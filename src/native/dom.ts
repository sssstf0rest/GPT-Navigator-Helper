import type { NativeState } from './types';

const MESSAGE = '[data-message-author-role="user"], [data-message-author-role="assistant"]';
export function messages(): HTMLElement[] {
  return Array.from((document.querySelector('main, [role="main"]') ?? document).querySelectorAll<HTMLElement>(MESSAGE));
}
export function conversationScroller(): HTMLElement | null {
  const first = messages()[0];
  if (!first) return null;
  for (let parent = first.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(parent).overflowY) && parent.clientHeight > 100) return parent;
  }
  return document.scrollingElement as HTMLElement | null;
}
export function viewportTop(scroller: HTMLElement): number {
  return scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top + scroller.clientTop;
}
function visible(el: HTMLElement): boolean {
  if (!el.isConnected || !el.getClientRects().length || getComputedStyle(el).visibility !== 'visible') return false;
  if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.left >= innerWidth || r.bottom <= 0 || r.top >= innerHeight) return false;
  const x = (Math.max(0, r.left) + Math.min(innerWidth, r.right)) / 2;
  const y = (Math.max(0, r.top) + Math.min(innerHeight, r.bottom)) / 2;
  const hit = document.elementFromPoint(x, y);
  return hit === el || (hit !== null && el.contains(hit));
}
export function nativeNavigation(): NativeState {
  const controls = Array.from(document.querySelectorAll<HTMLElement>('button[aria-label], button[aria-description], button[data-toc-item-index], [role="button"][aria-label], [role="button"][aria-description]'))
    .filter(el => (el.hasAttribute('data-toc-active') && /^\d+$/.test(el.getAttribute('data-toc-item-index') ?? '')) ||
      ['aria-label', 'aria-description'].some(attr => /^prompt\s+\d+(?:\b|:)/i.test(el.getAttribute(attr) ?? '')));
  // Native markers retain these structural attributes when labels change to prompt text.
  return { found: controls.length, visible: controls.filter(visible).length };
}
interface Identity { attribute: string; value: string }
function identity(el: HTMLElement): Identity | null {
  for (let node: HTMLElement | null = el, depth = 0; node && depth < 7; node = node.parentElement, depth++) {
    for (const attribute of ['data-message-id', 'data-turn-id', 'data-turn-id-container']) {
      const value = node.getAttribute(attribute);
      if (value && value.length <= 256) return { attribute, value };
    }
    if (node.tagName === 'ARTICLE') break;
  }
  return null;
}
function findAnchor(id: Identity): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(`[${id.attribute}="${CSS.escape(id.value)}"]`));
  if (matches.length !== 1) return null;
  const el = matches[0]!;
  return el.matches(MESSAGE) ? el : el.querySelector<HTMLElement>(MESSAGE);
}
export interface ReadingPosition {
  identity: Identity | null; element: HTMLElement; offset: number; scroller: HTMLElement;
}
export function readingPositionDrift(position: ReadingPosition): number | null {
  if (!position.scroller.isConnected) return null;
  const anchor = position.identity ? findAnchor(position.identity) : position.element.isConnected ? position.element : null;
  return anchor ? anchor.getBoundingClientRect().top - viewportTop(position.scroller) - position.offset : null;
}
export function saveReadingPosition(): ReadingPosition | null {
  const scroller = conversationScroller();
  if (!scroller) return null;
  const top = viewportTop(scroller);
  const bottom = Math.min(innerHeight, top + scroller.clientHeight);
  const candidates = messages().filter(el => { const r = el.getBoundingClientRect(); return r.bottom > top + 8 && r.top < bottom - 8; });
  const element = candidates.find(el => el.getBoundingClientRect().top >= top) ?? candidates[0];
  if (!element) return null;
  return { identity: identity(element), element, offset: element.getBoundingClientRect().top - top,
    scroller };
}
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
