import css from './helper.css?inline';
import type { HistoryState } from './shared';
import type { NativeState } from './prepare';

export class HelperUI {
  readonly host = document.createElement('div');
  private root: ShadowRoot;
  private shell: HTMLElement;
  private card: HTMLElement;
  private launcher: HTMLButtonElement;
  private action: HTMLButtonElement;
  private status: HTMLElement;
  private metrics: HTMLElement;
  private history: HTMLElement;
  private native: HTMLElement;
  private diagnostics: HTMLElement;
  private busy = false;
  constructor(start: () => void, stop: () => void) {
    this.host.id = 'native-navigator-helper';
    this.host.dataset.nativeNavigatorHelper = '';
    this.root = this.host.attachShadow({ mode: 'open' });
    // Fixed local markup only; all state and status updates use textContent.
    this.root.innerHTML = `<style>${css}</style><div class="shell">
      <section class="card" aria-label="Native navigator helper">
        <div class="top"><span class="eyebrow">Native navigator helper</span><button class="minimize" aria-label="Minimize helper">−</button></div>
        <h2>Find your way back.</h2><p class="description">Prepare this conversation for ChatGPT’s built-in prompt navigator.</p>
        <div class="signals"><div class="signal history"><span class="dot"></span><span></span></div><div class="signal native"><span class="dot"></span><span></span></div></div>
        <p class="status" role="status" aria-live="polite"></p><p class="metrics"></p>
        <button class="action"><span>Prepare navigation</span><span aria-hidden="true">↑</span></button>
        <p class="footnote">This tab only · no prompt text stored</p>
        <details><summary>Compatibility details</summary><pre></pre></details>
      </section>
      <button class="launcher" aria-label="Open native navigator helper" hidden><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span><span>Native navigation</span></button>
    </div>`;
    const get = <T extends HTMLElement>(selector: string) => this.root.querySelector<T>(selector)!;
    this.shell = get('.shell'); this.card = get('.card'); this.launcher = get('.launcher');
    this.action = get('.action'); this.status = get('.status'); this.metrics = get('.metrics');
    this.history = get('.history'); this.native = get('.native'); this.diagnostics = get('pre');
    get('.minimize').onclick = () => { this.card.hidden = true; this.launcher.hidden = false; this.launcher.focus(); };
    this.launcher.onclick = () => { this.card.hidden = false; this.launcher.hidden = true; get('.minimize').focus(); };
    this.action.onclick = () => this.busy ? stop() : start();
    this.setStatus('Loads earlier messages, then returns you here. The conversation may move while preparing.');
  }
  mount(): void { if (!this.host.isConnected) document.body.append(this.host); }
  setStatus(text: string): void { if (this.status.textContent !== text) this.status.textContent = text; }
  setBusy(busy: boolean): void {
    this.busy = busy; this.shell.classList.toggle('busy', busy); this.action.classList.toggle('stop', busy);
    this.action.querySelector('span')!.textContent = busy ? 'Stop and return' : 'Prepare navigation';
    this.action.lastElementChild!.textContent = busy ? '↩' : '↑';
  }
  setPhase(phase: string): void { this.host.dataset.phase = phase; }
  update(history: HistoryState, native: NativeState, connected: boolean, canPrepare: boolean, elapsed = 0): void {
    this.host.hidden = history.conversationId === null;
    this.shell.classList.toggle('dark', document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark');
    this.action.disabled = !this.busy && !canPrepare;
    this.history.lastElementChild!.textContent = history.boundary === 'complete' ? 'History loaded' : history.boundary === 'more' ? 'Earlier history available' : 'History completeness unknown';
    this.native.lastElementChild!.textContent = native.visible ? 'Native navigator visible' : native.found ? 'Native navigator hidden' : 'Native navigator not detected';
    this.history.dataset.ok = String(history.boundary === 'complete'); this.native.dataset.ok = String(native.visible > 0);
    this.metrics.textContent = history.pages ? `${history.prompts.toLocaleString()} prompts observed · ${history.pages} batches${elapsed ? ` · ${Math.floor(elapsed / 1000)}s` : ''}` : 'Waiting for conversation history';
    this.diagnostics.textContent = JSON.stringify({ bridge: connected ? 'connected' : 'not detected', history: history.boundary,
      pagesObserved: history.pages, messagesObserved: history.messages, promptsObserved: history.prompts,
      pendingRequests: history.pending, nativeControls: native.found, visibleNativeControls: native.visible,
      largerBatches: history.boosted, issue: history.issue, viewport: `${innerWidth} × ${innerHeight}`,
      nativeDetection: 'Prompt N accessibility labels; other locales may differ' }, null, 2);
  }
}
