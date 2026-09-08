import { CHANNEL, conversationIdFromUrl, emptyHistory, isHistoryState, record } from './shared';
import { prepareHistory } from './prepare';
import type { Outcome } from './prepare';
import { conversationScroller, delay, edgeIdentity, moveToHistoryEdge, nativeNavigation, restoreReadingPosition, saveReadingPosition } from './dom';
import { HelperUI } from './ui';

if (!document.getElementById('native-navigator-helper')) install();

function install(): void {
  let historyState = emptyHistory(conversationIdFromUrl(location.href));
  let connected = false;
  let controller: AbortController | null = null;
  let restoring: AbortController | null = null;
  let elapsed = 0;
  let refreshTimer = 0;
  const ui = new HelperUI(() => void start(), () => {
    controller?.abort('stop');
    if (restoring) { restoring.abort('user'); ui.setStatus('Stopped. You have control of the conversation.'); }
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
      ui.setStatus('Loads earlier messages, then returns you here. The conversation may move while preparing.');
      window.postMessage({ channel: CHANNEL, kind: 'hello' }, location.origin);
    }
    ui.mount();
    ui.update(historyState, nativeNavigation(), connected, Boolean(id && conversationScroller() && !oldNavigator()), elapsed);
    if (!controller && !restoring && oldNavigator()) ui.setStatus('Disable the previous Conversation Navigator extension before trying this helper.');
  }
  const schedule = () => { if (!refreshTimer) refreshTimer = window.setTimeout(refresh, 180); };
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = record(event.data);
    if (data?.channel !== CHANNEL || data.kind !== 'state' || !isHistoryState(data.state)) return;
    const state = data.state;
    if (state.conversationId !== conversationIdFromUrl(location.href) || state.generation < historyState.generation ||
      (state.generation === historyState.generation && state.revision < historyState.revision)) return;
    if ((controller || restoring) && (state.generation !== historyState.generation || state.initialVersion !== historyState.initialVersion)) cancel('changed');
    historyState = state; connected = true; schedule();
  });
  const interrupt = (event: Event) => {
    if (!controller && !restoring) return;
    if (event.composedPath().includes(ui.host)) return;
    if (event instanceof KeyboardEvent && !['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
    cancel('user');
  };
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(type, interrupt, { capture: true, passive: true });
  window.addEventListener('popstate', refresh);
  window.addEventListener('pagehide', () => { cancel('changed'); boost(false); });
  window.addEventListener('resize', schedule, { passive: true });
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true });
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  setInterval(refresh, 1_000); // Also catches routes when the MAIN hook is unavailable.
  window.postMessage({ channel: CHANNEL, kind: 'hello' }, location.origin);
  refresh();

  async function start(): Promise<void> {
    if (controller || restoring || !historyState.conversationId || oldNavigator()) return;
    const position = saveReadingPosition();
    if (!position) { ui.setStatus('Wait for conversation messages to appear, then try again.'); return; }
    const operation = new AbortController(); controller = operation;
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
      restoring = null; controller = null; ui.setBusy(false); ui.setPhase(outcome);
      const statuses: Record<Outcome | 'cancelled', string> = {
        ready: 'History loaded and native navigator visible. Use ChatGPT’s prompt markers on the right.',
        available: 'Native navigator visible. Full history could not be confirmed.',
        'loaded-no-native': 'History loaded, but no native navigator was detected. Try a wider window; availability may vary.',
        hidden: 'History loaded, but the native navigator is hidden. Try a wider window or lower browser zoom.',
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
