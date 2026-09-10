import type { HistoryState } from './shared';
import type { NativeState } from './types';

export const PANEL_CHANNEL = 'native-navigator-helper:panel:v1';
export interface PanelSnapshot {
  phase: string; available: boolean; dark: boolean; nativeVisible: boolean; prompts: number | null; reason: string;
}
/** Only report the minimum-turn cause when an intact, complete history proves it. */
export function panelSnapshot(history: HistoryState, native: NativeState, phase: string, dark = false): PanelSnapshot {
  const available = history.conversationId !== null;
  let reason = '';
  if (!available) reason = 'Open a ChatGPT conversation to see its navigator status.';
  else if (!native.visible) {
    if (history.boundary === 'complete' && !history.pending && !history.issue && history.prompts < 5) {
      reason = 'ChatGPT currently shows its navigator for conversations with at least 5 prompts. This conversation has 4 or fewer.';
    } else if (history.issue) {
      reason = 'History could not be fully loaded. Reload the conversation to try again.';
    } else if (history.pending || phase === 'automatic-loading') {
      reason = 'Loading earlier messages automatically…';
    } else if (history.boundary === 'complete') {
      reason = 'History is loaded, but ChatGPT’s navigator is not available in this view.';
    } else {
      const reasons: Record<string, string> = {
        deferred: 'Waiting for a stable, wide desktop view to finish loading history.',
        'deep-link': 'History preparation is skipped to preserve the linked message position.',
        conflict: 'Disable the older Conversation Navigator extension, then reload this tab.',
        recovering: 'Preparation will resume automatically when you stop interacting and the conversation is ready.',
        'recovery-limit': 'Preparation stopped after repeated interruptions or reaching its loading limit. Reload the conversation to try again.',
        cancelled: 'Preparation stopped when the conversation was interrupted. Reload to try again.',
        changed: 'Waiting for the conversation to become active.',
        incompatible: 'This layout does not support loading history in place.',
        'layout-changed': 'Preparation stopped to protect your reading position. Reload to try again.',
        stalled: 'History loading did not advance. Reload the conversation to try again.',
        'network-error': 'History could not be loaded. Reload the conversation to try again.',
        unverified: 'History is not yet verified. Reload the conversation if this persists.',
        limit: 'Automatic loading reached its limit. Some earlier history may remain.',
      };
      reason = reasons[phase] ?? 'Waiting for conversation history…';
    }
  }
  return { phase, available, dark, nativeVisible: native.visible > 0, prompts: available && history.pages > 0 ? history.prompts : null, reason };
}
