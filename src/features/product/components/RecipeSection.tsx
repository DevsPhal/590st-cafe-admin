"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { DataCard, FormSelect, StatusBadge } from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useI18n } from "@/contexts/I18nContext";
import { useListProductsQuery } from "@/store/api/productApi";
import { useListRecipesQuery, useSetRecipeMutation } from "@/store/api/recipeApi";
import type { ProductResponse, RecipeResponse } from "@/store/api/types";
import { cn, titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { formatStock } from "@/lib/stockUnits";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useCatalogAlerts } from "@/hooks/useCatalogAlerts";
import { parseForm } from "@/lib/validation";
import { recipeSchema } from "@/lib/formSchemas";
import { isIngredient } from "@/features/product/productKinds";

const inputClass = "block w-full rounded border px-3 py-2 text-sm";

// A gram of beans or a millilitre of milk costs a fraction of a cent, so tiny amounts keep four decimals.
const money = (value: number) => `$${value.toFixed(value !== 0 && Math.abs(value) < 0.01 ? 4 : 2)}`;

type Row = { key: string; ingredientId: string; quantity: string };

const rowsOf = (recipe: RecipeResponse): Row[] =>
  recipe.items.map((item) => ({ key: item.ingredientId, ingredientId: item.ingredientId, quantity: String(Number(item.quantity)) }));

// Remount a card when its saved recipe changes, so the rows start from what the server now has.
const recipeKey = (recipe: RecipeResponse) =>
  `${recipe.variantId}:${recipe.items.map((item) => `${item.ingredientId}=${Number(item.quantity)}`).join(",")}`;

function Figure({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="rounded border p-2">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className={cn("font-semibold", danger && "text-red-700")}>{value}</dd>
  </div>;
}

function RecipeCard({ productId, recipe, ingredients, copySources, needsRecipe }: {
  productId: string;
  recipe: RecipeResponse;
  ingredients: ProductResponse[];
  copySources: RecipeResponse[];
  needsRecipe: boolean;
}) {
  const { t } = useI18n();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [rows, setRows] = useState<Row[]>(() => rowsOf(recipe));
  const nextKey = useRef(0);
  const [save, saveState] = useSetRecipeMutation();
  const busy = saveState.isLoading;

  const sizeName = enumLabel(t, "variant", recipe.variantName);
  const saved = recipe.items;
  const hasRecipe = saved.length > 0;
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const savedById = new Map(saved.map((item) => [item.ingredientId, item]));
  // An ingredient moved out of its ingredient category still shows on the rows that use it.
  const options = [
    ...ingredients.map((ingredient) => ({ id: ingredient.id, name: ingredient.name, unit: ingredient.sellUnit })),
    ...saved.filter((item) => !ingredientById.has(item.ingredientId)).map((item) => ({ id: item.ingredientId, name: item.ingredientName, unit: item.unit })),
  ];
  const nameOf = (id: string) => titleCase(ingredientById.get(id)?.name ?? savedById.get(id)?.ingredientName ?? "");
  const unitOf = (id: string) => ingredientById.get(id)?.sellUnit ?? savedById.get(id)?.unit;
  const isSavedLine = (row: Row) => {
    const item = savedById.get(row.ingredientId);
    return item !== undefined && String(Number(item.quantity)) === row.quantity.trim();
  };
  const dirty = rows.length !== saved.length || rows.some((row, index) => row.ingredientId !== saved[index]?.ingredientId || !isSavedLine(row));
  const marginPercent = recipe.marginPercent == null ? "-" : `${Number(recipe.marginPercent).toFixed(1)}%`;

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const removeRow = (key: string) => setRows((current) => current.filter((row) => row.key !== key));
  function addRow() {
    nextKey.current += 1;
    const key = `new-${nextKey.current}`;
    setRows((current) => [...current, { key, ingredientId: "", quantity: "" }]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseForm(recipeSchema(nameOf), { items: rows.map(({ ingredientId, quantity }) => ({ ingredientId, quantity })) });
    if (!parsed) return;
    try {
      await save({ productId, variantId: recipe.variantId, body: { items: parsed.items } }).unwrap();
      toast.success(t("products.recipe.toast.saved", "{size} recipe saved", { size: sizeName }));
    } catch (error) { toast.error(apiErrorMessage(error as never, t("products.recipe.errors.save", "Could not save the recipe."))); }
  }
  async function removeRecipe() {
    if (!(await confirm({ title: t("products.recipe.confirm.remove_title", "Remove recipe"), description: t("products.recipe.confirm.remove_description", "Remove the {size} recipe? This size will be sold from the product's own stock again.", { size: sizeName }), confirmLabel: t("actions.remove", "Remove"), tone: "danger" }))) return;
    try {
      await save({ productId, variantId: recipe.variantId, body: { items: [] } }).unwrap();
      toast.success(t("products.recipe.toast.removed", "{size} recipe removed", { size: sizeName }));
    } catch (error) { toast.error(apiErrorMessage(error as never, t("products.recipe.errors.remove", "Could not remove the recipe."))); }
  }

  return <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="font-semibold">{recipe.variantStatus === "ACTIVE" ? sizeName : `${sizeName} (${enumLabel(t, "status", recipe.variantStatus).toLowerCase()})`}</h3>
      {hasRecipe && <StatusBadge label={t("products.badges.recipe", "Recipe")} tone="info" />}
      {needsRecipe && <StatusBadge label={t("products.recipe.no_recipe_badge", "No recipe yet")} tone="warning" />}
    </div>
    {hasRecipe ? <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
      <Figure label={t("products.recipe.cost", "Cost")} value={money(Number(recipe.cost))} />
      <Figure label={t("products.recipe.price", "Price")} value={money(Number(recipe.finalPrice))} />
      <Figure label={t("products.recipe.margin", "Margin")} value={money(Number(recipe.margin))} danger={Number(recipe.margin) < 0} />
      <Figure label={t("products.recipe.margin_percent", "Margin %")} value={marginPercent} danger={Number(recipe.margin) < 0} />
      <Figure label={t("products.recipe.available", "Available")} value={t("products.recipe.can_make", "Can make {count} now", { count: recipe.availableQuantity.toLocaleString() })} danger={recipe.availableQuantity <= 0} />
    </dl> : <p className="text-sm text-muted-foreground">{needsRecipe
      ? t("products.recipe.needs_recipe", "Fresh drinks are made to order: without a recipe this size is sold from the drink's own stock, which is usually empty.")
      : t("products.recipe.no_recipe", "No recipe: this size is sold from the product's own stock.")}</p>}

    {rows.map((row) => {
      const ingredient = ingredientById.get(row.ingredientId);
      const savedItem = savedById.get(row.ingredientId);
      const unit = unitOf(row.ingredientId);
      const takenElsewhere = new Set(rows.filter((other) => other.key !== row.key).map((other) => other.ingredientId));
      return <div key={row.key} className="grid items-start gap-3 rounded border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="space-y-1">
          <FormSelect label={t("products.recipe.ingredient", "Ingredient")} placeholder={t("products.recipe.ingredient_placeholder", "Select an ingredient")} value={row.ingredientId} onChange={(event) => updateRow(row.key, { ingredientId: event.target.value })}>
            {options.map((option) => <option key={option.id} value={option.id} disabled={takenElsewhere.has(option.id)}>{titleCase(option.name)} ({enumLabel(t, "unit", option.unit)})</option>)}
          </FormSelect>
          {ingredient ? <p className="text-xs text-muted-foreground">{t("products.recipe.on_hand", "On hand: {stock}", { stock: formatStock(t, Number(ingredient.quantityOnHand), ingredient) })}</p>
            : savedItem ? <p className="text-xs text-muted-foreground">{t("products.recipe.on_hand", "On hand: {stock}", { stock: `${Number(savedItem.onHand).toLocaleString()} ${enumLabel(t, "unit", savedItem.unit)}` })}</p> : null}
        </div>
        <label className="text-sm">{t("products.recipe.quantity", "Quantity")}
          <span className="mt-1 flex items-center gap-2">
            <input className={inputClass} type="number" min="1" step="1" inputMode="numeric" value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: event.target.value })} aria-label={t("products.recipe.quantity_of", "Quantity of {name}", { name: nameOf(row.ingredientId) })} />
            <span className="shrink-0 text-muted-foreground">{unit ? enumLabel(t, "unit", unit) : ""}</span>
          </span>
        </label>
        <div className="text-sm">
          <span className="block">{t("products.recipe.line_cost", "Line cost")}</span>
          {savedItem && isSavedLine(row)
            ? <span className="mt-1 block font-semibold">{money(Number(savedItem.lineCost))}</span>
            : <span className="mt-1 block text-muted-foreground">{t("products.recipe.line_cost_after_save", "Shown after saving")}</span>}
        </div>
        <button className="btn_outline_black self-end" type="button" disabled={busy} onClick={() => removeRow(row.key)}>{t("actions.remove", "Remove")}</button>
      </div>;
    })}
    {dirty && <p className="text-sm text-amber-700" role="status">{t("products.recipe.unsaved", "Unsaved changes. Save to update the cost and margin.")}</p>}

    <div className="flex flex-wrap items-center gap-3">
      <button className="btn_outline_black" type="button" disabled={busy || options.length === 0} onClick={addRow}>{t("products.recipe.add_row", "Add ingredient")}</button>
      <button className="btn_primary_black" disabled={busy || rows.length === 0 || !dirty}>{busy ? t("states.saving", "Saving...") : t("products.recipe.save", "Save recipe")}</button>
      {hasRecipe && <button className="btn_outline_black" type="button" disabled={busy} onClick={removeRecipe}>{t("products.recipe.remove", "Remove recipe")}</button>}
      {copySources.map((source) => <button key={source.variantId} className="btn_outline_black" type="button" disabled={busy} onClick={() => setRows(rowsOf(source))}>
        {t("products.recipe.copy_from", "Copy from {size}", { size: enumLabel(t, "variant", source.variantName) })}
      </button>)}
    </div>
    {confirmDialog}
  </form>;
}

export default function RecipeSection({ product }: { product: ProductResponse }) {
  const { t } = useI18n();
  const recipes = useListRecipesQuery(product.id);
  // The list endpoint can't filter by category group, so ingredients are picked out of one big page.
  const catalog = useListProductsQuery({ page: 1, size: 500 });
  const ingredients = (catalog.data?.content ?? []).filter((candidate) => isIngredient(candidate) && candidate.id !== product.id);
  const { refetch: refetchRecipes } = recipes;
  const { refetch: refetchCatalog } = catalog;

  useCatalogAlerts(
    useCallback(() => {
      void refetchRecipes();
      void refetchCatalog();
    }, [refetchRecipes, refetchCatalog])
  );

  const isFreshDrink = product.categoryGroup === "FRESH_DRINK";
  const missing = isFreshDrink ? (recipes.data ?? []).filter((recipe) => recipe.items.length === 0) : [];

  return <DataCard title={t("products.recipe.title", "Recipes")} meta={t("products.recipe.meta", "Sizes with a recipe use up their ingredients when sold; the others are sold from this product's own stock.")}>
    <div className="space-y-4 p-2">
      {recipes.isLoading ? <p role="status">{t("products.recipe.loading", "Loading recipes...")}</p> : recipes.error ? <div role="alert">{apiErrorMessage(recipes.error as never)} <button className="underline" onClick={() => recipes.refetch()}>{t("actions.retry", "Retry")}</button></div> : <>
        {catalog.isSuccess && !ingredients.length && <p className="text-sm text-muted-foreground">
          {t("products.recipe.no_ingredients", "No ingredients yet. Register products in an Ingredient category (e.g. beans in Gram, milk in Milliliter) on the")}{" "}
          <Link href="/products" className="font-semibold underline">{t("products.recipe.no_ingredients_link", "Products list")}</Link>
          {t("products.recipe.no_ingredients_after", ", then come back to build recipes.")}
        </p>}
        {missing.length > 0 && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          {t("products.recipe.missing_sizes", "No recipe yet for: {sizes}.", { sizes: missing.map((recipe) => enumLabel(t, "variant", recipe.variantName)).join(", ") })}
        </p>}
        {!recipes.data?.length && <p className="text-sm text-muted-foreground">{t("products.recipe.no_sizes", "Add a variant first: recipes are set per size.")}</p>}
        {recipes.data?.map((recipe) => <RecipeCard
          key={recipeKey(recipe)}
          productId={product.id}
          recipe={recipe}
          ingredients={ingredients}
          copySources={(recipes.data ?? []).filter((other) => other.variantId !== recipe.variantId && other.items.length > 0)}
          needsRecipe={isFreshDrink && recipe.items.length === 0}
        />)}
      </>}
    </div>
  </DataCard>;
}
