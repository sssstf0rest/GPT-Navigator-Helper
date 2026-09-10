import { test, expect, host, panel, openPanel } from './support';
import { PANEL_CHANNEL } from '../../src/native/panelState';
import { mkdir } from 'node:fs/promises';

async function open(page: import('@playwright/test').Page, query = 'count=30') {
  await page.goto(`https://chatgpt.com/c/fixture-a?${query}`);
  await page.waitForFunction(() => window.nativeFixture?.ready);
  await openPanel(page);
}

test('minimal popup has only the requested information and loading continues when closed', async ({ page }) => {
  await open(page, 'count=400&delay=900');
  expect(await panel(page).evaluate(() => chrome.action.getPopup({}))).toBe(panel(page).url());
  await expect(panel(page).getByRole('heading')).toHaveText('GPT NAVIGATOR HELPER');
  await expect(panel(page).locator('button, details, input')).toHaveCount(0);
  await page.waitForFunction(() => window.nativeFixture.pending);
  await panel(page).close();
  await page.waitForFunction(() => window.nativeFixture.loaded === 800);
  await expect(page.locator('#native-navigator-helper, [data-native-navigator-helper]')).toHaveCount(0);
  await openPanel(page);
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  await expect(host(page).locator('.prompts')).toHaveText('400');
  await expect(host(page).locator('.visibility')).toHaveText('Visible');
});

test('popup follows each active tab and updates a four-prompt explanation on route changes', async ({ page, context }) => {
  await open(page);
  await expect(host(page).locator('.prompts')).toHaveText('30');
  const other = await context.newPage();
  await other.goto('https://chatgpt.com/c/fixture-b?count=4');
  await other.waitForFunction(() => window.nativeFixture?.ready);
  await expect(host(page).locator('.prompts')).toHaveText('4');
  await expect(panel(page).getByRole('status')).toContainText('with at least 5 prompts');
  await other.evaluate(() => window.nativeFixture.changeRoute('fixture-c', 'count=7'));
  await expect(host(page).locator('.prompts')).toHaveText('7');
  await expect(host(page).locator('.visibility')).toHaveText('Visible');
  await expect(host(page).locator('.reason')).toBeHidden();
  await page.bringToFront();
  await expect(host(page).locator('.prompts')).toHaveText('30');
});

test('unsupported tabs show unavailable status rather than an invented zero prompt count', async ({ page, context }) => {
  await open(page);
  const other = await context.newPage(); await other.goto('about:blank');
  await expect(host(page)).toHaveAttribute('data-phase', 'unavailable');
  await expect(host(page).locator('.prompts')).toHaveText('—');
  await expect(host(page).locator('.visibility')).toHaveText('Unavailable');
  await expect(panel(page).getByRole('status')).toContainText('Open a ChatGPT conversation');
  await page.bringToFront();
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
});

test('legacy manual and pause messages cannot control the automatic-only extension', async ({ page }) => {
  await open(page, 'count=220&legacy=1');
  await expect(host(page)).toHaveAttribute('data-phase', 'incompatible');
  await panel(page).evaluate(async channel => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('Missing active fixture tab');
    for (const command of ['prepare', 'stop', 'toggle-automatic']) {
      await chrome.tabs.sendMessage(tab.id, { channel, command }).catch(() => {});
    }
  }, PANEL_CHANNEL);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.nativeFixture.requests)).toBe(1);
  await page.evaluate(() => {
    window.postMessage({ channel: 'native-navigator-helper:v1', kind: 'automatic', enabled: false }, location.origin);
    return window.nativeFixture.changeRoute('fixture-b', 'count=150');
  });
  await expect(host(page)).toHaveAttribute('data-phase', 'ready');
  expect(await page.evaluate(() => window.nativeFixture.loaded)).toBe(300);
});

test('short history explanation and five-prompt eligibility render in light and dark panels', async ({ page }) => {
  await open(page, 'count=3');
  await expect(host(page).locator('.prompts')).toHaveText('3');
  await expect(panel(page).getByRole('status')).toContainText('with at least 5 prompts');
  await mkdir('output/playwright', { recursive: true });
  await host(page).screenshot({ path: 'output/playwright/minimal-short.png' });
  await page.evaluate(() => window.nativeFixture.changeRoute('fixture-b', 'count=5'));
  await expect(host(page).locator('.visibility')).toHaveText('Visible');
  await expect(host(page).locator('.prompts')).toHaveText('5');
  await expect(host(page).locator('.reason')).toBeHidden();
  await host(page).screenshot({ path: 'output/playwright/minimal-ready.png' });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(host(page)).toHaveClass(/dark/);
  await host(page).screenshot({ path: 'output/playwright/minimal-dark.png' });
});

test('unknown payloads never claim the conversation is below the native minimum', async ({ page }) => {
  await open(page, 'count=3&unknown=1');
  await expect(host(page)).toHaveAttribute('data-phase', 'unverified');
  await expect(host(page).locator('.prompts')).toHaveText('—');
  await expect(panel(page).getByRole('status')).not.toContainText('requires at least');
});
