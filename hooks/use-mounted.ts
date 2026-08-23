"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True on client after hydration — use for relative dates, etc. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
