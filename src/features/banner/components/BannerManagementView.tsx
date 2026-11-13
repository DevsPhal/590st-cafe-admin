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
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePersistentState } from "@/hooks/usePersistentState";

const BANNER_TABLE_HEADERS = [
  "No",
  "Image",
  "Title",
  "Link",
  "Order",
  "Status",
  "Action",
] as const;

type BannerFormFields = {
  title: string;
  linkUrl: string;
  // Kept as a string for the numeric input; parsed only on submit.
  sortOrder: string;
  status: Status;
};

const EMPTY_FORM: BannerFormFields = {
  title: "",
  linkUrl: "",
  sortOrder: "0",
  status: "ACTIVE",
};

/**
 * The storefront carousel only follows a link that starts with "/" (a shop page) or "http" (an
 * external site) and sends anything else to /menu — so the same rule is enforced here, where the
 * admin can still fix it, instead of the slide silently going somewhere else.
 */
function isUsableLink(link: string): boolean {
  return link.startsWith("/") || /^https?:\/\//i.test(link);
}

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BannerManagementView() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [page, setPage] = usePersistentState("banners:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("banners:searchTerm", "");
  const [statusFilter, setStatusFilter] = usePersistentState("banners:statusFilter", "");

  const {
    data: bannerPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListBannersQuery({ page, size });
  const list = listLoadState({ isFetching, currentData, error });

  const [createBanner, { isLoading: isCreating }] = useCreateBannerMutation();
  const [updateBanner, { isLoading: isUpdating }] = useUpdateBannerMutation();
  const [deleteBanner] = useDeleteBannerMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadBannerImageMutation();
  const [removeImage, { isLoading: isRemovingImage }] = useRemoveBannerImageMutation();

  const [formOpen, setFormOpen] = usePersistentState("banners:formOpen", false);
  const [detailOpen, setDetailOpen] = usePersistentState("banners:detailOpen", false);
  const [selected, setSelected] = usePersistentState<BannerResponse | null>("banners:selected", null);
  const [form, setForm] = usePersistentState<BannerFormFields>("banners:form", EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const banners = useMemo(() => bannerPage?.content ?? [], [bannerPage]);

  const visibleBanners = useMemo(
    () =>
      banners.filter((banner) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = !term || banner.title.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || banner.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [banners, searchTerm, statusFilter]
  );

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
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    const linkUrl = form.linkUrl.trim();
    if (linkUrl && !isUsableLink(linkUrl)) {
      toast.error('Link must be a shop path starting with "/" (e.g. /menu) or a full http(s) URL');
      return;
    }
    const sortOrder = Number(form.sortOrder.trim() || "0");
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      toast.error("Display order must be a whole number, 0 or higher");
      return;
    }

    try {
      let bannerId: string;
      if (selected) {
        const updated = await updateBanner({
          id: selected.id,
          body: {
            title,
            // "" clears a previously saved link; the API treats a missing field as "unchanged".
            linkUrl,
            sortOrder,
            status: form.status,
          },
        }).unwrap();
        bannerId = updated.id;
      } else {
        const created = await createBanner({
          title,
          linkUrl: linkUrl || undefined,
          sortOrder,
        }).unwrap();
        bannerId = created.id;
      }

      if (imageFile) {
        await uploadImage({ id: bannerId, file: imageFile }).unwrap();
      }

      toast.success(selected ? "Banner updated" : "Banner created");
      setFormOpen(false);
      setSelected(null);
      setForm(EMPTY_FORM);
      setImageFile(null);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not save the banner."));
    }
  };

  const handleRemoveImage = async (banner: BannerResponse) => {
    if (!(await confirm({ title: "Remove image", description: `Remove the image from "${banner.title}"? The homepage will show the default photo until a new one is uploaded.`, confirmLabel: "Remove", tone: "danger" }))) return;
    try {
      const updated = await removeImage(banner.id).unwrap();
      setSelected(updated);
      toast.success("Image removed");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not remove the image."));
    }
  };

  const handleToggleStatus = async (banner: BannerResponse) => {
    const next: Status = banner.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateBanner({ id: banner.id, body: { status: next } }).unwrap();
      toast.success(next === "ACTIVE" ? "Banner is now live on the homepage" : "Banner hidden from the homepage");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not change the banner status."));
    }
  };

  const handleDelete = async (banner: BannerResponse) => {
    if (!(await confirm({ title: "Delete banner", description: `Delete banner "${banner.title}"? It will disappear from the homepage.`, confirmLabel: "Delete", tone: "danger" }))) return;
    try {
      await deleteBanner(banner.id).unwrap();
      toast.success("Banner deleted");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not delete the banner."));
    }
  };

  const isSaving = isCreating || isUpdating || isUploading || isRemovingImage;

  return (
    <PageShell>
      <PageHeader
        title="Banners"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Banners" }]}
        rightSlot={<AdminTopActions />}
      />

      <p className="text-sm text-muted-foreground">
        Slides on the customer homepage. Active banners show in ascending display order.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          title="All Banners"
          value={String(bannerPage?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile
          title="Live on Homepage (this page)"
          value={String(liveCount)}
          tone={liveCount > 0 ? "green" : "gray"}
        />
        <StatTile
          title="Live Without Image"
          value={String(missingImageCount)}
          hint="Shown with the default photo"
          tone={missingImageCount > 0 ? "orange" : "gray"}
        />
      </div>

      <FilterPanel>
        <TextField
          label="Title"
          placeholder="Search banners"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <SelectField
          label="Status"
          placeholder="All statuses"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setStatusFilter(""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard
        title="Banners"
        meta={`Total Banners: ${bannerPage?.totalElements ?? 0}`}
        actions={
          <TableActions onRegister={() => handleOpenForm()} primaryLabel="Add Banner" />
        }
      >
        <SimpleTable headers={[...BANNER_TABLE_HEADERS]}>
          <TableState
            colSpan={BANNER_TABLE_HEADERS.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleBanners.length === 0}
            emptyLabel="No banners yet. Use Add Banner to put the first slide on the homepage."
            onRetry={refetch}
          />
          {list.showRows &&
            visibleBanners.map((banner, index) => (
              <Row key={banner.id} striped={index % 2 === 1}>
                <Cell>{(page - 1) * size + index + 1}</Cell>
                <Cell>
                  <Thumbnail src={banner.imageUrl ?? undefined} />
                </Cell>
                <Cell className="font-semibold">{titleCase(banner.title)}</Cell>
                <Cell>
                  {banner.linkUrl ? (
                    <span className="block max-w-[14rem] truncate" title={banner.linkUrl}>
                      {banner.linkUrl}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">/menu (default)</span>
                  )}
                </Cell>
                <Cell>{banner.sortOrder}</Cell>
                <Cell>
                  {/* Same click-to-toggle status badge as the account tables. */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(banner)}
                    disabled={isSaving}
                    title={banner.status === "ACTIVE" ? "Click to hide from the homepage" : "Click to show on the homepage"}
                    className="cursor-pointer disabled:cursor-not-allowed"
                  >
                    <StatusBadge
                      label={banner.status === "ACTIVE" ? "Active" : "Inactive"}
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
                    isLoading={isSaving}
                  />
                </Cell>
              </Row>
            ))}
        </SimpleTable>
        <PaginationFooter
          page={bannerPage?.page ?? page}
          totalPages={bannerPage?.totalPages ?? 1}
          size={size}
          totalElements={bannerPage?.totalElements}
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
        title={selected ? "Modify Banner" : "Add Banner"}
        submitLabel="Submit"
        onSubmit={handleSubmit}
        isLoading={isSaving}
      >
        <ModalGrid>
          <FormInput
            label="Title"
            placeholder="e.g. New Iced Latte Menu"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <FormInput
            label="Link"
            placeholder="/menu or https://..."
            value={form.linkUrl}
            onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
          />
          <FormInput
            label="Display Order"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="0"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
          />
          {selected ? (
            <FormSelect
              label="Status"
              placeholder="Select status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </FormSelect>
          ) : null}
          <div className="md:col-span-3">
            <FormImageUpload
              label="Banner Image"
              file={imageFile}
              onChange={setImageFile}
              emptyLabel={selected?.imageUrl ? "Keep current image" : "No File Chosen"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Wide landscape images work best. Leave a link blank to send customers to the menu.
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
        title="Banner Detail"
        onEdit={() => {
          const banner = selected;
          setDetailOpen(false);
          if (banner) handleOpenForm(banner);
        }}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label="Title">{titleCase(selected.title)}</DetailItem>
              <DetailItem label="Link">
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
                  "/menu (default)"
                )}
              </DetailItem>
              <DetailItem label="Display Order">{selected.sortOrder}</DetailItem>
              <DetailItem label="Status">
                <StatusBadge
                  label={selected.status === "ACTIVE" ? "Active" : "Inactive"}
                  tone={selected.status === "ACTIVE" ? "success" : "danger"}
                />
              </DetailItem>
              <DetailItem label="Created By">
                {selected.adminName ? titleCase(selected.adminName) : "Super Admin"}
              </DetailItem>
              <DetailItem label="Last Updated">
                {formatDateTime(selected.updatedAt)}
                {selected.updatedByAdminName ? ` · ${titleCase(selected.updatedByAdminName)}` : ""}
              </DetailItem>
              <div className="detail_item">
                <p className="detail_item_label">Image :</p>
                <DetailImage src={selected.imageUrl ?? undefined} alt={selected.title} />
                {selected.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(selected)}
                    disabled={isSaving}
                    className="mt-2 text-xs text-red-600 underline disabled:opacity-50"
                  >
                    Remove image
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
