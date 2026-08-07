"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns `false` during server rendering / first client render and `true`
 * once the client has hydrated. Lets components avoid hydration mismatches
 * without calling setState in an effect.
 */
export function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
