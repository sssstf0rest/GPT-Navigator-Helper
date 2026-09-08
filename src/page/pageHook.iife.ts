import { conversationIdFromUrl } from '../conversation/types';
import { mergeOlderPage, normalizePayload } from '../conversation/pagePayloadSource';
import { CHANNEL, isPageEvent } from './protocol';
import type { PageEvent } from './protocol';

const scope = window as Window & { __conversationNavigatorHookV1?: boolean };
if (!scope.__conversationNavigatorHookV1) {
  scope.__conversationNavigatorHookV1 = true;
  install();
}

function install(): void {
  let generation = 0;
  let sequence = 0;
  let conversationId = conversationIdFromUrl(location.href);
  let latest: PageEvent | undefined;
  let routeHref = location.href;
  let ready = false;
  const readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();
  const mergedCursors = new Set<string>();

  const send = (event: PageEvent) => { if (ready) window.postMessage(event, location.origin); };
  const routeEvent = (): PageEvent => ({ channel: CHANNEL, kind: 'route', generation, conversationId, sequence });
  const onRoute = () => {
    if (location.href === routeHref) return;
    routeHref = location.href;
    generation++;
    conversationId = conversationIdFromUrl(location.href);
    latest = undefined;
    mergedCursors.clear();
    for (const reader of readers) void reader.cancel().catch(() => {});
    send(routeEvent());
  };

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (...args: Parameters<History[typeof method]>) {
      const result = Reflect.apply(original, this, args);
      onRoute();
      return result;
    };
  }
  window.addEventListener('popstate', onRoute);
  window.addEventListener('pageshow', onRoute);
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== CHANNEL || event.data?.kind !== 'hello') return;
    ready = true;
    send(routeEvent());
    if (latest) send(latest);
  });

  const originalFetch = window.fetch;
  window.fetch = function (...args: Parameters<typeof fetch>) {
    onRoute();
    const requestGeneration = generation;
    let requestId: string | null = null;
    let before: string | null = null;
    try {
      const input = args[0];
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      const method = args[1]?.method ?? (input instanceof Request ? input.method : 'GET');
      const match = url.pathname.match(/^\/backend-api\/(?:conversation|conversations)\/([A-Za-z0-9_-]{1,128})(?:\/messages)?\/?$/);
      if (method.toUpperCase() === 'GET' && url.origin === location.origin && match?.[1] === conversationId) { requestId = match[1]; before = url.searchParams.get('before'); }
    } catch { /* Host fetch still receives the original arguments. */ }
    const requestSequence = requestId ? ++sequence : 0;
    const result = Reflect.apply(originalFetch, this, args) as Promise<Response>;
    if (requestId) {
      const id = requestId;
      void result.then(async (response) => {
        if (requestGeneration !== generation || !response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
        if (readers.size >= 2) return;
        const size = Number(response.headers.get('content-length'));
        if (size > 16_000_000) return;
        const clone = response.clone();
        const reader = clone.body?.getReader();
        if (!reader) return;
        readers.add(reader);
        const timer = setTimeout(() => { void reader.cancel().catch(() => {}); }, 8_000);
        try {
          const decoder = new TextDecoder();
          let text = '';
          let bytes = 0;
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 16_000_000 || requestGeneration !== generation) {
              void reader.cancel().catch(() => {});
              return;
            }
            text += decoder.decode(chunk.value, { stream: true });
          }
          text += decoder.decode();
          let snapshot = normalizePayload(JSON.parse(text), id);
          if (!snapshot || requestGeneration !== generation || conversationId !== id) return;
          if (latest && latest.sequence > requestSequence) return;
          if (before && (mergedCursors.has(before) || mergedCursors.size >= 500)) return;
          if (before) snapshot = mergeOlderPage(latest?.snapshot, snapshot, before);
          if (!snapshot) return;
          const event: PageEvent = { channel: CHANNEL, kind: 'snapshot', generation, conversationId: id, sequence: requestSequence, snapshot };
          if (!isPageEvent(event)) return;
          if (before) mergedCursors.add(before); else mergedCursors.clear();
          latest = event;
          send(latest);
        } catch {
          if (requestGeneration === generation) send({ ...routeEvent(), kind: 'capture-error', reason: 'History capture was incomplete. The page remains available.' });
        } finally { clearTimeout(timer); readers.delete(reader); reader.releaseLock(); }
      }).catch(() => {});
    }
    return result;
  };
}
