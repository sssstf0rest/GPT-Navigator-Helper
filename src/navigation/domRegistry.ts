import { MAX_TEXT } from '../conversation/pagePayloadSource';
import type { DomTurn, PromptRecord, Turn } from '../conversation/types';

export interface MountedTurn {
  element: HTMLElement;
  aliases: string[];
  turn: DomTurn;
}
export type Resolution = { kind: 'found'; element: HTMLElement } | { kind: 'absent' | 'ambiguous' };

export class DomRegistry {
  entries: MountedTurn[] = [];
  root: HTMLElement | null = null;
  private temporary = new WeakMap<HTMLElement, { key: string; text: string }>();
  private nextKey = 0;

  scan(): void {
    this.root = document.querySelector<HTMLElement>('main, [role="main"]');
    if (!this.root) { this.entries = []; return; }
    this.entries = Array.from(this.root.querySelectorAll<HTMLElement>('[data-message-author-role]'))
      .filter((element) => !element.closest('[data-conversation-navigator]'))
      .flatMap((element) => {
        const role = element.getAttribute('data-message-author-role');
        if (role !== 'user' && role !== 'assistant' && role !== 'tool' && role !== 'system') return [];
        const aliases = new Set<string>();
        let parent: HTMLElement | null = element;
        for (let depth = 0; parent && parent !== this.root && depth < 6; depth++, parent = parent.parentElement) {
          for (const name of ['data-message-id', 'data-turn-id', 'data-turn-id-container']) {
            const id = parent.getAttribute(name);
            if (id && id.length <= 256 && !['true', 'false'].includes(id)) aliases.add(id);
          }
          if (parent.tagName === 'ARTICLE') break;
        }
        const text = role === 'user' ? (element.innerText.trim() || element.textContent?.trim() || '[Non-text prompt]').slice(0, MAX_TEXT) : '';
        let provisional = this.temporary.get(element);
        if (!provisional || provisional.text !== text) {
          provisional = { key: `local:${++this.nextKey}`, text };
          this.temporary.set(element, provisional);
        }
        const messageId = element.getAttribute('data-message-id') || [...aliases][0] || provisional.key;
        if (!aliases.size) aliases.add(provisional.key);
        const turn: DomTurn = {
          messageId, nodeId: messageId, parentId: null, role, text, hidden: false,
          identity: messageId === provisional.key ? 'provisional' : 'stable',
        };
        return [{ element, aliases: [...aliases], turn }];
      });
  }

  matches(entry: MountedTurn, turn: Pick<Turn, 'messageId' | 'nodeId'>): boolean {
    // An explicit message ID outranks container aliases, especially after edited turns reuse a wrapper.
    const explicit = entry.element.getAttribute('data-message-id');
    if (explicit) return explicit === turn.messageId;
    return entry.aliases.includes(turn.messageId) || entry.aliases.includes(turn.nodeId);
  }

  resolve(prompt: PromptRecord): Resolution {
    const matches = this.entries.filter((entry) => entry.turn.role === 'user' && entry.element.isConnected && this.matches(entry, prompt));
    if (matches.length > 1) return { kind: 'ambiguous' };
    return matches[0] ? { kind: 'found', element: matches[0].element } : { kind: 'absent' };
  }
}
