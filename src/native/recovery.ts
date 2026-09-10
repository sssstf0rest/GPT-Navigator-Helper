import { AUTOMATIC_LIMITS } from './seamless';

export const RECOVERY_IDLE_MS = 2_500;
export const MAX_RECOVERIES = 3;

/** One budget per captured history context, including interrupted attempts. */
export class RecoveryBudget {
  private elapsed = 0;
  private recoveries = 0;
  constructor(readonly key: string, private readonly initialPages: number) {}

  remaining(pages: number): typeof AUTOMATIC_LIMITS {
    return { ...AUTOMATIC_LIMITS,
      duration: Math.max(0, AUTOMATIC_LIMITS.duration - this.elapsed),
      pages: Math.max(0, AUTOMATIC_LIMITS.pages - Math.max(0, pages - this.initialPages)) };
  }
  finish(activeMs: number): void { this.elapsed += Math.max(0, activeMs); }
  recover(pages: number): boolean {
    const left = this.remaining(pages);
    if (this.recoveries >= MAX_RECOVERIES || left.duration <= 0 || left.pages <= 0) return false;
    this.recoveries++;
    return true;
  }
}
