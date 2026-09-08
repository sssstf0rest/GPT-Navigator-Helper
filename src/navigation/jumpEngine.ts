import type { ConversationIndex } from '../conversation/conversationIndex';
import type { PromptRecord } from '../conversation/types';
import { DomRegistry } from './domRegistry';
import { findScrollContainer, isPromptVisible, positionPrompt } from './scrollContainer';

export type JumpStatus = 'success' | 'cancelled' | 'ambiguous' | 'source-incomplete' | 'not-reachable' | 'unsupported' | 'timed-out';
export interface JumpResult { status: JumpStatus; attempts: number; elapsedMs: number }

/** A bounded rendering opportunity, not a wait for the entire streaming page to become idle. */
export function settle(signal: AbortSignal, ms = 70): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    let frame = 0;
    const finish = () => { clearTimeout(timer); clearTimeout(delay); cancelAnimationFrame(frame); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms + 80);
    const delay = setTimeout(() => { frame = requestAnimationFrame(() => { frame = requestAnimationFrame(finish); }); }, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

export class JumpEngine {
  private controller: AbortController | null = null;
  constructor(private registry: DomRegistry) {}
  cancel(): void { this.controller?.abort(); this.controller = null; }

  async jump(prompt: PromptRecord, index: ConversationIndex, current: () => boolean, onStep?: (attempts: number) => void): Promise<JumpResult> {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    const signal = controller.signal;
    const started = performance.now();
    let attempts = 0;
    const result = (status: JumpStatus): JumpResult => ({ status, attempts: Math.min(attempts, 40), elapsedMs: Math.round(performance.now() - started) });
    const valid = () => !signal.aborted && current();
    const interrupt = (event: Event) => {
      const path = event.composedPath();
      if (path.some((item) => item instanceof HTMLElement && item.hasAttribute('data-conversation-navigator'))) return;
      if (event instanceof KeyboardEvent) {
        if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) return;
        if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
      }
      controller.abort();
    };
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(type, interrupt, { capture: true, passive: true, signal });
    let low = 0;
    let high = 0;
    let container: HTMLElement | undefined;
    let previousMax = -1;
    let lastPosition = -1;
    let stalled = 0;
    try {
      if (prompt.conversationId !== index.conversationId) return result('cancelled');
      for (attempts = 1; attempts <= 40; attempts++) {
        if (!valid()) return result('cancelled');
        if (performance.now() - started > 8_000) return result('timed-out');
        this.registry.scan();
        const target = this.registry.resolve(prompt);
        if (target.kind === 'ambiguous') return result('ambiguous');
        const anchor = target.kind === 'found' ? target.element : this.registry.entries[0]?.element ?? this.registry.root;
        if (!anchor) return result('unsupported');
        const nextContainer = findScrollContainer(anchor);
        if (nextContainer !== container) { container = nextContainer; low = 0; previousMax = -1; }
        if (target.kind === 'found') {
          if (!valid()) return result('cancelled');
          positionPrompt(target.element, container);
          await settle(signal);
          if (!valid()) return result('cancelled');
          this.registry.scan();
          const verify = this.registry.resolve(prompt);
          if (verify.kind === 'ambiguous') return result('ambiguous');
          if (verify.kind === 'found' && isPromptVisible(verify.element, container)) {
            // Require a second observation so a remount/layout change cannot pass on a stale node.
            await settle(signal, 90);
            if (!valid()) return result('cancelled');
            this.registry.scan();
            const final = this.registry.resolve(prompt);
            if (final.kind === 'found' && isPromptVisible(final.element, container)) return result('success');
          }
          continue;
        }
        if (prompt.identity === 'provisional') return result('source-incomplete');
        const max = Math.max(0, container.scrollHeight - container.clientHeight);
        if (max < 1) return result('not-reachable');
        if (Math.abs(previousMax - max) > 4) { low = 0; high = max; previousMax = max; }
        const positions = this.registry.entries.map((entry) => index.snapshot.turns.findIndex((turn) => this.registry.matches(entry, turn))).filter((position) => position >= 0);
        const top = container.scrollTop;
        let next: number;
        if (positions.length && prompt.timelineIndex < Math.min(...positions)) {
          high = Math.min(high, top);
          next = (low + high) / 2;
        } else if (positions.length && prompt.timelineIndex > Math.max(...positions)) {
          low = Math.max(low, top);
          next = (low + high) / 2;
        } else if (attempts === 1 || !positions.length) {
          next = max * prompt.timelineIndex / Math.max(1, index.snapshot.turns.length - 1);
        } else {
          // Target falls inside overscan but is missing: bounded nearby probes, never text-based success.
          next = top + (attempts % 2 ? 1 : -1) * container.clientHeight * 0.6;
        }
        next = Math.max(0, Math.min(max, next));
        stalled = Math.abs(next - lastPosition) < 2 ? stalled + 1 : 0;
        if (stalled >= 3) return result(index.snapshot.coverage === 'complete' ? 'not-reachable' : 'source-incomplete');
        lastPosition = next;
        if (!valid()) return result('cancelled');
        container.scrollTo({ top: next, behavior: 'instant' });
        onStep?.(attempts);
        await settle(signal);
      }
      return result('not-reachable');
    } finally {
      controller.abort();
      if (this.controller === controller) this.controller = null;
    }
  }
}
