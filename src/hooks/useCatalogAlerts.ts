"use client";

import { useRealtimeTopic } from "./useRealtimeTopic";
import type { ResourceChangeMessage } from "@/store/api/types";

//catalog alerts are sent over a websocket topic, and this hook subscribes to that topic and calls the provided callback whenever a new message is received. The message contains information about what resource changed, so the UI can update accordingly.
export function useCatalogAlerts(
  onMessage: (message: ResourceChangeMessage) => void,
) {
  useRealtimeTopic<ResourceChangeMessage>("/topic/catalog", onMessage);
}
