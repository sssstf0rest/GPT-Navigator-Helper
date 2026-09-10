import { CHANNEL, conversationIdFromUrl, emptyHistory, isHistoryState, isMessageDeepLink, record } from './shared';
import { delay, nativeNavigation } from './dom';
import { panelSnapshot, PANEL_CHANNEL } from './panelState';
import { RecoveryBudget, RECOVERY_IDLE_MS } from './recovery';
import { prepareSeamlessly, stableLayoutAvailable } from './seamless';

const scope = globalThis as typeof globalThis & { __nativeHelperContent?: boolean };
if (!scope.__nativeHelperContent) { scope.__nativeHelperContent = true; install(); }

function install(): void {
  let historyState = emptyHistory(conversationIdFromUrl(location.href));
  let connected = false;
  let controller: AbortController | null = null;
  let phase = 'waiting';
  let refreshTimer = 0;
  let autoTimer = 0;
  let attempted = '';
  let budget: RecoveryBudget | null = null;
  let recovering = false;
  let lastInteraction = performance.now();
  const currentHistory = () => historyState;
  const key = () => `${historyState.conversationId}:${historyState.generation}:${historyState.initialVersion}`;
  const oldNavigator = () => document.querySelector('[data-conversation-navigator]') !== null;
  const boost = (enabled: boolean) => window.postMessage({ channel: CHANNEL, kind: 'prepare', enabled,
    conversationId: historyState.conversationId, generation: historyState.generation }, location.origin);
  const cancel = (reason: string) => controller?.abort(reason);
  function refresh(): void {
    clearTimeout(refreshTimer); refreshTimer = 0;
    const id = conversationIdFromUrl(location.href);
    if (id !== historyState.conversationId) {
      cancel('changed'); historyState = emptyHistory(id, historyState.generation); connected = false; phase = 'waiting';
      window.postMessage({ channel: CHANNEL, kind: 'hello' }, location.origin);
    }
    // Native controls can mount after capture completes, or change visibility on resize.
    if (!controller && connected && ['ready', 'available', 'hidden', 'loaded-no-native'].includes(phase) && historyState.boundary === 'complete') {
      const native = nativeNavigation();
      phase = native.visible ? 'ready' : native.found ? 'hidden' : 'loaded-no-native';
    }
    if (!autoTimer && !controller && attempted !== key()) autoTimer = window.setTimeout(() => { autoTimer = 0; void startAutomatic(); }, 600);
  }
  const schedule = () => { if (!refreshTimer) refreshTimer = window.setTimeout(refresh, 180); };
  // The popup is read-only. Legacy manual/pause messages are not accepted.
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.url?.split('?')[0] !== chrome.runtime.getURL('src/popup/index.html')) return;
    const data = record(message);
    if (data?.channel !== PANEL_CHANNEL || data.command !== 'status') return;
    refresh();
    respond(panelSnapshot(historyState, nativeNavigation(), oldNavigator() ? 'conflict' : phase,
      document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark'));
  });
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = record(event.data);
    if (data?.channel !== CHANNEL || data.kind !== 'state' || !isHistoryState(data.state)) return;
    const state = data.state;
    if (state.conversationId !== conversationIdFromUrl(location.href) || state.generation < historyState.generation ||
      (state.generation === historyState.generation && state.revision < historyState.revision)) return;
    if (state.generation !== historyState.generation || state.initialVersion !== historyState.initialVersion) {
      cancel('changed'); recovering = false; phase = 'waiting';
    }
    historyState = state; connected = true; schedule();
  });
  const interrupt = () => { lastInteraction = performance.now(); cancel('user'); };
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(type, interrupt, { capture: true, passive: true });
  window.addEventListener('popstate', refresh);
  window.addEventListener('pagehide', () => { clearTimeout(autoTimer); autoTimer = 0; cancel('changed'); boost(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel('hidden'); schedule(); });
  window.addEventListener('resize', schedule, { passive: true });
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true });
  setInterval(refresh, 1_000);
  window.postMessage({ channel: CHANNEL, kind: 'hello' }, location.origin);
  refresh();

  async function startAutomatic(): Promise<void> {
    if (controller || !connected || !historyState.conversationId || !historyState.initialVersion || historyState.pending ||
      document.hidden || oldNavigator() || attempted === key() || performance.now() - lastInteraction < (recovering ? RECOVERY_IDLE_MS : 600)) return;
    if (isMessageDeepLink(location.href)) { attempted = key(); phase = 'deep-link'; return; }
    const native = nativeNavigation();
    if (native.visible) { attempted = key(); phase = historyState.boundary === 'complete' ? 'ready' : 'available'; return; }
    if (historyState.boundary === 'complete') { attempted = key(); phase = native.found ? 'hidden' : 'loaded-no-native'; return; }
    if (historyState.issue || historyState.boundary === 'unknown') { attempted = key(); phase = 'unverified'; return; }
    if (innerWidth < 1024 || !matchMedia('(hover: hover)').matches || !stableLayoutAvailable()) { phase = 'deferred'; return; }
    if (budget?.key !== key()) budget = new RecoveryBudget(key(), historyState.pages);
    const runBudget = budget;
    const limits = runBudget.remaining(historyState.pages);
    if (limits.duration <= 0 || limits.pages <= 0) { attempted = key(); phase = 'limit'; return; }
    recovering = false;
    const started = performance.now();
    const operation = new AbortController(); controller = operation;
    const operationKey = key(); attempted = operationKey; phase = 'automatic-loading';
    boost(true);
    const heartbeat = setInterval(() => { if (!operation.signal.aborted) boost(true); }, 4_000);
    let outcome = 'unverified';
    try {
      const until = performance.now() + 1_000;
      while (!historyState.boosted && performance.now() < until) await delay(40, operation.signal);
      outcome = await prepareSeamlessly(() => historyState, operation.signal, { ...limits, duration: Math.max(0, limits.duration - (performance.now() - started)) });
    } catch { outcome = 'cancelled'; }
    finally {
      runBudget.finish(performance.now() - started);
      clearInterval(heartbeat); boost(false); controller = null;
      if (key() === operationKey) {
        phase = outcome;
        if (operation.signal.reason === 'user' || operation.signal.reason === 'hidden') {
          const latest = currentHistory();
          if (latest.boundary === 'complete' && !latest.pending && !latest.issue) {
            phase = 'loaded-no-native';
          } else if (runBudget.recover(historyState.pages)) {
            attempted = ''; recovering = true; lastInteraction = performance.now(); phase = 'recovering';
          } else phase = 'recovery-limit';
        }
      }
      refresh();
    }
  }
}
