import { test as base, chromium, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

declare global {
  interface Window {
    fixture: {
      ready: boolean; expectedPrompts: string[]; scrollTop: number;
      scrollTo(top: number): void; forceRemount(): void; hide(id: string): void;
      duplicate(id: string): void; branch(): Promise<void>;
      changeRoute(id: string, options?: { delay?: number; nested?: boolean; branch?: boolean }): Promise<void>;
      emptyWindow(ms?: number): void; changeHeight(): void; removeIds(): void;
      append(): void;
    };
  }
}

const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({}, use) => {
    const extension = path.resolve('dist');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    // Every ChatGPT request is answered by a local synthetic server. The release manifest is unmodified.
    await context.route('https://chatgpt.com/**', async (route) => {
      const url = new URL(route.request().url());
      const response = await fetch(`http://127.0.0.1:4173${url.pathname}${url.search}`);
      await route.fulfill({ status: response.status, contentType: response.headers.get('content-type') ?? 'text/plain', body: Buffer.from(await response.arrayBuffer()) });
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => { const page = await context.newPage(); await use(page); },
});

const measurements: { id: string; attempts: number; elapsedMs: number }[] = [];
test.afterAll(async () => {
  await mkdir('output/playwright', { recursive: true });
  const times = measurements.map(item => item.elapsedMs).sort((a, b) => a - b);
  await writeFile('output/playwright/jump-metrics.json', JSON.stringify({
    environment: 'Local synthetic fixture, production extension, Chromium 153, 1440x1000',
    verifiedJumps: measurements.length,
    p50Ms: times[Math.floor(times.length * 0.5)], p95Ms: times[Math.min(times.length - 1, Math.floor(times.length * 0.95))], measurements,
  }, null, 2));
});

async function open(page: Page, query = 'count=50') {
  await page.goto(`https://chatgpt.com/c/fixture-a?${query}`);
  await page.waitForFunction(() => window.fixture?.ready);
  await expect(page.getByRole('region', { name: 'Prompt outline' })).toBeVisible();
}
const promptButton = (page: Page, id: string) => page.locator(`[data-prompt-id="${id}"]`);

async function verifyJump(page: Page, id: string) {
  await promptButton(page, id).click();
  await expect(page.getByRole('status')).toContainText('is in view');
  await expect(page.locator(`main [data-message-id="${id}"]`)).toBeVisible();
  const geometry = await page.locator(`main [data-message-id="${id}"]`).evaluate((el) => {
    const r = el.getBoundingClientRect(); const v = document.querySelector('main')!.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 10);
    return { top: r.top, viewportTop: v.top, bottom: v.bottom, hit: hit === el || el.contains(hit) };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.viewportTop);
  expect(geometry.top).toBeLessThan(geometry.bottom - 8);
  expect(geometry.hit).toBe(true);
  await expect(promptButton(page, id)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-conversation-navigator] pre')).toContainText('"status": "success"');
  const details = JSON.parse((await page.locator('[data-conversation-navigator] pre').textContent())!);
  measurements.push({ id, attempts: details.lastJump.attempts, elapsedMs: details.lastJump.elapsedMs });
}

for (const count of [10, 50, 200, 500]) {
  test(`${count} prompts: early capture, bottom-to-first, first-to-last, duplicate text`, async ({ page }) => {
    await open(page, `count=${count}`);
    await expect(page.getByText('Full branch', { exact: true })).toBeVisible();
    await expect(page.locator('[data-prompt-id]')).toHaveCount(count);
    await expect(page.locator('main [data-message-id="fixture-a-m0"]')).toHaveCount(0);
    await verifyJump(page, 'fixture-a-m0');
    await verifyJump(page, `fixture-a-m${(count - 1) * 2}`);
    await verifyJump(page, 'fixture-a-m4'); // "Continue" also appears many times later.
  });
}

test('long answers, remounts, empty windows, and delayed height changes', async ({ page }) => {
  await open(page, 'count=50&huge=1');
  await verifyJump(page, 'fixture-a-m0');
  await page.evaluate(() => { window.fixture.changeHeight(); window.fixture.emptyWindow(); });
  await verifyJump(page, 'fixture-a-m98');
  await page.evaluate(() => window.fixture.forceRemount());
  await verifyJump(page, 'fixture-a-m4');
});

test('mounted conversation, search, collapse, and keyboard controls', async ({ page }) => {
  await open(page, 'count=10&mounted=1');
  await page.getByRole('searchbox', { name: 'Search prompts' }).fill('Continue');
  await expect(page.locator('[data-prompt-id]')).toHaveCount(2);
  await verifyJump(page, 'fixture-a-m4');
  await page.getByRole('searchbox').fill('nothing matches this');
  await expect(page.getByText('No matching prompts.')).toBeVisible();
  await page.getByRole('button', { name: 'Collapse navigator' }).click();
  await expect(page.getByRole('region', { name: 'Prompt outline' })).toBeHidden();
  await page.getByRole('button', { name: 'Open conversation navigator' }).press('Enter');
  await expect(page.getByRole('region', { name: 'Prompt outline' })).toBeVisible();
});

test('DOM fallback retains observed prompts but never claims full coverage', async ({ page }) => {
  await open(page, 'count=50&dom=1');
  await expect(page.getByText('Partial history', { exact: true })).toBeVisible();
  const oldIds = await page.locator('[data-prompt-id]').evaluateAll(els => els.map(el => el.getAttribute('data-prompt-id')));
  await page.evaluate(() => window.fixture.scrollTo(0));
  await expect(promptButton(page, 'fixture-a-m0')).toBeVisible();
  for (const id of oldIds) await expect(promptButton(page, id!)).toHaveCount(1);
});

test('partial graphs and unverified flat pages stay partial', async ({ page }) => {
  for (const shape of ['partial=1', 'flat=1']) {
    await open(page, `count=50&${shape}`);
    await expect(page.getByText('Partial history', { exact: true })).toBeVisible();
    await expect(page.locator('[data-prompt-id]')).toHaveCount(50);
    await verifyJump(page, 'fixture-a-m0');
  }
});

test('route transition quarantines old mounts and rejects a late previous response', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { void fetch('/backend-api/conversation/fixture-a?count=50&delay=900'); void window.fixture.changeRoute('fixture-b', { delay: 300, nested: true }); });
  await expect(page.locator('[data-prompt-id^="fixture-a"]')).toHaveCount(0);
  await expect(page.locator('[data-prompt-id^="fixture-b"]')).toHaveCount(50);
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-prompt-id^="fixture-a"]')).toHaveCount(0);
  await verifyJump(page, 'fixture-b-m0');
});

test('same-URL branch switch replaces the selected path', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.fixture.branch());
  await expect(page.locator('[data-prompt-id]')).toHaveCount(1);
  await expect(promptButton(page, 'fixture-a-edited')).toBeVisible();
  await verifyJump(page, 'fixture-a-edited');
});

test('a new click supersedes old navigation and user scrolling cancels it', async ({ page }) => {
  await open(page, 'count=500&huge=1');
  await promptButton(page, 'fixture-a-m0').click();
  await promptButton(page, 'fixture-a-m900').click();
  await expect(page.getByRole('status')).toHaveText('Prompt 451 is in view.');
  await promptButton(page, 'fixture-a-m0').click();
  await page.locator('main').hover();
  await page.mouse.wheel(0, 100);
  await expect(page.getByRole('status')).toHaveText('Navigation cancelled.');
  const top = await page.evaluate(() => window.fixture.scrollTop);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.fixture.scrollTop)).toBeCloseTo(top, 0);
});

test('ambiguous identities and unreachable targets never report success', async ({ page }) => {
  await open(page, 'count=10&mounted=1');
  await page.evaluate(() => window.fixture.duplicate('fixture-a-m0'));
  await promptButton(page, 'fixture-a-m0').click();
  await expect(page.getByRole('status')).toContainText('Several matches');
  await page.evaluate(() => window.fixture.hide('fixture-a-m4'));
  await promptButton(page, 'fixture-a-m4').click();
  await expect(page.getByRole('status')).toContainText('could not be brought into view');
});

test('missing IDs cannot turn duplicate text into exact matches', async ({ page }) => {
  await open(page, 'count=50&noids=1');
  await promptButton(page, 'fixture-a-m4').click();
  await expect(page.getByRole('status')).not.toContainText('is in view');
  await expect(page.getByRole('status')).not.toContainText('Finding');
});

test('reviewable light/dark and narrow-layout screenshots', async ({ page }) => {
  await open(page, 'count=50');
  await verifyJump(page, 'fixture-a-m4');
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/navigator-light.png', animations: 'disabled' });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(page.locator('.panel')).toHaveAttribute('data-dark', 'true');
  await page.screenshot({ path: 'output/playwright/navigator-dark.png', animations: 'disabled' });
  await page.setViewportSize({ width: 600, height: 800 });
  await page.reload();
  await page.waitForFunction(() => window.fixture?.ready);
  await expect(page.getByRole('button', { name: 'Open conversation navigator' })).toBeVisible();
  await page.screenshot({ path: 'output/playwright/navigator-narrow.png', animations: 'disabled' });
});

test('captured older flat pages extend history instead of replacing it', async ({ page }) => {
  await open(page, 'count=50&flat=1&pages=1');
  await expect(page.locator('[data-prompt-id]')).toHaveCount(10);
  await page.evaluate(() => fetch('/backend-api/conversations/fixture-a/messages?count=50&flat=1&pages=1&before=older-page').then(r => r.json()));
  await expect(page.locator('[data-prompt-id]')).toHaveCount(50);
  await expect(page.getByText('Partial history', { exact: true })).toBeVisible();
  await verifyJump(page, 'fixture-a-m0');
});

test('new mounted prompts extend the known tail and remain explicitly observational', async ({ page }) => {
  await open(page, 'count=10');
  await page.evaluate(() => window.fixture.append());
  await expect(page.locator('[data-prompt-id]')).toHaveCount(11);
  await expect(page.getByText('Partial history', { exact: true })).toBeVisible();
  await verifyJump(page, 'fixture-a-live');
});

test('route switch during navigation prevents old operations from scrolling the new chat', async ({ page }) => {
  await open(page, 'count=500&huge=1');
  await promptButton(page, 'fixture-a-m0').click();
  await page.evaluate(() => window.fixture.changeRoute('fixture-b'));
  await expect(page.locator('[data-prompt-id^="fixture-b"]')).toHaveCount(50);
  const top = await page.evaluate(() => window.fixture.scrollTop);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.fixture.scrollTop)).toBeCloseTo(top, 0);
  await expect(page.getByRole('status')).not.toContainText('is in view');
});

test('prompt markup is rendered as text and malformed bridge packets are ignored', async ({ page }) => {
  await open(page, 'count=10&html=1');
  await expect(page.locator('[data-conversation-navigator] img')).toHaveCount(0);
  await expect(promptButton(page, 'fixture-a-m0')).toContainText('<img src=x');
  await page.evaluate(() => window.postMessage({ channel: 'conversation-navigator:v1', kind: 'snapshot', generation: 0, sequence: 999, conversationId: 'fixture-a', snapshot: { turns: 'wrong shape' } }, location.origin));
  await expect(page.locator('[data-prompt-id]')).toHaveCount(10);
  await verifyJump(page, 'fixture-a-m0');
});

test('transparent or render-hidden targets cannot pass visibility verification', async ({ page }) => {
  await open(page, 'count=10&mounted=1');
  await page.locator('main [data-message-id="fixture-a-m0"]').evaluate(el => { (el.parentElement as HTMLElement).style.opacity = '0'; });
  await promptButton(page, 'fixture-a-m0').click();
  await expect(page.getByRole('status')).toContainText('could not be brought into view');
  await page.locator('main [data-message-id="fixture-a-m0"]').evaluate(el => {
    (el.parentElement as HTMLElement).style.opacity = '1';
    (el.parentElement as HTMLElement).style.contentVisibility = 'hidden';
  });
  await promptButton(page, 'fixture-a-m0').click();
  await expect(page.getByRole('status')).toContainText('could not be brought into view');
});

test('an explicit mismatched message ID outranks a reused container alias', async ({ page }) => {
  await open(page, 'count=10&mounted=1');
  await page.locator('main [data-message-id="fixture-a-m0"]').evaluate(el => {
    el.setAttribute('data-message-id', 'other-message');
    el.parentElement!.setAttribute('data-turn-id', 'fixture-a-n0');
  });
  await promptButton(page, 'fixture-a-m0').click();
  await expect(page.getByRole('status')).toHaveText('More history is needed to locate this prompt.');
});

export { test };
