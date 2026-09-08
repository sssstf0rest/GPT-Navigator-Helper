import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

function historyPage(id, options) {
  const count = Math.min(1500, Math.max(1, Number(options.get('count')) || 220));
  const total = count * 2;
  const before = options.get('before');
  const requested = Number(options.get('num_turns')) || 6;
  const size = options.has('ignore') ? 6 : Math.min(100, Math.max(1, requested));
  const end = before ? Number(before.replace('cursor-', '')) : total;
  const start = Math.max(0, end - size * 2);
  const rows = [];
  const repeat = before && options.has('repeat');
  const from = repeat ? end : start;
  const until = repeat ? Math.min(total, end + 12) : end;
  for (let i = from; i < until; i++) {
    rows.push({ id: `${id}-m${i}`, author: { role: i % 2 ? 'assistant' : 'user' },
      content: { parts: [i % 2 ? `Response ${Math.floor(i / 2) + 1}. A detailed answer with variable height. Earlier messages are fetched only when this conversation requests them.` : `Question ${Math.floor(i / 2) + 1}: ${i % 6 ? 'How does this part of the system work?' : 'Continue'}`] },
      fixtureHeight: i % 2 ? (options.has('huge') && i % 7 === 0 ? 3500 : 230 + (i * 73) % 480) : 110 });
  }
  const payload = { conversation_id: id, current_node: options.has('mismatch') && before ? 'other-branch' : `${id}-tail`, messages: rows,
    page_info: { has_previous_page: repeat ? true : start > 0, start_cursor: repeat ? before : start > 0 ? `cursor-${start}` : null } };
  return options.has('unknown') ? { fixtureOnly: payload } : payload;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4173');
  const send = (body, type = 'text/html', status = 200) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
  if (url.pathname === '/health') return send('native-helper-fixture', 'text/plain');
  if (url.pathname === '/native-fixture.js') return send(await readFile(new URL('./fixture.js', import.meta.url)), 'text/javascript');
  if (url.pathname.startsWith('/backend-api/')) {
    const parts = url.pathname.split('/'); const older = parts.at(-1) === 'messages';
    if (older) await new Promise(resolve => setTimeout(resolve, Math.min(5000, Number(url.searchParams.get('delay')) || 250)));
    if (older && url.searchParams.has('fail')) return send('{"error":"fixture failure"}', 'application/json', 503);
    return send(JSON.stringify(historyPage(older ? parts.at(-2) : parts.at(-1), url.searchParams)), 'application/json');
  }
  send(await readFile(new URL('./index.html', import.meta.url)));
}).listen(4173, '127.0.0.1', () => console.log('Native helper fixture: http://127.0.0.1:4173'));
