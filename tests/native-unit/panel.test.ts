import { expect, it } from 'vitest';
import { panelSnapshot } from '../../src/native/panelState';
import { emptyHistory } from '../../src/native/shared';

it.each([0, 1, 3, 4])('explains the native minimum for a complete %i-prompt conversation', prompts => {
  const history = { ...emptyHistory('abc'), pages: 1, prompts, boundary: 'complete' as const };
  const state = panelSnapshot(history, { found: 0, visible: 0 }, 'loaded-no-native');
  expect(state.reason).toContain('at least 5 prompts');
  expect(state.prompts).toBe(prompts);
});
it('does not confuse incomplete or failed capture with a genuinely short conversation', () => {
  const history = { ...emptyHistory('abc'), pages: 1, prompts: 3, boundary: 'more' as const };
  expect(panelSnapshot(history, { found: 0, visible: 0 }, 'automatic-loading').reason).not.toContain('at least 5');
  expect(panelSnapshot({ ...history, boundary: 'complete', issue: 'unlinked' }, { found: 0, visible: 0 }, 'unverified').reason).not.toContain('at least 5');
  expect(panelSnapshot(emptyHistory('abc'), { found: 0, visible: 0 }, 'waiting').prompts).toBeNull();
});
it('uses an unknown-cause explanation at five prompts and hides it when native navigation is visible', () => {
  const history = { ...emptyHistory('abc'), pages: 1, prompts: 5, boundary: 'complete' as const };
  expect(panelSnapshot(history, { found: 5, visible: 0 }, 'hidden').reason).toBe('History is loaded, but ChatGPT’s navigator is not available in this view.');
  expect(panelSnapshot(history, { found: 5, visible: 5 }, 'ready').reason).toBe('');
});
