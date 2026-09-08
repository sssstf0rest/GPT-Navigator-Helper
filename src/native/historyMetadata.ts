import { identifier, MAX_MESSAGES, record } from './shared';
import type { Boundary } from './shared';

export interface HistoryPage {
  messages: { id: string; user: boolean }[];
  boundary: Boundary;
  cursor: string | null;
  branch: string | null;
}
/** Retain identities and counts only. Prompt/answer text never crosses the bridge. */
export function historyMetadata(value: unknown, requestId: string): HistoryPage | null {
  const outer = record(value);
  const data = record(outer?.conversation) ?? outer;
  if (!data) return null;
  const id = identifier(data.conversation_id) ?? identifier(data.id);
  if (id && id !== requestId) return null;
  const branch = identifier(data.current_node) ?? identifier(data.current_node_id);
  const messages: HistoryPage['messages'] = [];
  const seen = new Set<string>();
  const add = (value: unknown, unique = false): boolean => {
    const m = record(value); const id = identifier(m?.id); const role = record(m?.author)?.role;
    if (!m || !id || !['user', 'assistant', 'system', 'tool'].includes(String(role))) return false;
    if (unique && seen.has(id)) return false;
    if (!seen.has(id)) {
      seen.add(id);
      messages.push({ id, user: role === 'user' && record(m.metadata)?.is_visually_hidden_from_conversation !== true });
    }
    return true;
  };
  if (Array.isArray(data.messages)) {
    if (data.messages.length > MAX_MESSAGES) return null;
    let valid = true;
    for (const message of data.messages) if (!add(message)) valid = false;
    const page = record(data.page_info) ?? record(data.pageInfo);
    const hasPrevious = page?.has_previous_page ?? page?.hasPreviousPage;
    const cursor = identifier(page?.start_cursor) ?? identifier(page?.startCursor);
    return { messages, branch, cursor,
      boundary: !valid ? 'unknown' : hasPrevious === false ? 'complete' : hasPrevious === true && cursor ? 'more' : 'unknown' };
  }
  const mapping = record(data.mapping);
  if (!mapping || !branch || Object.keys(mapping).length > MAX_MESSAGES) return null;
  let cursor: string | null = branch;
  let complete = false;
  const nodes = new Set<string>();
  while (cursor && nodes.size < MAX_MESSAGES) {
    const node = record(mapping[cursor]);
    if (!node || nodes.has(cursor)) break;
    nodes.add(cursor);
    if (node.message != null && !add(node.message, true)) break;
    if (node.parent === null || node.parent === '') { complete = true; break; }
    cursor = identifier(node.parent);
  }
  return { messages, branch, cursor: null, boundary: complete ? 'complete' : 'unknown' };
}

export class HistoryChain {
  readonly ids = new Map<string, boolean>();
  private cursors = new Set<string>();
  private branch: string | null = null;
  boundary: Boundary = 'unknown';
  cursor: string | null = null;
  pages = 0;
  issue: 'unlinked' | 'stalled' | 'limit' | null = null;

  accept(page: HistoryPage, before: string | null): void {
    if (before === null) {
      this.ids.clear(); this.cursors.clear(); this.pages = 0; this.branch = page.branch;
      this.boundary = 'unknown'; this.cursor = null; this.issue = null;
    } else if (this.pages === 0 || this.boundary !== 'more' || this.cursor !== before ||
      (page.branch && this.branch && page.branch !== this.branch)) {
      this.boundary = 'unknown'; this.issue = 'unlinked'; return;
    }
    const priorSize = this.ids.size;
    for (const m of page.messages) {
      if (this.ids.size >= MAX_MESSAGES && !this.ids.has(m.id)) { this.issue = 'limit'; this.boundary = 'unknown'; return; }
      this.ids.set(m.id, m.user);
    }
    this.pages++;
    if (before && page.boundary !== 'complete' && (this.ids.size === priorSize || !page.cursor || page.cursor === before || this.cursors.has(page.cursor))) {
      // The previously verified chain still has earlier history. Keep that cursor
      // so a later manual retry can recover from a transient repeated/empty page.
      this.issue = 'stalled'; return;
    }
    if (before) this.cursors.add(before);
    this.boundary = page.boundary;
    this.cursor = page.cursor;
    this.issue = null;
  }
}
