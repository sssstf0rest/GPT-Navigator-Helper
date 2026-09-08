const scroller = document.querySelector('main');
const timeline = document.querySelector('#timeline');
const options = new URLSearchParams(location.search);
let turns = [];
let offsets = [];
let lastRange = '';
let paused = false;
let omitIds = options.has('noids');
let hiddenTarget = options.get('unreachable');

function layout() {
  let height = 0;
  offsets = turns.map(turn => { const top = height; height += turn.height; return top; });
  timeline.style.height = `${height + 180}px`;
  lastRange = '';
}

function render(force = false) {
  if (paused) return;
  const first = Math.max(0, offsets.findIndex((top, i) => top + turns[i].height >= scroller.scrollTop - 200));
  let last = first;
  while (last < turns.length && offsets[last] < scroller.scrollTop + scroller.clientHeight + 200) last++;
  const start = options.has('mounted') ? 0 : first;
  const end = options.has('mounted') ? turns.length : last;
  const range = `${start}:${end}`;
  if (range === lastRange && !force) return;
  lastRange = range;
  const fragment = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    const turn = turns[i];
    if (turn.messageId === hiddenTarget) continue;
    const article = document.createElement('article');
    article.style.top = `${offsets[i]}px`; article.style.height = `${turn.height}px`;
    const message = document.createElement('div');
    message.setAttribute('data-message-author-role', turn.role);
    if (!omitIds) message.setAttribute('data-message-id', turn.messageId);
    message.textContent = turn.text;
    article.append(message);
    if (turn.role === 'assistant') {
      const note = document.createElement('p'); note.className = 'response-note';
      note.textContent = 'Each response has its own height. Older turns leave the DOM as you scroll; their identities stay in the conversation history.';
      article.append(note);
    }
    fragment.append(article);
  }
  timeline.replaceChildren(fragment);
}

function use(data, bottom = true) {
  turns = data.fixtureTurns;
  layout();
  scroller.scrollTop = bottom ? scroller.scrollHeight : 0;
  render(true);
}
scroller.addEventListener('scroll', () => requestAnimationFrame(() => render()));
new ResizeObserver(() => render(true)).observe(scroller);
use(await window.initialHistory, !options.has('top'));

window.fixture = {
  ready: true,
  get expectedPrompts() { return turns.filter(turn => turn.role === 'user').map(turn => turn.messageId); },
  get scrollTop() { return scroller.scrollTop; },
  scrollTo(top) { scroller.scrollTop = top; render(true); },
  forceRemount() { render(true); },
  hide(id) { hiddenTarget = id; render(true); },
  duplicate(id) {
    const original = timeline.querySelector(`[data-message-id="${id}"]`);
    if (original) original.parentElement.append(original.cloneNode(true));
  },
  async changeRoute(id, { delay = 0, nested = false, branch = false } = {}) {
    history.pushState({}, '', `${nested ? '/g/g-testing' : ''}/c/${id}?count=50`);
    // Retain old DOM briefly to exercise stale-mount quarantine.
    const data = await fetch(`/backend-api/conversation/${id}?count=50&delay=${delay}${branch ? '&branch=1' : ''}`).then(r => r.json());
    use(data);
  },
  async branch() {
    const id = location.pathname.split('/').at(-1);
    use(await fetch(`/backend-api/conversation/${id}?count=50&branch=1`).then(r => r.json()), false);
  },
  emptyWindow(ms = 90) { paused = true; timeline.replaceChildren(); setTimeout(() => { paused = false; render(true); }, ms); },
  changeHeight() { turns[1].height += 500; layout(); render(true); },
  removeIds() { omitIds = true; render(true); },
  append() {
    const id = location.pathname.split('/').at(-1);
    turns.push({ messageId: `${id}-live`, nodeId: `${id}-live-node`, role: 'user', text: 'A newly submitted prompt.', height: 140 });
    layout(); scroller.scrollTop = scroller.scrollHeight; render(true);
  },
};
