"use client";

import { useRealtimeTopic } from "./useRealtimeTopic";
import type { StaffCallMessage } from "@/store/api/types";

export function useStaffCallAlerts(
  onMessage: (message: StaffCallMessage) => void,
) {
  useRealtimeTopic<StaffCallMessage>("/topic/staff-calls", onMessage);
}
