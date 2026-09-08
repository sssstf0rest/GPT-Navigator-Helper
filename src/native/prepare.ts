import type { HistoryState } from './shared';

export interface NativeState { found: number; visible: number }
export interface Observation { history: HistoryState; native: NativeState; edge: string; height: number }
export interface PrepareEnvironment {
  observe(): Observation;
  goToHistoryEdge(): boolean;
  wait(ms: number, signal: AbortSignal): Promise<void>;
  now(): number;
}
export type Outcome = 'ready' | 'available' | 'loaded-no-native' | 'hidden' | 'stalled' | 'network-error' | 'unverified' | 'limit' | 'changed' | 'unsupported';
export interface Progress { phase: 'loading' | 'waiting-native'; pages: number; prompts: number; elapsed: number }
export const DEFAULT_LIMITS = { duration: 180_000, pageWait: 12_000, nativeWait: 2_500, pages: 80, steps: 160, tick: 120 };

/** One move to the loaded edge per observed change; never alternate search positions. */
export async function prepareHistory(env: PrepareEnvironment, signal: AbortSignal,
  onProgress: (progress: Progress) => void, limits = DEFAULT_LIMITS): Promise<Outcome> {
  const start = env.now();
  const initial = env.observe().history;
  let steps = 0;
  let pendingSince = start;
  const changed = (s: Observation) => s.history.conversationId !== initial.conversationId ||
    s.history.generation !== initial.generation || s.history.initialVersion !== initial.initialVersion;
  const tick = async () => { signal.throwIfAborted(); await env.wait(limits.tick, signal); signal.throwIfAborted(); };
  const signature = (s: Observation) => `${s.history.pages}:${s.edge}:${Math.round(s.height)}`;
  const report = (s: Observation, phase: Progress['phase'] = 'loading') => onProgress({ phase,
    pages: Math.max(0, s.history.pages - initial.pages), prompts: s.history.prompts, elapsed: env.now() - start });
  while (true) {
    signal.throwIfAborted();
    const s = env.observe();
    if (changed(s)) return 'changed';
    report(s);
    if (env.now() - start >= limits.duration || s.history.pages - initial.pages >= limits.pages || steps >= limits.steps) return 'limit';
    if (s.history.pending) {
      if (env.now() - pendingSince > limits.pageWait) return 'stalled';
      await tick(); continue;
    }
    pendingSince = env.now();
    if (s.history.issue === 'http-error') return 'network-error';
    if (s.history.issue === 'limit') return 'limit';
    if (s.history.issue === 'stalled') return 'stalled';
    if (s.history.issue === 'unlinked') return 'unverified';
    if (s.history.boundary === 'complete') {
      const until = env.now() + limits.nativeWait;
      while (env.now() < until) {
        const current = env.observe();
        if (changed(current)) return 'changed';
        report(current, 'waiting-native');
        if (current.native.visible) return 'ready';
        await tick();
      }
      return env.observe().native.found ? 'hidden' : 'loaded-no-native';
    }
    // The component may be usable even when its payload shape is unrecognized. Do not claim completeness.
    if (s.native.visible && s.history.boundary === 'unknown') return 'available';
    const before = signature(s);
    if (!env.goToHistoryEdge()) return 'unsupported';
    steps++;
    const deadline = Math.min(start + limits.duration, env.now() + limits.pageWait);
    let advanced = false;
    while (env.now() < deadline) {
      await tick();
      const current = env.observe();
      if (changed(current)) return 'changed';
      report(current);
      if (current.history.pending) continue;
      if (current.history.issue === 'http-error') return 'network-error';
      if (current.history.issue === 'stalled') return 'stalled';
      if (current.history.issue === 'unlinked') return 'unverified';
      if (current.history.issue === 'limit') return 'limit';
      if (current.history.boundary === 'complete' || signature(current) !== before || current.native.visible) {
        // Give host anchoring/remounts a chance to finish before another edge movement.
        await env.wait(240, signal);
        advanced = true; break;
      }
    }
    if (!advanced) return env.now() - start >= limits.duration ? 'limit' : 'stalled';
  }
}
