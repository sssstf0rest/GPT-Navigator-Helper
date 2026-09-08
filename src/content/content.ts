import { ConversationIndex } from '../conversation/conversationIndex';
import { conversationIdFromUrl } from '../conversation/types';
import type { PromptRecord } from '../conversation/types';
import { CHANNEL, isPageEvent } from '../page/protocol';
import { DomRegistry } from '../navigation/domRegistry';
import { JumpEngine } from '../navigation/jumpEngine';
import type { JumpResult } from '../navigation/jumpEngine';
import { findScrollContainer, viewport } from '../navigation/scrollContainer';
import { Navigator } from '../ui/Navigator';

const scope = globalThis as typeof globalThis & { __conversationNavigatorDispose?: () => void };
scope.__conversationNavigatorDispose?.();
scope.__conversationNavigatorDispose = start();
if (import.meta.hot) import.meta.hot.dispose(() => scope.__conversationNavigatorDispose?.());

function start(): () => void {
  const lifetime = new AbortController();
  const registry = new DomRegistry();
  const engine = new JumpEngine(registry);
  let routeId = conversationIdFromUrl(location.href);
  let index = new ConversationIndex(routeId ?? 'new-chat');
  let generation = -1;
  let acceptedSequence = -1;
  let revision = 0;
  let activeId: string | null = null;
  let frame = 0;
  let observerRoot: HTMLElement | null = null;
  let jumpId = 0;
  let jumping = false;
  let lastJump: JumpResult | null = null;
  let bridgeReady = false;
  const quarantined = new Map<HTMLElement, string>();
  const ui = new Navigator((prompt) => { void jump(prompt); });
  const observer = new MutationObserver(schedule);
  const mountObserver = new MutationObserver(() => {
    if (!registry.root?.isConnected || !ui.host.isConnected) schedule();
  });
  const themeObserver = new MutationObserver(schedule);

  function reset(id: string | null): void {
    engine.cancel(); jumpId++; revision++; jumping = false;
    for (const entry of registry.entries) quarantined.set(entry.element, entry.aliases.join('|'));
    routeId = id; index = new ConversationIndex(id ?? 'new-chat'); activeId = null; lastJump = null;
    acceptedSequence = -1;
    ui.setStatus('History stays in this tab.');
  }

  function schedule(): void { if (!frame && !lifetime.signal.aborted) frame = requestAnimationFrame(refresh); }

  function refresh(): void {
    frame = 0;
    if (lifetime.signal.aborted) return;
    const actualId = conversationIdFromUrl(location.href);
    if (actualId !== routeId) reset(actualId);
    registry.scan();
    if (registry.root !== observerRoot) {
      observer.disconnect(); observerRoot = registry.root;
      if (observerRoot) observer.observe(observerRoot, { subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ['data-message-id', 'data-message-author-role', 'data-turn-id', 'data-turn-id-container'] });
    }
    for (const [element] of quarantined) if (!element.isConnected) quarantined.delete(element);
    const observations = registry.entries.filter((entry) => quarantined.get(entry.element) !== entry.aliases.join('|'));
    index.observe(observations.map((entry) => entry.turn));
    if (!jumping) updateActive();
    ui.mount();
    ui.render(index, activeId, {
      pageHookConnected: bridgeReady, source: index.snapshot.source, coverage: index.snapshot.coverage,
      history: index.snapshot.reason, prompts: index.prompts.length, mountedTurns: registry.entries.length,
      identifiedTurns: registry.entries.filter((entry) => entry.turn.identity === 'stable').length,
      conversationRoute: routeId !== null, lastJump,
    });
  }

  function updateActive(): void {
    const anchor = registry.entries[0]?.element;
    if (!anchor) { activeId = null; return; }
    const container = findScrollContainer(anchor);
    const bounds = viewport(container);
    let order = -1;
    for (const entry of registry.entries) {
      const rect = entry.element.getBoundingClientRect();
      if (rect.bottom < bounds.top || rect.top > bounds.bottom) continue;
      const candidate = index.snapshot.turns.findIndex((turn) => registry.matches(entry, turn));
      if (candidate >= 0) { order = candidate; break; }
    }
    activeId = index.prompts.filter((prompt) => prompt.timelineIndex <= order).at(-1)?.messageId ?? null;
  }

  async function jump(prompt: PromptRecord): Promise<void> {
    const operation = ++jumpId;
    const capturedRevision = revision;
    const capturedIndex = index;
    jumping = true;
    ui.setStatus(`Finding prompt ${prompt.userOrder}…`);
    const current = () => !lifetime.signal.aborted && operation === jumpId && capturedRevision === revision && conversationIdFromUrl(location.href) === routeId;
    const result = await engine.jump(prompt, capturedIndex, current);
    if (operation !== jumpId || capturedRevision !== revision || lifetime.signal.aborted) return;
    jumping = false; lastJump = result;
    const messages: Record<JumpResult['status'], string> = {
      success: `Prompt ${prompt.userOrder} is in view.`, cancelled: 'Navigation cancelled.',
      ambiguous: 'Several matches found. No exact jump was confirmed.',
      'source-incomplete': 'More history is needed to locate this prompt.',
      'not-reachable': 'This prompt could not be brought into view.',
      unsupported: 'The conversation scroll area is unavailable.', 'timed-out': 'Navigation timed out. You can try again.',
    };
    if (result.status === 'success') activeId = prompt.messageId;
    ui.setStatus(messages[result.status]);
    schedule();
  }

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || event.origin !== location.origin || !isPageEvent(event.data)) return;
    const data = event.data;
    if (data.conversationId !== conversationIdFromUrl(location.href) || data.generation < generation) return;
    bridgeReady = true;
    if (data.generation > generation || data.conversationId !== routeId) {
      reset(data.conversationId); generation = data.generation;
    }
    if (data.kind === 'snapshot' && data.snapshot && data.sequence > acceptedSequence) {
      engine.cancel(); jumpId++; revision++; jumping = false;
      index.replace(data.snapshot); acceptedSequence = data.sequence; activeId = null;
    } else if (data.kind === 'capture-error') ui.setStatus(data.reason ?? 'History capture was incomplete.');
    schedule();
  }, { signal: lifetime.signal });
  window.addEventListener('scroll', schedule, { capture: true, passive: true, signal: lifetime.signal });
  window.addEventListener('resize', schedule, { passive: true, signal: lifetime.signal });
  window.addEventListener('popstate', schedule, { signal: lifetime.signal });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
  mountObserver.observe(document.body, { childList: true, subtree: true });
  ui.setStatus('History stays in this tab.');
  window.postMessage({ channel: CHANNEL, kind: 'hello' }, location.origin);
  schedule();
  return () => {
    lifetime.abort(); engine.cancel(); cancelAnimationFrame(frame);
    observer.disconnect(); mountObserver.disconnect(); themeObserver.disconnect(); ui.destroy();
  };
}
