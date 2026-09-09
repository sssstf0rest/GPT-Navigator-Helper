import { conversationScroller, delay, nativeNavigation, readingPositionDrift, saveReadingPosition, viewportTop } from './dom';
import type { HistoryState } from './shared';
import type { Outcome, Progress } from './prepare';

export type SeamlessOutcome = Outcome | 'incompatible' | 'layout-changed';
export const AUTOMATIC_LIMITS = { duration: 60_000, pages: 20, pageWait: 12_000, nativeWait: 2_500 };
const SENTINEL = '[data-testid="conversation-pagination-sentinel"]';

export function stableLayoutAvailable(): boolean {
  const scroller = conversationScroller();
  return Boolean(scroller && getComputedStyle(scroller).overflowAnchor !== 'none' &&
    !document.querySelector('button[data-testid="stop-button"]') && !scroller.closest('[data-stream-active]'));
}

/** Never moves the conversation or changes host history. Cleanup owns only the temporary inline styles. */
function exposeSentinel(scroller: HTMLElement): { element: HTMLElement; release(): void } | null {
  const matches = Array.from(scroller.querySelectorAll<HTMLElement>(SENTINEL));
  if (matches.length !== 1) return null;
  const element = matches[0]!;
  if (!element.getClientRects().length || element.getBoundingClientRect().height > 100) return null;
  const values: Record<string, string> = { position: 'sticky', top: '80px', opacity: '0', 'pointer-events': 'none' };
  const original = Object.keys(values).map(property => ({ property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }));
  for (const [property, value] of Object.entries(values)) element.style.setProperty(property, value, 'important');
  let released = false;
  return { element, release() {
    if (released) return;
    released = true;
    for (const { property, value, priority } of original) {
      if (element.style.getPropertyValue(property) !== values[property] || element.style.getPropertyPriority(property) !== 'important') continue;
      if (value) element.style.setProperty(property, value, priority); else element.style.removeProperty(property);
    }
  } };
}

/** A separate automatic path: one native page trigger at a time, with no scroll/restore fallback. */
export async function prepareSeamlessly(history: () => HistoryState, signal: AbortSignal,
  onProgress: (progress: Progress) => void, limits = AUTOMATIC_LIMITS): Promise<SeamlessOutcome> {
  const initial = history();
  const start = performance.now();
  const position = saveReadingPosition();
  const scroller = position?.scroller;
  if (!position || !scroller || !stableLayoutAvailable()) return 'incompatible';
  let exposure: ReturnType<typeof exposeSentinel> = null;
  let moved = false; let missingFrames = 0; let frame = 0; let stopped = false;
  const release = () => { exposure?.release(); exposure = null; };
  // Abort cleanup is synchronous: a pending host response may finish, but cannot trigger another page for us.
  signal.addEventListener('abort', release, { once: true });
  const monitor = () => {
    if (stopped || signal.aborted) return;
    const drift = readingPositionDrift(position);
    missingFrames = drift === null ? missingFrames + 1 : 0;
    if ((drift !== null && Math.abs(drift) > 8) || missingFrames > 3 || !stableLayoutAvailable()) { moved = true; release(); return; }
    frame = requestAnimationFrame(monitor);
  };
  frame = requestAnimationFrame(monitor);
  const stateCheck = (): SeamlessOutcome | null => {
    signal.throwIfAborted();
    const s = history();
    if (s.conversationId !== initial.conversationId || s.generation !== initial.generation || s.initialVersion !== initial.initialVersion) return 'changed';
    if (moved) return 'layout-changed';
    if (document.visibilityState !== 'visible') return 'changed';
    if (s.issue === 'http-error') return 'network-error';
    if (s.issue === 'stalled') return 'stalled';
    if (s.issue === 'limit') return 'limit';
    if (s.issue || s.boundary === 'unknown') return 'unverified';
    if (performance.now() - start >= limits.duration) return 'limit';
    return null;
  };
  const report = (waiting = false) => onProgress({ phase: waiting ? 'waiting-native' : 'loading', pages: history().pages - initial.pages,
    prompts: history().prompts, elapsed: performance.now() - start });
  try {
    while (true) {
      const problem = stateCheck(); if (problem) return problem;
      const s = history(); report();
      if (s.pending) { await delay(40, signal); continue; }
      if (s.boundary === 'complete') {
        release();
        const until = Math.min(start + limits.duration, performance.now() + limits.nativeWait);
        while (performance.now() < until) {
          const problem = stateCheck(); if (problem) return problem;
          if (history().pending || history().boundary !== 'complete') break;
          report(true);
          const native = nativeNavigation();
          if (native.visible) return 'ready';
          await delay(80, signal);
        }
        if (history().pending || history().boundary !== 'complete') continue;
        return nativeNavigation().found ? 'hidden' : 'loaded-no-native';
      }
      if (s.pages - initial.pages >= limits.pages) return 'limit';
      exposure = exposeSentinel(scroller);
      if (!exposure) return 'incompatible';
      const exposed = exposure.element;
      const deadline = Math.min(start + limits.duration, performance.now() + limits.pageWait);
      let started = false;
      while (performance.now() < deadline) {
        await delay(20, signal);
        const problem = stateCheck(); if (problem) return problem;
        const current = history(); report();
        if (current.pending || current.pages !== s.pages || current.boundary === 'complete') { started = true; release(); break; }
        const r = exposed.getBoundingClientRect();
        const top = viewportTop(scroller);
        if (!exposed.isConnected || r.bottom < top || r.top > top + scroller.clientHeight) return 'incompatible';
      }
      release();
      if (!started) return 'stalled';
      while (history().pending || history().pages === s.pages) {
        const problem = stateCheck(); if (problem) return problem;
        if (performance.now() >= deadline) return 'stalled';
        report(); await delay(40, signal);
      }
      // Host render/virtualizer commits can follow the fetch metadata acknowledgement.
      await delay(240, signal);
    }
  } finally {
    stopped = true; cancelAnimationFrame(frame); release(); signal.removeEventListener('abort', release);
  }
}
