"use client";

import { useRealtimeTopic } from "./useRealtimeTopic";
import type { OrderUpdateMessage } from "@/store/api/types";

//staff order alerts are sent over a websocket topic, and this hook subscribes to that topic and calls the provided callback whenever a new message is received. The message contains information about what resource changed, so the UI can update accordingly.
export function useStaffOrderAlerts(
  onMessage: (message: OrderUpdateMessage) => void,
) {
  useRealtimeTopic<OrderUpdateMessage>("/topic/orders", onMessage);
}
