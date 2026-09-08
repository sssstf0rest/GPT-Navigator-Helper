export type Coverage = 'unknown' | 'partial' | 'complete';
export type Role = 'user' | 'assistant' | 'tool' | 'system';
export interface Turn {
  messageId: string;
  nodeId: string;
  parentId: string | null;
  role: Role;
  text: string;
  hidden: boolean;
}
export interface ConversationSnapshot {
  conversationId: string;
  branchId: string | null;
  turns: Turn[];
  coverage: Coverage;
  reason: string;
  source: 'graph' | 'flat' | 'dom';
  previousCursor?: string | null;
}
export interface PromptRecord extends Turn {
  conversationId: string;
  timelineIndex: number;
  userOrder: number;
  identity: 'stable' | 'provisional';
}
export interface DomTurn extends Turn { identity: 'stable' | 'provisional' }

export function conversationIdFromUrl(input: string): string | null {
  try {
    const path = new URL(input).pathname;
    // Includes /c/:id and observed nested /g/:gpt/c/:id routes, without assuming UUIDs.
    const match = path.match(/(?:^|\/)c\/([A-Za-z0-9_-]{1,128})(?:\/|$)/);
    return match?.[1] ?? null;
  } catch { return null; }
}

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
export function identifier(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}
