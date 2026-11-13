"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import toast from "react-hot-toast";
import { z } from "zod";
import {
  FormInput,
  FormModal,
  FormProductSelect,
  FormSelect,
  FormTextarea,
  ModalGrid,
  MoneyField,
  type ProductSelectOption,
} from "@/components/common/AdminKit";
import { useI18n } from "@/contexts/I18nContext";
import { translate } from "@/contexts/translate";
import { usePersistentState } from "@/hooks/usePersistentState";
import { enumLabel } from "@/lib/enumLabel";
import { baseQuantity, formatStock, stockUnitSize, unitsPerStock } from "@/lib/stockUnits";
import { message, numberField, optionalText, requiredChoice } from "@/lib/validation";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useCountStockMutation,
  useRecordWasteMutation,
  useReturnToStockMutation,
  useStockCutMutation,
  useStockInMutation,
} from "@/store/api/inventoryApi";
import { orderApi } from "@/store/api/orderApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import type { InventoryResponse, QuantityUnit, StockStrategy, WasteReason } from "@/store/api/types";
import { formatUsd, isWhole, sellQuantity, stockUnitsOf } from "../stock";
import { useStockProducts } from "../useStockProducts";
import { useFormErrors } from "@/hooks/useFormErrors";

export type StockAction = "STOCK_IN" | "WASTE" | "RETURN" | "COUNT" | "STOCK_CUT";

export type StockActionForm = {
  open: boolean;
  productId: string;
  // The row the modal was opened from, shown until the full stock list has loaded.
  snapshot: InventoryResponse | null;
  action: StockAction;
  quantity: string;
  unit: QuantityUnit;
  unitCost: string;
  wasteReason: WasteReason | "";
  orderRef: string;
  strategy: StockStrategy;
  note: string;
};

const EMPTY_FORM: StockActionForm = {
  open: false,
  productId: "",
  snapshot: null,
  action: "STOCK_IN",
  quantity: "",
  unit: "PURCHASE",
  unitCost: "",
  wasteReason: "",
  orderRef: "",
  strategy: "FIFO",
  note: "",
};

// Stock is bought and drawn down in cartons, but waste is usually a few cans or some grams.
const DEFAULT_UNIT: Record<StockAction, QuantityUnit> = {
  STOCK_IN: "PURCHASE",
  WASTE: "BASE",
  RETURN: "BASE",
  COUNT: "BASE",
  STOCK_CUT: "PURCHASE",
};

const UNIT_CHOICE = new Set<StockAction>(["STOCK_IN", "WASTE", "STOCK_CUT"]);

const WASTE_REASONS: WasteReason[] = ["EXPIRED", "DAMAGED", "SPILLED", "QUALITY", "OTHER"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Receipts and the queue show an order as "#A1B2C3D4", the start of its id.
const ORDER_NUMBER_PATTERN = /^#?([0-9a-f-]{4,35})$/i;

const translated = (key: string, fallback: string) => ({ error: () => translate(key, fallback) });

function stockActionSchema(action: StockAction) {
  return z.object({
    productId: requiredChoice(message("product_required", "Choose a product first.")),
    quantity: numberField("quantity", action === "COUNT" ? { min: 0 } : { greaterThan: 0 }),
    unitCost: action === "STOCK_IN" ? numberField("unit cost", { min: 0 }) : z.any().transform(() => undefined),
    wasteReason:
      action === "WASTE"
        ? requiredChoice<WasteReason>(translated("inventory.stock_action.errors.waste_reason_required", "Choose why the stock was wasted."))
        : z.any().transform(() => undefined),
    note: optionalText("Note", 255),
  });
}

function parseAmount(value: string): number | null {
  const trimmed = value.replace(/,/g, "").trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

export function useStockActionModal() {
  const [form, setForm] = usePersistentState<StockActionForm>("inventory:stockAction", EMPTY_FORM);
  const open = useCallback(
    (item?: InventoryResponse, action: StockAction = "STOCK_IN") =>
      setForm({
        ...EMPTY_FORM,
        open: true,
        productId: item?.productId ?? "",
        snapshot: item ?? null,
        action,
        unit: DEFAULT_UNIT[action],
      }),
    [setForm]
  );
  return { form, setForm, open };
}

export function StockActionModal({
  form,
  setForm,
}: {
  form: StockActionForm;
  setForm: Dispatch<SetStateAction<StockActionForm>>;
}) {
  const { t } = useI18n();
  const { isAdmin } = useCurrentRole();
  const { options, byId } = useStockProducts({ skip: !isAdmin || !form.open });

  const [stockIn, { isLoading: isStockingIn }] = useStockInMutation();
  const [recordWaste, { isLoading: isWasting }] = useRecordWasteMutation();
  const [returnToStock, { isLoading: isReturning }] = useReturnToStockMutation();
  const [countStock, { isLoading: isCounting }] = useCountStockMutation();
  const [stockCut, { isLoading: isCutting }] = useStockCutMutation();
  const [findOrders, { isFetching: isFindingOrder }] = orderApi.useLazyListOrdersQuery();
  const isSaving = isStockingIn || isWasting || isReturning || isCounting || isCutting || isFindingOrder;

  const update = (patch: Partial<StockActionForm>) => setForm((current) => ({ ...current, ...patch }));
  const validation = useFormErrors(stockActionSchema(form.action), {
    productId: form.productId,
    quantity: form.quantity,
    unitCost: form.unitCost,
    wasteReason: form.wasteReason,
    note: form.note,
  });

  const item = byId.get(form.productId) ?? (form.snapshot?.productId === form.productId ? form.snapshot : null);
  const units = item ? stockUnitsOf(item) : null;
  const perStock = units ? unitsPerStock(units) : 1;
  const sellUnitLabel = item ? enumLabel(t, "unit", item.unit) : "";
  const offersUnitChoice = perStock > 1 && UNIT_CHOICE.has(form.action);
  const unit = offersUnitChoice ? form.unit : DEFAULT_UNIT[form.action];
  const onHand = Number(item?.quantityOnHand ?? 0);
  const amount = parseAmount(form.quantity);
  const base = units && amount !== null ? baseQuantity(amount, unit, units) : null;
  const hasAmount = amount !== null && (form.action === "COUNT" ? amount >= 0 : amount > 0);

  const selectedOption: ProductSelectOption | null =
    options.find((option) => option.id === form.productId) ??
    (item
      ? { id: item.productId, name: item.productName, sku: "-", currentStock: onHand, unit: sellUnitLabel }
      : null);

  const actionLabel: Record<StockAction, string> = {
    STOCK_IN: t("inventory.stock_action.actions.stock_in", "Receive Stock"),
    WASTE: t("inventory.stock_action.actions.waste", "Record Waste"),
    RETURN: t("inventory.stock_action.actions.return", "Return to Stock"),
    COUNT: t("inventory.stock_action.actions.count", "Stock Count"),
    STOCK_CUT: t("inventory.stock_action.actions.stock_cut", "Stock Cut (draw-down)"),
  };
  const availableActions = (Object.keys(actionLabel) as StockAction[]).filter(
    (action) => action !== "RETURN" || !item?.ingredient
  );

  const show = (quantity: number) => (units ? formatStock(t, quantity, units) : String(quantity));

  // The API rejects all of these too; catching them here explains the problem before anything is sent.
  const quantityProblem = (): string | null => {
    if (!units || base === null || !hasAmount) return null;
    if (!isWhole(base)) {
      return unit === "PURCHASE" && perStock > 1
        ? t(
            "inventory.stock_action.errors.whole_units_purchase",
            "{quantity} {unit} is {base} {sellUnit}. Stock is counted in whole {sellUnit}, so enter an amount that comes to a whole number.",
            {
              quantity: amount ?? 0,
              unit: enumLabel(t, "unit", units.stockUnit),
              base: Number(base.toFixed(4)),
              sellUnit: sellUnitLabel,
            }
          )
        : t("inventory.stock_action.errors.whole_units_base", "Stock is counted in whole {sellUnit}. Enter a whole number.", {
            sellUnit: sellUnitLabel,
          });
    }
    const whole = Math.round(base);
    if ((form.action === "WASTE" || form.action === "STOCK_CUT") && whole > onHand) {
      return t("inventory.stock_action.errors.not_enough", "Only {onHand} on hand.", { onHand: show(onHand) });
    }
    if (form.action === "COUNT" && whole === onHand) {
      return t("inventory.stock_action.errors.count_unchanged", "Stock already is {onHand}; there is nothing to adjust.", {
        onHand: show(onHand),
      });
    }
    return null;
  };
  const problem = quantityProblem();

  const preview = (): string | null => {
    if (!units || base === null || !hasAmount || problem) return null;
    const whole = Math.round(base);
    switch (form.action) {
      case "STOCK_IN": {
        const cost = parseAmount(form.unitCost);
        const received = `= ${sellQuantity(t, whole, units.sellUnit)}`;
        return cost === null || cost < 0
          ? received
          : `${received} · ${(amount ?? 0).toLocaleString()} × ${formatUsd(cost)} = ${formatUsd((amount ?? 0) * cost)}`;
      }
      case "WASTE":
      case "STOCK_CUT":
        return t("inventory.stock_action.preview.leaves", "= {quantity} · leaves {after}", {
          quantity: sellQuantity(t, whole, units.sellUnit),
          after: show(onHand - whole),
        });
      case "RETURN":
        return t("inventory.stock_action.preview.becomes", "Stock becomes {after}", { after: show(onHand + whole) });
      case "COUNT": {
        const difference = whole - onHand;
        return t("inventory.stock_action.preview.count", "Counted {counted} · difference {difference}", {
          counted: show(whole),
          difference: `${difference > 0 ? "+" : ""}${sellQuantity(t, difference, units.sellUnit)}`,
        });
      }
    }
  };
  const previewText = preview();

  // An order number from a receipt is matched to the full order id the API needs.
  const resolveOrderId = async (reference: string): Promise<string | undefined | null> => {
    const trimmed = reference.trim();
    if (!trimmed) return undefined;
    if (UUID_PATTERN.test(trimmed)) return trimmed;
    const prefix = ORDER_NUMBER_PATTERN.exec(trimmed)?.[1]?.toLowerCase();
    if (!prefix) {
      toast.error(t("inventory.stock_action.errors.order_invalid", "Enter an order number like #A1B2C3D4."));
      return null;
    }
    try {
      const orders = await findOrders({ search: `#${prefix}`, page: 1, size: 5 }).unwrap();
      const matches = orders.content.filter((order) => order.id.toLowerCase().startsWith(prefix));
      if (matches.length === 1) return matches[0].id;
      toast.error(
        matches.length === 0
          ? t("inventory.stock_action.errors.order_not_found", "No order matches {order}.", { order: trimmed })
          : t("inventory.stock_action.errors.order_ambiguous", "Several orders start with {order}; enter more of the number.", {
              order: trimmed,
            })
      );
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("inventory.stock_action.errors.order_lookup", "Could not look up that order.")));
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!isAdmin) return;
    const parsed = validation.validate();
    if (!parsed || !item || !units || base === null) return;
    if (problem) {
      toast.error(problem);
      return;
    }
    const productId = item.productId;
    const moved = show(Math.round(base));

    try {
      switch (form.action) {
        case "STOCK_IN":
          await stockIn({ productId, quantity: parsed.quantity, unit, unitCost: parsed.unitCost ?? 0, note: parsed.note }).unwrap();
          toast.success(t("inventory.toast.received", "Received {quantity}", { quantity: moved }));
          break;
        case "WASTE":
          if (!parsed.wasteReason) return;
          await recordWaste({ productId, quantity: parsed.quantity, unit, wasteReason: parsed.wasteReason, note: parsed.note }).unwrap();
          toast.success(t("inventory.toast.wasted", "Recorded {quantity} as waste", { quantity: moved }));
          break;
        case "RETURN": {
          const orderId = await resolveOrderId(form.orderRef);
          if (orderId === null) return;
          await returnToStock({ productId, quantity: parsed.quantity, unit, orderId, note: parsed.note }).unwrap();
          toast.success(t("inventory.toast.returned", "Returned {quantity} to stock", { quantity: moved }));
          break;
        }
        case "COUNT":
          await countStock({ productId, countedQuantity: parsed.quantity, unit, note: parsed.note }).unwrap();
          toast.success(t("inventory.toast.counted", "Stock count saved: {quantity}", { quantity: moved }));
          break;
        case "STOCK_CUT":
          await stockCut({ productId, quantity: parsed.quantity, unit, strategy: form.strategy, note: parsed.note }).unwrap();
          toast.success(t("inventory.toast.cut", "Cut {quantity}", { quantity: moved }));
          break;
      }
      update({ open: false });
    } catch (err) {
      validation.showServerError(err, t("inventory.errors.record_movement", "Could not record the stock movement."));
    }
  };

  const quantityLabel =
    form.action === "COUNT"
      ? t("inventory.stock_action.fields.counted_quantity", "Counted Quantity")
      : t("fields.quantity", "Quantity");

  return (
    <FormModal
      open={isAdmin && form.open}
      onOpenChange={(open) => {
        if (!open) validation.reset();
        update({ open });
      }}
      title={actionLabel[form.action]}
      submitLabel={t("actions.submit", "Submit")}
      onSubmit={handleSubmit}
      isLoading={isSaving}
    >
      <ModalGrid>
        <div className="md:col-span-3">
          <FormProductSelect
            label={t("fields.product", "Product")}
            required
            options={options}
            value={selectedOption}
            error={validation.errors.productId}
            onChange={(option) => {
              const next = option ? byId.get(option.id) ?? null : null;
              update({
                productId: option?.id ?? "",
                snapshot: next,
                action: next?.ingredient && form.action === "RETURN" ? "STOCK_IN" : form.action,
              });
            }}
          />
        </div>
        <FormSelect
          label={t("inventory.stock_action.fields.action", "Action")}
          placeholder={t("inventory.stock_action.fields.select_action", "Select action")}
          value={form.action}
          onChange={(e) => {
            const action = e.target.value as StockAction;
            if (action) update({ action, unit: DEFAULT_UNIT[action] });
          }}
          required
        >
          {availableActions.map((action) => (
            <option key={action} value={action}>
              {actionLabel[action]}
            </option>
          ))}
        </FormSelect>
        <FormInput
          label={offersUnitChoice || !item ? quantityLabel : `${quantityLabel} (${sellUnitLabel})`}
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="0"
          value={form.quantity}
          error={validation.errors.quantity}
          onChange={(e) => update({ quantity: e.target.value })}
          required
        />
        {offersUnitChoice && units ? (
          <FormSelect
            label={t("inventory.stock_action.fields.unit", "Quantity Unit")}
            value={form.unit}
            onChange={(e) => {
              if (e.target.value) update({ unit: e.target.value as QuantityUnit });
            }}
            required
          >
            <option value="PURCHASE">{stockUnitSize(t, units)}</option>
            <option value="BASE">{sellUnitLabel}</option>
          </FormSelect>
        ) : null}
        {form.action === "STOCK_IN" ? (
          <MoneyField
            label={
              item
                ? t("inventory.stock_action.fields.unit_cost_per", "Cost per {unit} (USD)", {
                    unit: enumLabel(t, "unit", unit === "PURCHASE" ? item.stockUnit : item.unit),
                  })
                : t("inventory.form.unit_cost", "Unit Cost (USD)")
            }
            value={form.unitCost}
            error={validation.errors.unitCost}
            onValueChange={(unitCost) => update({ unitCost })}
            required
          />
        ) : null}
        {form.action === "WASTE" ? (
          <FormSelect
            label={t("inventory.stock_action.fields.waste_reason", "Waste Reason")}
            placeholder={t("inventory.stock_action.fields.select_waste_reason", "Select reason")}
            value={form.wasteReason}
            error={validation.errors.wasteReason}
            onChange={(e) => update({ wasteReason: e.target.value as WasteReason | "" })}
            required
          >
            {WASTE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {enumLabel(t, "waste_reason", reason)}
              </option>
            ))}
          </FormSelect>
        ) : null}
        {form.action === "RETURN" ? (
          <FormInput
            label={t("inventory.stock_action.fields.order", "Order Number (optional)")}
            placeholder="#A1B2C3D4"
            value={form.orderRef}
            onChange={(e) => update({ orderRef: e.target.value })}
          />
        ) : null}
        {form.action === "STOCK_CUT" ? (
          <FormSelect
            label={t("inventory.form.costing_strategy", "Costing Strategy")}
            placeholder={t("inventory.form.select_strategy", "Select strategy")}
            value={form.strategy}
            onChange={(e) => {
              if (e.target.value) update({ strategy: e.target.value as StockStrategy });
            }}
            required
          >
            <option value="FIFO">{t("inventory.form.fifo", "FIFO (oldest batch first)")}</option>
            <option value="LIFO">{t("inventory.form.lifo", "LIFO (newest batch first)")}</option>
          </FormSelect>
        ) : null}
        <div className="md:col-span-3">
          <FormTextarea
            label={t("fields.note", "Note")}
            placeholder={t("inventory.form.note_placeholder", "Optional reason or reference")}
            value={form.note}
            error={validation.errors.note}
            onChange={(e) => update({ note: e.target.value })}
            maxLength={255}
          />
        </div>
        {item ? (
          <div className="md:col-span-3 space-y-1 text-sm">
            <p className="text-muted-foreground">
              {t("inventory.stock_action.preview.current", "Current stock: {quantity}", { quantity: show(onHand) })}
            </p>
            {form.action === "RETURN" ? (
              <p className="text-muted-foreground">
                {t("inventory.stock_action.preview.return_hint", "With an order number, no more can come back than that order took out.")}
              </p>
            ) : null}
            {problem ? <p className="font-medium text-destructive">{problem}</p> : null}
            {previewText ? <p className="font-semibold">{previewText}</p> : null}
          </div>
        ) : null}
      </ModalGrid>
    </FormModal>
  );
}
