import './popup.css';
import { PANEL_CHANNEL } from '../native/panelState';
import type { PanelSnapshot } from '../native/panelState';

const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const shell = get('main');
shell.classList.toggle('dark', matchMedia('(prefers-color-scheme: dark)').matches);
let reading = false;
function render(state: PanelSnapshot): void {
  shell.dataset.phase = state.phase;
  shell.classList.toggle('dark', state.dark);
  get('.visibility').textContent = !state.available ? 'Unavailable' : state.nativeVisible ? 'Visible' : 'Not visible';
  get('.visibility').dataset.visible = String(state.available && state.nativeVisible);
  get('.prompts').textContent = state.prompts === null ? '—' : state.prompts.toLocaleString();
  get('.reason').textContent = state.reason;
  get('.reason').hidden = !state.reason;
}
async function sync(): Promise<void> {
  if (reading) return;
  reading = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('No current tab');
    const response = await chrome.tabs.sendMessage(tab.id, { channel: PANEL_CHANNEL, command: 'status' }, { frameId: 0 }) as PanelSnapshot;
    if (!response || typeof response.reason !== 'string' || typeof response.nativeVisible !== 'boolean') throw new Error('Unavailable state');
    // Discard a reply if the user selected another tab while it was being read.
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id !== tab.id) return;
    render(response);
  } catch {
    render({ phase: 'unavailable', available: false, nativeVisible: false, prompts: null,
      dark: matchMedia('(prefers-color-scheme: dark)').matches,
      reason: 'Open a ChatGPT conversation. If it is already open, reload the tab to connect.' });
  } finally { reading = false; }
}
void sync();
const timer = window.setInterval(() => void sync(), 350);
window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
