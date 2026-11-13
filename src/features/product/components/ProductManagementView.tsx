"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  DetailGrid,
  DetailImage,
  DetailItem,
  DetailModal,
  ExcelImportButton,
  FilterActions,
  FilterPanel,
  FormImageUpload,
  FormInput,
  FormModal,
  FormSelect,
  ModalGrid,
  PaginationFooter,
  Row,
  RowActions,
  SelectField,
  SimpleTable,
  StatTile,
  StatusBadge,
  TableActions,
  TableState,
  listLoadState,
  TextField,
  Thumbnail,
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import { useListCategoriesQuery } from "@/store/api/categoryApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import {
  useCreateProductMutation,
  useCreateVariantMutation,
  useDeleteProductMutation,
  useImportProductsMutation,
  useListProductsQuery,
  useUpdateProductMutation,
  useUploadProductImageMutation,
} from "@/store/api/productApi";
import type { ProductResponse, SellUnit, Status, StockUnit, VariantLabel } from "@/store/api/types";
import { formatSku, humanise, productPriceLabel, titleCase } from "@/lib/utils";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useCatalogAlerts } from "@/hooks/useCatalogAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";

const PRODUCT_TABLE_HEADERS = [
  "No",
  "Image",
  "Name",
  "SKU",
  "Category",
  "Price",
  "Stock",
  "Status",
  "Action",
] as const;

const STOCK_UNITS: StockUnit[] = ["PACK", "BOX", "CARTON", "PIECE"];
const SELL_UNITS: SellUnit[] = ["PLATE", "BOTTLE", "CAN", "CUP", "CARTON", "PACKAGE", "TANK", "PIECE"];
const VARIANT_LABELS: VariantLabel[] = ["MEDIUM", "LARGE", "PIECE"];

type ProductFormFields = {
  name: string;
  description: string;
  sku: string;
  stockUnit: StockUnit | "";
  sellUnit: SellUnit | "";
  unitsPerStock: string;
  categoryId: string;
  reorderLevel: string;
  status: Status;
  // Creation only — a product needs at least one variant to have a price, so the form collects
  // its first one here. Editing a variant's price afterward happens on the configuration screen.
  variantName: VariantLabel | "";
  variantPrice: string;
};

const EMPTY_FORM: ProductFormFields = {
  name: "",
  description: "",
  sku: "",
  stockUnit: "",
  sellUnit: "",
  unitsPerStock: "",
  categoryId: "",
  reorderLevel: "",
  status: "ACTIVE",
  variantName: "",
  variantPrice: "",
};

const money = (value: number | null | undefined) =>
  value == null ? "-" : `$${Number(value).toFixed(2)}`;

export default function Products() {
  const { isAdmin } = useCurrentRole();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [page, setPage] = usePersistentState("products:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("products:searchTerm", "");
  const [categoryFilter, setCategoryFilter] = usePersistentState("products:categoryFilter", "");
  const [statusFilter, setStatusFilter] = usePersistentState("products:statusFilter", "");

  const {
    data: productPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListProductsQuery({
    page,
    size,
    // The API filters by category server-side; status and name are narrowed client-side.
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
  });
  const list = listLoadState({ isFetching, currentData, error });

  const { data: categoryPage, isSuccess: categoriesLoaded, refetch: refetchCategories } = useListCategoriesQuery({
    page: 1,
    size: 200,
  });
  const categories = useMemo(() => categoryPage?.content ?? [], [categoryPage]);

  // A product, category or extra changed anywhere (another tab, another staff member, an Excel
  // import) reaches this list the instant the API broadcasts it, instead of only on this page's
  // own next mutation or a manual refresh.
  useCatalogAlerts(
    useCallback(() => {
      void refetch();
      void refetchCategories();
    }, [refetch, refetchCategories])
  );

  /**
   * Every product needs a category (the API rejects a null categoryId), so on a fresh install
   * the form cannot be completed at all until one exists. Wait for the query to actually
   * succeed before saying so — an empty list while loading is not the same as none existing.
   */
  const hasNoCategories = categoriesLoaded && categories.length === 0;

  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [createVariant, { isLoading: isCreatingVariant }] = useCreateVariantMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [deleteProduct] = useDeleteProductMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadProductImageMutation();
  const [importProducts] = useImportProductsMutation();

  const [formOpen, setFormOpen] = usePersistentState("products:formOpen", false);
  const [detailOpen, setDetailOpen] = usePersistentState("products:detailOpen", false);
  const [selected, setSelected] = usePersistentState<ProductResponse | null>("products:selected", null);
  const [formFields, setFormFields] = usePersistentState<ProductFormFields>("products:formFields", EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const products = useMemo(() => productPage?.content ?? [], [productPage]);

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !term ||
          product.name.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || product.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [products, searchTerm, statusFilter]
  );

  const lowStockCount = products.filter(
    (p) => Number(p.quantityOnHand) <= Number(p.reorderLevel)
  ).length;
  const discountedCount = products.filter((p) => p.discountActive).length;

  const handleOpenForm = (product?: ProductResponse) => {
    if (!isAdmin) return;
    setSelected(product ?? null);
    setImageFile(null);
    setFormFields(
      product
        ? {
            name: product.name,
            description: product.description ?? "",
            sku: formatSku(product.sku),
            stockUnit: product.stockUnit,
            sellUnit: product.sellUnit,
            unitsPerStock: String(product.unitsPerStock ?? ""),
            categoryId: product.categoryId,
            reorderLevel: String(product.reorderLevel ?? ""),
            status: product.status,
            variantName: "",
            variantPrice: "",
          }
        : { ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" }
    );
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelected(null);
    setFormFields(EMPTY_FORM);
    setImageFile(null);
  };

  const handleSubmitForm = async () => {
    if (!isAdmin) return;
    const name = formFields.name.trim();

    if (!name) {
      toast.error("Product name is required");
      return;
    }
    if (!formFields.categoryId) {
      // Telling someone to choose from an empty list is a dead end — on a fresh install there
      // is nothing to choose, and the category is required server-side.
      toast.error(
        hasNoCategories
          ? "Create a category first — a product has to belong to one."
          : "Please choose a category"
      );
      return;
    }
    if (!formFields.stockUnit || !formFields.sellUnit) {
      toast.error("Choose a stock unit and a sell unit");
      return;
    }

    const reorderLevel = formFields.reorderLevel.trim()
      ? Number(formFields.reorderLevel)
      : undefined;
    const unitsPerStock = formFields.unitsPerStock.trim()
      ? Number(formFields.unitsPerStock)
      : undefined;

    try {
      let productId: string;

      if (selected) {
        const updated = await updateProduct({
          id: selected.id,
          body: {
            name,
            description: formFields.description.trim() || undefined,
            sku: formatSku(formFields.sku.trim()) || undefined,
            stockUnit: formFields.stockUnit,
            sellUnit: formFields.sellUnit,
            unitsPerStock,
            categoryId: formFields.categoryId,
            status: formFields.status,
            reorderLevel,
          },
        }).unwrap();
        productId = updated.id;
      } else {
        if (!formFields.sku.trim()) {
          toast.error("SKU is required");
          return;
        }
        // A product with no variant has no price at all, so the form collects one up front —
        // more can be added afterward on the configuration screen.
        const variantPrice = Number(formFields.variantPrice);
        if (!formFields.variantName) {
          toast.error("Choose a variant (e.g. Medium) for the starting price");
          return;
        }
        if (!Number.isFinite(variantPrice) || variantPrice < 0) {
          toast.error("Enter a valid starting price");
          return;
        }
        const created = await createProduct({
          name,
          description: formFields.description.trim() || undefined,
          sku: formatSku(formFields.sku.trim()),
          stockUnit: formFields.stockUnit,
          sellUnit: formFields.sellUnit,
          unitsPerStock,
          categoryId: formFields.categoryId,
          reorderLevel,
        }).unwrap();
        productId = created.id;
        await createVariant({
          productId,
          body: { name: formFields.variantName, price: variantPrice },
        }).unwrap();
      }

      // The image is a separate multipart endpoint, so it only runs once the product exists.
      if (imageFile) {
        await uploadImage({ id: productId, file: imageFile }).unwrap();
      }

      toast.success(selected ? "Product updated" : "Product created");
      handleCloseForm();
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not save the product."));
    }
  };

  const handleDelete = async (product: ProductResponse) => {
    if (!isAdmin) return;
    if (!(await confirm({ title: "Delete product", description: `Delete product "${product.name}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    try {
      await deleteProduct(product.id).unwrap();
      toast.success("Product deleted");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not delete the product."));
    }
  };

  const isSaving = isCreating || isCreatingVariant || isUpdating || isUploading;

  return (
    <PageShell>
      <PageHeader
        title="Products List"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Products" },
          { label: "Products List" },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          title="All Products"
          value={String(productPage?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile
          title="Low Stock (this page)"
          value={String(lowStockCount)}
          tone={lowStockCount > 0 ? "red" : "gray"}
        />
        <StatTile title="On Discount" value={String(discountedCount)} tone="green" />
      </div>

      <FilterPanel>
        <TextField
          label="Name or SKU"
          placeholder="Search products"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <SelectField
          label="Category"
          placeholder="All categories"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {titleCase(category.name)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Status"
          placeholder="All statuses"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setStatusFilter(""); setCategoryFilter(""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard
        title="Products"
        meta={`Total Products: ${productPage?.totalElements ?? 0}`}
        actions={
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-3">
              <ExcelImportButton
                label="Import Excel"
                columnsHint="name, description, sku, unit, price, category, reorderLevel, variants (optional, e.g. MEDIUM:1.50;LARGE:1.75), sellUnit (optional), unitsPerStock (optional), nameKh (optional)"
                onImport={(file) => importProducts(file).unwrap()}
              />
              <TableActions onRegister={() => handleOpenForm()} primaryLabel="Register" />
            </div>
          ) : undefined
        }
      >
        <SimpleTable headers={[...PRODUCT_TABLE_HEADERS]}>
          <TableState
            colSpan={PRODUCT_TABLE_HEADERS.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleProducts.length === 0}
            emptyLabel={
              !isAdmin ? "No products found." : hasNoCategories
                ? "No products yet — and no categories to file one under. Create a category first, then Register a product."
                : "No products yet. Use Register to add the first one."
            }
            onRetry={refetch}
          />
          {list.showRows &&
            visibleProducts.map((product, index) => (
              <Row key={product.id} striped={index % 2 === 1}>
                <Cell>{(page - 1) * size + index + 1}</Cell>
                <Cell>
                  <Thumbnail src={product.imageUrl ?? undefined} />
                </Cell>
                <Cell className="font-semibold">{titleCase(product.name)}</Cell>
                <Cell>{formatSku(product.sku)}</Cell>
                <Cell>{titleCase(product.categoryName)}</Cell>
                <Cell>{productPriceLabel(product.variants)}</Cell>
                <Cell>
                  <span
                    className={
                      Number(product.quantityOnHand) <= Number(product.reorderLevel)
                        ? "font-semibold text-red-600"
                        : undefined
                    }
                  >
                    {Number(product.quantityOnHand)} {humanise(product.stockUnit)}
                  </span>
                </Cell>
                <Cell>
                  <StatusBadge
                    label={product.status === "ACTIVE" ? "Active" : "Inactive"}
                    tone={product.status === "ACTIVE" ? "success" : "danger"}
                  />
                </Cell>
                <Cell>
                  <RowActions
                    onView={() => {
                      setSelected(product);
                      setDetailOpen(true);
                    }}
                    onEdit={isAdmin ? () => handleOpenForm(product) : undefined}
                    onDelete={isAdmin ? () => handleDelete(product) : undefined}
                    isLoading={isSaving}
                  />
                </Cell>
              </Row>
            ))}
        </SimpleTable>
        <PaginationFooter
          page={productPage?.page ?? page}
          totalPages={productPage?.totalPages ?? 1}
          size={size}
          totalElements={productPage?.totalElements}
          onPageChange={setPage}
          onSizeChange={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      </DataCard>

      <FormModal
        open={isAdmin && formOpen}
        onOpenChange={handleCloseForm}
        title={selected ? "Modify Product" : "Register Product"}
        submitLabel="Submit"
        onSubmit={handleSubmitForm}
        isLoading={isSaving}
      >
        {hasNoCategories && !selected ? (
          <div
            className="mx-6 mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
            role="status"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              There are no categories yet, and every product belongs to one.{" "}
              <Link href="/categories" className="font-semibold underline">
                Create a category
              </Link>{" "}
              first, then come back here.
            </p>
          </div>
        ) : null}
        <ModalGrid>
          <FormInput
            label="Product Name"
            placeholder="e.g. Iced Latte"
            value={formFields.name}
            onChange={(e) => setFormFields({ ...formFields, name: e.target.value })}
            required
          />
          <FormInput
            label="SKU"
            placeholder="e.g. DRK-LAT-01"
            value={formFields.sku}
            onChange={(e) => setFormFields({ ...formFields, sku: e.target.value.toUpperCase() })}
            required={!selected}
          />
          <FormSelect
            label="Stock Unit"
            placeholder="Select stock unit"
            value={formFields.stockUnit}
            onChange={(e) => setFormFields({ ...formFields, stockUnit: e.target.value as StockUnit })}
            required
          >
            {STOCK_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {humanise(unit)}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            label="Sell Unit"
            placeholder="Select sell unit"
            value={formFields.sellUnit}
            onChange={(e) => setFormFields({ ...formFields, sellUnit: e.target.value as SellUnit })}
            required
          >
            {SELL_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {humanise(unit)}
              </option>
            ))}
          </FormSelect>
          <FormInput
            label="Units per Stock"
            type="number"
            placeholder="e.g. 24 cans per carton"
            value={formFields.unitsPerStock}
            onChange={(e) => setFormFields({ ...formFields, unitsPerStock: e.target.value })}
          />
          <FormSelect
            label="Category"
            placeholder="Select category"
            value={formFields.categoryId}
            onChange={(e) =>
              setFormFields({ ...formFields, categoryId: e.target.value })
            }
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {titleCase(category.name)}
              </option>
            ))}
          </FormSelect>
          <FormInput
            label="Reorder Level"
            type="number"
            placeholder="e.g. 10"
            value={formFields.reorderLevel}
            onChange={(e) =>
              setFormFields({ ...formFields, reorderLevel: e.target.value })
            }
          />
          {/* A product has no price of its own — creation collects its first variant here.
              More variants, extras and the discount are managed on the configuration screen. */}
          {!selected ? (
            <FormSelect
              label="Variant"
              placeholder="Select variant"
              value={formFields.variantName}
              onChange={(e) => setFormFields({ ...formFields, variantName: e.target.value as VariantLabel })}
              required
            >
              {VARIANT_LABELS.map((label) => (
                <option key={label} value={label}>
                  {humanise(label)}
                </option>
              ))}
            </FormSelect>
          ) : null}
          {!selected ? (
            <FormInput
              label="Starting Price (USD)"
              type="number"
              placeholder="0.00"
              value={formFields.variantPrice}
              onChange={(e) => setFormFields({ ...formFields, variantPrice: e.target.value })}
              required
            />
          ) : null}
          {!selected ? (
            <p className="text-sm text-muted-foreground md:col-span-3">
              More variants, extras and a discount can be added afterward on the configuration screen.
            </p>
          ) : null}
          {selected ? (
            <p className="text-sm text-muted-foreground md:col-span-3">
              Price: {productPriceLabel(selected.variants)}
              {" — "}
              <Link
                href={`/products/${selected.id}/configuration`}
                className="font-semibold underline"
              >
                manage variants, extras and discount
              </Link>
            </p>
          ) : null}
          {selected ? (
            <p className="text-sm text-muted-foreground md:col-span-3">
              Discount:{" "}
              {selected.discountValue != null
                ? `${Number(selected.discountValue)}${
                    selected.discountType === "PERCENTAGE" ? "%" : " USD"
                  } off`
                : "none"}{" "}
              —{" "}
              <Link
                href={`/products/${selected.id}/configuration`}
                className="font-semibold underline"
              >
                manage discount and sizes
              </Link>
            </p>
          ) : null}
          {selected ? (
            <FormSelect
              label="Status"
              placeholder="Select status"
              value={formFields.status}
              onChange={(e) =>
                setFormFields({ ...formFields, status: e.target.value as Status })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </FormSelect>
          ) : null}
          <FormInput
            label="Description"
            placeholder="Short description"
            value={formFields.description}
            onChange={(e) =>
              setFormFields({ ...formFields, description: e.target.value })
            }
          />
          <div className="md:col-span-3">
            <FormImageUpload
              label="Product Image"
              file={imageFile}
              onChange={setImageFile}
            />
          </div>
        </ModalGrid>
      </FormModal>

      <DetailModal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
        title="Product Detail"
        onEdit={isAdmin ? () => {
          const product = selected;
          setDetailOpen(false);
          if (product) handleOpenForm(product);
        } : undefined}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            {isAdmin && <Link href={`/products/${selected.id}/configuration`} className="mb-4 inline-block underline">Manage variants, extras and discount</Link>}
            <DetailGrid>
              <DetailItem label="Name">{titleCase(selected.name)}</DetailItem>
              <DetailItem label="SKU">{formatSku(selected.sku)}</DetailItem>
              <DetailItem label="Category">{titleCase(selected.categoryName)}</DetailItem>
              <DetailItem label="Discount">
                {selected.discountActive
                  ? `${selected.discountValue}${
                      selected.discountType === "PERCENTAGE" ? "%" : " USD"
                    } off`
                  : "None"}
              </DetailItem>
              <DetailItem label="Stock">
                {Number(selected.quantityOnHand)} {humanise(selected.stockUnit)}
              </DetailItem>
              <DetailItem label="Reorder Level">
                {Number(selected.reorderLevel)} {humanise(selected.stockUnit)}
              </DetailItem>
              <DetailItem label="Status">
                <StatusBadge
                  label={selected.status === "ACTIVE" ? "Active" : "Inactive"}
                  tone={selected.status === "ACTIVE" ? "success" : "danger"}
                />
              </DetailItem>
              <DetailItem label="Variants">
                {selected.variants.length > 0
                  ? selected.variants
                      .map((variant) => `${humanise(variant.name)}: ${money(variant.finalPrice)}`)
                      .join(", ")
                  : "None yet"}
              </DetailItem>
              <DetailItem label="Extras">
                {selected.extras.length > 0
                  ? selected.extras
                      .map((extra) => `${titleCase(extra.name)} (+${money(extra.price)})`)
                      .join(", ")
                  : "None"}
              </DetailItem>
              <DetailItem label="Description">{selected.description || "-"}</DetailItem>
              <div className="detail_item">
                <p className="detail_item_label">Image :</p>
                <DetailImage src={selected.imageUrl ?? undefined} alt={selected.name} />
              </div>
            </DetailGrid>
          </div>
        )}
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
