export interface NativeState { found: number; visible: number }
export type Outcome = 'ready' | 'loaded-no-native' | 'hidden' | 'stalled' | 'network-error' | 'unverified' | 'limit' | 'changed';
