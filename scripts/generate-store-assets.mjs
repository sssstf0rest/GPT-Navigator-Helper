import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const out = path.join(root, 'store-assets');
await mkdir(path.join(out, 'sources'), { recursive: true });
await copyFile('public/licenses/Geist-OFL.txt', path.join(out, 'sources/Geist-OFL.txt'));
const server = spawn(process.execPath, ['tests/native-fixture/server.mjs'], { stdio: 'ignore' });
let context;
let browser;
try {
  for (let i = 0; i < 80; i++) {
    if (await fetch('http://127.0.0.1:4173/health').then(r => r.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${path.join(root, 'dist')}`, `--load-extension=${path.join(root, 'dist')}`],
  });
  await context.route('https://chatgpt.com/**', async route => {
    const url = new URL(route.request().url());
    const response = await fetch(`http://127.0.0.1:4173${url.pathname}${url.search}`);
    await route.fulfill({ status: response.status, contentType: response.headers.get('content-type') ?? 'text/plain', body: Buffer.from(await response.arrayBuffer()) });
  });
  const chat = await context.newPage();
  await chat.goto('https://chatgpt.com/c/store-demo?count=30');
  await chat.waitForFunction(() => window.nativeFixture?.ready);
  const cdp = await context.newCDPSession(chat);
  let origin = '';
  cdp.on('Runtime.executionContextCreated', ({ context: world }) => {
    if (world.origin.startsWith('chrome-extension://')) origin = world.origin;
  });
  await cdp.send('Runtime.enable');
  if (!origin) throw new Error('Extension world missing');
  await cdp.detach();
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 320, height: 420 });
  await chat.bringToFront();
  await popup.goto(`${origin}/src/popup/index.html`);
  const shell = popup.locator('main');
  await popup.waitForFunction(() => document.querySelector('.prompts')?.textContent === '30' && document.querySelector('.visibility')?.textContent === 'Visible');
  await popup.evaluate(() => document.fonts.ready);
  await shell.screenshot({ omitBackground: true, path: path.join(out, 'sources/popup-light.png') });
  await chat.evaluate(() => { document.documentElement.classList.remove('dark'); return window.nativeFixture.changeRoute('store-short', 'count=4'); });
  await popup.waitForFunction(() => document.querySelector('.prompts')?.textContent === '4' && document.querySelector('.reason')?.textContent.includes('at least 5'));
  await shell.screenshot({ omitBackground: true, path: path.join(out, 'sources/popup-short.png') });
  await context.close(); context = null;

  const svg = await readFile('icons/chatgpt-conversation-navigator.svg', 'utf8');
  const logo = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const font = `data:font/woff2;base64,${(await readFile('src/popup/fonts/geist-latin-variable.woff2')).toString('base64')}`;
  const png = async name => `data:image/png;base64,${(await readFile(path.join(out, 'sources', name))).toString('base64')}`;
  const light = await png('popup-light.png'), short = await png('popup-short.png');
  const css = `@font-face{font-family:Geist;src:url('${font}') format('woff2');font-weight:100 900}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Geist,sans-serif;-webkit-font-smoothing:antialiased;color:#202020;background:#ffffff}.canvas{position:relative;width:100%;height:100%}.brand{position:absolute;left:64px;top:48px;display:flex;align-items:center;gap:14px;font-size:18px;font-weight:500;letter-spacing:-.4px}.brand img{width:46px;height:46px}h1{font-weight:500;letter-spacing:-.055em;line-height:1.07;margin:0}p{margin:0;font-weight:400;line-height:1.55;letter-spacing:-.025em}.muted{color:#666}.rule{position:absolute;top:126px;left:64px;right:64px;height:1px;background:#e5e5e5}.panel{display:block;border-radius:22px;outline:1px solid #e2e2e2;box-shadow:0 20px 60px #00000008}.footer{position:absolute;bottom:44px;left:64px;color:#777;font-size:13px;letter-spacing:-.1px}.caption{font-size:13px;color:#888;letter-spacing:0}`;
  const brand = `<div class="brand"><img src="${logo}" alt=""><span>GPT Navigator Helper</span></div>`;
  const defs = [
    { name: '01-small-promo-440x280', w: 440, h: 280, html: `<div class="canvas"><div style="position:absolute;left:34px;top:46px;width:104px;height:104px;background:#f7f7f7;border-radius:26px;display:grid;place-items:center"><img src="${logo}" style="width:104px;height:104px"></div><h1 style="position:absolute;left:164px;top:57px;font-size:30px;line-height:1.1;letter-spacing:-1.3px">GPT Navigator<br>Helper</h1><div style="position:absolute;left:34px;right:34px;top:184px;height:1px;background:#e5e5e5"></div><p style="position:absolute;left:34px;top:211px;font-size:14px;color:#666">Missing navigator? Get it back.</p></div>` },
    { name: '02-marquee-1400x560', w: 1400, h: 560, html: `<div class="canvas">${brand}<h1 style="position:absolute;left:78px;top:192px;font-size:68px">Missing navigator?<br>Get it back.</h1><p class="muted" style="position:absolute;left:80px;top:390px;font-size:21px">Helps fix ChatGPT’s native navigator loading issue.</p><div style="position:absolute;left:1016px;top:158px;width:244px;height:244px;background:#f7f7f7;border-radius:56px;display:grid;place-items:center"><img src="${logo}" style="width:244px;height:244px"></div></div>` },
    { name: '03-screenshot-automatic-1280x800', w: 1280, h: 800, html: `<div class="canvas">${brand}<div class="rule"></div><h1 style="position:absolute;left:64px;top:256px;font-size:56px">Your navigator.<br>Back in view.</h1><p class="muted" style="position:absolute;left:66px;top:412px;width:465px;font-size:21px">Helps fix a missing ChatGPT native navigator by loading conversation history automatically.</p><img class="panel" src="${light}" style="position:absolute;left:696px;top:245px;width:512px"><div class="footer">Automatic history loading · Native ChatGPT navigation</div></div>` },
    { name: '04-screenshot-themes-1280x800', w: 1280, h: 800, html: `<div class="canvas">${brand}<div class="rule"></div><h1 style="position:absolute;left:64px;top:276px;font-size:56px">Fits right in.</h1><p class="muted" style="position:absolute;left:66px;top:370px;width:450px;font-size:21px">A clean, minimal panel. Navigator status at a glance.</p><img class="panel" src="${light}" style="position:absolute;left:696px;top:245px;width:512px"><div class="footer">Simple, clear, and out of your way</div></div>` },
    { name: '05-screenshot-status-1280x800', w: 1280, h: 800, html: `<div class="canvas">${brand}<div class="rule"></div><h1 style="position:absolute;left:64px;top:276px;font-size:56px">Know where<br>things stand.</h1><p class="muted" style="position:absolute;left:66px;top:432px;width:450px;font-size:21px">See navigator visibility, observed prompts, and a brief explanation when navigation is unavailable.</p><img class="panel" src="${short}" style="position:absolute;left:720px;top:212px;width:448px"><div class="footer">Clear status · No manual controls</div></div>` },
  ];
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const manifest = [];
  for (const def of defs) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${def.name}</title><style>${css}</style></head><body>${def.html}</body></html>`;
    await writeFile(path.join(out, 'sources', `${def.name}.html`), html);
    await page.setViewportSize({ width: def.w, height: def.h });
    await page.setContent(html);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
    const bytes = await page.screenshot({ path: path.join(out, `${def.name}.png`) });
    manifest.push({ file: `${def.name}.png`, width: def.w, height: def.h, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    console.log(`${def.name}.png ${def.w}x${def.h}`);
  }
  await writeFile(path.join(out, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
} finally {
  await context?.close(); await browser?.close(); server.kill();
}
