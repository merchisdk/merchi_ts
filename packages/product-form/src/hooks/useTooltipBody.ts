import { useSyncExternalStore } from 'react';

interface BodySnapshot {
  body: HTMLElement | null;
  revision: number;
}

const serverSnapshot: BodySnapshot = { body: null, revision: 0 };
let snapshot = serverSnapshot;

function getSnapshot(): BodySnapshot {
  const body = typeof document === 'undefined' ? null : document.body;
  const connectedBody = body?.nodeType === 1 && body.isConnected ? body : null;
  if (snapshot.body !== connectedBody) {
    snapshot = { body: connectedBody, revision: snapshot.revision + 1 };
  }
  return snapshot;
}

function subscribe(onChange: () => void): () => void {
  if (typeof document === 'undefined' || document.nodeType !== 9) return () => {};
  // Body itself may be absent or replaced, so observe its stable document.
  const observer = new MutationObserver(onChange);
  observer.observe(document, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function getEmptySnapshot(): BodySnapshot {
  return serverSnapshot;
}

function subscribeDisabled(): () => void {
  return () => {};
}

/** Delay browser-only tooltip effects until body exists, and remount on replacement. */
export function useTooltipBody(enabled: boolean): BodySnapshot {
  return useSyncExternalStore(
    enabled ? subscribe : subscribeDisabled,
    enabled ? getSnapshot : getEmptySnapshot,
    getEmptySnapshot,
  );
}
