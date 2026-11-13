"use client";

import { useRealtimeTopic } from "./useRealtimeTopic";
import type { ResourceChangeMessage } from "@/store/api/types";

export function useCatalogAlerts(
  onMessage: (message: ResourceChangeMessage) => void,
) {
  useRealtimeTopic<ResourceChangeMessage>("/topic/catalog", onMessage);
}
