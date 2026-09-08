import type { ConversationSnapshot, DomTurn, PromptRecord, Turn } from './types';

export class ConversationIndex {
  snapshot: ConversationSnapshot;
  private identities = new Map<string, 'stable' | 'provisional'>();

  constructor(readonly conversationId: string) {
    this.snapshot = {
      conversationId, branchId: null, turns: [], coverage: 'unknown', source: 'dom',
      reason: 'Open or reload a conversation to capture its history.',
    };
  }

  replace(snapshot: ConversationSnapshot): boolean {
    if (snapshot.conversationId !== this.conversationId) return false;
    this.snapshot = snapshot;
    this.identities.clear();
    for (const turn of snapshot.turns) this.identities.set(turn.messageId, 'stable');
    return true;
  }

  /** DOM removal never removes index entries. A payload/branch revision may replace them. */
  observe(observations: DomTurn[]): boolean {
    let changed = false;
    const turns = [...this.snapshot.turns];
    for (let i = 0; i < observations.length; i++) {
      const observed = observations[i]!;
      const existing = turns.findIndex((turn) => turn.messageId === observed.messageId || turn.nodeId === observed.nodeId);
      if (existing >= 0) {
        const prior = turns[existing]!;
        if (this.snapshot.source === 'dom' && prior.role === 'user' && prior.text !== observed.text && observed.text) {
          turns[existing] = { ...prior, text: observed.text };
          changed = true;
        }
        continue;
      }
      // Complete snapshots are authoritative: an unknown mount could belong to an old branch.
      // Invalidate coverage, but do not insert it into the proven branch based on text/order guesses.
      if (this.snapshot.source === 'graph') {
        const previous = observations[i - 1];
        const tail = turns.at(-1);
        if (observed.identity === 'stable' && previous && tail && (previous.messageId === tail.messageId || previous.nodeId === tail.nodeId)) {
          // A mounted contiguous extension of the known tail can contribute new live turns.
          // It is observational evidence, not proof that the new selected branch is complete.
          turns.push(observed); this.identities.set(observed.messageId, 'stable');
          this.snapshot = { ...this.snapshot, coverage: 'partial', reason: 'New turns observed. Reload to refresh the complete branch.' };
          changed = true;
          continue;
        }
        if (observed.role === 'user' && this.snapshot.coverage === 'complete') {
          this.snapshot = { ...this.snapshot, coverage: 'partial', reason: 'The page changed. Reload to refresh the selected branch.' };
          changed = true;
        }
        continue;
      }
      const nextKnown = observations.slice(i + 1).find((item) => turns.some((turn) => turn.messageId === item.messageId));
      const insertion = nextKnown ? turns.findIndex((turn) => turn.messageId === nextKnown.messageId) : turns.length;
      turns.splice(insertion, 0, observed);
      this.identities.set(observed.messageId, observed.identity);
      changed = true;
    }
    if (changed) this.snapshot = {
      ...this.snapshot, turns,
      coverage: this.snapshot.source === 'dom' ? 'partial' : this.snapshot.coverage,
      reason: this.snapshot.source === 'dom' ? 'Prompts seen on this page. Earlier history may be missing.' : this.snapshot.reason,
    };
    return changed;
  }

  get prompts(): PromptRecord[] {
    const prompts: PromptRecord[] = [];
    this.snapshot.turns.forEach((turn, timelineIndex) => {
      if (turn.role !== 'user' || turn.hidden) return;
      prompts.push({ ...turn, conversationId: this.conversationId, timelineIndex,
        userOrder: prompts.length + 1, identity: this.identities.get(turn.messageId) ?? 'stable' });
    });
    return prompts;
  }

  orderOf(turn: Pick<Turn, 'messageId' | 'nodeId'>): number {
    return this.snapshot.turns.findIndex((item) => item.messageId === turn.messageId || item.nodeId === turn.nodeId);
  }
}
