import { describe, expect, it } from 'vitest';
import { HistoryChain, historyMetadata } from '../../src/native/historyMetadata';
import { canExpandInitial, expandHistoryRequest, historyRequest, isHistoryState, emptyHistory } from '../../src/native/shared';

const message = (id: string, role = 'user') => ({ id, author: { role }, content: { parts: ['PRIVATE TEXT MUST NOT CROSS THE BRIDGE'] } });
const payload = (ids: string[], cursor: string | null, branch = 'tail') => ({ conversation_id: 'abc', current_node: branch,
  messages: ids.map(id => message(id)), page_info: { has_previous_page: cursor !== null, start_cursor: cursor } });
const page = (ids: string[], cursor: string | null) => historyMetadata(payload(ids, cursor), 'abc')!;

describe('history metadata and continuity', () => {
  it('extracts only identities and roles; validates payload identity', () => {
    const result = page(['a', 'b'], 'before-a');
    expect(result.messages).toEqual([{ id: 'a', user: true }, { id: 'b', user: true }]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE TEXT');
    expect(historyMetadata(payload(['a'], null), 'different')).toBeNull();
  });
  it('only completes an initial page or a continuously linked pagination chain', () => {
    const chain = new HistoryChain();
    chain.accept(page(['m90', 'm91'], 'older-1'), null);
    chain.accept(page(['m40', 'm90'], 'older-2'), 'older-1');
    expect(chain.boundary).toBe('more');
    chain.accept(page(['m0', 'm40'], null), 'older-2');
    expect(chain.boundary).toBe('complete'); expect(chain.ids.size).toBe(4); expect(chain.pages).toBe(3);
  });
  it('rejects unlinked, missing-initial, or different-branch terminal pages', () => {
    for (const kind of ['unlinked', 'missing', 'branch']) {
      const chain = new HistoryChain();
      if (kind !== 'missing') chain.accept(page(['new'], 'older'), null);
      const older = historyMetadata(payload(['old'], null, kind === 'branch' ? 'other' : 'tail'), 'abc')!;
      chain.accept(older, kind === 'unlinked' ? 'wrong' : 'older');
      expect(chain.boundary).toBe('unknown'); expect(chain.issue).toBe('unlinked');
    }
  });
  it('stops repeated cursors and pages that add no messages', () => {
    for (const older of [page(['old'], 'cursor'), page(['new'], 'different')]) {
      const chain = new HistoryChain(); chain.accept(page(['new'], 'cursor'), null); chain.accept(older, 'cursor');
      expect(chain.issue).toBe('stalled'); expect(chain.boundary).toBe('more');
      expect(chain.cursor).toBe('cursor');
    }
  });
  it('requires explicit boundary metadata; never infers completion from an empty cursor', () => {
    expect(historyMetadata({ messages: [message('m')] }, 'abc')?.boundary).toBe('unknown');
    expect(historyMetadata({ messages: [message('m')], page_info: { has_previous_page: true } }, 'abc')?.boundary).toBe('unknown');
  });
  it('walks only the selected graph path and requires an explicit root', () => {
    const mapping = { root: { parent: null, message: null }, a: { parent: 'root', message: message('a') },
      b: { parent: 'a', message: message('b', 'assistant') }, alternate: { parent: 'root', message: message('wrong') } };
    const result = historyMetadata({ mapping, current_node: 'b' }, 'abc')!;
    expect(result.boundary).toBe('complete'); expect(result.messages.map(m => m.id)).toEqual(['b', 'a']);
    expect(historyMetadata({ mapping: { a: { parent: 'missing', message: message('a') } }, current_node: 'a' }, 'abc')?.boundary).toBe('unknown');
    expect(historyMetadata({ mapping: { a: { parent: 'a', message: message('a') } }, current_node: 'a' }, 'abc')?.boundary).toBe('unknown');
  });
});

describe('request scoping and preservation', () => {
  const route = 'https://chatgpt.com/g/g-123/c/abc';
  it('only recognizes the current conversation and true older pages', () => {
    expect(historyRequest('/backend-api/conversations/abc/messages?before=x', undefined, route)?.kind).toBe('older');
    for (const url of ['/backend-api/conversations/other', '/backend-api/conversations/abc/messages?after=x',
      '/backend-api/conversations/abc/messages', 'https://example.org/backend-api/conversation/abc', '/backend-api/conversation']) {
      expect(historyRequest(url, undefined, route)).toBeNull();
    }
    expect(historyRequest('/backend-api/conversations/abc', { method: 'POST' }, route)).toBeNull();
  });
  it('preserves request headers, credentials, signal and init overrides', () => {
    const controller = new AbortController();
    const original = new Request('https://chatgpt.com/backend-api/conversations/abc/messages?before=x', {
      credentials: 'include', headers: { 'x-fixture': 'retained' }, signal: controller.signal,
    });
    const init = { cache: 'no-store' as const };
    const [rewritten, unchangedInit] = expandHistoryRequest(original, init, route);
    const request = rewritten as Request;
    expect(new URL(request.url).searchParams.get('num_turns')).toBe('100');
    expect(request.headers.get('x-fixture')).toBe('retained'); expect(request.credentials).toBe('include');
    expect(unchangedInit).toBe(init); controller.abort(); expect(request.signal.aborted).toBe(true);
  });
  it('leaves unrelated or already larger requests alone', () => {
    const url = '/backend-api/conversations/abc?num_turns=200';
    expect(expandHistoryRequest(url, undefined, route)[0]).toBe(url);
    expect(expandHistoryRequest('/backend-api/models', undefined, route)[0]).toBe('/backend-api/models');
  });
  it('only automatically expands unambiguous initial pages, preserving message deep links and speculative routes', () => {
    expect(canExpandInitial('/backend-api/conversations/abc?num_turns=6', undefined, route)).toBe(true);
    for (const url of ['/backend-api/conversations/other', '/backend-api/conversation/abc',
      '/backend-api/conversations/abc/messages?before=x', '/backend-api/conversations/abc?include_message_id=target']) {
      expect(canExpandInitial(url, undefined, route)).toBe(false);
    }
    for (const suffix of ['?message=target', '?messageId=target']) {
      expect(canExpandInitial('/backend-api/conversations/abc', undefined, route + suffix)).toBe(false);
    }
  });
  it('rejects malformed or unbounded state packets', () => {
    const state = emptyHistory('abc'); expect(isHistoryState(state)).toBe(true);
    expect(isHistoryState({ ...state, pages: -1 })).toBe(false);
    expect(isHistoryState({ ...state, pending: Infinity })).toBe(false);
    expect(isHistoryState({ ...state, boundary: 'probably' })).toBe(false);
  });
});
