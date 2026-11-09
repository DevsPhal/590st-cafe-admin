"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
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
  FieldError,
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
  MoneyField,
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import { useListCategoriesQuery } from "@/store/api/categoryApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import { useI18n } from "@/contexts/I18nContext";
import {
  useCreateProductMutation,
  useCreateVariantMutation,
  useDeleteProductMutation,
  useDownloadProductImportTemplateMutation,
  useGenerateSkuMutation,
  useImportProductsMutation,
  useListProductsQuery,
  useUpdateProductMutation,
  useUploadProductImageMutation,
} from "@/store/api/productApi";
import type { CategoryGroup, ProductResponse, SellUnit, SkuMode, Status, StockUnit, VariantLabel } from "@/store/api/types";
import { formatSku, productPriceLabel, titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { formatStock, stockUnitSize } from "@/lib/stockUnits";
import {
  allowedVariantLabels,
  hasRecipe,
  isIngredient,
  isIngredientGroup,
  isPackLabel,
  variantDisplayName,
} from "@/features/product/productKinds";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useCatalogAlerts } from "@/hooks/useCatalogAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { filteredPage, filteredQueryArgs } from "@/hooks/useFilteredPaging";
import { productSchema, SKU_MAX_LENGTH } from "@/lib/formSchemas";
import { useFormErrors } from "@/hooks/useFormErrors";
import { Button } from "@/components/common/Button";

const STOCK_UNITS: StockUnit[] = ["PACK", "BOX", "CARTON", "PIECE", "BAG", "BOTTLE", "KILOGRAM", "LITER"];
const SELL_UNITS: SellUnit[] = [
  "PLATE", "BOTTLE", "CAN", "CUP", "CARTON", "PACKAGE", "TANK", "PIECE", "GRAM", "MILLILITER",
];

type KindFilter = "" | "MENU" | "INGREDIENT";

type ProductFormFields = {
  name: string;
  description: string;
  sku: string;
  // GENERATE: the server assigns the SKU on save (`sku` is only a preview). MANUAL: `sku` is sent as typed.
  skuMode: SkuMode;
  stockUnit: StockUnit | "";
  sellUnit: SellUnit | "";
  unitsPerStock: string;
  categoryId: string;
  reorderLevel: string;
  status: Status;
  variantName: VariantLabel | "";
  variantPrice: string;
};

const EMPTY_FORM: ProductFormFields = {
  name: "",
  description: "",
  sku: "",
  skuMode: "GENERATE",
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

function WithHint({ hint, children }: { hint: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

function ProductBadges({ product }: { product: ProductResponse }) {
  const { t } = useI18n();
  return (
    <>
      {isIngredient(product) && <StatusBadge label={t("products.badges.ingredient", "Ingredient")} tone="neutral" />}
      {hasRecipe(product) && <StatusBadge label={t("products.badges.recipe", "Recipe")} tone="info" />}
    </>
  );
}

export default function Products() {
  const { t } = useI18n();
  const { isAdmin } = useCurrentRole();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [page, setPage] = usePersistentState("products:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("products:searchTerm", "");
  const [categoryFilter, setCategoryFilter] = usePersistentState("products:categoryFilter", "");
  const [statusFilter, setStatusFilter] = usePersistentState("products:statusFilter", "");
  const [kindFilter, setKindFilter] = usePersistentState<KindFilter>("products:kindFilter", "");

  const isFiltering = Boolean(searchTerm.trim() || statusFilter || kindFilter);
  const {
    data: productPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListProductsQuery({
    ...filteredQueryArgs(page, size, isFiltering),
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
  });
  const list = listLoadState({ isFetching, currentData, error });

  const { data: categoryPage, isSuccess: categoriesLoaded, refetch: refetchCategories } = useListCategoriesQuery({
    page: 1,
    size: 200,
  });
  const categories = useMemo(() => categoryPage?.content ?? [], [categoryPage]);

  useCatalogAlerts(
    useCallback(() => {
      void refetch();
      void refetchCategories();
    }, [refetch, refetchCategories])
  );

  const hasNoCategories = categoriesLoaded && categories.length === 0;

  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [createVariant, { isLoading: isCreatingVariant }] = useCreateVariantMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadProductImageMutation();
  const [importProducts] = useImportProductsMutation();
  const [downloadProductTemplate] = useDownloadProductImportTemplateMutation();
  const [generateSku, { isLoading: isGeneratingSku }] = useGenerateSkuMutation();

  const [formOpen, setFormOpen] = usePersistentState("products:formOpen", false);
  const [detailOpen, setDetailOpen] = usePersistentState("products:detailOpen", false);
  const [selected, setSelected] = usePersistentState<ProductResponse | null>("products:selected", null);
  const [formFields, setFormFields] = usePersistentState<ProductFormFields>("products:formFields", EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const products = useMemo(() => productPage?.content ?? [], [productPage]);

  const matchingProducts = useMemo(
    () =>
      products.filter((product) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !term ||
          product.name.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || product.status === statusFilter;
        const matchesKind = !kindFilter || (kindFilter === "INGREDIENT") === isIngredient(product);
        return matchesSearch && matchesStatus && matchesKind;
      }),
    [products, searchTerm, statusFilter, kindFilter]
  );
  const view = filteredPage(matchingProducts, productPage, page, size, isFiltering);
  const visibleProducts = view.rows;

  const lowStockCount = products.filter(
    (p) => Number(p.quantityOnHand) <= Number(p.reorderLevel)
  ).length;
  const discountedCount = products.filter((p) => p.discountActive).length;

  const categoryGroupOf = (categoryId: string): CategoryGroup | null =>
    categories.find((category) => category.id === categoryId)?.categoryGroup ??
    (selected?.categoryId === categoryId ? selected.categoryGroup : null);
  // Ingredients are mostly weighed, so a new one starts in grams; any other unit can still be picked.
  const ingredientDefaults = (categoryId: string, sellUnit: SellUnit | "") =>
    isIngredientGroup(categoryGroupOf(categoryId)) && !sellUnit ? { sellUnit: "GRAM" as const } : {};

  const formCategoryGroup = categoryGroupOf(formFields.categoryId);
  const isIngredientForm = isIngredientGroup(formCategoryGroup);
  // A pack can only start the product when it's the unit stock is bought in, since the server then knows its
  // size; other packs are added on the configuration screen, where their size is entered.
  const startingVariantLabels = allowedVariantLabels(formCategoryGroup).filter(
    (label) => !isPackLabel(label) || label === formFields.stockUnit
  );
  const startingVariant: VariantLabel | "" =
    formFields.variantName && startingVariantLabels.includes(formFields.variantName) ? formFields.variantName : "";
  const validation = useFormErrors(
    productSchema({ isCreate: !selected, hasNoCategories, isIngredient: isIngredientForm }),
    { ...formFields, sku: formatSku(formFields.sku.trim()), variantName: startingVariant }
  );
  const purchaseUnitLabel = enumLabel(t, "unit", formFields.stockUnit);
  const sellUnitLabel = enumLabel(t, "unit", formFields.sellUnit);

  const handleOpenForm = (product?: ProductResponse) => {
    if (!isAdmin) return;
    const firstCategoryId = categories[0]?.id ?? "";
    setSelected(product ?? null);
    setImageFile(null);
    setFormFields(
      product
        ? {
            name: product.name,
            description: product.description ?? "",
            sku: formatSku(product.sku),
            skuMode: "MANUAL",
            stockUnit: product.stockUnit,
            sellUnit: product.sellUnit,
            unitsPerStock: String(product.unitsPerStock ?? ""),
            categoryId: product.categoryId,
            reorderLevel: String(product.reorderLevel ?? ""),
            status: product.status,
            variantName: "",
            variantPrice: "",
          }
        : { ...EMPTY_FORM, categoryId: firstCategoryId, ...ingredientDefaults(firstCategoryId, "") }
    );
    validation.reset();
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelected(null);
    setFormFields(EMPTY_FORM);
    setImageFile(null);
  };

  // A generated preview depends on name + category, so drop it when either changes; the server
  // still generates a fresh SKU on save while the mode stays GENERATE.
  const updateSkuSource = (patch: Pick<Partial<ProductFormFields>, "name" | "categoryId" | "sellUnit">) =>
    setFormFields({
      ...formFields,
      ...patch,
      ...(formFields.skuMode === "GENERATE" ? { sku: "" } : {}),
    });

  const handleGenerateSku = async () => {
    const name = formFields.name.trim();
    if (!name || !formFields.categoryId) {
      toast.error(t("products.toast.sku_needs_name_category", "Enter a product name and choose a category to generate a SKU."));
      return;
    }
    try {
      const suggestion = await generateSku({
        categoryId: formFields.categoryId,
        name,
        ...(selected ? { productId: selected.id } : {}),
      }).unwrap();
      setFormFields({ ...formFields, sku: suggestion.sku, skuMode: "GENERATE" });
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("products.errors.generate_sku", "Could not generate a SKU.")));
    }
  };

  const handleSubmitForm = async () => {
    if (!isAdmin) return;
    const manualSku = formatSku(formFields.sku.trim());
    const parsed = validation.validate();
    if (!parsed) return;
    const { name, description, stockUnit, sellUnit, variantName, unitsPerStock, reorderLevel } = parsed;
    const isManualSku = formFields.skuMode === "MANUAL" && Boolean(manualSku);
    // Blank manual SKU: create falls back to generating one, update keeps the current SKU.
    const skuFields = isManualSku
      ? { sku: manualSku, skuMode: "MANUAL" as const }
      : !selected || formFields.skuMode === "GENERATE"
        ? { skuMode: "GENERATE" as const }
        : {};

    try {
      let productId: string;

      if (selected) {
        const updated = await updateProduct({
          id: selected.id,
          body: {
            name,
            description,
            ...skuFields,
            stockUnit,
            sellUnit,
            unitsPerStock,
            categoryId: formFields.categoryId,
            status: formFields.status,
            reorderLevel,
          },
        }).unwrap();
        productId = updated.id;
      } else {
        const variantPrice = Number(formFields.variantPrice.replace(/,/g, ""));
        const created = await createProduct({
          name,
          description,
          ...skuFields,
          stockUnit,
          sellUnit,
          unitsPerStock,
          categoryId: formFields.categoryId,
          reorderLevel,
        }).unwrap();
        productId = created.id;
        if (!isIngredientForm) {
          await createVariant({
            productId,
            body: { name: variantName as VariantLabel, price: variantPrice },
          }).unwrap();
        }
      }

      if (imageFile) {
        await uploadImage({ id: productId, file: imageFile }).unwrap();
      }

      toast.success(selected ? t("products.toast.updated", "Product updated") : t("products.toast.created", "Product created"));
      handleCloseForm();
    } catch (err) {
      validation.showServerError(err, t("products.errors.save", "Could not save the product."));
    }
  };

  const handleDelete = async (product: ProductResponse) => {
    if (!isAdmin) return;
    if (!(await confirm({ title: t("products.confirm.delete_title", "Delete product"), description: t("products.confirm.delete_description", "Delete product \"{name}\"?", { name: product.name }), confirmLabel: t("actions.delete", "Delete"), tone: "danger" }))) return;
    try {
      await deleteProduct(product.id).unwrap();
      toast.success(t("products.toast.deleted", "Product deleted"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("products.errors.delete", "Could not delete the product.")));
    }
  };

  const isSaving = isCreating || isCreatingVariant || isUpdating || isUploading;

  const productTableHeaders = [
    t("table.no", "No"),
    t("fields.image", "Image"),
    t("fields.name", "Name"),
    t("fields.sku", "SKU"),
    t("fields.category", "Category"),
    t("fields.price", "Price"),
    t("products.fields.stock", "Stock"),
    t("fields.status", "Status"),
    t("table.action", "Action"),
  ];

  return (
    <PageShell>
      <PageHeader
        title={t("products.title", "Products List")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("products.breadcrumb.products", "Products") },
          { label: t("products.title", "Products List") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          title={t("products.stats.all", "All Products")}
          value={String(productPage?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile
          title={t("products.stats.low_stock_page", "Low Stock (this page)")}
          value={String(lowStockCount)}
          tone={lowStockCount > 0 ? "red" : "gray"}
        />
        <StatTile title={t("products.stats.on_discount", "On Discount")} value={String(discountedCount)} tone="green" />
      </div>

      <FilterPanel>
        <TextField
          label={t("products.filters.name_or_sku", "Name or SKU")}
          placeholder={t("products.filters.search_placeholder", "Search products")}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
        />
        <SelectField
          label={t("fields.category", "Category")}
          placeholder={t("products.filters.all_categories", "All categories")}
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
          label={t("fields.status", "Status")}
          placeholder={t("products.filters.all_statuses", "All statuses")}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="ACTIVE">{enumLabel(t, "status", "ACTIVE")}</option>
          <option value="INACTIVE">{enumLabel(t, "status", "INACTIVE")}</option>
        </SelectField>
        <SelectField
          label={t("products.filters.kind", "Type")}
          placeholder={t("products.filters.all_kinds", "All")}
          value={kindFilter}
          onChange={(e) => {
            setKindFilter(e.target.value as KindFilter);
            setPage(1);
          }}
        >
          <option value="MENU">{t("products.filters.menu_items", "Menu items")}</option>
          <option value="INGREDIENT">{t("products.filters.ingredients", "Ingredients")}</option>
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setStatusFilter(""); setCategoryFilter(""); setKindFilter(""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard
        title={t("products.card.title", "Products")}
        meta={t("products.card.meta", "Total Products: {count}", { count: productPage?.totalElements ?? 0 })}
        actions={
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-3">
              <ExcelImportButton
                label={t("actions.import_excel", "Import Excel")}
                columnsHint={t("products.import.columns_hint", "Name, Category, Price, Stock Unit, plus optional Name (Khmer), Description, SKU (blank = auto-generate), Large Price, Sell Unit, Units Per Stock, Reorder Level")}
                onImport={(file) => importProducts(file).unwrap()}
                template={{
                  filename: "product-import-template.xlsx",
                  download: () => downloadProductTemplate().unwrap(),
                }}
              />
              <TableActions onRegister={() => handleOpenForm()} primaryLabel={t("actions.register", "Register")} />
            </div>
          ) : undefined
        }
      >
        <SimpleTable headers={productTableHeaders}>
          <TableState
            colSpan={productTableHeaders.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleProducts.length === 0}
            emptyLabel={
              isFiltering ? t("products.empty.filtered", "No products match these filters.")
              : !isAdmin ? t("products.empty.none", "No products found.") : hasNoCategories
                ? t("products.empty.no_categories", "No products yet — and no categories to file one under. Create a category first, then Register a product.")
                : t("products.empty.admin", "No products yet. Use Register to add the first one.")
            }
            onRetry={refetch}
          />
          {list.showRows &&
            visibleProducts.map((product, index) => (
              <Row key={product.id} striped={index % 2 === 1}>
                <Cell>{view.offset + index + 1}</Cell>
                <Cell>
                  <Thumbnail src={product.imageUrl} kind="product" />
                </Cell>
                <Cell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{titleCase(product.name)}</span>
                    <ProductBadges product={product} />
                  </div>
                </Cell>
                <Cell>{formatSku(product.sku)}</Cell>
                <Cell>{titleCase(product.categoryName)}</Cell>
                <Cell>
                  {isIngredient(product) ? (
                    <span className="text-muted-foreground">{t("products.list.not_sold", "Not sold")}</span>
                  ) : (
                    productPriceLabel(product.variants)
                  )}
                </Cell>
                <Cell>
                  <span
                    className={
                      Number(product.quantityOnHand) <= Number(product.reorderLevel)
                        ? "font-semibold text-red-700"
                        : undefined
                    }
                  >
                    {formatStock(t, Number(product.quantityOnHand), product)}
                  </span>
                </Cell>
                <Cell>
                  <StatusBadge
                    label={enumLabel(t, "status", product.status)}
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
                    isLoading={isSaving || isDeleting}
                  />
                </Cell>
              </Row>
            ))}
        </SimpleTable>
        <PaginationFooter
          page={view.page}
          totalPages={view.totalPages}
          size={size}
          totalElements={view.totalElements}
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
        title={selected ? t("products.form.modify_title", "Modify Product") : t("products.form.register_title", "Register Product")}
        submitLabel={t("actions.submit", "Submit")}
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
              {t("products.form.no_categories_before", "There are no categories yet, and every product belongs to one.")}{" "}
              <Link href="/categories" className="font-semibold underline">
                {t("products.form.no_categories_link", "Create a category")}
              </Link>{" "}
              {t("products.form.no_categories_after", "first, then come back here.")}
            </p>
          </div>
        ) : null}
        <ModalGrid>
          <FormInput
            label={t("products.form.name", "Product Name")}
            placeholder={t("products.form.name_placeholder", "e.g. Iced Latte")}
            value={formFields.name}
            error={validation.errors.name}
            onChange={(e) => updateSkuSource({ name: e.target.value })}
            required
          />
          <div className="form_field">
            <span className="form_field_label">{t("fields.sku", "SKU")}</span>
            <div className="flex gap-2">
              <input
                value={formFields.sku}
                onChange={(e) =>
                  setFormFields({ ...formFields, sku: e.target.value.toUpperCase(), skuMode: "MANUAL" })
                }
                placeholder={
                  formFields.skuMode === "GENERATE"
                    ? t("products.form.sku_auto_placeholder", "Auto-generated on save")
                    : t("products.form.sku_placeholder", "e.g. FD-COF-IL-001")
                }
                maxLength={SKU_MAX_LENGTH}
                aria-label={t("fields.sku", "SKU")}
                aria-invalid={validation.errors.sku ? true : undefined}
                aria-describedby={validation.errors.sku ? "product-sku-error" : undefined}
                className="form_field_control min-w-0 flex-1"
              />
              <Button
               
                onClick={handleGenerateSku}
                disabled={isGeneratingSku}
                variant="outline" className="shrink-0"
                title={t("products.form.sku_generate_title", "Generate from category and name (GROUP-CATEGORY-NAME-###)")}
              >
                {selected ? t("products.form.regenerate", "Regenerate") : t("products.form.generate", "Generate")}
                <RefreshCw className={isGeneratingSku ? "animate-spin" : undefined} />
              </Button>
            </div>
            <FieldError id="product-sku-error" error={validation.errors.sku} />
            <span className="text-xs text-muted-foreground">
              {formFields.skuMode === "GENERATE"
                ? t("products.form.sku_generated_hint", "Generated from category and name. Type to enter your own.")
                : t("validation.sku_hint", "Letters, digits and single - _ . separators, e.g. FD-COF-IL-001")}
            </span>
          </div>
          <FormSelect
            label={t("fields.category", "Category")}
            placeholder={t("products.form.category_placeholder", "Select category")}
            value={formFields.categoryId}
            error={validation.errors.categoryId}
            onChange={(e) =>
              updateSkuSource({ categoryId: e.target.value, ...ingredientDefaults(e.target.value, formFields.sellUnit) })
            }
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {titleCase(category.name)}
              </option>
            ))}
          </FormSelect>
          <WithHint hint={t("products.form.purchase_unit_hint", "What stock is bought in, e.g. Carton or Kilogram.")}>
            <FormSelect
              label={t("products.fields.purchase_unit", "Purchase Unit")}
              placeholder={t("products.form.purchase_unit_placeholder", "Select purchase unit")}
              value={formFields.stockUnit}
              error={validation.errors.stockUnit}
              onChange={(e) => setFormFields({ ...formFields, stockUnit: e.target.value as StockUnit })}
              required
            >
              {STOCK_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {enumLabel(t, "unit", unit)}
                </option>
              ))}
            </FormSelect>
          </WithHint>
          <WithHint hint={t("products.form.sell_unit_hint", "Stock and the reorder level are counted in it, e.g. Can or Gram.")}>
            <FormSelect
              label={t("products.fields.sell_unit", "Sell Unit")}
              placeholder={t("products.form.sell_unit_placeholder", "Select sell unit")}
              value={formFields.sellUnit}
              error={validation.errors.sellUnit}
              onChange={(e) => setFormFields({ ...formFields, sellUnit: e.target.value as SellUnit })}
              required
            >
              {SELL_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {enumLabel(t, "unit", unit)}
                </option>
              ))}
            </FormSelect>
          </WithHint>
          <WithHint
            hint={
              formFields.stockUnit && formFields.sellUnit
                ? t("products.form.units_per_purchase_hint", "1 {purchase} = {count} {sell}", {
                    purchase: purchaseUnitLabel,
                    count: formFields.unitsPerStock.trim() || 1,
                    sell: sellUnitLabel,
                  })
                : t("products.form.units_per_purchase_empty_hint", "Whole number; blank means 1.")
            }
          >
            <FormInput
              label={t("products.fields.units_per_purchase", "Sell units per purchase unit")}
              type="number"
              min={1}
              step={1}
              placeholder={t("products.form.units_per_purchase_placeholder", "e.g. 24 cans per carton, 1000 g per kg")}
              value={formFields.unitsPerStock}
              error={validation.errors.unitsPerStock}
              onChange={(e) => setFormFields({ ...formFields, unitsPerStock: e.target.value })}
            />
          </WithHint>
          <WithHint hint={t("products.form.reorder_level_hint", "Counted in the sell unit; stock at or below it shows as low.")}>
            <FormInput
              label={
                formFields.sellUnit
                  ? t("products.form.reorder_level_in", "Reorder Level ({unit})", { unit: sellUnitLabel })
                  : t("products.fields.reorder_level", "Reorder Level")
              }
              type="number"
              min={0}
              step={1}
              placeholder={t("products.form.reorder_level_placeholder", "e.g. 10")}
              value={formFields.reorderLevel}
              error={validation.errors.reorderLevel}
              onChange={(e) =>
                setFormFields({ ...formFields, reorderLevel: e.target.value })
              }
            />
          </WithHint>
          {!selected && !isIngredientForm ? (
            <FormSelect
              label={t("products.fields.variant", "Variant")}
              placeholder={t("products.form.variant_placeholder", "Select variant")}
              value={startingVariant}
              error={validation.errors.variantName}
              onChange={(e) => setFormFields({ ...formFields, variantName: e.target.value as VariantLabel })}
              required
            >
              {startingVariantLabels.map((label) => (
                <option key={label} value={label}>
                  {enumLabel(t, "variant", label)}
                </option>
              ))}
            </FormSelect>
          ) : null}
          {!selected && !isIngredientForm ? (
            <MoneyField
              label={t("products.form.starting_price", "Starting Price (USD)")}
              value={formFields.variantPrice}
              error={validation.errors.variantPrice}
              onValueChange={(variantPrice) => setFormFields({ ...formFields, variantPrice })}
              required
            />
          ) : null}
          {isIngredientForm ? (
            <p className="text-sm text-muted-foreground md:col-span-3">
              {t("products.form.ingredient_hint", "Ingredients are stock-only: no variants, price, extras or discount. Add their stock from")}{" "}
              <Link href="/inventory" className="font-semibold underline">
                {t("products.form.ingredient_hint_link", "Inventory")}
              </Link>
              {t("products.form.ingredient_hint_after", ", then use them in drink recipes.")}
            </p>
          ) : null}
          {!selected && !isIngredientForm ? (
            <p className="text-sm text-muted-foreground md:col-span-3">
              {t("products.form.more_config_hint", "More variants, recipes, extras and a discount can be added afterward on the configuration screen.")}
            </p>
          ) : null}
          {selected && !isIngredientForm ? (
            <p className="text-sm text-muted-foreground md:col-span-3">
              {t("products.form.price_line", "Price: {price}", { price: productPriceLabel(selected.variants) })}
              {" — "}
              <Link
                href={`/products/${selected.id}/configuration`}
                className="font-semibold underline"
              >
                {t("products.form.manage_variants_link", "manage variants, recipes, extras and discount")}
              </Link>
            </p>
          ) : null}
          {selected && !isIngredientForm ? (
            <p className="text-sm text-muted-foreground md:col-span-3">
              {t("products.form.discount_line", "Discount: {discount}", {
                discount:
                  selected.discountValue != null
                    ? t("products.discount_off", "{value} off", {
                        value: `${Number(selected.discountValue)}${
                          selected.discountType === "PERCENTAGE" ? "%" : " USD"
                        }`,
                      })
                    : t("products.form.discount_none", "none"),
              })}{" "}
              —{" "}
              <Link
                href={`/products/${selected.id}/configuration`}
                className="font-semibold underline"
              >
                {t("products.form.manage_discount_link", "manage discount and sizes")}
              </Link>
            </p>
          ) : null}
          {selected ? (
            <FormSelect
              label={t("fields.status", "Status")}
              placeholder={t("products.form.status_placeholder", "Select status")}
              value={formFields.status}
              onChange={(e) =>
                setFormFields({ ...formFields, status: e.target.value as Status })
              }
            >
              <option value="ACTIVE">{enumLabel(t, "status", "ACTIVE")}</option>
              <option value="INACTIVE">{enumLabel(t, "status", "INACTIVE")}</option>
            </FormSelect>
          ) : null}
          <FormInput
            label={t("fields.description", "Description")}
            placeholder={t("products.form.description_placeholder", "Short description")}
            value={formFields.description}
            error={validation.errors.description}
            onChange={(e) =>
              setFormFields({ ...formFields, description: e.target.value })
            }
          />
          <div className="md:col-span-3">
            <FormImageUpload
              label={t("products.form.image", "Product Image")}
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
        title={t("products.detail.title", "Product Detail")}
        onEdit={isAdmin ? () => {
          const product = selected;
          setDetailOpen(false);
          if (product) handleOpenForm(product);
        } : undefined}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            {isAdmin && !isIngredient(selected) && <Link href={`/products/${selected.id}/configuration`} className="mb-4 inline-block underline">{t("products.detail.manage_link", "Manage variants, recipes, extras and discount")}</Link>}
            <DetailGrid>
              <DetailItem label={t("fields.name", "Name")}>
                <div className="flex flex-wrap items-center gap-2">
                  {titleCase(selected.name)}
                  <ProductBadges product={selected} />
                </div>
              </DetailItem>
              <DetailItem label={t("fields.sku", "SKU")}>{formatSku(selected.sku)}</DetailItem>
              <DetailItem label={t("fields.category", "Category")}>{titleCase(selected.categoryName)}</DetailItem>
              {!isIngredient(selected) && (
                <DetailItem label={t("products.fields.discount", "Discount")}>
                  {selected.discountActive
                    ? t("products.discount_off", "{value} off", {
                        value: `${selected.discountValue}${
                          selected.discountType === "PERCENTAGE" ? "%" : " USD"
                        }`,
                      })
                    : t("products.detail.none", "None")}
                </DetailItem>
              )}
              <DetailItem label={t("products.fields.stock", "Stock")}>
                {formatStock(t, Number(selected.quantityOnHand), selected)}
              </DetailItem>
              <DetailItem label={t("products.fields.reorder_level", "Reorder Level")}>
                {Number(selected.reorderLevel).toLocaleString()} {enumLabel(t, "unit", selected.sellUnit)}
              </DetailItem>
              <DetailItem label={t("products.fields.purchase_unit", "Purchase Unit")}>
                {stockUnitSize(t, selected)}
              </DetailItem>
              <DetailItem label={t("fields.status", "Status")}>
                <StatusBadge
                  label={enumLabel(t, "status", selected.status)}
                  tone={selected.status === "ACTIVE" ? "success" : "danger"}
                />
              </DetailItem>
              <DetailItem label={t("products.fields.variants", "Variants")}>
                {isIngredient(selected)
                  ? t("products.detail.ingredient_variants", "None: an ingredient is used up by recipes, not sold")
                  : selected.variants.length > 0
                  ? selected.variants
                      .map(
                        (variant) =>
                          `${variantDisplayName(t, variant, selected.sellUnit)}: ${money(variant.finalPrice)}${
                            variant.recipeBased ? ` (${t("products.badges.recipe", "Recipe")})` : ""
                          }`
                      )
                      .join(", ")
                  : t("products.detail.none_yet", "None yet")}
              </DetailItem>
              {!isIngredient(selected) && (
                <DetailItem label={t("products.fields.extras", "Extras")}>
                  {selected.extras.length > 0
                    ? selected.extras
                        .map((extra) => `${titleCase(extra.name)} (+${money(extra.price)})`)
                        .join(", ")
                    : t("products.detail.none", "None")}
                </DetailItem>
              )}
              <DetailItem label={t("fields.description", "Description")}>{selected.description || "-"}</DetailItem>
              <div className="detail_item">
                <p className="detail_item_label">{t("products.detail.image", "Image :")}</p>
                <DetailImage src={selected.imageUrl ?? undefined} alt={selected.name} kind="product" />
              </div>
            </DetailGrid>
          </div>
        )}
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
