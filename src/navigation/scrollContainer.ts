export function findScrollContainer(element: HTMLElement): HTMLElement {
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 2) return parent;
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

export function viewport(container: HTMLElement): { top: number; bottom: number; left: number; right: number } {
  const rect = container.getBoundingClientRect();
  const isDocument = container === document.scrollingElement;
  return {
    top: Math.max(0, isDocument ? 0 : rect.top + container.clientTop) + 12,
    bottom: Math.min(innerHeight, isDocument ? innerHeight : rect.top + container.clientTop + container.clientHeight) - 12,
    left: Math.max(0, rect.left), right: Math.min(innerWidth, rect.right),
  };
}

/** Leading prompt anchor, clipping and actual hit-testing; oversized prompts need not fit. */
export function isPromptVisible(element: HTMLElement, container: HTMLElement): boolean {
  if (!element.isConnected || element.getClientRects().length === 0 || getComputedStyle(element).visibility !== 'visible') return false;
  if (typeof element.checkVisibility === 'function' && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) return false;
  const bounds = viewport(container);
  const rect = element.getBoundingClientRect();
  if (rect.height < 1 || rect.width < 1 || rect.top < bounds.top - 2 || rect.top >= bounds.bottom - 8) return false;
  const left = Math.max(bounds.left, rect.left);
  const right = Math.min(bounds.right, rect.right);
  if (right - left < 8) return false;
  const y = Math.min(rect.bottom - 1, rect.top + Math.min(12, rect.height / 2));
  return [0.15, 0.5, 0.85].some((fraction) => {
    const hit = document.elementFromPoint(left + (right - left) * fraction, y);
    return hit !== null && (element.contains(hit) || hit === element);
  });
}

export function positionPrompt(element: HTMLElement, container: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const bounds = viewport(container);
  const header = Array.from(document.querySelectorAll<HTMLElement>('header')).reduce((bottom, item) => {
    const r = item.getBoundingClientRect();
    return r.top <= bounds.top + 8 && r.bottom < bounds.bottom / 2 ? Math.max(bottom, r.bottom + 12) : bottom;
  }, bounds.top);
  container.scrollTo({ top: container.scrollTop + rect.top - Math.max(bounds.top + 24, header), behavior: 'instant' });
}
