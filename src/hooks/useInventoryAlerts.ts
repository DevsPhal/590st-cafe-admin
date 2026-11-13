"use client";

import { useRealtimeTopic } from "./useRealtimeTopic";
import type { ResourceChangeMessage } from "@/store/api/types";

export function useInventoryAlerts(
  onMessage: (message: ResourceChangeMessage) => void,
) {
  useRealtimeTopic<ResourceChangeMessage>("/topic/inventory", onMessage);
}
