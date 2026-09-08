import { describe, expect, it } from 'vitest';
import { mergeOlderPage, normalizePayload } from '../../src/conversation/pagePayloadSource';
import { conversationIdFromUrl } from '../../src/conversation/types';
import { ConversationIndex } from '../../src/conversation/conversationIndex';
import { CHANNEL, isPageEvent } from '../../src/page/protocol';

const message = (id: string, text: string, role = 'user') => ({ id, author: { role }, content: { parts: [text] } });
const graph = () => ({ conversation_id: 'a', current_node: 'n3', mapping: {
  root: { parent: null, message: null },
  n1: { parent: 'root', message: message('m1', 'Again') },
  n2: { parent: 'n1', message: message('m2', 'Answer', 'assistant') },
  n3: { parent: 'n2', message: message('m3', 'Again') },
  alternate: { parent: 'root', message: message('other', 'Inactive edit') },
} });

describe('payload normalization and identity', () => {
  it('walks the selected branch and preserves identical prompts as distinct messages', () => {
    const snapshot = normalizePayload(graph(), 'a')!;
    expect(snapshot.coverage).toBe('complete');
    expect(snapshot.turns.map((turn) => turn.messageId)).toEqual(['m1', 'm2', 'm3']);
    const index = new ConversationIndex('a'); index.replace(snapshot);
    expect(index.prompts.map((prompt) => [prompt.messageId, prompt.timelineIndex, prompt.userOrder])).toEqual([['m1', 0, 1], ['m3', 2, 2]]);
  });
  it('rejects data belonging to another conversation, including nested shapes', () => {
    expect(normalizePayload(graph(), 'b')).toBeNull();
    expect(normalizePayload({ conversation: graph() }, 'b')).toBeNull();
  });
  it('does not mark a broken parent chain, missing parent, or cycle complete', () => {
    const missing = graph(); missing.mapping.n1.parent = 'not-loaded';
    expect(normalizePayload(missing, 'a')?.coverage).toBe('partial');
    const cyclic = graph(); cyclic.mapping.n1.parent = 'n3';
    expect(normalizePayload(cyclic, 'a')?.coverage).toBe('partial');
    const malformed = graph(); delete (malformed.mapping.root as { parent?: null }).parent;
    expect(normalizePayload(malformed, 'a')?.coverage).toBe('partial');
  });
  it('does not guess the selected branch or certify a flat page', () => {
    expect(normalizePayload({ ...graph(), current_node: null }, 'a')).toMatchObject({ coverage: 'unknown', turns: [] });
    expect(normalizePayload({ conversation_id: 'a', messages: [message('one', 'Hi')], page_info: { has_previous_page: false } }, 'a')?.coverage).toBe('partial');
  });
  it('handles hidden messages and image/file prompts without downloading assets', () => {
    const payload = { conversation_id: 'a', messages: [
      { ...message('image', ''), content: { parts: [{ content_type: 'image_asset_pointer', asset_pointer: 'private-asset' }] } },
      { ...message('file', ''), metadata: { attachments: [{ name: 'report.pdf' }] } },
      { ...message('hidden', 'internal'), metadata: { is_visually_hidden_from_conversation: true } },
    ] };
    const index = new ConversationIndex('a'); index.replace(normalizePayload(payload, 'a')!);
    expect(index.prompts.map((prompt) => prompt.text)).toEqual(['[Image prompt]', '[File: report.pdf]']);
  });
});

describe('index lifecycle', () => {
  it('retains earlier observations when the DOM window disappears', () => {
    const index = new ConversationIndex('a');
    const turns = normalizePayload(graph(), 'a')!.turns;
    index.observe(turns.map((turn) => ({ ...turn, identity: 'stable' })));
    index.observe([]);
    expect(index.prompts).toHaveLength(2);
    expect(index.snapshot.coverage).toBe('partial');
  });
  it('rejects cross-conversation replacement and replaces obsolete branch entries', () => {
    const index = new ConversationIndex('a'); index.replace(normalizePayload(graph(), 'a')!);
    expect(index.replace({ ...index.snapshot, conversationId: 'b' })).toBe(false);
    index.replace(normalizePayload({ ...graph(), current_node: 'alternate' }, 'a')!);
    expect(index.prompts.map((prompt) => prompt.messageId)).toEqual(['other']);
  });
  it('does not pollute a proven branch with unknown mounted messages', () => {
    const index = new ConversationIndex('a'); index.replace(normalizePayload(graph(), 'a')!);
    index.observe([{ ...index.snapshot.turns[0]!, messageId: 'old-branch', nodeId: 'old-node', identity: 'stable' }]);
    expect(index.prompts.map((prompt) => prompt.messageId)).toEqual(['m1', 'm3']);
    expect(index.snapshot.coverage).toBe('partial');
  });
  it('accepts a new live prompt only when it extends the observed known tail', () => {
    const index = new ConversationIndex('a'); index.replace(normalizePayload(graph(), 'a')!);
    const tail = index.snapshot.turns.at(-1)!;
    index.observe([{ ...tail, identity: 'stable' }, { ...tail, messageId: 'new-live', nodeId: 'new-node', text: 'New prompt', identity: 'stable' }]);
    expect(index.prompts.at(-1)?.messageId).toBe('new-live');
    expect(index.snapshot.coverage).toBe('partial');
  });
  it('never overwrites captured prompt text with a truncated mounted preview', () => {
    const index = new ConversationIndex('a'); index.replace(normalizePayload(graph(), 'a')!);
    index.observe([{ ...index.snapshot.turns[0]!, text: 'Truncated DOM preview…', identity: 'stable' }]);
    expect(index.prompts[0]?.text).toBe('Again');
  });
});

describe('passive older-page merging', () => {
  const newer = () => ({ ...normalizePayload({ messages: [message('new', 'Later')], current_node: 'tail', page_info: { has_previous_page: true, start_cursor: 'cursor1' } }, 'a')! });
  const older = () => normalizePayload({ messages: [message('old', 'Earlier'), message('new', 'Later')], current_node: 'tail', page_info: { has_previous_page: false } }, 'a')!;
  it('prepends a cursor-linked page, deduplicates overlap and stays partial', () => {
    expect(mergeOlderPage(newer(), older(), 'cursor1')).toMatchObject({ coverage: 'partial', previousCursor: null });
    expect(mergeOlderPage(newer(), older(), 'cursor1')?.turns.map(turn => turn.messageId)).toEqual(['old', 'new']);
  });
  it('rejects missing context, unrelated cursors, changed branches and repeated cursors', () => {
    expect(mergeOlderPage(undefined, older(), 'cursor1')).toBeNull();
    expect(mergeOlderPage(newer(), older(), 'wrong')).toBeNull();
    expect(mergeOlderPage(newer(), { ...older(), branchId: 'another' }, 'cursor1')).toBeNull();
    expect(mergeOlderPage(newer(), { ...older(), previousCursor: 'cursor1' }, 'cursor1')).toBeNull();
  });
});

describe('route and bridge boundaries', () => {
  it('recognizes conversation and nested GPT routes but not unrelated paths', () => {
    expect(conversationIdFromUrl('https://chatgpt.com/c/abc?x=1')).toBe('abc');
    expect(conversationIdFromUrl('https://chatgpt.com/g/g-test/c/abc')).toBe('abc');
    expect(conversationIdFromUrl('https://chatgpt.com/')).toBeNull();
    expect(conversationIdFromUrl('invalid')).toBeNull();
  });
  it('validates payload identity, bounded text, duplicate IDs, and sequence values', () => {
    const snapshot = normalizePayload(graph(), 'a')!;
    const valid = { channel: CHANNEL, kind: 'snapshot', generation: 1, conversationId: 'a', sequence: 2, snapshot };
    expect(isPageEvent(valid)).toBe(true);
    expect(isPageEvent({ ...valid, conversationId: 'b' })).toBe(false);
    expect(isPageEvent({ ...valid, sequence: NaN })).toBe(false);
    expect(isPageEvent({ ...valid, snapshot: { ...snapshot, turns: [...snapshot.turns, snapshot.turns[0]] } })).toBe(false);
    expect(isPageEvent({ ...valid, snapshot: { ...snapshot, turns: [{ ...snapshot.turns[0], text: 'x'.repeat(20_001) }] } })).toBe(false);
  });
});
