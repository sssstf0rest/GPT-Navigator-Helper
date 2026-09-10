import { test as base, chromium, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import path from 'node:path';

declare global {
  interface Window {
    nativeFixture: { ready: boolean; loaded: number; pending: boolean; requests: number; scrollTop: number;
      scrollEvents: number; earliest: string; initialScrolls: number[]; anchorSamples: (number | null)[]; minTop: number; startSampling(): void; scroll(top: number): void;
      changeRoute(id: string, query?: string): Promise<void>; branch(): Promise<void>; grow(): void; recover(): void };
  }
}
export const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({}, use) => {
    const extension = path.resolve('dist');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    await context.route('https://chatgpt.com/**', async route => {
      const url = new URL(route.request().url());
      const response = await fetch(`http://127.0.0.1:4173${url.pathname}${url.search}`);
      await route.fulfill({ status: response.status, contentType: response.headers.get('content-type') ?? 'text/plain', body: Buffer.from(await response.arrayBuffer()) });
    });
    await use(context); await context.close();
  },
  page: async ({ context }, use) => { const page = await context.newPage(); await use(page); },
});
const panels = new WeakMap<Page, Page>();
export const panel = (page: Page): Page => panels.get(page)!;
export const host = (page: Page) => panel(page).locator('#native-navigator-helper');
export async function openPanel(page: Page): Promise<Page> {
  if (panels.get(page) && !panels.get(page)!.isClosed()) return panels.get(page)!;
  const cdp = await page.context().newCDPSession(page);
  let origin = '';
  cdp.on('Runtime.executionContextCreated', ({ context }) => {
    if (context.origin.startsWith('chrome-extension://')) origin = context.origin;
  });
  await cdp.send('Runtime.enable');
  await expect.poll(() => origin).not.toBe('');
  await cdp.detach();
  const popup = await page.context().newPage();
  await popup.setViewportSize({ width: 320, height: 420 });
  await page.bringToFront();
  await popup.goto(`${origin}/src/popup/index.html`);
  panels.set(page, popup);
  await expect(host(page)).not.toHaveAttribute('data-phase', 'connecting');
  return popup;
}

export async function anchor(page: Page) {
  return page.locator('main [data-message-id]').evaluateAll(els => {
    const top = document.querySelector('main')!.getBoundingClientRect().top;
    const bottom = document.querySelector('main')!.getBoundingClientRect().bottom;
    const element = els.find(el => { const r = el.getBoundingClientRect(); return r.top >= top && r.top < bottom; }) ??
      els.find(el => { const r = el.getBoundingClientRect(); return r.bottom > top && r.top < bottom; })!;
    return { id: element.getAttribute('data-message-id')!, offset: element.getBoundingClientRect().top - top };
  });
}
export async function expectAnchor(page: Page, saved: { id: string; offset: number }) {
  const el = page.locator(`main [data-message-id="${saved.id}"]`);
  await expect(el).toBeVisible();
  const offset = await el.evaluate(el => el.getBoundingClientRect().top - document.querySelector('main')!.getBoundingClientRect().top);
  expect(Math.abs(offset - saved.offset)).toBeLessThanOrEqual(4);
}


export { expect };
