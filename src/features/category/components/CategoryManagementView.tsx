"use client";

import { useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  DetailGrid,
  DetailItem,
  DetailModal,
  FilterActions,
  FilterPanel,
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
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import { translate, useI18n } from "@/contexts/I18nContext";
import {
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useListCategoriesQuery,
  useUpdateCategoryMutation,
} from "@/store/api/categoryApi";
import { useListProductsQuery } from "@/store/api/productApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import type { CategoryGroup, CategoryResponse, Status } from "@/store/api/types";
import { titleCase } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateFormat";
import { enumLabel } from "@/lib/enumLabel";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useCatalogAlerts } from "@/hooks/useCatalogAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { filteredPage, filteredQueryArgs } from "@/hooks/useFilteredPaging";
import { categorySchema } from "@/lib/formSchemas";
import { useFormErrors } from "@/hooks/useFormErrors";

const CATEGORY_GROUPS: CategoryGroup[] = ["FRESH_DRINK", "BEVERAGE", "SNACK"];

type CategoryFormFields = {
  name: string;
  description: string;
  status: Status;
  categoryGroup: CategoryGroup | "";
};

const EMPTY_FORM: CategoryFormFields = {
  name: "",
  description: "",
  status: "ACTIVE",
  categoryGroup: "",
};

function formatCreatedDate(date: string | null) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return formatLocalDate(parsed, { day: "2-digit", month: "short", year: "numeric" })
    .replace(/ /g, "-");
}

function statusTone(status: Status): "success" | "danger" {
  return status === "ACTIVE" ? "success" : "danger";
}

function statusLabel(status: Status) {
  return translate(`enums.status.${status}`, status === "ACTIVE" ? "Active" : "Inactive");
}

export default function Categories() {
  const { t } = useI18n();
  const { isAdmin } = useCurrentRole();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [page, setPage] = usePersistentState("categories:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("categories:searchTerm", "");
  const [filterStatus, setFilterStatus] = usePersistentState("categories:filterStatus", "");
  const isFiltering = Boolean(searchTerm.trim() || filterStatus);

  const {
    data: categoryPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListCategoriesQuery(filteredQueryArgs(page, size, isFiltering));
  const list = listLoadState({ isFetching, currentData, error });

  const { data: productPage, refetch: refetchProducts } = useListProductsQuery({ page: 1, size: 500 });

  useCatalogAlerts(
    useCallback(() => {
      void refetch();
      void refetchProducts();
    }, [refetch, refetchProducts])
  );

  const [createCategory, { isLoading: isCreating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] = useDeleteCategoryMutation();

  const [formOpen, setFormOpen] = usePersistentState("categories:formOpen", false);
  const [detailOpen, setDetailOpen] = usePersistentState("categories:detailOpen", false);
  const [selected, setSelected] = usePersistentState<CategoryResponse | null>("categories:selected", null);
  const [formFields, setFormFields] = usePersistentState<CategoryFormFields>("categories:formFields", EMPTY_FORM);
  const validation = useFormErrors(categorySchema, formFields);

  const categories = useMemo(() => categoryPage?.content ?? [], [categoryPage]);

  const categoryTableHeaders = [
    t("table.no", "No"),
    t("categories.fields.category_name", "Category Name"),
    t("fields.description", "Description"),
    t("categories.fields.total_products", "Total Products"),
    t("fields.created_date", "Created Date"),
    t("fields.created_by", "Created By"),
    t("fields.status", "Status"),
    t("table.action", "Action"),
  ];

  const productCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of productPage?.content ?? []) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [productPage]);

  const matchingCategories = useMemo(
    () =>
      categories.filter((category) => {
        const matchesSearch = category.name
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase());
        const matchesStatus = !filterStatus || category.status === filterStatus;
        return matchesSearch && matchesStatus;
      }),
    [categories, searchTerm, filterStatus]
  );
  const view = filteredPage(matchingCategories, categoryPage, page, size, isFiltering);
  const visibleCategories = view.rows;

  const activeCount = categories.filter((c) => c.status === "ACTIVE").length;

  const handleOpenForm = (category?: CategoryResponse) => {
    if (!isAdmin) return;
    setSelected(category ?? null);
    setFormFields(
      category
        ? {
            name: category.name,
            description: category.description ?? "",
            status: category.status,
            categoryGroup: category.categoryGroup ?? "",
          }
        : EMPTY_FORM
    );
    validation.reset();
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelected(null);
    setFormFields(EMPTY_FORM);
    validation.reset();
  };

  const handleSubmitForm = async () => {
    if (!isAdmin) return;
    const parsed = validation.validate();
    if (!parsed) return;
    const { name, description } = parsed;
    const categoryGroup = formFields.categoryGroup || undefined;

    try {
      if (selected) {
        await updateCategory({
          id: selected.id,
          body: { name, description, status: formFields.status, categoryGroup },
        }).unwrap();
        toast.success(t("categories.toast.updated", "Category updated"));
      } else {
        await createCategory({ name, description, categoryGroup }).unwrap();
        toast.success(t("categories.toast.created", "Category created"));
      }
      handleCloseForm();
    } catch (err) {
      validation.showServerError(err, t("categories.errors.save", "Could not save the category."));
    }
  };

  const handleDelete = async (category: CategoryResponse) => {
    if (!isAdmin) return;
    if (!(await confirm({ title: t("categories.confirm.delete_title", "Delete category"), description: t("categories.confirm.delete_description", "Delete category \"{name}\"?", { name: category.name }), confirmLabel: t("actions.delete", "Delete"), tone: "danger" }))) return;
    try {
      await deleteCategory(category.id).unwrap();
      toast.success(t("categories.toast.deleted", "Category deleted"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("categories.errors.delete", "Could not delete the category.")));
    }
  };

  const handleViewDetail = (category: CategoryResponse) => {
    setSelected(category);
    setDetailOpen(true);
  };

  return (
    <PageShell>
      <PageHeader
        title={t("categories.title", "Categories List")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("categories.breadcrumb.categories", "Categories") },
          { label: t("categories.breadcrumb.list", "Categories List") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          title={t("categories.stats.all", "All Categories")}
          value={String(categoryPage?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile title={t("categories.stats.active_page", "Active (this page)")} value={String(activeCount)} tone="gray" />
        <StatTile
          title={t("categories.stats.products_categorised", "Products Categorised")}
          value={String(productPage?.totalElements ?? 0)}
          tone="gray"
        />
      </div>

      <FilterPanel>
        <TextField
          label={t("categories.fields.category_name", "Category Name")}
          placeholder={t("categories.filters.search_by_name", "Search by name")}
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />
        <SelectField
          label={t("fields.status", "Status")}
          placeholder={t("categories.filters.all_statuses", "All statuses")}
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
        >
          <option value="ACTIVE">{enumLabel(t, "status", "ACTIVE")}</option>
          <option value="INACTIVE">{enumLabel(t, "status", "INACTIVE")}</option>
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setFilterStatus(""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard
        title={t("categories.card.title", "Categories")}
        meta={t("categories.card.meta", "Total Categories: {count}", { count: categoryPage?.totalElements ?? 0 })}
        actions={
          isAdmin ? <TableActions onRegister={() => handleOpenForm()} primaryLabel={t("actions.register", "Register")} /> : undefined
        }
      >
        <SimpleTable headers={categoryTableHeaders}>
          <TableState
            colSpan={categoryTableHeaders.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleCategories.length === 0}
            emptyLabel={isFiltering ? t("categories.empty.filtered", "No categories match these filters.") : isAdmin ? t("categories.empty.admin", "No categories yet. Use Register to add the first one.") : t("categories.empty.none", "No categories found.")}
            onRetry={refetch}
          />
          {list.showRows &&
            visibleCategories.map((category, index) => (
              <Row key={category.id} striped={index % 2 === 1}>
                <Cell>{view.offset + index + 1}</Cell>
                <Cell className="font-semibold">{titleCase(category.name)}</Cell>
                <Cell>{category.description || "-"}</Cell>
                <Cell>{productCountByCategory.get(category.id) ?? 0}</Cell>
                <Cell>{formatCreatedDate(category.createdAt)}</Cell>
                <Cell>{category.createdByName ? titleCase(category.createdByName) : "-"}</Cell>
                <Cell>
                  <StatusBadge
                    label={statusLabel(category.status)}
                    tone={statusTone(category.status)}
                  />
                </Cell>
                <Cell>
                  <RowActions
                    onView={() => handleViewDetail(category)}
                    onEdit={isAdmin ? () => handleOpenForm(category) : undefined}
                    onDelete={isAdmin ? () => handleDelete(category) : undefined}
                    isLoading={isCreating || isUpdating || isDeleting}
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
        title={selected ? t("categories.form.modify_title", "Modify Category") : t("categories.form.register_title", "Register Category")}
        submitLabel={t("actions.submit", "Submit")}
        onSubmit={handleSubmitForm}
        isLoading={isCreating || isUpdating}
      >
        <ModalGrid>
          <FormInput
            label={t("categories.fields.category_name", "Category Name")}
            placeholder={t("categories.form.category_name_placeholder", "e.g. Coffee")}
            value={formFields.name}
            error={validation.errors.name}
            onChange={(e) => setFormFields({ ...formFields, name: e.target.value })}
            required
          />
          <FormInput
            label={t("fields.description", "Description")}
            placeholder={t("categories.form.description_placeholder", "Short description")}
            value={formFields.description}
            error={validation.errors.description}
            onChange={(e) =>
              setFormFields({ ...formFields, description: e.target.value })
            }
          />
          <FormSelect
            label={t("categories.fields.menu_group", "Menu Group")}
            placeholder={t("categories.form.menu_group_internal", "Internal (not on the customer menu)")}
            value={formFields.categoryGroup}
            error={validation.errors.categoryGroup}
            onChange={(e) =>
              setFormFields({ ...formFields, categoryGroup: e.target.value as CategoryGroup })
            }
          >
            {CATEGORY_GROUPS.map((group) => (
              <option key={group} value={group}>
                {enumLabel(t, "category_group", group)}
              </option>
            ))}
          </FormSelect>
          {selected ? (
            <FormSelect
              label={t("fields.status", "Status")}
              placeholder={t("categories.form.select_status", "Select status")}
              value={formFields.status}
              error={validation.errors.status}
              onChange={(e) =>
                setFormFields({ ...formFields, status: e.target.value as Status })
              }
            >
              <option value="ACTIVE">{enumLabel(t, "status", "ACTIVE")}</option>
              <option value="INACTIVE">{enumLabel(t, "status", "INACTIVE")}</option>
            </FormSelect>
          ) : null}
        </ModalGrid>
      </FormModal>

      <DetailModal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
        title={t("categories.detail.title", "Category Detail")}
        onEdit={isAdmin ? () => {
          const category = selected;
          setDetailOpen(false);
          if (category) handleOpenForm(category);
        } : undefined}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label={t("categories.fields.category_name", "Category Name")}>{titleCase(selected.name)}</DetailItem>
              <DetailItem label={t("fields.description", "Description")}>{selected.description || "-"}</DetailItem>
              <DetailItem label={t("categories.fields.menu_group", "Menu Group")}>
                {selected.categoryGroup ? enumLabel(t, "category_group", selected.categoryGroup) : t("categories.form.menu_group_internal", "Internal (not on the customer menu)")}
              </DetailItem>
              <DetailItem label={t("categories.fields.total_products", "Total Products")}>
                {productCountByCategory.get(selected.id) ?? 0}
              </DetailItem>
              <DetailItem label={t("fields.status", "Status")}>
                <StatusBadge
                  label={statusLabel(selected.status)}
                  tone={statusTone(selected.status)}
                />
              </DetailItem>
              <DetailItem label={t("fields.created", "Created")}>
                {formatCreatedDate(selected.createdAt)}
                {selected.createdByName ? ` ${t("categories.detail.by_name", "by {name}", { name: titleCase(selected.createdByName) })}` : ""}
              </DetailItem>
              <DetailItem label={t("fields.last_updated", "Last Updated")}>
                {formatCreatedDate(selected.updatedAt)}
                {selected.updatedByName ? ` ${t("categories.detail.by_name", "by {name}", { name: titleCase(selected.updatedByName) })}` : ""}
              </DetailItem>
            </DetailGrid>
          </div>
        )}
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
