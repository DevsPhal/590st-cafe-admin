"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { MapPin } from "lucide-react";
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
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePersistentState } from "@/hooks/usePersistentState";

const EVENT_TABLE_HEADERS = [
  "No",
  "Image",
  "Title",
  "Venue",
  "Starts",
  "Ends",
  "Window",
  "Status",
  "Action",
] as const;

type EventFormFields = {
  title: string;
  description: string;
  // Kept as strings for the form's own numeric inputs; parsed to numbers only on submit. Must
  // be given together, or both left blank — mirrors the API's own latitude/longitude pairing
  // rule (400s otherwise).
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

/** The API takes ISO local date-time; <input type="datetime-local"> already produces that. */
function toInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
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

  const {
    data: eventPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListEventsQuery({ page, size });
  const list = listLoadState({ isFetching, currentData, error });

  const [createEvent, { isLoading: isCreating }] = useCreateEventMutation();
  const [updateEvent, { isLoading: isUpdating }] = useUpdateEventMutation();
  const [deleteEvent] = useDeleteEventMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadEventImageMutation();

  const [formOpen, setFormOpen] = usePersistentState("events:formOpen", false);
  const [detailOpen, setDetailOpen] = usePersistentState("events:detailOpen", false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [selected, setSelected] = usePersistentState<EventResponse | null>("events:selected", null);
  const [form, setForm] = usePersistentState<EventFormFields>("events:form", EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const events = useMemo(() => eventPage?.content ?? [], [eventPage]);

  const visibleEvents = useMemo(
    () =>
      events.filter((event) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = !term || event.title.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || event.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [events, searchTerm, statusFilter]
  );

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
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    if (!form.startAt || !form.endAt) {
      toast.error("Start and end date/time are both required");
      return;
    }
    if (new Date(form.endAt).getTime() <= new Date(form.startAt).getTime()) {
      toast.error("The end must come after the start");
      return;
    }

    const lat = form.latitude.trim();
    const lng = form.longitude.trim();
    if (Boolean(lat) !== Boolean(lng)) {
      toast.error("Latitude and longitude must be given together");
      return;
    }
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (lat && lng) {
      latitude = Number(lat);
      longitude = Number(lng);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        toast.error("Latitude must be between -90 and 90");
        return;
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        toast.error("Longitude must be between -180 and 180");
        return;
      }
    }

    try {
      let eventId: string;
      if (selected) {
        const updated = await updateEvent({
          id: selected.id,
          body: {
            title,
            description: form.description.trim() || undefined,
            latitude,
            longitude,
            startAt: form.startAt,
            endAt: form.endAt,
            status: form.status,
          },
        }).unwrap();
        eventId = updated.id;
      } else {
        const created = await createEvent({
          title,
          description: form.description.trim() || undefined,
          latitude,
          longitude,
          startAt: form.startAt,
          endAt: form.endAt,
        }).unwrap();
        eventId = created.id;
      }

      if (imageFile) {
        await uploadImage({ id: eventId, file: imageFile }).unwrap();
      }

      toast.success(selected ? "Event updated" : "Event created");
      setFormOpen(false);
      setSelected(null);
      setForm(EMPTY_FORM);
      setImageFile(null);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not save the event."));
    }
  };

  const handleDelete = async (event: EventResponse) => {
    if (!(await confirm({ title: "Delete event", description: `Delete event "${event.title}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    try {
      await deleteEvent(event.id).unwrap();
      toast.success("Event deleted");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not delete the event."));
    }
  };

  const isSaving = isCreating || isUpdating || isUploading;

  return (
    <PageShell>
      <PageHeader
        title="Events"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Events" }]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatTile
          title="All Events"
          value={String(eventPage?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile
          title="Running Now (this page)"
          value={String(runningCount)}
          tone={runningCount > 0 ? "green" : "gray"}
        />
      </div>

      <FilterPanel>
        <TextField
          label="Title"
          placeholder="Search events"
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
        title="Events"
        meta={`Total Events: ${eventPage?.totalElements ?? 0}`}
        actions={
          <TableActions onRegister={() => handleOpenForm()} primaryLabel="Add Event" />
        }
      >
        <SimpleTable headers={[...EVENT_TABLE_HEADERS]}>
          <TableState
            colSpan={EVENT_TABLE_HEADERS.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleEvents.length === 0}
            emptyLabel="No events yet. Use Add Event to create the first one."
            onRetry={refetch}
          />
          {list.showRows &&
            visibleEvents.map((event, index) => {
              const win = eventWindow(event);
              return (
                <Row key={event.id} striped={index % 2 === 1}>
                  <Cell>{(page - 1) * size + index + 1}</Cell>
                  <Cell>
                    <Thumbnail src={event.imageUrl ?? undefined} />
                  </Cell>
                  <Cell className="font-semibold">{titleCase(event.title)}</Cell>
                  <Cell>
                    {event.latitude != null && event.longitude != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline"
                        title="View venue on map"
                      >
                        <MapPin className="h-3.5 w-3.5" /> View
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
                          ? "Running"
                          : win === "UPCOMING"
                          ? "Upcoming"
                          : "Ended"
                      }
                      tone={WINDOW_TONE[win]}
                    />
                  </Cell>
                  <Cell>
                    <StatusBadge
                      label={event.status === "ACTIVE" ? "Active" : "Inactive"}
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
                      isLoading={isSaving}
                    />
                  </Cell>
                </Row>
              );
            })}
        </SimpleTable>
        <PaginationFooter
          page={eventPage?.page ?? page}
          totalPages={eventPage?.totalPages ?? 1}
          size={size}
          totalElements={eventPage?.totalElements}
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
        title={selected ? "Modify Event" : "Add Event"}
        submitLabel="Submit"
        onSubmit={handleSubmit}
        isLoading={isSaving}
      >
        <ModalGrid>
          <FormInput
            label="Title"
            placeholder="e.g. Latte Art Workshop"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <div className="form_field md:col-span-3">
            <span className="form_field_label">Venue</span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setMapPickerOpen(true)}
                className="btn_outline_black inline-flex items-center gap-2 text-xs"
              >
                <MapPin className="h-3.5 w-3.5" />
                {form.latitude.trim() && form.longitude.trim() ? "Change Pin on Map" : "Pin on Map"}
              </button>
              {form.latitude.trim() && form.longitude.trim() ? (
                <>
                  <span className="text-xs text-gray-600">
                    {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${form.latitude.trim()},${form.longitude.trim()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                  >
                    Preview
                  </a>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, latitude: "", longitude: "" })}
                    className="text-xs text-red-600 underline"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-500">
                  No fixed venue set — optional, leave blank for an announcement with no venue.
                </span>
              )}
            </div>
          </div>
          <FormInput
            label="Starts At"
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            required
          />
          <FormInput
            label="Ends At"
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            required
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
          <FormInput
            label="Description"
            placeholder="What is happening?"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="md:col-span-3">
            <FormImageUpload
              label="Event Image"
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
        title="Event Detail"
        onEdit={() => {
          const event = selected;
          setDetailOpen(false);
          if (event) handleOpenForm(event);
        }}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label="Title">{titleCase(selected.title)}</DetailItem>
              <DetailItem label="Description">{selected.description || "-"}</DetailItem>
              <DetailItem label="Venue">
                {selected.latitude != null && selected.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View on map
                  </a>
                ) : (
                  "No fixed venue"
                )}
              </DetailItem>
              <DetailItem label="Starts At">{formatDateTime(selected.startAt)}</DetailItem>
              <DetailItem label="Ends At">{formatDateTime(selected.endAt)}</DetailItem>
              <DetailItem label="Status">
                <StatusBadge
                  label={selected.status === "ACTIVE" ? "Active" : "Inactive"}
                  tone={selected.status === "ACTIVE" ? "success" : "danger"}
                />
              </DetailItem>
              <DetailItem label="Created By">
                {selected.createdByName ? titleCase(selected.createdByName) : "-"}
              </DetailItem>
              <div className="detail_item">
                <p className="detail_item_label">Image :</p>
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
