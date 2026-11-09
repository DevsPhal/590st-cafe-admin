"use client";

import { useState } from "react";
import type { OrderResponse } from "@/store/api/types";
import { fulfillmentLabel, titleCase } from "@/lib/utils";
import { deliveryFeeSchema } from "@/lib/validation";
import { formatPhone } from "@/lib/phone";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { useI18n } from "@/contexts/I18nContext";
import { useFormErrors } from "@/hooks/useFormErrors";
import { FieldError } from "@/components/common/AdminKit";

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function OrderFulfillmentDetails({
  order,
  onSetDeliveryFee,
  isSettingFee = false,
}: {
  order: OrderResponse;
  onSetDeliveryFee?: (fee: number) => void;
  isSettingFee?: boolean;
}) {
  const { t } = useI18n();
  const [feeInput, setFeeInput] = useState(() => (order.deliveryFee != null ? String(order.deliveryFee) : ""));
  const feeValidation = useFormErrors(deliveryFeeSchema, { fee: feeInput });
  if (!order.fulfillmentMethod && !order.contactName) return null;
  const isDelivery = order.fulfillmentMethod === "DELIVERY";
  const hasPin = order.deliveryLatitude != null && order.deliveryLongitude != null;

  const submitFee = () => {
    const parsed = feeValidation.validate();
    if (!parsed) return;
    onSetDeliveryFee?.(parsed.fee);
  };

  return <div className="my-3 rounded-lg border bg-gray-50 p-3 text-xs text-gray-700">
    <p className="font-semibold">{fulfillmentLabel(order) || t("fulfillment.pickup", "Pickup")}
      {order.contactName ? ` · ${titleCase(order.contactName)}` : ""}</p>
    {order.contactPhone && <p className="mt-1 tabular-nums">{t("fulfillment.phone", "Phone: {phone}", { phone: formatPhone(order.contactPhone) })}</p>}
    {order.deliveryAddress && <p className="mt-1 whitespace-pre-wrap">{order.deliveryAddress}</p>}
    {isDelivery && hasPin && (
      <p className="mt-1">
        <a
          href={`https://www.google.com/maps?q=${order.deliveryLatitude},${order.deliveryLongitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {t("fulfillment.view_pin", "View pinned location on map")}
        </a>
        {order.distanceMeters != null ? ` · ${t("fulfillment.distance", "{distance} from the shop", { distance: formatDistance(Number(order.distanceMeters)) })}` : ""}
      </p>
    )}
    {isDelivery && order.deliveryFee != null && (
      <p className="mt-1">{t("fulfillment.fee_included", "Delivery fee included: {fee}", { fee: `$${Number(order.deliveryFee).toFixed(2)}` })}</p>
    )}
    {isDelivery && onSetDeliveryFee && (
      <div className="mt-2 flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="text-gray-500">{order.deliveryFee != null ? t("fulfillment.revise_fee", "Revise fee") : t("fulfillment.set_fee", "Set fee")} (USD)</span>
          <MoneyInput
            value={feeInput}
            onValueChange={setFeeInput}
            wrapperClassName="w-24"
            className="w-full rounded border border-gray-300 py-1 pr-2 text-xs"
            aria-label={t("fulfillment.fee_label", "Delivery fee in USD")}
            aria-invalid={feeValidation.errors.fee ? true : undefined}
            aria-describedby={feeValidation.errors.fee ? "order-fee-error" : undefined}
          />
        </label>
        <button
          type="button"
          onClick={submitFee}
          disabled={isSettingFee || !feeInput.trim()}
          className="rounded border border-gray-400 px-2 py-1 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
        >
          {isSettingFee ? t("states.saving", "Saving...") : t("actions.save", "Save")}
        </button>
      </div>
    )}
    {isDelivery && onSetDeliveryFee && <FieldError id="order-fee-error" error={feeValidation.errors.fee} />}
  </div>;
}
