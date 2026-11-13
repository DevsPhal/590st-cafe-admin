"use client";

import { useCallback } from "react";
import { useRealtimeTopic } from "./useRealtimeTopic";
import { baseApi } from "@/store/api/baseApi";
import { useAppDispatch } from "@/store/hooks";
import type { OrderUpdateMessage } from "@/store/api/types";

// Order events come in bursts — a new order, then "will pay cash" a few ms later. A refetch() made while the
// previous one is still loading is dropped, which left lists showing the older state until their next poll.
// Invalidating the tags as well makes RTK Query fetch once more after the in-flight requests settle.
const ORDER_EVENT_TAGS = ["Order", "Report", "Finance"] as const;

export function useStaffOrderAlerts(
  onMessage: (message: OrderUpdateMessage) => void,
) {
  const dispatch = useAppDispatch();
  useRealtimeTopic<OrderUpdateMessage>(
    "/topic/orders",
    useCallback(
      (message: OrderUpdateMessage) => {
        onMessage(message);
        dispatch(baseApi.util.invalidateTags([...ORDER_EVENT_TAGS]));
      },
      [dispatch, onMessage],
    ),
  );
}
