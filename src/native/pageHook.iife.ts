import { CHANNEL, canExpandInitial, conversationIdFromUrl, emptyHistory, expandHistoryRequest, historyRequest, record } from './shared';
import type { HistoryState } from './shared';
import { HistoryChain, historyMetadata } from './historyMetadata';

const scope = window as Window & { __nativeNavigatorHelperV1?: boolean };
if (!scope.__nativeNavigatorHelperV1) { scope.__nativeNavigatorHelperV1 = true; install(); }

function install(): void {
  let state = emptyHistory(conversationIdFromUrl(location.href));
  let chain = new HistoryChain();
  let active = false;
  let boostUntil = 0;
  let latestRequest = 0;
  const readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();
  const originalFetch = window.fetch;
  const send = () => {
    state.revision++;
    window.postMessage({ channel: CHANNEL, kind: 'state', state: { ...state } }, location.origin);
  };
  const route = () => {
    const id = conversationIdFromUrl(location.href);
    if (id === state.conversationId) return;
    const generation = state.generation + 1;
    for (const reader of readers) void reader.cancel().catch(() => {});
    state = emptyHistory(id, generation); chain = new HistoryChain(); active = false; boostUntil = 0;
    send();
  };
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (...args) { const result = original.apply(this, args); route(); return result; };
  }
  window.addEventListener('popstate', route);
  window.addEventListener('pageshow', route);
  window.addEventListener('pagehide', () => { active = false; boostUntil = 0; state.boosted = false; });
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = record(event.data);
    if (data?.channel !== CHANNEL) return;
    route();
    if (data.kind === 'hello') send();
    if (data.kind !== 'prepare' || data.conversationId !== state.conversationId || data.generation !== state.generation || typeof data.enabled !== 'boolean') return;
    if (data.enabled && !active && ['http-error', 'capture-unavailable', 'stalled'].includes(state.issue ?? '')) {
      state.issue = null;
      if (chain.issue === 'stalled') chain.issue = null;
    }
    active = data.enabled;
    // A lost content script cannot leave request expansion enabled indefinitely.
    boostUntil = active ? Date.now() + 10_000 : 0;
    state.boosted = active;
    send();
  });

  window.fetch = function (input, init) {
    route();
    const meta = historyRequest(input, init, location.href);
    if (!meta) return originalFetch.call(this, input, init);
    if (Date.now() > boostUntil) { active = false; state.boosted = false; }
    const early = document.visibilityState === 'visible' && canExpandInitial(input, init, location.href);
    const args = active || early ? expandHistoryRequest(input, init, location.href) : [input, init] as const;
    const generation = state.generation;
    if (meta.kind === 'initial') {
      state.initialVersion++; state.pending = 0; state.pages = 0; state.messages = 0; state.prompts = 0;
      state.boundary = 'unknown'; state.cursor = null; state.issue = null; chain = new HistoryChain();
    }
    const initialVersion = state.initialVersion;
    const request = ++latestRequest;
    const valid = () => state.generation === generation && state.initialVersion === initialVersion && state.conversationId === meta.conversationId;
    state.pending++; send();
    let promise: Promise<Response>;
    try { promise = originalFetch.call(this, ...args); }
    catch (error) { if (valid()) { state.pending = Math.max(0, state.pending - 1); state.issue = 'http-error'; send(); } throw error; }
    void promise.then(async response => {
      if (!valid()) return;
      if (!response.ok) { state.issue = 'http-error'; return; }
      try {
        const value = await readJson(response);
        if (!valid()) return;
        // Concurrent, out-of-order pagination is not enough evidence of one contiguous history.
        if (request !== latestRequest) { state.issue = 'unlinked'; state.boundary = 'unknown'; return; }
        const page = historyMetadata(value, meta.conversationId);
        if (!page) { state.issue = 'capture-unavailable'; return; }
        chain.accept(page, meta.before);
        const summary: Pick<HistoryState, 'pages' | 'messages' | 'prompts' | 'boundary' | 'cursor' | 'issue'> = {
          pages: chain.pages, messages: chain.ids.size, prompts: Array.from(chain.ids.values()).filter(Boolean).length,
          boundary: chain.boundary, cursor: chain.cursor, issue: chain.issue,
        };
        Object.assign(state, summary);
      } catch { if (valid()) state.issue = 'capture-unavailable'; }
    }, () => { if (valid()) state.issue = 'http-error'; }).finally(() => {
      if (valid()) { state.pending = Math.max(0, state.pending - 1); send(); }
    }).catch(() => {});
    // Preserve the exact original promise/response for ChatGPT. Only its clone is inspected.
    return promise;
  };

  async function readJson(response: Response): Promise<unknown> {
    if (!response.headers.get('content-type')?.includes('application/json') || readers.size >= 2) throw new Error('Unsupported capture');
    const limit = 16 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit) throw new Error('Capture limit');
    const reader = response.clone().body?.getReader();
    if (!reader) throw new Error('No body');
    readers.add(reader);
    let bytes = 0; let timedOut = false;
    const chunks: Uint8Array[] = [];
    const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 8_000);
    try {
      while (true) {
        const result = await reader.read();
        if (timedOut) throw new Error('Capture timeout');
        if (result.done) break;
        bytes += result.value.length;
        if (bytes > limit) throw new Error('Capture limit');
        chunks.push(result.value);
      }
      const buffer = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
      return JSON.parse(new TextDecoder().decode(buffer));
    } finally { clearTimeout(timer); readers.delete(reader); void reader.cancel().catch(() => {}); }
  }
}
