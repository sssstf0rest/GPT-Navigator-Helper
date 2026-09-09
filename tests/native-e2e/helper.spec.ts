import { test, expect, host, open, prepare, anchor, expectAnchor } from './support';
import { mkdir } from 'node:fs/promises';

test('prepares real missing pages, restores reading position, and leaves native first/middle/last jumps to the host', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(12);
  await expect(page.getByRole('navigation', { name: 'Fixture native prompt navigation' })).toHaveCount(0);
  await expect(page.locator('main [data-message-id="fixture-a-m0"]')).toHaveCount(0);
  const saved = await anchor(page);
  await prepare(page);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(440);
  await expect(host(page).locator('pre')).toContainText('"promptsObserved": 220');
  await expect(page.getByRole('status')).toContainText('History loaded and native navigator visible');
  await expectAnchor(page, saved);
  await expect(page.locator('[data-conversation-navigator]')).toHaveCount(0);
  for (const n of [1, 110, 220]) {
    await page.getByRole('button', { name: `Prompt ${n}`, exact: true }).click();
    const message = page.locator(`main [data-message-id="fixture-a-m${(n - 1) * 2}"]`);
    await expect(message).toBeVisible();
    const offset = await message.evaluate(el => el.getBoundingClientRect().top - document.querySelector('main')!.getBoundingClientRect().top);
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(await page.locator('main').evaluate(el => el.clientHeight - 8));
    expect(await message.evaluate(el => {
      const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 8);
      return hit === el || (hit !== null && el.contains(hit));
    })).toBe(true);
  }
});

test('pausing automatic preparation preserves manual batching until the tab reloads', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/backend-api/')) requests.push(request.url()); });
  await open(page, 'count=30');
  expect(new URL(requests[1]!).searchParams.has('num_turns')).toBe(false);
  await prepare(page);
  expect(requests.slice(2).every(url => new URL(url).searchParams.get('num_turns') === '100')).toBe(true);
  await expect(host(page).locator('pre')).toContainText('"largerBatches": false');
  await page.reload(); await page.waitForFunction(() => window.nativeFixture?.ready);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(60);
  expect(new URL(requests.at(-1)!).searchParams.get('num_turns')).toBe('100');
});

test('server batch limits still permit sequential preparation', async ({ page }) => {
  await open(page, 'count=24&ignore=1&delay=350');
  await prepare(page);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(48);
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(5);
});

test('slow pages do not cause repeated scroll probes while pending', async ({ page }) => {
  await open(page, 'count=30&delay=1600');
  await page.getByRole('button', { name: 'Prepare navigation' }).click();
  await page.waitForFunction(() => window.nativeFixture.pending);
  await page.waitForTimeout(350);
  const count = await page.evaluate(() => window.nativeFixture.scrollEvents);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.nativeFixture.scrollEvents)).toBe(count);
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
});

test('wheel interruption releases control and never restores over the user', async ({ page }) => {
  await open(page, 'count=220&delay=1200');
  await page.getByRole('button', { name: 'Prepare navigation' }).click();
  await page.waitForFunction(() => window.nativeFixture.pending);
  await page.locator('main').hover(); await page.mouse.wheel(0, 350);
  await expect(host(page)).toHaveAttribute('data-phase', 'cancelled');
  await expect(page.getByRole('status')).toContainText('You have control');
  await page.waitForFunction(() => !window.nativeFixture.pending);
  const requests = await page.evaluate(() => window.nativeFixture.requests);
  const top = await page.evaluate(() => window.nativeFixture.scrollTop);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(requests);
  expect(await page.evaluate(() => window.nativeFixture.scrollTop)).toBe(top);
  await expect(host(page).locator('pre')).toContainText('"largerBatches": false');
});

test('Stop and return restores the anchor even with an older page in flight', async ({ page }) => {
  await open(page, 'count=220&delay=1200');
  const saved = await anchor(page);
  await page.getByRole('button', { name: 'Prepare navigation' }).click();
  await page.waitForFunction(() => window.nativeFixture.pending);
  await page.getByRole('button', { name: 'Stop and return' }).click();
  await expect(host(page)).toHaveAttribute('data-phase', 'cancelled');
  await page.waitForFunction(() => !window.nativeFixture.pending);
  await expectAnchor(page, saved);
});

test('route changes reject late history and prevent restoration into the next conversation', async ({ page }) => {
  await open(page, 'count=220&delay=1500');
  await page.getByRole('button', { name: 'Prepare navigation' }).click();
  await page.waitForFunction(() => window.nativeFixture.pending);
  await page.evaluate(() => window.nativeFixture.changeRoute('fixture-b', 'count=24'));
  await expect(page.getByRole('button', { name: 'Prepare navigation' })).toBeEnabled();
  const top = await page.evaluate(() => window.nativeFixture.scrollTop);
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => window.nativeFixture.scrollTop)).toBe(top);
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(12);
  await expect(host(page).locator('pre')).toContainText('"promptsObserved": 6');
  await prepare(page);
  await expect(page.getByRole('button', { name: 'Prompt 24', exact: true })).toHaveCount(1);
});

test('a same-route conversation replacement cancels active preparation', async ({ page }) => {
  await open(page, 'count=220&delay=1200');
  await page.getByRole('button', { name: 'Prepare navigation' }).click();
  await page.waitForFunction(() => window.nativeFixture.pending);
  await page.evaluate(() => window.nativeFixture.branch());
  await expect(page.getByRole('button', { name: 'Prepare navigation' })).toBeEnabled();
  const top = await page.evaluate(() => window.nativeFixture.scrollTop);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.nativeFixture.scrollTop)).toBe(top);
  await expect(host(page).locator('pre')).toContainText('"promptsObserved": 3');
});

test('repeating pagination stops with an explicit failure instead of looping', async ({ page }) => {
  await open(page, 'count=220&repeat=1');
  const saved = await anchor(page);
  await prepare(page, 'stalled');
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(3);
  await expect(page.getByRole('status')).toContainText('did not make further loading progress');
  await expectAnchor(page, saved);
  await page.evaluate(() => window.nativeFixture.recover());
  await prepare(page);
});

test('HTTP failure restores position and explains the problem', async ({ page }) => {
  await open(page, 'count=220&fail=1'); const saved = await anchor(page);
  await prepare(page, 'network-error'); await expectAnchor(page, saved);
  await expect(page.getByRole('status')).toContainText('history request failed');
  await page.evaluate(() => window.nativeFixture.recover());
  await prepare(page);
});

test('an unresponsive history edge times out without repeated scroll movement', async ({ page }) => {
  await open(page, 'count=220&stuck=1'); const saved = await anchor(page);
  await page.getByRole('button', { name: 'Prepare navigation' }).click();
  await page.waitForTimeout(1200);
  const events = await page.evaluate(() => window.nativeFixture.scrollEvents);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.nativeFixture.scrollEvents)).toBe(events);
  await expect(host(page)).toHaveAttribute('data-phase', 'stalled');
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(2);
  await expectAnchor(page, saved);
});

test('history completion without a native component is not reported as ready', async ({ page }) => {
  await open(page, 'count=30&railoff=1'); await prepare(page, 'loaded-no-native');
  await expect(page.getByRole('status')).toContainText('no native navigator was detected');
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(60);
});

test('narrow hidden native controls are distinguished from absent controls', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await open(page, 'count=30'); await prepare(page, 'hidden');
  await expect(page.getByRole('status')).toContainText('native navigator is hidden');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepare(page);
});

test('unrecognized responses never invent full history coverage', async ({ page }) => {
  await open(page, 'count=30&unknown=1'); await prepare(page, 'available');
  await expect(page.getByRole('status')).toContainText('Full history could not be confirmed');
  await expect(host(page).locator('pre')).toContainText('"history": "unknown"');
});

test('short already prepared conversations need no pagination', async ({ page }) => {
  await open(page, 'count=3'); await prepare(page, 'loaded-no-native');
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(2);
});

test('restores a position inside an oversized answer in a 501-prompt conversation', async ({ page }) => {
  await open(page, 'count=501&huge=1');
  const saved = await anchor(page);
  expect(saved.offset).toBeLessThan(0); // The beginning of this answer is above the viewport.
  await prepare(page);
  await expectAnchor(page, saved);
  await expect(host(page).locator('pre')).toContainText('"promptsObserved": 501');
  await page.getByRole('button', { name: 'Prompt 1', exact: true }).click();
  await expect(page.locator('main [data-message-id="fixture-a-m0"]')).toBeVisible();
});

test('a native component that disappears on return is not reported as ready', async ({ page }) => {
  await open(page, 'count=30&hideonreturn=1');
  await prepare(page, 'loaded-no-native');
  await expect(page.getByRole('status')).toContainText('no native navigator was detected');
});

test('keyboard/minimize controls and fixture screenshots', async ({ page }) => {
  await open(page, 'count=30');
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/native-helper-before.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Minimize helper' }).click();
  await expect(page.getByRole('region', { name: 'Native navigator helper' })).toBeHidden();
  await page.getByRole('button', { name: 'Open native navigator helper' }).press('Enter');
  await page.getByRole('button', { name: 'Prepare navigation' }).press('Enter');
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  await page.screenshot({ path: 'output/playwright/native-helper-ready.png', animations: 'disabled' });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(host(page).locator('.shell')).toHaveClass(/dark/);
  await page.screenshot({ path: 'output/playwright/native-helper-dark.png', animations: 'disabled' });
});
