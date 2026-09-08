import css from './navigator.css?inline';
import type { ConversationIndex } from '../conversation/conversationIndex';
import type { PromptRecord } from '../conversation/types';

export class Navigator {
  readonly host = document.createElement('aside');
  private readonly shadow = this.host.attachShadow({ mode: 'open' });
  private readonly panel = document.createElement('section');
  private readonly list = document.createElement('ol');
  private readonly search = document.createElement('input');
  private readonly count = document.createElement('span');
  private readonly coverage = document.createElement('span');
  private readonly status = document.createElement('p');
  private readonly empty = document.createElement('p');
  private readonly diagnostics = document.createElement('pre');
  private readonly rows = new Map<string, { li: HTMLLIElement; button: HTMLButtonElement; number: HTMLElement; preview: HTMLElement }>();
  private prompts: PromptRecord[] = [];
  private activeId: string | null = null;

  constructor(private readonly onJump: (prompt: PromptRecord) => void) {
    this.host.setAttribute('data-conversation-navigator', '');
    this.host.setAttribute('aria-label', 'Conversation navigator');
    const style = document.createElement('style');
    style.textContent = css;
    this.panel.className = 'panel';
    this.panel.setAttribute('aria-label', 'Prompt outline');
    const header = document.createElement('header');
    const heading = document.createElement('div');
    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow'; eyebrow.textContent = 'Your conversation';
    const title = document.createElement('h2'); title.textContent = 'The outline';
    heading.append(eyebrow, title);
    const collapse = document.createElement('button'); collapse.className = 'collapse';
    collapse.textContent = '−'; collapse.setAttribute('aria-label', 'Collapse navigator');
    const reopen = document.createElement('button'); reopen.className = 'reopen'; reopen.textContent = 'Outline';
    reopen.setAttribute('aria-label', 'Open conversation navigator');
    reopen.hidden = true;
    collapse.onclick = () => { this.panel.hidden = true; reopen.hidden = false; reopen.focus(); };
    reopen.onclick = () => { reopen.hidden = true; this.panel.hidden = false; collapse.focus(); };
    if (innerWidth < 1100) { this.panel.hidden = true; reopen.hidden = false; }
    header.append(heading, collapse);
    const searchWrap = document.createElement('div'); searchWrap.className = 'search-wrap';
    this.search.type = 'search'; this.search.placeholder = 'Find a prompt…';
    this.search.setAttribute('aria-label', 'Search prompts');
    this.search.addEventListener('input', () => this.renderRows());
    searchWrap.append(this.search);
    const meta = document.createElement('div'); meta.className = 'meta';
    this.coverage.className = 'coverage'; meta.append(this.count, this.coverage);
    this.list.setAttribute('aria-label', 'User prompts');
    this.empty.className = 'empty';
    const footer = document.createElement('footer');
    this.status.className = 'status'; this.status.setAttribute('role', 'status');
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = 'Connection details';
    details.append(summary, this.diagnostics);
    footer.append(this.status, details);
    this.panel.append(header, searchWrap, meta, this.list, this.empty, footer);
    this.shadow.append(style, this.panel, reopen);
  }

  mount(): void { if (!this.host.isConnected) document.body.append(this.host); }
  destroy(): void { this.host.remove(); }

  render(index: ConversationIndex, activeId: string | null, diagnostics: Record<string, unknown>): void {
    this.prompts = index.prompts;
    this.activeId = activeId;
    this.coverage.textContent = index.snapshot.coverage === 'complete' ? 'Full branch' : 'Partial history';
    this.coverage.title = index.snapshot.reason;
    this.empty.textContent = this.prompts.length ? 'No matching prompts.' : index.snapshot.reason;
    this.diagnostics.textContent = JSON.stringify(diagnostics, null, 2);
    this.panel.dataset.dark = String(document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark' || getComputedStyle(document.documentElement).colorScheme === 'dark');
    this.renderRows();
  }

  setStatus(message: string): void { this.status.textContent = message; }

  private renderRows(): void {
    const query = this.search.value.trim().toLocaleLowerCase();
    const visible = this.prompts.filter((prompt) => prompt.text.toLocaleLowerCase().includes(query));
    const ids = new Set(visible.map((prompt) => prompt.messageId));
    for (const [id, row] of this.rows) if (!ids.has(id)) { row.li.remove(); this.rows.delete(id); }
    let position = 0;
    for (const prompt of visible) {
      let row = this.rows.get(prompt.messageId);
      if (!row) {
        const li = document.createElement('li');
        const button = document.createElement('button'); button.className = 'prompt';
        const number = document.createElement('span'); number.className = 'number'; number.setAttribute('aria-hidden', 'true');
        const preview = document.createElement('span'); preview.className = 'preview';
        button.append(number, preview); li.append(button);
        row = { li, button, number, preview }; this.rows.set(prompt.messageId, row);
      }
      row.number.textContent = String(prompt.userOrder).padStart(2, '0');
      row.preview.textContent = prompt.text.slice(0, 400);
      row.button.setAttribute('aria-label', `Prompt ${prompt.userOrder}: ${prompt.text.slice(0, 140)}`);
      row.button.setAttribute('aria-current', String(prompt.messageId === this.activeId));
      row.button.dataset.promptId = prompt.messageId;
      row.button.onclick = () => this.onJump(prompt);
      const atPosition = this.list.children.item(position++);
      if (atPosition !== row.li) this.list.insertBefore(row.li, atPosition);
    }
    this.count.textContent = query ? `${visible.length} of ${this.prompts.length} prompts` : `${this.prompts.length} prompts`;
    this.empty.hidden = visible.length > 0;
    this.list.hidden = visible.length === 0;
  }
}
