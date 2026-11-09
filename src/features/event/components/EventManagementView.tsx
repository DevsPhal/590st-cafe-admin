"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { MapPin, Store } from "lucide-react";
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
import { LocationPickerModal } from "@/components/common/LocationPickerModal";
import { SHOP_LOCATION, isShopLocation } from "@/constants/shop";
import { useI18n } from "@/contexts/I18nContext";
import { apiErrorMessage } from "@/store/api/baseApi";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import {
  useCreateEventMutation,
  useDeleteEventMutation,
  useListEventsQuery,
  useUpdateEventMutation,
  useUploadEventImageMutation,
} from "@/store/api/eventApi";
import type { EventResponse, Status } from "@/store/api/types";
import { titleCase } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateFormat";
import { enumLabel } from "@/lib/enumLabel";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePersistentState } from "@/hooks/usePersistentState";
import { filteredPage, filteredQueryArgs } from "@/hooks/useFilteredPaging";
import { eventSchema } from "@/lib/formSchemas";
import { useFormErrors } from "@/hooks/useFormErrors";

type EventFormFields = {
  title: string;
  description: string;
  latitude: string;
  longitude: string;
  startAt: string;
  endAt: string;
  status: Status;
};

const EMPTY_FORM: EventFormFields = {
  title: "",
  description: "",
  latitude: "",
  longitude: "",
  startAt: "",
  endAt: "",
  status: "ACTIVE",
};

function toInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

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

type Window = "UPCOMING" | "RUNNING" | "ENDED";

function eventWindow(event: EventResponse): Window {
  const now = Date.now();
  if (new Date(event.startAt).getTime() > now) return "UPCOMING";
  if (new Date(event.endAt).getTime() < now) return "ENDED";
  return "RUNNING";
}

const WINDOW_TONE: Record<Window, "info" | "success" | "neutral"> = {
  UPCOMING: "info",
  RUNNING: "success",
  ENDED: "neutral",
};

export default function EventManagementView() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [page, setPage] = usePersistentState("events:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("events:searchTerm", "");
  const [statusFilter, setStatusFilter] = usePersistentState("events:statusFilter", "");
  const isFiltering = Boolean(searchTerm.trim() || statusFilter);

  const {
    data: eventPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListEventsQuery(filteredQueryArgs(page, size, isFiltering));
  const list = listLoadState({ isFetching, currentData, error });

  const [createEvent, { isLoading: isCreating }] = useCreateEventMutation();
  const [updateEvent, { isLoading: isUpdating }] = useUpdateEventMutation();
  const [deleteEvent, { isLoading: isDeleting }] = useDeleteEventMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadEventImageMutation();

  const [formOpen, setFormOpen] = usePersistentState("events:formOpen", false);
  const [detailOpen, setDetailOpen] = usePersistentState("events:detailOpen", false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const { t } = useI18n();
  const [selected, setSelected] = usePersistentState<EventResponse | null>("events:selected", null);
  const [form, setForm] = usePersistentState<EventFormFields>("events:form", EMPTY_FORM);
  const validation = useFormErrors(eventSchema, form);
  const hasVenue = Boolean(form.latitude.trim() && form.longitude.trim());
  const venueIsShop = hasVenue && isShopLocation(Number(form.latitude), Number(form.longitude));
  const [imageFile, setImageFile] = useState<File | null>(null);

  const eventTableHeaders = [
    t("table.no", "No"),
    t("fields.image", "Image"),
    t("fields.title", "Title"),
    t("venue.label", "Venue"),
    t("events.table.starts", "Starts"),
    t("events.table.ends", "Ends"),
    t("events.table.window", "Window"),
    t("fields.status", "Status"),
    t("table.action", "Action"),
  ];

  const events = useMemo(() => eventPage?.content ?? [], [eventPage]);

  const matchingEvents = useMemo(
    () =>
      events.filter((event) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = !term || event.title.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || event.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [events, searchTerm, statusFilter]
  );
  const view = filteredPage(matchingEvents, eventPage, page, size, isFiltering);
  const visibleEvents = view.rows;

  const runningCount = events.filter((e) => eventWindow(e) === "RUNNING").length;

  const handleOpenForm = (event?: EventResponse) => {
    setSelected(event ?? null);
    setImageFile(null);
    setForm(
      event
        ? {
            title: event.title,
            description: event.description ?? "",
            latitude: event.latitude != null ? String(event.latitude) : "",
            longitude: event.longitude != null ? String(event.longitude) : "",
            startAt: toInputValue(event.startAt),
            endAt: toInputValue(event.endAt),
            status: event.status,
          }
        : EMPTY_FORM
    );
    validation.reset();
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const parsed = validation.validate();
    if (!parsed) return;
    const { title, description, startAt, endAt, latitude, longitude } = parsed;

    try {
      let eventId: string;
      if (selected) {
        const updated = await updateEvent({
          id: selected.id,
          body: {
            title,
            description,
            latitude,
            longitude,
            startAt,
            endAt,
            status: form.status,
          },
        }).unwrap();
        eventId = updated.id;
      } else {
        const created = await createEvent({
          title,
          description,
          latitude,
          longitude,
          startAt,
          endAt,
        }).unwrap();
        eventId = created.id;
      }

      if (imageFile) {
        await uploadImage({ id: eventId, file: imageFile }).unwrap();
      }

      toast.success(selected ? t("events.toast.updated", "Event updated") : t("events.toast.created", "Event created"));
      setFormOpen(false);
      setSelected(null);
      setForm(EMPTY_FORM);
      setImageFile(null);
    } catch (err) {
      validation.showServerError(err, t("events.errors.save", "Could not save the event."));
    }
  };

  const handleDelete = async (event: EventResponse) => {
    if (!(await confirm({ title: t("events.confirm.delete_title", "Delete event"), description: t("events.confirm.delete_description", "Delete event \"{title}\"?", { title: event.title }), confirmLabel: t("actions.delete", "Delete"), tone: "danger" }))) return;
    try {
      await deleteEvent(event.id).unwrap();
      toast.success(t("events.toast.deleted", "Event deleted"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("events.errors.delete", "Could not delete the event.")));
    }
  };

  const isSaving = isCreating || isUpdating || isUploading;

  return (
    <PageShell>
      <PageHeader
        title={t("events.title", "Events")}
        breadcrumbs={[{ label: t("breadcrumb.home", "Home"), href: "/" }, { label: t("events.title", "Events") }]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatTile
          title={t("events.stats.all", "All Events")}
          value={String(eventPage?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile
          title={t("events.stats.running_now", "Running Now (this page)")}
          value={String(runningCount)}
          tone={runningCount > 0 ? "green" : "gray"}
        />
      </div>

      <FilterPanel>
        <TextField
          label={t("fields.title", "Title")}
          placeholder={t("events.filters.search_placeholder", "Search events")}
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />
        <SelectField
          label={t("fields.status", "Status")}
          placeholder={t("events.filters.all_statuses", "All statuses")}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="ACTIVE">{enumLabel(t, "status", "ACTIVE")}</option>
          <option value="INACTIVE">{enumLabel(t, "status", "INACTIVE")}</option>
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setStatusFilter(""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard
        title={t("events.title", "Events")}
        meta={t("events.meta.total", "Total Events: {count}", { count: eventPage?.totalElements ?? 0 })}
        actions={
          <TableActions onRegister={() => handleOpenForm()} primaryLabel={t("events.add_event", "Add Event")} />
        }
      >
        <SimpleTable headers={eventTableHeaders}>
          <TableState
            colSpan={eventTableHeaders.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleEvents.length === 0}
            emptyLabel={isFiltering ? t("events.empty.filtered", "No events match these filters.") : t("events.empty.none", "No events yet. Use Add Event to create the first one.")}
            onRetry={refetch}
          />
          {list.showRows &&
            visibleEvents.map((event, index) => {
              const win = eventWindow(event);
              return (
                <Row key={event.id} striped={index % 2 === 1}>
                  <Cell>{view.offset + index + 1}</Cell>
                  <Cell>
                    <Thumbnail src={event.imageUrl} kind="picture" />
                  </Cell>
                  <Cell className="font-semibold">{titleCase(event.title)}</Cell>
                  <Cell>
                    {event.latitude != null && event.longitude != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline"
                        title={t("venue.view_on_map", "View on map")}
                      >
                        {isShopLocation(event.latitude, event.longitude) ? (
                          <>
                            <Store className="h-3.5 w-3.5" /> {SHOP_LOCATION.name}
                          </>
                        ) : (
                          <>
                            <MapPin className="h-3.5 w-3.5" /> {t("venue.view", "View")}
                          </>
                        )}
                      </a>
                    ) : (
                      "-"
                    )}
                  </Cell>
                  <Cell>{formatDateTime(event.startAt)}</Cell>
                  <Cell>{formatDateTime(event.endAt)}</Cell>
                  <Cell>
                    <StatusBadge
                      label={
                        win === "RUNNING"
                          ? t("events.window.running", "Running")
                          : win === "UPCOMING"
                          ? t("events.window.upcoming", "Upcoming")
                          : t("events.window.ended", "Ended")
                      }
                      tone={WINDOW_TONE[win]}
                    />
                  </Cell>
                  <Cell>
                    <StatusBadge
                      label={enumLabel(t, "status", event.status)}
                      tone={event.status === "ACTIVE" ? "success" : "danger"}
                    />
                  </Cell>
                  <Cell>
                    <RowActions
                      onView={() => {
                        setSelected(event);
                        setDetailOpen(true);
                      }}
                      onEdit={() => handleOpenForm(event)}
                      onDelete={() => handleDelete(event)}
                      isLoading={isSaving || isDeleting}
                    />
                  </Cell>
                </Row>
              );
            })}
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
        title={selected ? t("events.form.modify_title", "Modify Event") : t("events.add_event", "Add Event")}
        submitLabel={t("actions.submit", "Submit")}
        onSubmit={handleSubmit}
        isLoading={isSaving}
      >
        <ModalGrid>
          <FormInput
            label={t("fields.title", "Title")}
            placeholder={t("events.form.title_placeholder", "e.g. Latte Art Workshop")}
            value={form.title}
            error={validation.errors.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <div className="form_field md:col-span-3">
            <span className="form_field_label">{t("venue.label", "Venue")}</span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setMapPickerOpen(true)}
                className="btn_outline_black inline-flex items-center gap-2 text-xs"
              >
                <MapPin className="h-3.5 w-3.5" />
                {hasVenue ? t("venue.change_pin", "Change Pin on Map") : t("venue.pin_on_map", "Pin on Map")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    latitude: SHOP_LOCATION.lat.toFixed(6),
                    longitude: SHOP_LOCATION.lng.toFixed(6),
                  }))
                }
                aria-pressed={venueIsShop}
                className={
                  venueIsShop
                    ? "btn_primary_yellow inline-flex items-center gap-2 text-xs"
                    : "btn_outline_black inline-flex items-center gap-2 text-xs"
                }
              >
                <Store className="h-3.5 w-3.5" />
                {t("venue.use_shop", "Use Shop Location")}
              </button>
              {hasVenue ? (
                <>
                  <span className="text-xs text-gray-600">
                    {venueIsShop ? (
                      <span className="font-semibold text-gray-900">{SHOP_LOCATION.name} · </span>
                    ) : null}
                    {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${form.latitude.trim()},${form.longitude.trim()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                  >
                    {t("venue.preview", "Preview")}
                  </a>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, latitude: "", longitude: "" })}
                    className="text-xs text-red-600 underline"
                  >
                    {t("venue.clear", "Clear")}
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-500">
                  {t("venue.none_hint", "No fixed venue set — optional, leave blank for an announcement with no venue.")}
                </span>
              )}
            </div>
          </div>
          <FormInput
            label={t("events.form.starts_at", "Starts At")}
            type="datetime-local"
            value={form.startAt}
            error={validation.errors.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            required
          />
          <FormInput
            label={t("events.form.ends_at", "Ends At")}
            type="datetime-local"
            value={form.endAt}
            error={validation.errors.endAt}
            onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            required
          />
          {selected ? (
            <FormSelect
              label={t("fields.status", "Status")}
              placeholder={t("events.form.select_status", "Select status")}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
            >
              <option value="ACTIVE">{enumLabel(t, "status", "ACTIVE")}</option>
              <option value="INACTIVE">{enumLabel(t, "status", "INACTIVE")}</option>
            </FormSelect>
          ) : null}
          <FormInput
            label={t("fields.description", "Description")}
            placeholder={t("events.form.description_placeholder", "What is happening?")}
            value={form.description}
            error={validation.errors.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="md:col-span-3">
            <FormImageUpload
              label={t("events.form.image", "Event Image")}
              file={imageFile}
              onChange={setImageFile}
            />
          </div>
        </ModalGrid>
      </FormModal>

      <LocationPickerModal
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialLat={form.latitude.trim() ? Number(form.latitude) : null}
        initialLng={form.longitude.trim() ? Number(form.longitude) : null}
        onConfirm={(lat, lng) =>
          setForm((prev) => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
        }
      />

      <DetailModal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
        title={t("events.detail.title", "Event Detail")}
        onEdit={() => {
          const event = selected;
          setDetailOpen(false);
          if (event) handleOpenForm(event);
        }}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label={t("fields.title", "Title")}>{titleCase(selected.title)}</DetailItem>
              <DetailItem label={t("fields.description", "Description")}>{selected.description || "-"}</DetailItem>
              <DetailItem label={t("venue.label", "Venue")}>
                {selected.latitude != null && selected.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {isShopLocation(selected.latitude, selected.longitude)
                      ? SHOP_LOCATION.name
                      : t("venue.view_on_map", "View on map")}
                  </a>
                ) : (
                  t("venue.none", "No fixed venue")
                )}
              </DetailItem>
              <DetailItem label={t("events.form.starts_at", "Starts At")}>{formatDateTime(selected.startAt)}</DetailItem>
              <DetailItem label={t("events.form.ends_at", "Ends At")}>{formatDateTime(selected.endAt)}</DetailItem>
              <DetailItem label={t("fields.status", "Status")}>
                <StatusBadge
                  label={enumLabel(t, "status", selected.status)}
                  tone={selected.status === "ACTIVE" ? "success" : "danger"}
                />
              </DetailItem>
              <DetailItem label={t("fields.created_by", "Created By")}>
                {selected.createdByName ? titleCase(selected.createdByName) : "-"}
              </DetailItem>
              <div className="detail_item">
                <p className="detail_item_label">{t("fields.image", "Image")} :</p>
                <DetailImage src={selected.imageUrl ?? undefined} alt={selected.title} />
              </div>
            </DetailGrid>
          </div>
        )}
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
