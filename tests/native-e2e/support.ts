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
export const host = (page: Page) => page.locator('#native-navigator-helper');
export async function open(page: Page, query = 'count=220') {
  await page.goto('https://chatgpt.com/c/fixture-boot?count=4');
  await page.waitForFunction(() => window.nativeFixture?.ready);
  await page.getByRole('button', { name: 'Open native navigator helper' }).click();
  await page.getByRole('button', { name: 'Pause automatic preparation' }).click();
  await page.evaluate(query => window.nativeFixture.changeRoute('fixture-a', query), query);
  await page.waitForFunction(() => window.nativeFixture?.ready);
  await expect(page.getByRole('region', { name: 'Native navigator helper' })).toBeVisible();
  await expect(host(page).locator('pre')).toContainText('"bridge": "connected"');
  await expect(host(page).locator('pre')).toContainText(query.includes('unknown=1') ? '"issue": "capture-unavailable"' : '"pagesObserved": 1');
  await expect(host(page).locator('pre')).toContainText('"pendingRequests": 0');
  await expect(page.getByRole('button', { name: 'Prepare navigation' })).toBeEnabled();
}
export async function prepare(page: Page, outcome = 'ready') {
  await page.getByRole('button', { name: 'Prepare navigation' }).click();
  await expect(host(page)).toHaveAttribute('data-phase', outcome);
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
