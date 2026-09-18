import { useSyncExternalStore } from "react";

import { onSessionChange, tokens } from "@/lib/api/client";

/**
 * Whether there is a session, in a way that is safe to branch on while rendering.
 *
 * Reading localStorage directly during render is a server/client branch: the
 * server always says "signed out", the browser may say "signed in", and the two
 * trees disagree at hydration. `useSyncExternalStore` is the supported way to
 * express exactly that — a server snapshot of `false`, a client snapshot read
 * from storage, and a re-render after hydration instead of a mismatch.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const unsubscribeTokens = onSessionChange(onChange);
  // Another tab signing in or out should update this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith("avtoqism.")) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    unsubscribeTokens();
    window.removeEventListener("storage", onStorage);
  };
}

/** Call after any local token change so subscribers re-read immediately. */
export function notifySessionChanged() {
  listeners.forEach((l) => l());
}

export function useIsAuthenticated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => tokens.isAuthenticated(),
    () => false,
  );
}
