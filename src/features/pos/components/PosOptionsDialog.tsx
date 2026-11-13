"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/contexts/I18nContext";
import {
  ICE_CHOICES,
  MILK_CHOICES,
  SUGAR_CHOICES,
  activeExtras,
  drinkCustomization,
  iceLabel,
  milkLabel,
  sizeLabel,
  sugarLabel,
} from "@/lib/drinkOptions";
import { cn, titleCase } from "@/lib/utils";
import type { IceLevel, MilkType, ProductResponse, ProductVariantResponse, SugarLevel, UUID } from "@/store/api/types";
import { Button } from "@/components/common/Button";

export type PosExtra = { extraId: UUID; name: string; price: number };

export type PosLineOptions = {
  variant: ProductVariantResponse;
  sugarLevel?: SugarLevel;
  iceLevel?: IceLevel;
  milkType?: MilkType;
  extras: PosExtra[];
};

const money = (value: number) => `$${value.toFixed(2)}`;

function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
  describe,
}: {
  label: string;
  choices: readonly T[];
  value: T;
  onChange: (next: T) => void;
  describe: (choice: T) => string;
}) {
  return (
    <fieldset className="pos_options_group">
      <legend className="pos_options_label">{label}</legend>
      <div className="pos_options_choices">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={value === choice}
            onClick={() => onChange(choice)}
            className={cn("pos_option_chip", value === choice && "is_selected")}
          >
            {value === choice ? <Check aria-hidden /> : null}
            {describe(choice)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// Size, sugar, ice, milk and extras for one drink — the same choices the customer app offers.
// Mounted fresh for each product (the parent keys it), so the choices start from `initial` every time.
export function PosOptionsDialog({
  product,
  initial,
  mode,
  onConfirm,
  onClose,
}: {
  product: ProductResponse;
  initial: Partial<PosLineOptions>;
  mode: "add" | "edit";
  onConfirm: (options: PosLineOptions) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const flags = drinkCustomization(product);
  const extras = activeExtras(product);
  const variants = product.variants
    .filter((v) => v.status === "ACTIVE")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const [variantId, setVariantId] = useState(initial.variant?.id ?? variants[0]?.id);
  const [sugarLevel, setSugarLevel] = useState<SugarLevel>(initial.sugarLevel ?? "NORMAL");
  const [iceLevel, setIceLevel] = useState<IceLevel>(initial.iceLevel ?? "NORMAL");
  const [milkType, setMilkType] = useState<MilkType>(initial.milkType ?? "NORMAL");
  const [chosenExtras, setChosenExtras] = useState<PosExtra[]>(initial.extras ?? []);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const extrasTotal = chosenExtras.reduce((sum, extra) => sum + extra.price, 0);
  const unitPrice = Number(variant?.finalPrice ?? 0) + extrasTotal;

  const toggleExtra = (extra: (typeof extras)[number]) =>
    setChosenExtras((current) =>
      current.some((e) => e.extraId === extra.extraId)
        ? current.filter((e) => e.extraId !== extra.extraId)
        : [...current, { extraId: extra.extraId, name: extra.name, price: Number(extra.price) }],
    );

  const confirm = () => {
    if (!variant) return;
    onConfirm({
      variant,
      // Only the choices this drink takes are sent; the API rejects the rest.
      sugarLevel: flags.sugar ? sugarLevel : undefined,
      iceLevel: flags.ice ? iceLevel : undefined,
      milkType: flags.milk ? milkType : undefined,
      extras: chosenExtras,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="admin_modal pos_options_modal sm:max-w-[560px]"
        // Start on the confirm button (Enter adds the drink as chosen), not on the first chip, whose focus ring looks like a selection.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          confirmRef.current?.focus();
        }}
      >
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title">{titleCase(product.name)}</DialogTitle>
          <DialogDescription className="text-sm text-(--ink-muted)">
            {t("pos.options.subtitle", "Choose how to make it, then add it to the order.")}
          </DialogDescription>
        </DialogHeader>

        <div className="admin_modal_body pos_options_body">
          {variants.length > 1 ? (
            <ChoiceGroup
              label={t("pos.options.size", "Size")}
              choices={variants.map((v) => v.id)}
              value={variant?.id ?? ""}
              onChange={setVariantId}
              describe={(id) => {
                const v = variants.find((item) => item.id === id);
                return v ? `${sizeLabel(v.name)} · ${money(Number(v.finalPrice))}` : "";
              }}
            />
          ) : null}
          {flags.sugar ? (
            <ChoiceGroup label={t("pos.options.sugar", "Sugar level")} choices={SUGAR_CHOICES} value={sugarLevel} onChange={setSugarLevel} describe={sugarLabel} />
          ) : null}
          {flags.ice ? (
            <ChoiceGroup label={t("pos.options.ice", "Ice level")} choices={ICE_CHOICES} value={iceLevel} onChange={setIceLevel} describe={iceLabel} />
          ) : null}
          {flags.milk ? (
            <ChoiceGroup label={t("pos.options.milk", "Milk")} choices={MILK_CHOICES} value={milkType} onChange={setMilkType} describe={milkLabel} />
          ) : null}
          {extras.length > 0 ? (
            <fieldset className="pos_options_group">
              <legend className="pos_options_label">{t("pos.options.extras", "Extras")}</legend>
              <div className="pos_options_extras">
                {extras.map((extra) => {
                  const selected = chosenExtras.some((e) => e.extraId === extra.extraId);
                  const outOfStock = extra.quantityOnHand != null && Number(extra.quantityOnHand) <= 0;
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      disabled={outOfStock && !selected}
                      onClick={() => toggleExtra(extra)}
                      className={cn("pos_option_extra", selected && "is_selected")}
                    >
                      <span aria-hidden className="pos_option_extra_box">{selected ? <Check /> : null}</span>
                      <span className="pos_option_extra_name">{titleCase(extra.name)}</span>
                      <span className="pos_option_extra_price">
                        {outOfStock ? t("pos.product.out_of_stock", "Out of stock") : `+${money(Number(extra.price))}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
        </div>

        <div className="admin_modal_footer pos_options_footer">
          <p className="pos_options_total">
            <span>{t("pos.options.each", "Each")}</span>
            <strong>{money(unitPrice)}</strong>
          </p>
          <Button variant="outline" onClick={onClose}>
            {t("actions.cancel", "Cancel")}
          </Button>
          <Button ref={confirmRef} variant="accent" onClick={confirm} disabled={!variant}>
            {mode === "edit" ? t("pos.options.update", "Update item") : t("pos.options.add", "Add to order")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
