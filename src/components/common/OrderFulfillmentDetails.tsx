"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { OrderResponse } from "@/store/api/types";
import { titleCase } from "@/lib/utils";
import { deliveryFeeSchema, firstIssueMessage } from "@/lib/validation";
import { formatPhone } from "@/lib/phone";

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function OrderFulfillmentDetails({
  order,
  onSetDeliveryFee,
  isSettingFee = false,
}: {
  order: OrderResponse;
  /** Omit to render read-only (e.g. a closed-out order, or a screen with no staff actions). */
  onSetDeliveryFee?: (fee: number) => void;
  isSettingFee?: boolean;
}) {
  const [feeInput, setFeeInput] = useState(() => (order.deliveryFee != null ? String(order.deliveryFee) : ""));
  if (!order.fulfillmentMethod && !order.contactName) return null;
  const isDelivery = order.fulfillmentMethod === "DELIVERY";
  const hasPin = order.deliveryLatitude != null && order.deliveryLongitude != null;

  const submitFee = () => {
    const parsed = deliveryFeeSchema.safeParse({ fee: feeInput });
    if (!parsed.success) {
      toast.error(firstIssueMessage(parsed.error));
      return;
    }
    onSetDeliveryFee?.(parsed.data.fee);
  };

  return <div className="my-3 rounded-lg border bg-gray-50 p-3 text-xs text-gray-700">
    <p className="font-semibold">{isDelivery ? "Delivery" : "Pickup"}
      {order.contactName ? ` · ${titleCase(order.contactName)}` : ""}</p>
    {order.contactPhone && <p className="mt-1 tabular-nums">Phone: {formatPhone(order.contactPhone)}</p>}
    {order.deliveryAddress && <p className="mt-1 whitespace-pre-wrap">{order.deliveryAddress}</p>}
    {isDelivery && hasPin && (
      <p className="mt-1">
        <a
          href={`https://www.google.com/maps?q=${order.deliveryLatitude},${order.deliveryLongitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          View pinned location on map
        </a>
        {order.distanceMeters != null ? ` · ${formatDistance(Number(order.distanceMeters))} from the shop` : ""}
      </p>
    )}
    {isDelivery && order.deliveryFee != null && (
      <p className="mt-1">Delivery fee included: ${Number(order.deliveryFee).toFixed(2)}</p>
    )}
    {isDelivery && onSetDeliveryFee && (
      <div className="mt-2 flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="text-gray-500">{order.deliveryFee != null ? "Revise fee" : "Set fee"} (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={feeInput}
            onChange={(e) => setFeeInput(e.target.value)}
            className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </label>
        <button
          type="button"
          onClick={submitFee}
          disabled={isSettingFee || !feeInput.trim()}
          className="rounded border border-gray-400 px-2 py-1 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
        >
          {isSettingFee ? "Saving..." : "Save"}
        </button>
      </div>
    )}
  </div>;
}
