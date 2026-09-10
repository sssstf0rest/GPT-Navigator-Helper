import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Render from the vector master: keep the original mark, remove excess canvas padding.
const source = (await readFile('icons/chatgpt-conversation-navigator.svg', 'utf8')).replace(/<\?xml[^>]*>/, '');
const sizes = new Map([[16, 1], [32, 2], [48, 3], [128, 16]]);
const before = new Map();
for (const size of sizes.keys()) before.set(size, (await readFile(`icons/icon${size}.png`)).toString('base64'));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(source);
  const bounds = await page.locator('svg').evaluate(svg => {
    const b = svg.getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height };
  });
  const after = new Map();
  for (const [size, padding] of sizes) {
    const side = Math.max(bounds.width, bounds.height) * size / (size - 2 * padding);
    const x = bounds.x + bounds.width / 2 - side / 2;
    const y = bounds.y + bounds.height / 2 - side / 2;
    const svg = source.replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${side} ${side}"`)
      .replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block}</style>${svg}`);
    const png = await page.screenshot({ omitBackground: true });
    await writeFile(`icons/icon${size}.png`, png);
    after.set(size, png.toString('base64'));
    console.log(`${size}px: ${size-2*padding}px maximum artwork span; ${padding}px minimum padding`);
  }
  await mkdir('output', { recursive: true });
  await page.setViewportSize({ width: 680, height: 380 });
  const cells = (images) => [...images].map(([size, png]) => `<div><img width="${size}" height="${size}" src="data:image/png;base64,${png}"><span>${size}px</span></div>`).join('');
  await page.setContent(`<style>body{margin:0;padding:24px;background:#f7f7f7;color:#222;font:14px system-ui}section{display:flex;align-items:center;gap:35px;height:160px}section>b{width:65px}section div{width:90px;display:flex;align-items:center;gap:8px;flex-direction:column}span{font-size:11px;color:#666}</style><section><b>Before</b>${cells(before)}</section><section><b>After</b>${cells(after)}</section>`);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
  await page.screenshot({ path: 'output/icon-padding-preview.png' });
} finally { await browser.close(); }
