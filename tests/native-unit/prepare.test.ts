import { expect, it } from 'vitest';
import { prepareHistory } from '../../src/native/prepare';
import type { Observation } from '../../src/native/prepare';
import { emptyHistory } from '../../src/native/shared';

const limits = { duration: 3000, pageWait: 1000, nativeWait: 400, pages: 10, steps: 20, tick: 100 };
function fixture(change: (s: Observation, time: number) => void = () => {}) {
  const state: Observation = { history: { ...emptyHistory('abc'), pages: 1, boundary: 'more' }, native: { found: 0, visible: 0 }, edge: 'recent', height: 2000 };
  let time = 0; let moves = 0;
  const signal = new AbortController();
  const env = { observe: () => structuredClone(state), goToHistoryEdge: () => { moves++; return true; },
    wait: async (ms: number, abort: AbortSignal) => { abort.throwIfAborted(); time += ms; change(state, time); }, now: () => time };
  return { state, env, signal, get moves() { return moves; } };
}
it('waits for a delayed page instead of repeatedly moving during network activity', async () => {
  const f = fixture((s, time) => {
    s.history.pending = time < 700 ? 1 : 0;
    if (time >= 700) { s.history.pages = 2; s.history.boundary = 'complete'; s.native = { found: 10, visible: 10 }; }
  });
  expect(await prepareHistory(f.env, f.signal.signal, () => {}, limits)).toBe('ready'); expect(f.moves).toBe(1);
});
it('stops without oscillation when no history progress occurs', async () => {
  const f = fixture();
  expect(await prepareHistory(f.env, f.signal.signal, () => {}, limits)).toBe('stalled'); expect(f.moves).toBe(1);
});
it('does not equate history completion with a visible navigator', async () => {
  const f = fixture(); f.state.history.boundary = 'complete';
  expect(await prepareHistory(f.env, f.signal.signal, () => {}, limits)).toBe('loaded-no-native'); expect(f.moves).toBe(0);
  f.state.native.found = 10;
  expect(await prepareHistory(f.env, f.signal.signal, () => {}, limits)).toBe('hidden');
});
it('returns available with unknown coverage without claiming completion', async () => {
  const f = fixture(); f.state.history.boundary = 'unknown'; f.state.native = { found: 2, visible: 2 };
  expect(await prepareHistory(f.env, f.signal.signal, () => {}, limits)).toBe('available');
});
it('halts on route or branch changes, cancellation, and HTTP failures', async () => {
  for (const mutate of [(s: Observation) => { s.history.generation++; }, (s: Observation) => { s.history.initialVersion++; }]) {
    const f = fixture(mutate); expect(await prepareHistory(f.env, f.signal.signal, () => {}, limits)).toBe('changed');
  }
  const cancelled = fixture(() => cancelled.signal.abort('user'));
  await expect(prepareHistory(cancelled.env, cancelled.signal.signal, () => {}, limits)).rejects.toBe('user');
  const failed = fixture(s => { s.history.issue = 'http-error'; });
  expect(await prepareHistory(failed.env, failed.signal.signal, () => {}, limits)).toBe('network-error');
});
it('enforces total limits even when a page continually changes height', async () => {
  const f = fixture(s => { s.height += 20; });
  expect(await prepareHistory(f.env, f.signal.signal, () => {}, limits)).toBe('limit');
  expect(f.moves).toBeLessThan(15);
});
