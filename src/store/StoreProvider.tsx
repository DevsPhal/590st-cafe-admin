"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { setupListeners } from "@reduxjs/toolkit/query";

import { makeStore, type AppStore } from "./index";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState<AppStore>(makeStore);
  useEffect(() => setupListeners(store.dispatch), [store]);

  return <Provider store={store}>{children}</Provider>;
}
