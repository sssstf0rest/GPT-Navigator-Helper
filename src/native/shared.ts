export const CHANNEL = 'native-navigator-helper:v1';
export const MAX_MESSAGES = 10_000;
export type Boundary = 'unknown' | 'more' | 'complete';
export type HistoryIssue = 'http-error' | 'capture-unavailable' | 'unlinked' | 'stalled' | 'limit' | null;
export interface HistoryState {
  conversationId: string | null;
  generation: number;
  initialVersion: number;
  revision: number;
  pending: number;
  pages: number;
  messages: number;
  prompts: number;
  boundary: Boundary;
  cursor: string | null;
  issue: HistoryIssue;
  boosted: boolean;
}
export const emptyHistory = (conversationId: string | null, generation = 0): HistoryState => ({
  conversationId, generation, initialVersion: 0, revision: 0, pending: 0, pages: 0,
  messages: 0, prompts: 0, boundary: 'unknown', cursor: null, issue: null, boosted: false,
});
export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function identifier(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}
export function conversationIdFromUrl(input: string): string | null {
  try { return new URL(input).pathname.match(/(?:^|\/)c\/([A-Za-z0-9_-]{1,128})(?:\/|$)/)?.[1] ?? null; }
  catch { return null; }
}
export function isHistoryState(value: unknown): value is HistoryState {
  const s = record(value);
  if (!s || !(s.conversationId === null || identifier(s.conversationId)) || !(s.cursor === null || identifier(s.cursor))) return false;
  if (!['unknown', 'more', 'complete'].includes(String(s.boundary)) || typeof s.boosted !== 'boolean') return false;
  if (![null, 'http-error', 'capture-unavailable', 'unlinked', 'stalled', 'limit'].includes(s.issue as HistoryIssue)) return false;
  return ['generation', 'initialVersion', 'revision', 'pending', 'pages', 'messages', 'prompts'].every(key =>
    Number.isSafeInteger(s[key]) && (s[key] as number) >= 0 && (s[key] as number) <= 1_000_000);
}

export interface HistoryRequest { conversationId: string; kind: 'initial' | 'older'; before: string | null }
/** A strict same-origin GET allowlist, scoped to the currently open conversation. */
export function historyRequest(input: RequestInfo | URL, init: RequestInit | undefined, pageUrl: string): HistoryRequest | null {
  try {
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (method.toUpperCase() !== 'GET') return null;
    const url = new URL(input instanceof Request ? input.url : String(input), pageUrl);
    if (url.origin !== new URL(pageUrl).origin || url.origin !== 'https://chatgpt.com') return null;
    const match = url.pathname.match(/^\/backend-api\/conversations?\/([A-Za-z0-9_-]{1,128})(\/messages)?\/?$/);
    if (!match || match[1] !== conversationIdFromUrl(pageUrl)) return null;
    const before = identifier(url.searchParams.get('before'));
    // Other message queries may be forward pages or targeted windows, not an older-history chain.
    if (match[2] && !before) return null;
    if (!match[2] && ['before', 'after', 'message_id', 'include_message_id'].some(key => url.searchParams.has(key))) return null;
    return { conversationId: match[1]!, kind: match[2] ? 'older' : 'initial', before };
  } catch { return null; }
}

export function isMessageDeepLink(pageUrl: string): boolean {
  const query = new URL(pageUrl).searchParams;
  return ['message', 'messageId'].some(key => query.has(key));
}

/** Only optimize an unambiguous initial request; never speculative requests for another chat. */
export function canExpandInitial(input: RequestInfo | URL, init: RequestInit | undefined, pageUrl: string): boolean {
  const meta = historyRequest(input, init, pageUrl);
  if (meta?.kind !== 'initial' || isMessageDeepLink(pageUrl)) return false;
  const url = new URL(input instanceof Request ? input.url : String(input), pageUrl);
  return url.pathname.startsWith('/backend-api/conversations/');
}

/** Change only the page's own validated request; keep method, headers, credentials, and signal. */
export function expandHistoryRequest(input: RequestInfo | URL, init: RequestInit | undefined, pageUrl: string): [RequestInfo | URL, RequestInit?] {
  if (!historyRequest(input, init, pageUrl)) return [input, init];
  try {
    const url = new URL(input instanceof Request ? input.url : String(input), pageUrl);
    const current = Number(url.searchParams.get('num_turns'));
    // Do not reduce an already larger host request.
    if (Number.isFinite(current) && current >= 100) return [input, init];
    url.searchParams.set('num_turns', '100');
    return [input instanceof Request ? new Request(url, input) : url.href, init];
  } catch { return [input, init]; }
}
