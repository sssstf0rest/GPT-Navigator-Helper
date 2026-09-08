import { identifier, record } from '../conversation/types';
import type { ConversationSnapshot } from '../conversation/types';
import { MAX_TEXT, MAX_TURNS } from '../conversation/pagePayloadSource';

export const CHANNEL = 'conversation-navigator:v1';
export interface PageEvent {
  channel: typeof CHANNEL;
  kind: 'route' | 'snapshot' | 'capture-error';
  generation: number;
  conversationId: string | null;
  sequence: number;
  snapshot?: ConversationSnapshot;
  reason?: string;
}

export function isPageEvent(value: unknown): value is PageEvent {
  const event = record(value);
  if (!event || event.channel !== CHANNEL || !['route', 'snapshot', 'capture-error'].includes(String(event.kind))) return false;
  if (!Number.isSafeInteger(event.generation) || Number(event.generation) < 0 || !Number.isSafeInteger(event.sequence) || Number(event.sequence) < 0) return false;
  if (event.conversationId !== null && !identifier(event.conversationId)) return false;
  if (event.reason !== undefined && (typeof event.reason !== 'string' || event.reason.length > 300)) return false;
  if (event.kind !== 'snapshot') return true;
  const snapshot = record(event.snapshot);
  if (!snapshot || snapshot.conversationId !== event.conversationId || !identifier(snapshot.conversationId)) return false;
  if (snapshot.branchId !== null && !identifier(snapshot.branchId)) return false;
  if (snapshot.previousCursor !== undefined && snapshot.previousCursor !== null && !identifier(snapshot.previousCursor)) return false;
  if (!['unknown', 'partial', 'complete'].includes(String(snapshot.coverage)) || !['graph', 'flat', 'dom'].includes(String(snapshot.source))) return false;
  if (typeof snapshot.reason !== 'string' || snapshot.reason.length > 300 || !Array.isArray(snapshot.turns) || snapshot.turns.length > MAX_TURNS) return false;
  let characters = 0;
  const ids = new Set<string>();
  return snapshot.turns.every((raw) => {
    const turn = record(raw);
    if (!turn || !identifier(turn.messageId) || !identifier(turn.nodeId) || (turn.parentId !== null && !identifier(turn.parentId))) return false;
    if (!['user', 'assistant', 'tool', 'system'].includes(String(turn.role)) || typeof turn.hidden !== 'boolean') return false;
    if (typeof turn.text !== 'string' || turn.text.length > MAX_TEXT || ids.has(String(turn.messageId))) return false;
    ids.add(String(turn.messageId));
    characters += turn.text.length;
    return characters <= 2_000_000;
  });
}
