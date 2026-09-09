import { CHANNEL, conversationIdFromUrl, emptyHistory, isHistoryState, isMessageDeepLink, record } from './shared';
import { prepareHistory } from './prepare';
import type { Outcome } from './prepare';
import { conversationScroller, delay, edgeIdentity, moveToHistoryEdge, nativeNavigation, restoreReadingPosition, saveReadingPosition } from './dom';
import { HelperUI } from './ui';
import { prepareSeamlessly, stableLayoutAvailable } from './seamless';
import type { SeamlessOutcome } from './seamless';

if (!document.getElementById('native-navigator-helper')) install();

function install(): void {
  let historyState = emptyHistory(conversationIdFromUrl(location.href));
  let connected = false;
  let controller: AbortController | null = null;
  let restoring: AbortController | null = null;
  let elapsed = 0;
  let refreshTimer = 0;
  let autoTimer = 0;
  let automatic = true;
  let mode: 'automatic' | 'manual' | null = null;
  let attempted = '';
  let lastInteraction = performance.now();
  const key = () => `${historyState.conversationId}:${historyState.generation}:${historyState.initialVersion}`;
  const ui = new HelperUI(() => void start(), () => {
    controller?.abort('stop');
    if (restoring) { restoring.abort('user'); ui.setStatus('Stopped. You have control of the conversation.'); }
  }, () => {
    automatic = !automatic;
    // A tab preference must take effect before a same-task SPA request can be issued.
    document.documentElement.dataset.nativeHelperAutomatic = automatic ? 'on' : 'off';
    window.postMessage({ channel: CHANNEL, kind: 'automatic', enabled: automatic,
      conversationId: historyState.conversationId, generation: historyState.generation }, location.origin);
    if (!automatic && mode === 'automatic') controller?.abort('paused');
    if (automatic) attempted = '';
    ui.setAutomatic(automatic);
    if (!controller) { ui.setPhase(automatic ? 'waiting' : 'paused'); ui.setStatus(automatic ? 'Automatic preparation is enabled for this tab.' : 'Automatic preparation is paused in this tab until resumed or reloaded.'); }
    schedule();
  });
  const oldNavigator = () => document.querySelector('[data-conversation-navigator]') !== null;
  const observe = () => ({ history: historyState, native: nativeNavigation(), edge: edgeIdentity(), height: conversationScroller()?.scrollHeight ?? 0 });
  const boost = (enabled: boolean) => window.postMessage({ channel: CHANNEL, kind: 'prepare', enabled,
    conversationId: historyState.conversationId, generation: historyState.generation }, location.origin);
  const cancel = (reason: string) => { controller?.abort(reason); restoring?.abort(reason); };
  function refresh(): void {
    refreshTimer = 0;
    const id = conversationIdFromUrl(location.href);
    if (id !== historyState.conversationId) {
      cancel('changed'); historyState = emptyHistory(id, historyState.generation); connected = false; elapsed = 0;
      ui.setPhase(automatic ? 'waiting' : 'paused');
      ui.setStatus(automatic ? 'Checking this conversation for native navigation.' : 'Automatic preparation is paused in this tab until resumed or reloaded.');
      window.postMessage({ channel: CHANNEL, kind: 'hello' }, location.origin);
    }
    ui.mount();
    const native = nativeNavigation();
    // Native controls can mount after capture completes, or become visible after a resize.
    if (!controller && !restoring && connected && ['ready', 'available', 'hidden', 'loaded-no-native'].includes(ui.host.dataset.phase ?? '')) {
      if (historyState.boundary === 'complete') {
        const outcome = native.visible ? 'ready' : native.found ? 'hidden' : 'loaded-no-native';
        ui.setPhase(outcome); ui.setStatus(completeStatus(outcome));
      }
    }
    ui.update(historyState, native, connected, Boolean(id && conversationScroller() && !oldNavigator()), elapsed);
    if (!controller && !restoring && oldNavigator()) ui.setStatus('Disable the previous Conversation Navigator extension before trying this helper.');
    if (!autoTimer && !controller && !restoring && automatic && attempted !== key()) autoTimer = window.setTimeout(() => { autoTimer = 0; void startAutomatic(); }, 600);
  }
  const schedule = () => { if (!refreshTimer) refreshTimer = window.setTimeout(refresh, 180); };
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = record(event.data);
    if (data?.channel !== CHANNEL || data.kind !== 'state' || !isHistoryState(data.state)) return;
    const state = data.state;
    if (state.conversationId !== conversationIdFromUrl(location.href) || state.generation < historyState.generation ||
      (state.generation === historyState.generation && state.revision < historyState.revision)) return;
    if (state.generation !== historyState.generation || state.initialVersion !== historyState.initialVersion) {
      cancel('changed'); elapsed = 0;
      ui.setPhase(automatic ? 'waiting' : 'paused');
      ui.setStatus(automatic ? 'Checking this conversation for native navigation.' : 'Automatic preparation is paused in this tab until resumed or reloaded.');
    }
    historyState = state; connected = true; schedule();
  });
  const interrupt = (event: Event) => {
    if (event.composedPath().includes(ui.host)) return;
    lastInteraction = performance.now();
    if (!controller && !restoring) return;
    if (mode !== 'automatic' && event instanceof KeyboardEvent && !['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
    cancel('user');
  };
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(type, interrupt, { capture: true, passive: true });
  window.addEventListener('popstate', refresh);
  window.addEventListener('pagehide', () => { clearTimeout(autoTimer); autoTimer = 0; cancel('changed'); boost(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel('hidden'); schedule(); });
  window.addEventListener('resize', schedule, { passive: true });
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true });
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  setInterval(refresh, 1_000); // Also catches routes when the MAIN hook is unavailable.
  window.postMessage({ channel: CHANNEL, kind: 'hello' }, location.origin);
  refresh();

  function completeStatus(outcome: Outcome): string {
    if (outcome === 'ready') return 'History loaded and native navigator visible. Use ChatGPT’s prompt markers on the right.';
    if (outcome === 'hidden') return 'History loaded, but the native navigator is hidden by the current layout.';
    if (outcome === 'loaded-no-native' && historyState.prompts < 5) return `${historyState.prompts} prompts captured. ChatGPT’s current native navigator requires at least 5 user turns.`;
    return 'History loaded, but no native navigator was detected. Other ChatGPT display conditions may apply.';
  }

  async function startAutomatic(): Promise<void> {
    if (!automatic || controller || restoring || !connected || !historyState.conversationId || !historyState.initialVersion ||
      historyState.pending || document.hidden || oldNavigator() || attempted === key() || performance.now() - lastInteraction < 600) return;
    if (isMessageDeepLink(location.href)) { attempted = key(); ui.setPhase('deferred'); ui.setStatus('Automatic preparation skipped to preserve this message link. Manual preparation is available.'); return; }
    const native = nativeNavigation();
    if (native.visible) {
      attempted = key(); const outcome = historyState.boundary === 'complete' ? 'ready' : 'available';
      ui.setPhase(outcome); ui.setStatus(outcome === 'ready' ? completeStatus(outcome) : 'Native navigator visible. Full history could not be confirmed.'); return;
    }
    if (historyState.boundary === 'complete') {
      attempted = key(); const outcome = native.found ? 'hidden' : 'loaded-no-native';
      ui.setPhase(outcome); ui.setStatus(completeStatus(outcome)); return;
    }
    if (historyState.issue || historyState.boundary === 'unknown') {
      attempted = key(); ui.setPhase('unverified'); ui.setStatus('Automatic preparation stopped: history could not be verified. Manual preparation is available.'); return;
    }
    if (innerWidth < 1024 || !matchMedia('(hover: hover)').matches || !stableLayoutAvailable()) {
      ui.setPhase('deferred'); ui.setStatus('Automatic preparation is waiting for a supported, stable desktop layout.'); return;
    }
    const operation = new AbortController(); controller = operation; mode = 'automatic';
    const operationKey = key(); attempted = operationKey;
    elapsed = 0; ui.setBusy(true, 'automatic'); ui.setPhase('automatic-loading');
    ui.setStatus('Preparing in place. Scroll, type, or press Stop to end automatic preparation.');
    boost(true);
    const heartbeat = setInterval(() => { if (!operation.signal.aborted) boost(true); }, 4_000);
    let outcome: SeamlessOutcome | 'cancelled' = 'unverified';
    try {
      const until = performance.now() + 1_000;
      while (!historyState.boosted && performance.now() < until) await delay(40, operation.signal);
      outcome = await prepareSeamlessly(() => historyState, operation.signal, progress => { elapsed = progress.elapsed; schedule(); });
    } catch { outcome = 'cancelled'; }
    finally {
      clearInterval(heartbeat); boost(false); controller = null; mode = null; ui.setBusy(false);
      if (key() === operationKey) {
        const statuses: Partial<Record<SeamlessOutcome | 'cancelled', string>> = {
          incompatible: 'Automatic preparation stopped: this layout cannot load history in place. Manual preparation is available.',
          'layout-changed': 'Automatic preparation stopped because the reading layout changed. Manual preparation is available.',
          stalled: 'Automatic preparation stopped: history did not advance. Manual preparation is available.',
          'network-error': 'Automatic preparation stopped: ChatGPT’s history request failed. Manual preparation is available.',
          unverified: 'Automatic preparation stopped: continuous history could not be verified. Manual preparation is available.',
          limit: 'Automatic preparation reached its time or page limit. Manual preparation is available.',
          cancelled: 'Automatic preparation stopped. You have control of the conversation.',
          changed: 'Automatic preparation stopped because the conversation or tab changed.',
        };
        ui.setPhase(!automatic ? 'paused' : outcome);
        ui.setStatus(!automatic ? 'Automatic preparation is paused in this tab until resumed or reloaded.' : statuses[outcome] ?? completeStatus(outcome as Outcome));
        if (operation.signal.reason === 'hidden') attempted = ''; // Recheck on foregrounding, never while hidden.
      }
      refresh();
    }
  }

  async function start(): Promise<void> {
    if (controller || restoring || !historyState.conversationId || oldNavigator()) return;
    const position = saveReadingPosition();
    if (!position) { ui.setStatus('Wait for conversation messages to appear, then try again.'); return; }
    const operation = new AbortController(); controller = operation; mode = 'manual'; attempted = key();
    const id = historyState.conversationId;
    const version = historyState.initialVersion;
    let outcome: Outcome | 'cancelled' = 'unverified'; let restore = true;
    elapsed = 0; ui.setBusy(true); ui.setPhase('loading');
    ui.setStatus('Loading earlier messages. Scroll or click in the page to stop.');
    boost(true);
    const heartbeat = setInterval(() => { if (!operation.signal.aborted) boost(true); }, 4_000);
    try {
      // postMessage is asynchronous. Wait for the page hook to acknowledge expansion
      // before the first scroll can trigger a host request. DOM-only loading still works without it.
      const acknowledgementDeadline = performance.now() + 1_000;
      while (!historyState.boosted && performance.now() < acknowledgementDeadline) await delay(40, operation.signal);
      outcome = await prepareHistory({ observe, goToHistoryEdge: moveToHistoryEdge, wait: delay, now: () => performance.now() }, operation.signal, progress => {
        elapsed = progress.elapsed;
        if (progress.phase === 'waiting-native') ui.setStatus('History loaded. Waiting for the native navigator…');
        schedule();
      });
      if (outcome === 'changed') restore = false;
    } catch {
      outcome = 'cancelled';
      restore = operation.signal.reason === 'stop';
    } finally {
      clearInterval(heartbeat); boost(false);
      // Keep operation live for interruption during restoration, but use a fresh signal for Stop and return.
      let restored = true;
      if (restore && id === conversationIdFromUrl(location.href) && version === historyState.initialVersion) {
        restoring = new AbortController();
        ui.setPhase('returning'); ui.setStatus('Returning to your reading position…');
        try { restored = await restoreReadingPosition(position, restoring.signal); }
        catch { restore = false; outcome = 'cancelled'; }
      }
      const finalNative = nativeNavigation();
      if (outcome === 'ready' && !finalNative.visible) outcome = finalNative.found ? 'hidden' : 'loaded-no-native';
      if (outcome === 'available' && !finalNative.visible) outcome = 'unverified';
      restoring = null; controller = null; mode = null; ui.setBusy(false); ui.setPhase(outcome);
      const statuses: Record<Outcome | 'cancelled', string> = {
        ready: completeStatus('ready'),
        available: 'Native navigator visible. Full history could not be confirmed.',
        'loaded-no-native': completeStatus('loaded-no-native'),
        hidden: completeStatus('hidden'),
        stalled: 'Stopped: ChatGPT did not make further loading progress. You can retry or load older history manually.',
        'network-error': 'Stopped: ChatGPT’s history request failed. Retry once the page can load history again.',
        unverified: 'Stopped: continuous history or native navigation availability could not be confirmed. Reload the conversation and try again.',
        limit: 'Preparation limit reached. Some history may remain; you can run it again.',
        changed: 'Conversation changed. Preparation stopped.',
        unsupported: 'The conversation scroll area could not be found.',
        cancelled: restore && restored ? 'Preparation stopped. Returned to your reading position.' : 'Preparation stopped. You have control of the conversation.',
      };
      ui.setStatus(statuses[outcome] + (restore && !restored ? ' The original reading position could not be restored exactly.' : ''));
      refresh();
    }
  }
}
