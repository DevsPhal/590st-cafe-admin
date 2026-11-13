"use client";

import { useRealtimeTopic } from "./useRealtimeTopic";
import type { ResourceChangeMessage } from "@/store/api/types";

export function useFeedbackAlerts(
  onMessage: (message: ResourceChangeMessage) => void,
) {
  useRealtimeTopic<ResourceChangeMessage>("/topic/feedback", onMessage);
}
