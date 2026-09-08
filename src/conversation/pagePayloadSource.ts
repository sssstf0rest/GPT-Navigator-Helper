import { identifier, record } from './types';
import type { ConversationSnapshot, Role, Turn } from './types';

export const MAX_TURNS = 10_000;
export const MAX_TEXT = 20_000;
const roles = new Set(['user', 'assistant', 'tool', 'system']);

function textOf(message: Record<string, unknown>): string {
  const content = record(message.content);
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const text = parts.filter((part): part is string => typeof part === 'string').join('\n').trim();
  if (text) return text.slice(0, MAX_TEXT);
  if (typeof content?.text === 'string') return content.text.slice(0, MAX_TEXT);
  const attachments = record(message.metadata)?.attachments;
  if (Array.isArray(attachments) && attachments.length) {
    return attachments.slice(0, 8).map((item) => {
      const name = record(item)?.name;
      return typeof name === 'string' ? `[File: ${name.slice(0, 200)}]` : '[File]';
    }).join(' ');
  }
  if (parts.some((part) => record(part)?.content_type === 'image_asset_pointer')) return '[Image prompt]';
  if (typeof content?.content_type === 'string' && /audio/.test(content.content_type)) return '[Audio prompt]';
  return '[Non-text prompt]';
}

function turnOf(value: unknown, nodeId?: string, parentId: string | null = null): Turn | null {
  const message = record(value);
  const id = identifier(message?.id);
  const role = record(message?.author)?.role;
  if (!message || !id || typeof role !== 'string' || !roles.has(role)) return null;
  return {
    messageId: id, nodeId: nodeId ?? id, parentId, role: role as Role,
    text: role === 'user' ? textOf(message) : '',
    hidden: record(message.metadata)?.is_visually_hidden_from_conversation === true,
  };
}

/** Parse only known payload shapes. Request identity is evidence, never a global cache fallback. */
export function normalizePayload(value: unknown, requestId: string): ConversationSnapshot | null {
  const outer = record(value);
  const data = record(outer?.conversation) ?? outer;
  if (!data) return null;
  const payloadId = identifier(data.conversation_id) ?? identifier(data.id);
  if (payloadId && payloadId !== requestId) return null;
  const branchId = identifier(data.current_node) ?? identifier(data.current_node_id);
  const mapping = record(data.mapping);
  if (mapping) {
    if (Object.keys(mapping).length > MAX_TURNS) return null;
    if (!branchId) return {
      conversationId: requestId, branchId: null, turns: [], coverage: 'unknown',
      source: 'graph', reason: 'The selected conversation branch is unavailable.',
    };
    const seen = new Set<string>();
    const turns: Turn[] = [];
    const messageIds = new Set<string>();
    let cursor: string | null = branchId;
    let complete = true;
    while (cursor) {
      const node = record(mapping[cursor]);
      if (!node || seen.has(cursor)) { complete = false; break; }
      seen.add(cursor);
      const parent = node.parent === null || node.parent === '' ? null : identifier(node.parent);
      if (node.parent !== null && node.parent !== '' && !parent) complete = false;
      if (node.message !== null && node.message !== undefined) {
        const turn = turnOf(node.message, cursor, parent);
        if (!turn || messageIds.has(turn.messageId)) { complete = false; }
        else { turns.push(turn); messageIds.add(turn.messageId); }
      }
      cursor = parent;
    }
    return {
      conversationId: requestId, branchId, turns: turns.reverse(), source: 'graph',
      coverage: complete ? 'complete' : 'partial',
      reason: complete ? 'All prompts on the captured selected branch.' : 'Some earlier history or branch links are missing.',
    };
  }
  if (!Array.isArray(data.messages) || data.messages.length > MAX_TURNS) return null;
  const turns: Turn[] = [];
  const seen = new Set<string>();
  for (const message of data.messages) {
    const turn = turnOf(message);
    if (turn && !seen.has(turn.messageId)) { turns.push(turn); seen.add(turn.messageId); }
  }
  return {
    conversationId: requestId, branchId, turns, coverage: 'partial', source: 'flat',
    previousCursor: previousCursor(data),
    reason: 'Observed history. Full coverage and branch selection are not yet verified.',
  };
}

function previousCursor(data: Record<string, unknown>): string | null {
  const page = record(data.page_info) ?? record(data.pageInfo);
  return page?.has_previous_page === true || page?.hasPreviousPage === true
    ? identifier(page.start_cursor) ?? identifier(page.startCursor) : null;
}

/** Merge only a cursor-linked older page into the same captured branch. Completion stays unverified. */
export function mergeOlderPage(current: ConversationSnapshot | undefined, older: ConversationSnapshot, before: string): ConversationSnapshot | null {
  if (!current || current.source !== 'flat' || older.source !== 'flat' || current.conversationId !== older.conversationId || current.previousCursor !== before) return null;
  if (older.branchId && older.branchId !== current.branchId) return null;
  const turns = [...older.turns];
  const ids = new Set(turns.map(turn => turn.messageId));
  for (const turn of current.turns) if (!ids.has(turn.messageId)) { turns.push(turn); ids.add(turn.messageId); }
  if (turns.length > MAX_TURNS || older.previousCursor === before) return null;
  return { ...current, turns, previousCursor: older.previousCursor, coverage: 'partial' };
}
