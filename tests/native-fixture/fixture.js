const scroller = document.querySelector('main');
const timeline = document.querySelector('#timeline');
const spinner = document.querySelector('#spinner');
let options = new URLSearchParams(location.search);
let id = location.pathname.split('/').at(-1);
let loaded = [];
let offsets = [];
let pageInfo;
let pending = false;
let generation = 0;
let requests = 1;
let scrollEvents = 0;
let lastRange = '';

function layout() {
  let height = 0;
  offsets = loaded.map(message => { const y = height; height += message.fixtureHeight; return y; });
  timeline.style.height = `${height + 70}px`;
  lastRange = '';
}
function render() {
  const start = Math.max(0, offsets.findIndex((y, i) => y + loaded[i].fixtureHeight > scroller.scrollTop - 250));
  let end = start;
  while (end < loaded.length && offsets[end] < scroller.scrollTop + scroller.clientHeight + 250) end++;
  const range = `${start}:${end}`;
  if (range === lastRange) return;
  lastRange = range;
  const fragment = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    const message = loaded[i];
    const row = document.createElement('article'); row.style.top = `${offsets[i]}px`; row.style.height = `${message.fixtureHeight}px`;
    const bubble = document.createElement('div'); bubble.dataset.messageId = message.id; bubble.dataset.messageAuthorRole = message.author.role;
    bubble.textContent = message.content.parts[0];
    if (message.author.role === 'assistant') bubble.style.minHeight = `${message.fixtureHeight - 80}px`;
    row.append(bubble);
    if (message.author.role === 'assistant') {
      const note = document.createElement('p'); note.textContent = 'This older message was unavailable to the renderer until the host requested its history page.'; row.append(note);
    }
    fragment.append(row);
  }
  timeline.replaceChildren(fragment);
  const rail = document.querySelector('.native-rail');
  if (rail && options.has('hideonreturn') && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 8) rail.remove();
}
function updateNative() {
  document.querySelector('.native-rail')?.remove();
  if (pageInfo.has_previous_page || options.has('railoff')) return;
  const rail = document.createElement('nav'); rail.className = 'native-rail'; rail.ariaLabel = 'Fixture native prompt navigation';
  let number = 0;
  loaded.forEach((message, i) => {
    if (message.author.role !== 'user') return;
    const button = document.createElement('button'); button.ariaLabel = `Prompt ${++number}`; button.title = message.content.parts[0];
    button.onclick = () => { scroller.scrollTo({ top: offsets[i], behavior: 'instant' }); requestAnimationFrame(render); };
    rail.append(button);
  });
  document.body.append(rail);
}
function use(payload) {
  const data = payload.fixtureOnly ?? payload;
  loaded = data.messages; pageInfo = data.page_info;
  layout(); scroller.scrollTop = scroller.scrollHeight; render(); updateNative();
}
async function loadOlder() {
  if (pending || !pageInfo?.has_previous_page || options.has('stuck')) return;
  pending = true; spinner.hidden = false; requests++;
  const token = generation;
  const query = new URLSearchParams(options); query.set('before', pageInfo.start_cursor);
  try {
    const response = await fetch(`/backend-api/conversations/${id}/messages?${query}`);
    if (!response.ok) return;
    const payload = await response.json();
    if (token !== generation) return;
    const data = payload.fixtureOnly ?? payload;
    const top = scroller.scrollTop; const height = scroller.scrollHeight;
    const ids = new Set(loaded.map(m => m.id));
    loaded = [...data.messages.filter(m => !ids.has(m.id)), ...loaded];
    pageInfo = data.page_info;
    layout();
    // Simulate a host virtualizer retaining the current content anchor after prepending new pages.
    scroller.scrollTop = top + scroller.scrollHeight - height;
    render(); updateNative();
  } finally { if (token === generation) { pending = false; spinner.hidden = true; } }
}
scroller.addEventListener('scroll', () => {
  scrollEvents++;
  requestAnimationFrame(render);
  if (scroller.scrollTop < 30) void loadOlder();
});
new ResizeObserver(() => { lastRange = ''; render(); }).observe(scroller);
use(await window.nativeInitial);
window.nativeFixture = {
  ready: true,
  get loaded() { return loaded.length; }, get pending() { return pending; }, get requests() { return requests; },
  get scrollTop() { return scroller.scrollTop; }, get scrollEvents() { return scrollEvents; },
  get earliest() { return loaded[0]?.id; },
  scroll(top) { scroller.scrollTop = top; render(); },
  async changeRoute(nextId, query = 'count=24') {
    generation++; pending = false; id = nextId; options = new URLSearchParams(query);
    history.pushState({}, '', `/g/g-fixture/c/${id}?${query}`);
    use(await fetch(`/backend-api/conversations/${id}?${query}`).then(r => r.json()));
  },
  async branch() {
    generation++; pending = false;
    use(await fetch(`/backend-api/conversations/${id}?count=3`).then(r => r.json()));
  },
  grow() { loaded[0].fixtureHeight += 90; layout(); render(); },
  recover() { for (const key of ['fail', 'repeat', 'stuck']) options.delete(key); },
};
