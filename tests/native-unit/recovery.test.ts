import { expect, it } from 'vitest';
import { RecoveryBudget } from '../../src/native/recovery';

it('shares page and active-time limits across interrupted attempts', () => {
  const budget = new RecoveryBudget('conversation:1:1', 1);
  budget.finish(20_000);
  expect(budget.recover(8)).toBe(true);
  expect(budget.remaining(8)).toMatchObject({ pages: 13, duration: 40_000 });
  budget.finish(40_000);
  expect(budget.recover(9)).toBe(false);
});
it('bounds repeated interruptions even if no pages complete', () => {
  const budget = new RecoveryBudget('conversation:1:1', 1);
  expect([1, 2, 3, 4].map(() => budget.recover(1))).toEqual([true, true, true, false]);
});
it('counts pages that finish after cancellation and resets only with a new context', () => {
  const budget = new RecoveryBudget('conversation:1:1', 1);
  expect(budget.recover(20)).toBe(true);
  expect(budget.remaining(21).pages).toBe(0);
  expect(budget.recover(21)).toBe(false);
  expect(new RecoveryBudget('conversation:1:2', 21).remaining(21).pages).toBe(20);
});
