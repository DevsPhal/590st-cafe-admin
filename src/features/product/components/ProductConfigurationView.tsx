"use client";

import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTopActions, DataCard, FormInput, FormSelect, Thumbnail } from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useAttachProductExtraMutation, useClearProductDiscountMutation, useCreateVariantMutation,
  useDeleteVariantMutation, useDetachProductExtraMutation, useGetProductQuery, useListProductExtrasQuery,
  useListVariantsQuery, useSetProductDiscountMutation, useUpdateProductExtraMutation, useUpdateVariantMutation,
} from "@/store/api/productApi";
import {
  useCreateExtraMutation, useDeleteExtraMutation, useListExtrasQuery, useRemoveExtraImageMutation,
  useUpdateExtraMutation, useUploadExtraImageMutation,
} from "@/store/api/extraApi";
import type {
  DiscountType, ExtraResponse, ProductExtraResponse, ProductResponse, ProductVariantResponse, VariantLabel,
} from "@/store/api/types";
import { humanise, productPriceLabel, titleCase } from "@/lib/utils";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useCatalogAlerts } from "@/hooks/useCatalogAlerts";

const inputClass = "mt-1 block w-full rounded border px-3 py-2 text-sm";
const discountTypes: Record<DiscountType, string> = { PERCENTAGE: "Percentage", FIXED: "Amount in USD" };
const VARIANT_LABELS: VariantLabel[] = ["MEDIUM", "LARGE", "PIECE"];

function DiscountForm({ product }: { product: ProductResponse }) {
  const [type, setType] = useState<DiscountType>(product.discountType ?? "PERCENTAGE");
  const [value, setValue] = useState(String(product.discountValue ?? ""));
  const [start, setStart] = useState(product.discountStartAt?.slice(0, 16) ?? "");
  const [end, setEnd] = useState(product.discountEndAt?.slice(0, 16) ?? "");
  const [save, saveState] = useSetProductDiscountMutation();
  const [clear, clearState] = useClearProductDiscountMutation();
  const busy = saveState.isLoading || clearState.isLoading;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (start && end && end <= start) { toast.error("End time must be after start time."); return; }
    try {
      await save({ id: product.id, body: { discountType: type, discountValue: Number(value),
        ...(start ? { discountStartAt: `${start}:00` } : {}), ...(end ? { discountEndAt: `${end}:00` } : {}),
      } }).unwrap();
      toast.success("Product discount saved");
    } catch (error) { toast.error(apiErrorMessage(error as never, "Could not save discount.")); }
  }

  async function remove() {
    try { await clear(product.id).unwrap(); toast.success("Discount removed"); }
    catch (error) { toast.error(apiErrorMessage(error as never, "Could not remove discount.")); }
  }

  return <form onSubmit={submit} className="space-y-4 p-2">
    <p className="text-sm">Current price: {productPriceLabel(product.variants)}. Discount applies on top of each variant&apos;s own price.</p>
    <p className="text-sm text-muted-foreground">{product.discountType ? product.discountActive ? "Discount is active." : "Discount is scheduled or expired." : "No discount is set."} Times use Cambodia time.</p>
    <div className="grid gap-4 md:grid-cols-2">
      <FormSelect label="Discount type" value={type} onChange={(event) => setType(event.target.value as DiscountType)}>
        {Object.entries(discountTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </FormSelect>
      <FormInput label={type === "PERCENTAGE" ? "Percentage off" : "USD off"} type="number" min="0.01" step="0.01" max={type === "PERCENTAGE" ? 100 : undefined} required value={value} onChange={(event) => setValue(event.target.value)} />
      <FormInput label="Starts at (optional)" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
      <FormInput label="Ends at (optional)" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
    </div>
    <div className="flex gap-3"><button className="btn_primary_black" disabled={busy}>{busy ? "Saving..." : "Save discount"}</button>
      {product.discountType && <button className="btn_outline_black" type="button" disabled={busy} onClick={remove}>Remove discount</button>}</div>
  </form>;
}

/** Every variant has its own absolute price — unlike the old size options, which only added a
 * delta on top of one shared product price. */
function VariantForm({ productId, variant, takenLabels }: { productId: string; variant?: ProductVariantResponse; takenLabels: VariantLabel[] }) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [name, setName] = useState<VariantLabel>(variant?.name ?? VARIANT_LABELS.find((l) => !takenLabels.includes(l)) ?? "MEDIUM");
  const [price, setPrice] = useState(String(variant?.price ?? ""));
  const [sortOrder, setSortOrder] = useState(String(variant?.sortOrder ?? 0));
  const [create, createState] = useCreateVariantMutation();
  const [update, updateState] = useUpdateVariantMutation();
  const [remove, removeState] = useDeleteVariantMutation();
  const busy = createState.isLoading || updateState.isLoading || removeState.isLoading;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const priceNumber = Number(price);
    if (!Number.isFinite(priceNumber) || priceNumber < 0) { toast.error("Enter a valid price."); return; }
    const body = { name, price: priceNumber, sortOrder: Number(sortOrder) };
    try {
      if (variant) await update({ productId, id: variant.id, body }).unwrap();
      else { await create({ productId, body }).unwrap(); setPrice(""); setSortOrder("0"); }
      toast.success("Variant saved");
    } catch (error) { toast.error(apiErrorMessage(error as never, "Could not save variant.")); }
  }
  async function toggleStatus() {
    if (!variant) return;
    try { await update({ productId, id: variant.id, body: { status: variant.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } }).unwrap(); toast.success("Variant status updated"); }
    catch (error) { toast.error(apiErrorMessage(error as never, "Could not update variant.")); }
  }
  async function deleteVariant() {
    if (!variant) return;
    if (!(await confirm({ title: "Delete variant", description: `Delete the ${humanise(variant.name)} variant?`, confirmLabel: "Delete", tone: "danger" }))) return;
    try { await remove({ productId, id: variant.id }).unwrap(); toast.success("Variant deleted"); }
    catch (error) { toast.error(apiErrorMessage(error as never, "Could not delete variant.")); }
  }

  return <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">{variant ? `${humanise(variant.name)} (${variant.status.toLowerCase()})` : "Add a variant"}</h3>
    <div className="grid gap-3 md:grid-cols-3">
      <FormSelect label="Variant" value={name} onChange={(event) => setName(event.target.value as VariantLabel)} disabled={Boolean(variant)}>
        {VARIANT_LABELS.map((label) => <option key={label} value={label}>{humanise(label)}</option>)}
      </FormSelect>
      <label className="text-sm">Price (USD)<input className={inputClass} required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <label className="text-sm">Display order<input className={inputClass} required type="number" step="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></label>
    </div>
    <div className="flex flex-wrap gap-3"><button className="btn_primary_black" disabled={busy}>{busy ? "Saving..." : variant ? "Save variant" : "Add variant"}</button>
      {variant && <><button className="btn_outline_black" type="button" disabled={busy} onClick={toggleStatus}>{variant.status === "ACTIVE" ? "Disable" : "Enable"}</button>
        <button className="btn_outline_black" type="button" disabled={busy} onClick={deleteVariant}>Delete</button></>}
    </div>
    {confirmDialog}
  </form>;
}

/** One row of the shop-wide add-on catalog (e.g. Pearl) — separate from offering it on this
 * particular product, which is ProductExtraRow below. */
function ExtraCatalogForm({ extra }: { extra?: ExtraResponse }) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [name, setName] = useState(extra?.name ?? "");
  const [price, setPrice] = useState(String(extra?.price ?? ""));
  const [tracked, setTracked] = useState(extra?.quantityOnHand != null);
  const [quantityOnHand, setQuantityOnHand] = useState(String(extra?.quantityOnHand ?? ""));
  const [create, createState] = useCreateExtraMutation();
  const [update, updateState] = useUpdateExtraMutation();
  const [remove, removeState] = useDeleteExtraMutation();
  const [uploadImage, uploadState] = useUploadExtraImageMutation();
  const [removeImage, removeImageState] = useRemoveExtraImageMutation();
  const busy = createState.isLoading || updateState.isLoading || removeState.isLoading;
  const imageBusy = uploadState.isLoading || removeImageState.isLoading;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const priceNumber = Number(price);
    if (!name.trim()) { toast.error("Enter an extra's name."); return; }
    if (!Number.isFinite(priceNumber) || priceNumber < 0) { toast.error("Enter a valid price."); return; }
    const qty = tracked && quantityOnHand.trim() ? Number(quantityOnHand) : undefined;
    try {
      if (extra) await update({ id: extra.id, body: { name: name.trim(), price: priceNumber, quantityOnHand: qty } }).unwrap();
      else { await create({ name: name.trim(), price: priceNumber, quantityOnHand: qty }).unwrap(); setName(""); setPrice(""); setQuantityOnHand(""); }
      toast.success("Extra saved");
    } catch (error) { toast.error(apiErrorMessage(error as never, "Could not save extra.")); }
  }
  async function deleteExtra() {
    if (!extra) return;
    if (!(await confirm({ title: "Delete extra", description: `Delete "${titleCase(extra.name)}" from the extras catalog?`, confirmLabel: "Delete", tone: "danger" }))) return;
    try { await remove(extra.id).unwrap(); toast.success("Extra deleted"); }
    catch (error) { toast.error(apiErrorMessage(error as never, "Could not delete extra — it may still be offered on a product.")); }
  }
  async function handleImagePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !extra) return;
    try { await uploadImage({ id: extra.id, file }).unwrap(); toast.success("Extra photo updated"); }
    catch (error) { toast.error(apiErrorMessage(error as never, "Could not upload the photo.")); }
  }
  async function handleRemoveImage() {
    if (!extra) return;
    try { await removeImage(extra.id).unwrap(); toast.success("Extra photo removed"); }
    catch (error) { toast.error(apiErrorMessage(error as never, "Could not remove the photo.")); }
  }

  return <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">{extra ? titleCase(extra.name) : "Add an extra"}</h3>
    <div className="grid gap-3 md:grid-cols-3">
      <label className="text-sm">Name<input className={inputClass} required value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="text-sm">Price (USD)<input className={inputClass} required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <label className="text-sm">
        <span className="mt-1 flex items-center gap-2">
          <input type="checkbox" checked={tracked} onChange={(event) => setTracked(event.target.checked)} /> Track stock
        </span>
        {tracked && <input className={inputClass} type="number" min="0" step="1" placeholder="Quantity on hand" value={quantityOnHand} onChange={(event) => setQuantityOnHand(event.target.value)} />}
      </label>
    </div>
    <div className="flex items-center gap-3">
      <Thumbnail src={extra?.imageUrl ?? undefined} />
      {extra ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn_outline_black cursor-pointer text-xs">
            {imageBusy ? "Working..." : extra.imageUrl ? "Change photo" : "Add photo"}
            <input type="file" accept="image/*" className="hidden" disabled={imageBusy} onChange={handleImagePick} />
          </label>
          {extra.imageUrl && (
            <button type="button" className="text-xs text-red-600 underline" disabled={imageBusy} onClick={handleRemoveImage}>
              Remove photo
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Save the extra first, then you can add a photo.</p>
      )}
    </div>
    <div className="flex flex-wrap gap-3"><button className="btn_primary_black" disabled={busy}>{busy ? "Saving..." : extra ? "Save extra" : "Add extra"}</button>
      {extra && <button className="btn_outline_black" type="button" disabled={busy} onClick={deleteExtra}>Delete</button>}
    </div>
    {confirmDialog}
  </form>;
}

/** One extra currently offered on this product, with a control to stop offering it. */
function ProductExtraRow({ productId, productExtra }: { productId: string; productExtra: ProductExtraResponse }) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [update, updateState] = useUpdateProductExtraMutation();
  const [detach, detachState] = useDetachProductExtraMutation();
  const busy = updateState.isLoading || detachState.isLoading;

  async function toggleStatus() {
    try {
      await update({ productId, id: productExtra.id, body: { status: productExtra.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } }).unwrap();
      toast.success("Updated");
    } catch (error) { toast.error(apiErrorMessage(error as never, "Could not update.")); }
  }
  async function remove() {
    if (!(await confirm({ title: "Remove extra", description: `Stop offering "${titleCase(productExtra.name)}" on this product?`, confirmLabel: "Remove", tone: "danger" }))) return;
    try { await detach({ productId, id: productExtra.id }).unwrap(); toast.success("Extra removed from this product"); }
    catch (error) { toast.error(apiErrorMessage(error as never, "Could not remove extra.")); }
  }

  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
    <div className="flex items-center gap-3">
      <Thumbnail src={productExtra.imageUrl ?? undefined} />
      <div>
        <p className="font-semibold">{titleCase(productExtra.name)} — ${Number(productExtra.price).toFixed(2)}</p>
        <p className="text-xs text-muted-foreground">{productExtra.status === "ACTIVE" ? "Offered" : "Hidden"} on this product</p>
      </div>
    </div>
    <div className="flex gap-3">
      <button className="btn_outline_black" type="button" disabled={busy} onClick={toggleStatus}>{productExtra.status === "ACTIVE" ? "Hide" : "Offer"}</button>
      <button className="btn_outline_black" type="button" disabled={busy} onClick={remove}>Remove</button>
    </div>
    {confirmDialog}
  </div>;
}

function ExtrasSection({ productId }: { productId: string }) {
  const catalog = useListExtrasQuery();
  const offered = useListProductExtrasQuery(productId);
  const [attach, attachState] = useAttachProductExtraMutation();
  const [selectedExtraId, setSelectedExtraId] = useState("");

  // A catalog extra's price/photo, or this product's own attached extras, changing anywhere
  // reaches this section instantly instead of only on this page's own next mutation.
  useCatalogAlerts(
    useCallback(() => {
      void catalog.refetch();
      void offered.refetch();
    }, [catalog, offered])
  );

  const offeredIds = new Set((offered.data ?? []).map((e) => e.extraId));
  const attachable = (catalog.data ?? []).filter((e) => e.status === "ACTIVE" && !offeredIds.has(e.id));

  async function handleAttach(event: FormEvent) {
    event.preventDefault();
    if (!selectedExtraId) { toast.error("Choose an extra to offer."); return; }
    try {
      await attach({ productId, body: { extraId: selectedExtraId } }).unwrap();
      toast.success("Extra offered on this product");
      setSelectedExtraId("");
    } catch (error) { toast.error(apiErrorMessage(error as never, "Could not offer this extra.")); }
  }

  return <DataCard title="Extras on this product" meta="Add-ons (e.g. Pearl) a customer can add to this product.">
    <div className="space-y-4 p-2">
      {offered.isLoading ? <p role="status">Loading extras...</p> : offered.error ? <div role="alert">{apiErrorMessage(offered.error as never)} <button className="underline" onClick={() => offered.refetch()}>Retry</button></div> : <>
        {!offered.data?.length && <p className="text-sm text-muted-foreground">No extras offered on this product yet.</p>}
        {offered.data?.map((productExtra) => <ProductExtraRow key={productExtra.id} productId={productId} productExtra={productExtra} />)}
      </>}
      <form onSubmit={handleAttach} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <FormSelect label="Offer an extra" placeholder="Select an extra" value={selectedExtraId} onChange={(event) => setSelectedExtraId(event.target.value)}>
          {attachable.map((extra) => <option key={extra.id} value={extra.id}>{titleCase(extra.name)} — ${Number(extra.price).toFixed(2)}</option>)}
        </FormSelect>
        <button className="btn_primary_black" disabled={attachState.isLoading || !attachable.length}>{attachState.isLoading ? "Adding..." : "Offer on this product"}</button>
        {!catalog.data?.length && <p className="text-sm text-muted-foreground">No extras exist yet — add one to the shop-wide catalog below first.</p>}
      </form>
    </div>
  </DataCard>;
}

export default function ProductConfigurationView({ productId }: { productId: string }) {
  const product = useGetProductQuery(productId);
  const variants = useListVariantsQuery(productId);
  const extraCatalog = useListExtrasQuery();
  const takenLabels = (variants.data ?? []).map((v) => v.name);

  // This product's own discount/variants (a PRODUCT push) or the extras catalog changing
  // anywhere reaches this page instantly instead of only on its own next mutation.
  useCatalogAlerts(
    useCallback(() => {
      void product.refetch();
      void variants.refetch();
      void extraCatalog.refetch();
    }, [product, variants, extraCatalog])
  );

  return <PageShell>
    <PageHeader title={product.data?.name ? titleCase(product.data.name) : "Product settings"} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Products", href: "/products" }, { label: "Variants and discount" }]} rightSlot={<AdminTopActions />} />
    {product.isLoading ? <p role="status">Loading product...</p> : product.error ? <div role="alert">{apiErrorMessage(product.error as never)} <button className="underline" onClick={() => product.refetch()}>Retry</button></div> : product.data && <>
      <DataCard title="Product discount"><DiscountForm key={JSON.stringify([product.data.id, product.data.discountType, product.data.discountValue, product.data.discountStartAt, product.data.discountEndAt])} product={product.data} /></DataCard>
      <DataCard title="Variants" meta="Every product needs at least one variant to have a price.">
        <div className="space-y-4 p-2">
          {variants.isLoading ? <p role="status">Loading variants...</p> : variants.error ? <div role="alert">{apiErrorMessage(variants.error as never)} <button className="underline" onClick={() => variants.refetch()}>Retry</button></div> : <>
            {!variants.data?.length && <p className="text-sm text-muted-foreground">No variants yet — this product has no price until you add one.</p>}
            {variants.data?.map((variant) => <VariantForm key={variant.id} productId={productId} variant={variant} takenLabels={takenLabels} />)}
            {takenLabels.length < VARIANT_LABELS.length && <VariantForm productId={productId} takenLabels={takenLabels} />}
          </>}
        </div>
      </DataCard>
      <ExtrasSection productId={productId} />
      <DataCard title="Extras catalog" meta="The shop-wide add-ons that any product can offer.">
        <div className="space-y-4 p-2">
          {extraCatalog.isLoading ? <p role="status">Loading extras catalog...</p> : extraCatalog.error ? <div role="alert">{apiErrorMessage(extraCatalog.error as never)} <button className="underline" onClick={() => extraCatalog.refetch()}>Retry</button></div> : <>
            {!extraCatalog.data?.length && <p className="text-sm text-muted-foreground">No extras have been added yet.</p>}
            {extraCatalog.data?.map((extra) => <ExtraCatalogForm key={extra.id} extra={extra} />)}
            <ExtraCatalogForm />
          </>}
        </div>
      </DataCard>
    </>}
  </PageShell>;
}
