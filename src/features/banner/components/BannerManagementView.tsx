"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ExternalLink } from "lucide-react";
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
import { useI18n } from "@/contexts/I18nContext";
import { apiErrorMessage } from "@/store/api/baseApi";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import {
  useCreateBannerMutation,
  useDeleteBannerMutation,
  useListBannersQuery,
  useRemoveBannerImageMutation,
  useUpdateBannerMutation,
  useUploadBannerImageMutation,
} from "@/store/api/bannerApi";
import type { BannerResponse, Status } from "@/store/api/types";
import { titleCase } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateFormat";
import { enumLabel } from "@/lib/enumLabel";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePersistentState } from "@/hooks/usePersistentState";
import { filteredPage, filteredQueryArgs } from "@/hooks/useFilteredPaging";
import { bannerSchema } from "@/lib/formSchemas";
import { useFormErrors } from "@/hooks/useFormErrors";

type BannerFormFields = {
  title: string;
  linkUrl: string;
  sortOrder: string;
  status: Status;
};

const EMPTY_FORM: BannerFormFields = {
  title: "",
  linkUrl: "",
  sortOrder: "0",
  status: "ACTIVE",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return formatLocalDate(parsed, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BannerManagementView() {
  const { t } = useI18n();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [page, setPage] = usePersistentState("banners:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("banners:searchTerm", "");
  const [statusFilter, setStatusFilter] = usePersistentState("banners:statusFilter", "");
  const isFiltering = Boolean(searchTerm.trim() || statusFilter);

  const {
    data: bannerPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListBannersQuery(filteredQueryArgs(page, size, isFiltering));
  const list = listLoadState({ isFetching, currentData, error });

  const [createBanner, { isLoading: isCreating }] = useCreateBannerMutation();
  const [updateBanner, { isLoading: isUpdating }] = useUpdateBannerMutation();
  const [deleteBanner, { isLoading: isDeleting }] = useDeleteBannerMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadBannerImageMutation();
  const [removeImage, { isLoading: isRemovingImage }] = useRemoveBannerImageMutation();

  const [formOpen, setFormOpen] = usePersistentState("banners:formOpen", false);
  const [detailOpen, setDetailOpen] = usePersistentState("banners:detailOpen", false);
  const [selected, setSelected] = usePersistentState<BannerResponse | null>("banners:selected", null);
  const [form, setForm] = usePersistentState<BannerFormFields>("banners:form", EMPTY_FORM);
  const validation = useFormErrors(bannerSchema, form);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const bannerTableHeaders = [
    t("table.no", "No"),
    t("fields.image", "Image"),
    t("fields.title", "Title"),
    t("banners.fields.link", "Link"),
    t("banners.table.order", "Order"),
    t("fields.status", "Status"),
    t("table.action", "Action"),
  ];

  const banners = useMemo(() => bannerPage?.content ?? [], [bannerPage]);

  const matchingBanners = useMemo(
    () =>
      banners.filter((banner) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = !term || banner.title.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || banner.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [banners, searchTerm, statusFilter]
  );
  const view = filteredPage(matchingBanners, bannerPage, page, size, isFiltering);
  const visibleBanners = view.rows;

  const liveCount = banners.filter((banner) => banner.status === "ACTIVE").length;
  const missingImageCount = banners.filter(
    (banner) => banner.status === "ACTIVE" && !banner.imageUrl
  ).length;

  const handleOpenForm = (banner?: BannerResponse) => {
    setSelected(banner ?? null);
    setImageFile(null);
    setForm(
      banner
        ? {
            title: banner.title,
            linkUrl: banner.linkUrl ?? "",
            sortOrder: String(banner.sortOrder ?? 0),
            status: banner.status,
          }
        : EMPTY_FORM
    );
    validation.reset();
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const parsed = validation.validate();
    if (!parsed) return;
    const { title, linkUrl, sortOrder } = parsed;

    try {
      let bannerId: string;
      if (selected) {
        const updated = await updateBanner({
          id: selected.id,
          body: {
            title,
            linkUrl: linkUrl ?? "",
            sortOrder,
            status: form.status,
          },
        }).unwrap();
        bannerId = updated.id;
      } else {
        const created = await createBanner({
          title,
          linkUrl,
          sortOrder,
        }).unwrap();
        bannerId = created.id;
      }

      if (imageFile) {
        await uploadImage({ id: bannerId, file: imageFile }).unwrap();
      }

      toast.success(selected ? t("banners.toast.updated", "Banner updated") : t("banners.toast.created", "Banner created"));
      setFormOpen(false);
      setSelected(null);
      setForm(EMPTY_FORM);
      setImageFile(null);
    } catch (err) {
      validation.showServerError(err, t("banners.errors.save", "Could not save the banner."));
    }
  };

  const handleRemoveImage = async (banner: BannerResponse) => {
    if (!(await confirm({ title: t("banners.remove_image", "Remove image"), description: t("banners.confirm.remove_image_description", "Remove the image from \"{title}\"? The homepage will show the default photo until a new one is uploaded.", { title: banner.title }), confirmLabel: t("actions.remove", "Remove"), tone: "danger" }))) return;
    try {
      const updated = await removeImage(banner.id).unwrap();
      setSelected(updated);
      toast.success(t("banners.toast.image_removed", "Image removed"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("banners.errors.remove_image", "Could not remove the image.")));
    }
  };

  const handleToggleStatus = async (banner: BannerResponse) => {
    const next: Status = banner.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateBanner({ id: banner.id, body: { status: next } }).unwrap();
      toast.success(next === "ACTIVE" ? t("banners.toast.now_live", "Banner is now live on the homepage") : t("banners.toast.hidden", "Banner hidden from the homepage"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("banners.errors.status", "Could not change the banner status.")));
    }
  };

  const handleDelete = async (banner: BannerResponse) => {
    if (!(await confirm({ title: t("banners.confirm.delete_title", "Delete banner"), description: t("banners.confirm.delete_description", "Delete banner \"{title}\"? It will disappear from the homepage.", { title: banner.title }), confirmLabel: t("actions.delete", "Delete"), tone: "danger" }))) return;
    try {
      await deleteBanner(banner.id).unwrap();
      toast.success(t("banners.toast.deleted", "Banner deleted"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("banners.errors.delete", "Could not delete the banner.")));
    }
  };

  const isSaving = isCreating || isUpdating || isUploading || isRemovingImage;

  return (
    <PageShell>
      <PageHeader
        title={t("banners.title", "Banners")}
        breadcrumbs={[{ label: t("breadcrumb.home", "Home"), href: "/" }, { label: t("banners.title", "Banners") }]}
        rightSlot={<AdminTopActions />}
      />

      <p className="text-sm text-muted-foreground">
        {t("banners.description", "Slides on the customer homepage. Active banners show in ascending display order.")}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          title={t("banners.stats.all", "All Banners")}
          value={String(bannerPage?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile
          title={t("banners.stats.live", "Live on Homepage (this page)")}
          value={String(liveCount)}
          tone={liveCount > 0 ? "green" : "gray"}
        />
        <StatTile
          title={t("banners.stats.live_without_image", "Live Without Image")}
          value={String(missingImageCount)}
          hint={t("banners.stats.live_without_image_hint", "Shown with the default photo")}
          tone={missingImageCount > 0 ? "orange" : "gray"}
        />
      </div>

      <FilterPanel>
        <TextField
          label={t("fields.title", "Title")}
          placeholder={t("banners.filters.search_placeholder", "Search banners")}
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />
        <SelectField
          label={t("fields.status", "Status")}
          placeholder={t("banners.filters.all_statuses", "All statuses")}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="ACTIVE">{enumLabel(t, "status", "ACTIVE")}</option>
          <option value="INACTIVE">{enumLabel(t, "status", "INACTIVE")}</option>
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setStatusFilter(""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard
        title={t("banners.title", "Banners")}
        meta={t("banners.meta.total", "Total Banners: {count}", { count: bannerPage?.totalElements ?? 0 })}
        actions={
          <TableActions onRegister={() => handleOpenForm()} primaryLabel={t("banners.add_banner", "Add Banner")} />
        }
      >
        <SimpleTable headers={bannerTableHeaders}>
          <TableState
            colSpan={bannerTableHeaders.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleBanners.length === 0}
            emptyLabel={isFiltering ? t("banners.empty.filtered", "No banners match these filters.") : t("banners.empty.none", "No banners yet. Use Add Banner to put the first slide on the homepage.")}
            onRetry={refetch}
          />
          {list.showRows &&
            visibleBanners.map((banner, index) => (
              <Row key={banner.id} striped={index % 2 === 1}>
                <Cell>{view.offset + index + 1}</Cell>
                <Cell>
                  <Thumbnail src={banner.imageUrl} kind="picture" />
                </Cell>
                <Cell className="font-semibold">{titleCase(banner.title)}</Cell>
                <Cell>
                  {banner.linkUrl ? (
                    <span className="block max-w-[14rem] truncate" title={banner.linkUrl}>
                      {banner.linkUrl}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t("banners.default_link", "/menu (default)")}</span>
                  )}
                </Cell>
                <Cell>{banner.sortOrder}</Cell>
                <Cell>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(banner)}
                    disabled={isSaving}
                    title={banner.status === "ACTIVE" ? t("banners.table.toggle_hide", "Click to hide from the homepage") : t("banners.table.toggle_show", "Click to show on the homepage")}
                    className="cursor-pointer disabled:cursor-not-allowed"
                  >
                    <StatusBadge
                      label={enumLabel(t, "status", banner.status)}
                      tone={banner.status === "ACTIVE" ? "success" : "danger"}
                    />
                  </button>
                </Cell>
                <Cell>
                  <RowActions
                    onView={() => {
                      setSelected(banner);
                      setDetailOpen(true);
                    }}
                    onEdit={() => handleOpenForm(banner)}
                    onDelete={() => handleDelete(banner)}
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
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selected ? t("banners.form.modify_title", "Modify Banner") : t("banners.add_banner", "Add Banner")}
        submitLabel={t("actions.submit", "Submit")}
        onSubmit={handleSubmit}
        isLoading={isSaving}
      >
        <ModalGrid>
          <FormInput
            label={t("fields.title", "Title")}
            placeholder={t("banners.form.title_placeholder", "e.g. New Iced Latte Menu")}
            value={form.title}
            error={validation.errors.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <FormInput
            label={t("banners.fields.link", "Link")}
            placeholder={t("banners.form.link_placeholder", "/menu or https://...")}
            value={form.linkUrl}
            error={validation.errors.linkUrl}
            onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
          />
          <FormInput
            label={t("banners.fields.display_order", "Display Order")}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="0"
            value={form.sortOrder}
            error={validation.errors.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
          />
          {selected ? (
            <FormSelect
              label={t("fields.status", "Status")}
              placeholder={t("banners.form.select_status", "Select status")}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
            >
              <option value="ACTIVE">{enumLabel(t, "status", "ACTIVE")}</option>
              <option value="INACTIVE">{enumLabel(t, "status", "INACTIVE")}</option>
            </FormSelect>
          ) : null}
          <div className="md:col-span-3">
            <FormImageUpload
              label={t("banners.form.image", "Banner Image")}
              file={imageFile}
              onChange={setImageFile}
              emptyLabel={selected?.imageUrl ? t("banners.form.keep_image", "Keep current image") : t("banners.form.no_file", "No File Chosen")}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("banners.form.image_hint", "Wide landscape images work best. Leave a link blank to send customers to the menu.")}
            </p>
          </div>
        </ModalGrid>
      </FormModal>

      <DetailModal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
        title={t("banners.detail.title", "Banner Detail")}
        onEdit={() => {
          const banner = selected;
          setDetailOpen(false);
          if (banner) handleOpenForm(banner);
        }}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label={t("fields.title", "Title")}>{titleCase(selected.title)}</DetailItem>
              <DetailItem label={t("banners.fields.link", "Link")}>
                {selected.linkUrl ? (
                  <a
                    href={selected.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    {selected.linkUrl}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  t("banners.default_link", "/menu (default)")
                )}
              </DetailItem>
              <DetailItem label={t("banners.fields.display_order", "Display Order")}>{selected.sortOrder}</DetailItem>
              <DetailItem label={t("fields.status", "Status")}>
                <StatusBadge
                  label={enumLabel(t, "status", selected.status)}
                  tone={selected.status === "ACTIVE" ? "success" : "danger"}
                />
              </DetailItem>
              <DetailItem label={t("fields.created_by", "Created By")}>
                {selected.adminName ? titleCase(selected.adminName) : t("banners.detail.super_admin", "Super Admin")}
              </DetailItem>
              <DetailItem label={t("fields.last_updated", "Last Updated")}>
                {formatDateTime(selected.updatedAt)}
                {selected.updatedByAdminName ? ` · ${titleCase(selected.updatedByAdminName)}` : ""}
              </DetailItem>
              <div className="detail_item">
                <p className="detail_item_label">{t("fields.image", "Image")} :</p>
                <DetailImage src={selected.imageUrl ?? undefined} alt={selected.title} />
                {selected.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(selected)}
                    disabled={isSaving}
                    className="mt-2 text-xs text-red-600 underline disabled:opacity-50"
                  >
                    {t("banners.remove_image", "Remove image")}
                  </button>
                ) : null}
              </div>
            </DetailGrid>
          </div>
        )}
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
