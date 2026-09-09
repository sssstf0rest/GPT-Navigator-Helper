import { test, expect, host, anchor, expectAnchor } from './support';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function openAutomatic(page: Page, query = 'count=220&delay=450') {
  await page.goto(`https://chatgpt.com/c/fixture-a?${query}`);
  await page.waitForFunction(() => window.nativeFixture?.ready);
  await expect(host(page)).toBeAttached();
}
async function details(page: Page) {
  await page.getByRole('button', { name: 'Open native navigator helper' }).click();
}
async function cleanTrigger(page: Page) {
  expect(await page.locator('[data-testid="conversation-pagination-sentinel"]').evaluateAll(els =>
    els.every(el => !el.getAttribute('style')?.includes('important')))).toBe(true);
}

test('opens with a larger first batch and automatically loads remaining history without a reading-position jump', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', r => { if (r.url().includes('/backend-api/')) requests.push(r.url()); });
  await openAutomatic(page);
  await expect(page.getByRole('region', { name: 'Native navigator helper' })).toBeHidden();
  const saved = await anchor(page);
  const initialTop = await page.evaluate(() => { window.nativeFixture.startSampling(); return window.nativeFixture.scrollTop; });
  await expect(host(page)).toHaveAttribute('data-phase', 'automatic-loading');
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/seamless-preparing.png' });
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  await page.screenshot({ path: 'output/playwright/seamless-ready.png' });
  await expectAnchor(page, saved);
  const samples = await page.evaluate(() => window.nativeFixture.anchorSamples);
  expect(samples.length).toBeGreaterThan(10);
  expect(samples.filter(x => x === null).length).toBe(0);
  expect(Math.max(...samples.map(x => Math.abs(x!)))).toBeLessThanOrEqual(4);
  expect(await page.evaluate(() => window.nativeFixture.minTop)).toBeGreaterThanOrEqual(initialTop - 4);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(440);
  expect(requests).toHaveLength(3);
  expect(requests.every(url => new URL(url).searchParams.get('num_turns') === '100')).toBe(true);
  await cleanTrigger(page);
  for (const n of [1, 110, 220]) {
    await page.getByRole('button', { name: `Prompt ${n}`, exact: true }).click();
    await expect(page.locator(`[data-message-id="fixture-a-m${(n - 1) * 2}"]`)).toBeVisible();
  }
});

test('a complete first response needs no later pagination and changed native labels stay detected', async ({ page }) => {
  await openAutomatic(page, 'count=30&labels=1');
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(1);
  expect(await page.locator('button[data-toc-item-index]')).toHaveCount(30);
  await details(page);
  await expect(host(page).locator('pre')).toContainText('"nativeControls": 30');
  await page.screenshot({ path: 'output/playwright/seamless-details.png' });
});

test('four-prompt conversations explain the native minimum without trying to scroll', async ({ page }) => {
  await openAutomatic(page, 'count=4');
  const saved = await anchor(page);
  await expect(host(page)).toHaveAttribute('data-phase', 'loaded-no-native');
  await details(page);
  await expect(page.getByRole('status')).toContainText('requires at least 5 user turns');
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(1);
  await expectAnchor(page, saved);
});

test('automatic loading honors server caps and keeps a position inside a huge answer', async ({ page }) => {
  await openAutomatic(page, 'count=32&ignore=1&huge=1&delay=300');
  const saved = await anchor(page);
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  await expectAnchor(page, saved);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(64);
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(6);
});

test('Stop restores sentinel styles and never starts another page after an in-flight response', async ({ page }) => {
  await openAutomatic(page, 'count=400&delay=1500');
  const saved = await anchor(page);
  await page.waitForFunction(() => window.nativeFixture.pending);
  await page.getByRole('button', { name: 'Stop automatic preparation', exact: true }).click();
  await expect(host(page)).toHaveAttribute('data-phase', 'cancelled');
  await cleanTrigger(page);
  await page.waitForFunction(() => !window.nativeFixture.pending);
  await expectAnchor(page, saved);
  const count = await page.evaluate(() => window.nativeFixture.requests);
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(count);
});

test('user scrolling immediately ends automatic loading without restoration over the user', async ({ page }) => {
  await openAutomatic(page, 'count=400&delay=1200');
  await page.waitForFunction(() => window.nativeFixture.pending);
  await page.locator('main').hover(); await page.mouse.wheel(0, -350);
  await expect(host(page)).toHaveAttribute('data-phase', 'cancelled');
  await cleanTrigger(page);
  await page.waitForFunction(() => !window.nativeFixture.pending);
  const top = await page.evaluate(() => window.nativeFixture.scrollTop);
  const count = await page.evaluate(() => window.nativeFixture.requests);
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(count);
  expect(await page.evaluate(() => window.nativeFixture.scrollTop)).toBe(top);
});

test('unsupported and constrained sentinel layouts stop without automatic scrolling fallback', async ({ page }) => {
  for (const option of ['legacy=1', 'constrained=1']) {
    await openAutomatic(page, `count=220&${option}`);
    const saved = await anchor(page);
    await expect(host(page)).toHaveAttribute('data-phase', 'incompatible');
    expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(1);
    await expectAnchor(page, saved); await cleanTrigger(page);
  }
});

test('unsafe anchoring defers; resuming a stable layout starts preparation', async ({ page }) => {
  await openAutomatic(page, 'count=220&noanchor=1');
  await expect(host(page)).toHaveAttribute('data-phase', 'deferred');
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(1);
  await page.locator('main').evaluate(el => { el.style.overflowAnchor = 'auto'; });
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
});

test('network errors and repeated cursors stop once without retry loops', async ({ page }) => {
  for (const [option, outcome] of [['fail=1', 'network-error'], ['repeat=1', 'stalled']] as const) {
    await openAutomatic(page, `count=220&${option}`);
    const saved = await anchor(page);
    await expect(host(page)).toHaveAttribute('data-phase', outcome);
    await cleanTrigger(page); await expectAnchor(page, saved);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(2);
  }
});

test('a changed reading layout stops subsequent preparation', async ({ page }) => {
  await openAutomatic(page, 'count=400&drift=1');
  await expect(host(page)).toHaveAttribute('data-phase', 'layout-changed');
  await cleanTrigger(page);
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(2);
});

test('route changes isolate stale responses and automatically prepare the new conversation', async ({ page }) => {
  await openAutomatic(page, 'count=400&delay=1400');
  await page.waitForFunction(() => window.nativeFixture.pending);
  await page.evaluate(() => window.nativeFixture.changeRoute('fixture-b', 'count=150&delay=300'));
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  await page.waitForTimeout(1600);
  expect(await page.evaluate(() => window.nativeFixture.earliest)).toBe('fixture-b-m0');
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(300);
  await cleanTrigger(page);
});

test('message deep links preserve their original request and do not start automatic pagination', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', r => { if (r.url().includes('/backend-api/')) urls.push(r.url()); });
  await openAutomatic(page, 'count=220&message=target-message');
  await expect(host(page)).toHaveAttribute('data-phase', 'deferred');
  expect(urls).toHaveLength(1);
  expect(new URL(urls[0]!).searchParams.has('num_turns')).toBe(false);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(12);
});

test('Pause ends an active run, stays paused across routes, and Resume prepares the current conversation', async ({ page }) => {
  await openAutomatic(page, 'count=400&delay=1200');
  await page.waitForFunction(() => window.nativeFixture.pending);
  await details(page);
  await page.getByRole('button', { name: 'Pause automatic preparation' }).click();
  await expect(host(page)).toHaveAttribute('data-phase', 'paused');
  await cleanTrigger(page);
  await page.evaluate(() => window.nativeFixture.changeRoute('fixture-b', 'count=150&delay=80'));
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(12);
  await page.getByRole('button', { name: 'Resume automatic preparation' }).click();
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  expect(await page.evaluate(() => window.nativeFixture.earliest)).toBe('fixture-b-m0');
});

test('visibility lifecycle stops a run and leaves hidden-route initial requests unchanged', async ({ page, context }) => {
  await openAutomatic(page, 'count=400&delay=1200');
  const cdp = await context.newCDPSession(page);
  const worlds: number[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context: world }) => {
    if (world.auxData?.isDefault || world.origin.startsWith('chrome-extension://')) worlds.push(world.id);
  });
  await cdp.send('Runtime.enable');
  expect(worlds.length).toBeGreaterThanOrEqual(2);
  const visibility = async (hidden: boolean) => {
    // Playwright keeps tabs visible. Model the browser state in BOTH real script worlds;
    // a page-only property override cannot reach the extension's isolated Document wrapper.
    for (const contextId of worlds) {
      const result = await cdp.send('Runtime.evaluate', { contextId, expression: hidden ?
        `Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
         Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });` :
        'delete document.visibilityState; delete document.hidden;' });
      expect(result.exceptionDetails).toBeUndefined();
    }
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  };
  await page.waitForFunction(() => window.nativeFixture.pending);
  await visibility(true);
  await expect(host(page)).toHaveAttribute('data-phase', 'cancelled');
  await cleanTrigger(page);
  await page.evaluate(() => window.nativeFixture.changeRoute('fixture-b', 'count=150&delay=80'));
  await page.waitForTimeout(1400);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(12);
  const saved = await anchor(page);
  await visibility(false);
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  await expectAnchor(page, saved);
});

test('streaming defers loading until the host layout becomes stable', async ({ page }) => {
  await openAutomatic(page, 'count=150&streaming=1&delay=80');
  await expect(host(page)).toHaveAttribute('data-phase', 'deferred');
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(1);
  await page.locator('main').evaluate(el => { delete el.dataset.streamActive; });
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
});

test('complete history status follows native controls becoming visible on resize', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1000 });
  await openAutomatic(page, 'count=30');
  await expect(host(page)).toHaveAttribute('data-phase', 'hidden');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(1);
});

test('manual preparation remains available after an incompatible automatic layout', async ({ page }) => {
  await openAutomatic(page, 'count=220&legacy=1&delay=80');
  const saved = await anchor(page);
  await expect(host(page)).toHaveAttribute('data-phase', 'incompatible');
  await details(page);
  await page.getByRole('button', { name: 'Prepare navigation', exact: true }).click();
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  await expectAnchor(page, saved);
});

test('the page budget allows the last permitted page to complete but never starts an extra page', async ({ page }) => {
  for (const [count, outcome] of [[126, 'ready'], [127, 'limit']] as const) {
    await openAutomatic(page, `count=${count}&ignore=1&delay=40`);
    await expect(host(page)).toHaveAttribute('data-phase', outcome);
    await cleanTrigger(page);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(21);
  }
});
