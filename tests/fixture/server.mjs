import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

function dataset(id, count, options) {
  const prompts = ['Map the architecture and its boundaries.', 'How should the data flow through the application?', 'Continue', 'Compare the implementation options.', 'Which edge cases should we test first?', 'Explain this with a concrete example.'];
  const mapping = { root: { parent: null, message: null } };
  const turns = [];
  let parent = 'root';
  for (let i = 0; i < count * 2; i++) {
    const user = i % 2 === 0;
    const messageId = `${id}-m${i}`;
    const nodeId = `${id}-n${i}`;
    const number = Math.floor(i / 2);
    const text = options.has('html') && user ? '<img src=x onerror="window.promptExecuted=true">' : user ? prompts[number % prompts.length] : `Response ${number + 1}. A structured explanation with enough detail to exercise variable-height rendering.`;
    const parts = options.get('attachment') === String(number) && user ? [{ content_type: 'image_asset_pointer' }] : [text];
    const message = { id: messageId, author: { role: user ? 'user' : 'assistant' }, content: { parts } };
    mapping[nodeId] = { parent, message };
    parent = nodeId;
    turns.push({ messageId, nodeId, role: message.author.role, text: typeof parts[0] === 'string' ? text : '[Image prompt]', height: user ? 110 : options.has('huge') && number % 9 === 0 ? 18_000 : 180 + (number * 173) % 850 });
  }
  if (options.has('branch')) {
    const messageId = `${id}-edited`;
    mapping.alternate = { parent: 'root', message: { id: messageId, author: { role: 'user' }, content: { parts: ['The selected edited branch.'] } } };
    parent = 'alternate';
    turns.splice(0, turns.length, { messageId, nodeId: parent, role: 'user', text: 'The selected edited branch.', height: 180 });
  }
  if (options.has('partial')) delete mapping.root;
  const data = { conversation_id: options.has('wrong') ? 'wrong-conversation' : id, current_node: parent, mapping, fixtureTurns: turns };
  if (options.has('flat')) {
    const all = Object.values(mapping).map((node) => node.message).filter(Boolean);
    const paged = options.has('pages'); const before = options.get('before');
    return { conversation_id: id, current_node: parent,
      messages: paged ? before ? all.slice(0, -18) : all.slice(-20) : all,
      page_info: { has_previous_page: !before, start_cursor: !before ? 'older-page' : null }, fixtureTurns: turns };
  }
  return data;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4173');
  const send = (body, type = 'text/html') => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
  if (url.pathname === '/health') return send('ok', 'text/plain');
  if (url.pathname.endsWith('/fixture.js')) return send(await readFile(new URL('./fixture.js', import.meta.url)), 'text/javascript');
  if (url.pathname.startsWith('/backend-api/') || url.pathname.startsWith('/fixture/history/')) {
    const path = url.pathname.split('/');
    const id = path.at(-1) === 'messages' ? path.at(-2) : path.at(-1);
    const count = Math.min(500, Math.max(1, Number(url.searchParams.get('count')) || 50));
    const delay = Math.min(3000, Number(url.searchParams.get('delay')) || 0);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (url.searchParams.has('malformed')) return send('{broken', 'application/json');
    return send(JSON.stringify(dataset(id, count, url.searchParams)), 'application/json');
  }
  send(await readFile(new URL('./index.html', import.meta.url)));
}).listen(4173, '127.0.0.1', () => console.log('Fixture server: http://127.0.0.1:4173'));
