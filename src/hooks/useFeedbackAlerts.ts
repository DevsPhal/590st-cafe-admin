"use client";

import { useRealtimeTopic } from "./useRealtimeTopic";
import type { ResourceChangeMessage } from "@/store/api/types";

//feedback alerts are sent over a websocket topic, and this hook subscribes to that topic and calls the provided callback whenever a new message is received. The message contains information about what resource changed, so the UI can update accordingly.
export function useFeedbackAlerts(
  onMessage: (message: ResourceChangeMessage) => void,
) {
  useRealtimeTopic<ResourceChangeMessage>("/topic/feedback", onMessage);
}
