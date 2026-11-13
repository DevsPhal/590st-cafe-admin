"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { setupListeners } from "@reduxjs/toolkit/query";

import { makeStore, type AppStore } from "./index";

/// A React component that provides the Redux store to its children. It creates a store instance on first render and reuses it for subsequent renders. It also sets up listeners for RTK Query's cache invalidation and refetching.
export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = makeStore();
  }
  useEffect(() => setupListeners(storeRef.current!.dispatch), []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
