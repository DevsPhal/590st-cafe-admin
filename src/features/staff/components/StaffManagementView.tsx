"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentRole } from "@/store/api/useCurrentRole";
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
  FilterActions,
  FilterPanel,
  FormInput,
  FormPhoneInput,
  FormImageUpload,
  FormModal,
  FormSelect,
  ModalGrid,
  PaginationFooter,
  Row,
  RowActions,
  SelectField,
  SimpleTable,
  StaffIdentityCell,
  StatTile,
  StatusBadge,
  TableActions,
  TableState,
  listLoadState,
  TextField,
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import {
  useCreateAdminMutation,
  useCreateBaristaMutation,
  useDeleteAdminMutation,
  useDeleteBaristaMutation,
  useInviteAdminViaTelegramMutation,
  useInviteBaristaViaTelegramMutation,
  useListAdminsQuery,
  useListBaristasQuery,
  useResendAdminTelegramInviteMutation,
  useResendBaristaTelegramInviteMutation,
  useUpdateAdminMutation,
  useUpdateBaristaMutation,
  useUploadStaffAvatarMutation,
} from "@/store/api/userApi";
import { humanise, statusTone } from "@/features/user/components/UserManagementView";
import { titleCase } from "@/lib/utils";
import type { Gender, TelegramLinkCodeResponse, UserResponse, UserStatus } from "@/store/api/types";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { formatPhone, formatPhoneInput, isValidPhone, PHONE_INVALID_MESSAGE } from "@/lib/phone";
import { usePersistentState } from "@/hooks/usePersistentState";

const STAFF_TABLE_HEADERS = [
  "No",
  "Staff",
  "Phone Number",
  "Gender",
  "Role",
  "Created By",
  "Status",
  "Action",
] as const;

/** Admins and baristas are separate endpoints, so the screen tabs between them. */
type StaffKind = "ADMIN" | "BARISTA";

/** Telegram invitees have no email/password — they verify by phone over Telegram instead. */
type CreationMode = "PASSWORD" | "TELEGRAM";

type StaffFormFields = {
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  gender: string;
  status: UserStatus;
};

const EMPTY_FORM: StaffFormFields = {
  fullName: "",
  email: "",
  password: "",
  phoneNumber: "",
  gender: "",
  status: "ACTIVE",
};

export default function Staff() {
  const { role, isAdmin } = useCurrentRole();
  const { confirm, confirmDialog } = useConfirmDialog();
  const canManageAdmins = role === "SUPER_ADMIN";
  const [kind, setKind] = usePersistentState<StaffKind>("staff:kind", "BARISTA");
  const [formKind, setFormKind] = usePersistentState<StaffKind>("staff:formKind", "BARISTA");
  const [page, setPage] = usePersistentState("staff:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("staff:searchTerm", "");
  const [statusFilter, setStatusFilter] = usePersistentState("staff:statusFilter", "");

  const adminQuery = useListAdminsQuery(
    { page, size },
    { skip: !canManageAdmins || kind !== "ADMIN" }
  );
  const baristaQuery = useListBaristasQuery(
    { page, size },
    { skip: !isAdmin || kind !== "BARISTA" }
  );
  const active = kind === "ADMIN" ? adminQuery : baristaQuery;
  const list = listLoadState(active);

  const [createAdmin, { isLoading: isCreatingAdmin }] = useCreateAdminMutation();
  const [createBarista, { isLoading: isCreatingBarista }] = useCreateBaristaMutation();
  const [updateAdmin, { isLoading: isUpdatingAdmin }] = useUpdateAdminMutation();
  const [updateBarista, { isLoading: isUpdatingBarista }] = useUpdateBaristaMutation();
  const [deleteAdmin] = useDeleteAdminMutation();
  const [deleteBarista] = useDeleteBaristaMutation();
  const [uploadAvatar, { isLoading: isUploadingAvatar }] = useUploadStaffAvatarMutation();
  const [inviteAdmin, { isLoading: isInvitingAdmin }] = useInviteAdminViaTelegramMutation();
  const [inviteBarista, { isLoading: isInvitingBarista }] = useInviteBaristaViaTelegramMutation();
  const [resendAdminInvite, { isLoading: isResendingAdmin }] = useResendAdminTelegramInviteMutation();
  const [resendBaristaInvite, { isLoading: isResendingBarista }] = useResendBaristaTelegramInviteMutation();
  const submitting = useRef(false);

  const [formOpen, setFormOpen] = usePersistentState("staff:formOpen", false);
  const [detailOpen, setDetailOpen] = usePersistentState("staff:detailOpen", false);
  const [selected, setSelected] = usePersistentState<UserResponse | null>("staff:selected", null);
  const [form, setForm] = usePersistentState<StaffFormFields>("staff:form", EMPTY_FORM);
  const [creationMode, setCreationMode] = usePersistentState<CreationMode>("staff:creationMode", "PASSWORD");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>();
  const [inviteResult, setInviteResult] = usePersistentState<TelegramLinkCodeResponse | null>("staff:inviteResult", null);
  const [inviteResultOpen, setInviteResultOpen] = usePersistentState("staff:inviteResultOpen", false);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(undefined);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handlePickImage = (file: File | null) => {
    if (submitting.current) return;
    if (file && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Choose a JPEG, PNG, WebP, or GIF image");
      return;
    }
    if (file && (file.size === 0 || file.size > 5 * 1024 * 1024)) {
      toast.error("Choose a non-empty image of 5 MB or smaller");
      return;
    }
    setImageFile(file);
  };

  const staff = useMemo(() => active.data?.content ?? [], [active.data]);

  const visibleStaff = useMemo(
    () =>
      staff.filter((member) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !term ||
          member.fullName.toLowerCase().includes(term) ||
          member.email.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || member.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [staff, searchTerm, statusFilter]
  );

  const activeCount = staff.filter((s) => s.status === "ACTIVE").length;

  const handleOpenForm = (member?: UserResponse, createKind: StaffKind = kind) => {
    const targetKind = member?.role === "ADMIN" ? "ADMIN" : member ? "BARISTA" : createKind;
    if (!isAdmin || (targetKind === "ADMIN" && !canManageAdmins)) return;
    setFormKind(targetKind);
    setImageFile(null);
    setCreationMode("PASSWORD");
    setSelected(member ?? null);
    setForm(
      member
        ? {
            fullName: member.fullName,
            email: member.email,
            password: "",
            phoneNumber: formatPhoneInput(member.phoneNumber),
            gender: member.gender ?? "",
            status: member.status,
          }
        : EMPTY_FORM
    );
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (submitting.current) return;
    if (!isAdmin || (formKind === "ADMIN" && !canManageAdmins)) {
      toast.error("Your account cannot manage this staff role.");
      return;
    }
    const fullName = form.fullName.trim();
    if (!fullName) {
      toast.error("Full name is required");
      return;
    }
    if (!isValidPhone(form.phoneNumber)) {
      toast.error(PHONE_INVALID_MESSAGE);
      return;
    }

    if (!selected && formKind && creationMode === "TELEGRAM") {
      const phoneNumber = form.phoneNumber.trim();
      if (!phoneNumber) {
        toast.error("Phone number is required to invite via Telegram");
        return;
      }
      submitting.current = true;
      try {
        const body = { fullName, phoneNumber, gender: (form.gender || undefined) as Gender | undefined };
        const result = formKind === "ADMIN" ? await inviteAdmin(body).unwrap() : await inviteBarista(body).unwrap();
        setKind(formKind);
        setPage(1);
        setFormOpen(false);
        setForm(EMPTY_FORM);
        setInviteResult(result);
        setInviteResultOpen(true);
      } catch (err) {
        toast.error(apiErrorMessage(err as never, "Could not send the Telegram invite."));
      } finally {
        submitting.current = false;
      }
      return;
    }

    submitting.current = true;
    let detailsSaved = false;
    try {
      let savedMember: UserResponse;
      if (selected) {
        // Email and password are not editable through UpdateStaffRequest.
        const body = {
          fullName,
          phoneNumber: form.phoneNumber.trim() || undefined,
          gender: (form.gender || undefined) as Gender | undefined,
          status: form.status,
        };
        if (formKind === "ADMIN") {
          savedMember = await updateAdmin({ id: selected.id, body }).unwrap();
        } else {
          savedMember = await updateBarista({ id: selected.id, body }).unwrap();
        }
      } else {
        if (!form.email.trim()) {
          toast.error("Email is required");
          return;
        }
        if (form.password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        const body = {
          fullName,
          email: form.email.trim(),
          password: form.password,
          phoneNumber: form.phoneNumber.trim() || undefined,
          gender: (form.gender || undefined) as Gender | undefined,
        };
        if (formKind === "ADMIN") {
          savedMember = await createAdmin(body).unwrap();
        } else {
          savedMember = await createBarista(body).unwrap();
        }
      }
      detailsSaved = true;
      // Preserve the created account if its separate photo upload fails, so retry edits it.
      setSelected(savedMember);
      setForm((current) => ({ ...current, password: "" }));
      if (imageFile) {
        await uploadAvatar({ id: savedMember.id, role: formKind, file: imageFile }).unwrap();
      }
      toast.success(selected ? "Staff member updated" : `${formKind === "ADMIN" ? "Admin" : "Barista"} created`);
      setKind(formKind);
      setPage(1);
      setFormOpen(false);
      setSelected(null);
      setForm(EMPTY_FORM);
      setImageFile(null);
    } catch (err) {
      toast.error(detailsSaved
        ? `Staff details saved, but the photo was not uploaded. ${apiErrorMessage(err as never, "Please try again.")} Submit again to retry.`
        : apiErrorMessage(err as never, "Could not save the staff member."));
    } finally {
      submitting.current = false;
    }
  };

  const handleResendInvite = async (member: UserResponse) => {
    try {
      const result = member.role === "ADMIN"
        ? await resendAdminInvite(member.id).unwrap()
        : await resendBaristaInvite(member.id).unwrap();
      setDetailOpen(false);
      setInviteResult(result);
      setInviteResultOpen(true);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not resend the Telegram invite."));
    }
  };

  const handleDelete = async (member: UserResponse) => {
    if (!isAdmin || (member.role === "ADMIN" && !canManageAdmins)) return;
    if (!(await confirm({ title: "Remove staff member", description: `Remove ${member.fullName}?`, confirmLabel: "Remove", tone: "danger" }))) return;
    try {
      if (member.role === "ADMIN") {
        await deleteAdmin(member.id).unwrap();
      } else {
        await deleteBarista(member.id).unwrap();
      }
      toast.success("Staff member removed");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not remove the staff member."));
    }
  };

  const isSaving =
    isCreatingAdmin || isCreatingBarista || isUpdatingAdmin || isUpdatingBarista || isUploadingAvatar ||
    isInvitingAdmin || isInvitingBarista;
  const isResendingInvite = isResendingAdmin || isResendingBarista;

  return (
    <PageShell>
      <PageHeader
        title="Staff"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Staff" }]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatTile
          title={kind === "ADMIN" ? "All Admins" : "All Baristas"}
          value={String(active.data?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile title="Active (this page)" value={String(activeCount)} tone="green" />
      </div>

      <FilterPanel>
        <SelectField
          label="Staff Type"
          value={kind}
          onChange={(e) => {
            if (!e.target.value) return;
            const nextKind = e.target.value as StaffKind;
            if (nextKind === "ADMIN" && !canManageAdmins) return;
            setKind(nextKind);
            setPage(1);
          }}
        >
          <option value="BARISTA">Baristas</option>
          {canManageAdmins && <option value="ADMIN">Admins</option>}
        </SelectField>
        <TextField
          label="Name or Email"
          placeholder="Search staff"
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
          <option value="PENDING_VERIFICATION">Pending Verification</option>
          <option value="DEACTIVATED">Deactivated</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setStatusFilter(""); setPage(1); }} onSearch={active.refetch} />
      </FilterPanel>

      <DataCard
        title={kind === "ADMIN" ? "Admins" : "Baristas"}
        meta={`Total: ${active.data?.totalElements ?? 0}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageAdmins && <TableActions onRegister={() => handleOpenForm(undefined, "ADMIN")} primaryLabel="Add Admin" />}
            {isAdmin && <TableActions onRegister={() => handleOpenForm(undefined, "BARISTA")} primaryLabel="Add Barista" />}
          </div>
        }
      >
        <SimpleTable headers={[...STAFF_TABLE_HEADERS]}>
          <TableState
            colSpan={STAFF_TABLE_HEADERS.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleStaff.length === 0}
            emptyLabel={`No ${kind === "ADMIN" ? "admins" : "baristas"} yet.`}
            onRetry={active.refetch}
          />
          {list.showRows &&
            visibleStaff.map((member, index) => (
              <Row key={member.id} striped={index % 2 === 1}>
                <Cell>{(page - 1) * size + index + 1}</Cell>
                <Cell>
                  <StaffIdentityCell name={member.fullName} email={member.email} avatarUrl={member.avatarUrl} />
                </Cell>
                <Cell className="tabular-nums whitespace-nowrap">{formatPhone(member.phoneNumber) || "-"}</Cell>
                <Cell>{member.gender ? humanise(member.gender) : "-"}</Cell>
                <Cell>{humanise(member.role)}</Cell>
                <Cell>{member.createdByName ? titleCase(member.createdByName) : "-"}</Cell>
                <Cell>
                  <StatusBadge
                    label={humanise(member.status)}
                    tone={statusTone(member.status)}
                  />
                </Cell>
                <Cell>
                  <RowActions
                    onView={() => {
                      setSelected(member);
                      setDetailOpen(true);
                    }}
                    onEdit={() => handleOpenForm(member)}
                    onDelete={() => handleDelete(member)}
                    isLoading={isSaving}
                  />
                </Cell>
              </Row>
            ))}
        </SimpleTable>
        <PaginationFooter
          page={active.data?.page ?? page}
          totalPages={active.data?.totalPages ?? 1}
          size={size}
          totalElements={active.data?.totalElements}
          onPageChange={setPage}
          onSizeChange={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      </DataCard>

      <FormModal
        open={formOpen}
        onOpenChange={(open) => {
          if (submitting.current) return;
          setFormOpen(open);
          if (!open) setImageFile(null);
        }}
        title={
          selected
            ? "Modify Staff"
            : `Register ${formKind === "ADMIN" ? "Admin" : "Barista"}`
        }
        submitLabel="Submit"
        onSubmit={handleSubmit}
        isLoading={isSaving}
      >
        <ModalGrid>
          <FormSelect label="Account Role" value={formKind} disabled={Boolean(selected) || isSaving}
            onChange={(event) => {
              const nextKind = event.target.value as StaffKind;
              if (nextKind === "BARISTA" || (nextKind === "ADMIN" && canManageAdmins)) setFormKind(nextKind);
            }}>
            <option value="BARISTA">Barista</option>
            {canManageAdmins && <option value="ADMIN">Admin</option>}
          </FormSelect>
          {!selected && (
            <FormSelect
              label="Setup Method"
              value={creationMode}
              disabled={isSaving}
              onChange={(event) => setCreationMode(event.target.value as CreationMode)}
            >
              <option value="PASSWORD">Email &amp; Password</option>
              <option value="TELEGRAM">Invite via Telegram</option>
            </FormSelect>
          )}
          {(selected || creationMode === "PASSWORD") && (
            <div className="md:col-span-3">
              {(imagePreview || selected?.avatarUrl) && <DetailImage src={imagePreview || selected?.avatarUrl || undefined} alt="Staff profile photo" />}
              <FormImageUpload label="Profile Photo" file={imageFile} onChange={handlePickImage} disabled={isSaving}
                accept="image/jpeg,image/png,image/webp,image/gif" emptyLabel={selected?.avatarUrl ? "Choose a photo to replace the current one" : "No photo selected"} />
              <p className="mt-2 text-sm text-muted-foreground">Optional. JPEG, PNG, WebP, or GIF, up to 5 MB. Saved when you submit.</p>
              {imageFile && <button type="button" className="mt-2 text-sm underline" disabled={isSaving} onClick={() => setImageFile(null)}>Clear selected photo</button>}
            </div>
          )}
          <FormInput
            label="Full Name"
            placeholder="e.g. Sophal Nem"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
          {(selected || creationMode === "PASSWORD") && (
            <FormInput
              label="Email"
              type="email"
              placeholder="user@gmail.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              readOnly={Boolean(selected)}
              required={!selected}
            />
          )}
          {/* Only set at creation — the API offers no password change on this resource. */}
          {!selected && creationMode === "PASSWORD" && (
            <FormInput
              label="Password"
              type="password"
              placeholder="Min 8 chars, mixed case, digit + symbol"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          )}
          <FormPhoneInput
            value={form.phoneNumber}
            onChange={(phoneNumber) => setForm({ ...form, phoneNumber })}
            required={!selected && creationMode === "TELEGRAM"}
          />
          {!selected && creationMode === "TELEGRAM" && (
            <p className="md:col-span-3 text-sm text-muted-foreground">
              No email or password needed — {formKind === "ADMIN" ? "the admin" : "the barista"} activates
              their account by opening the Telegram invite link and confirming this phone number, then
              signs in on the login page under the <span className="font-semibold">Phone number</span> tab.
            </p>
          )}
          <FormSelect
            label="Gender"
            placeholder="Select gender"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </FormSelect>
          {selected ? (
            <FormSelect
              label="Status"
              placeholder="Select status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as UserStatus })}
            >
              <option value="ACTIVE">Active</option>
              <option value="DEACTIVATED">Deactivated</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BANNED">Banned</option>
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
        title="Staff Detail"
        onEdit={() => {
          const member = selected;
          setDetailOpen(false);
          if (member) handleOpenForm(member);
        }}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            {selected.avatarUrl && <DetailImage src={selected.avatarUrl} alt={`${selected.fullName}'s profile photo`} />}
            <DetailGrid>
              <DetailItem label="Full Name">{titleCase(selected.fullName)}</DetailItem>
              <DetailItem label="Email">{selected.email}</DetailItem>
              <DetailItem label="Phone Number">{formatPhone(selected.phoneNumber) || "-"}</DetailItem>
              <DetailItem label="Gender">
                {selected.gender ? humanise(selected.gender) : "-"}
              </DetailItem>
              <DetailItem label="Role">{humanise(selected.role)}</DetailItem>
              <DetailItem label="Status">
                <StatusBadge
                  label={humanise(selected.status)}
                  tone={statusTone(selected.status)}
                />
              </DetailItem>
              <DetailItem label="Telegram">
                <div className="flex items-center gap-3">
                  <span>{selected.telegramLinked ? "Linked" : "Not linked"}</span>
                  {!selected.telegramLinked && (
                    <button
                      type="button"
                      className="text-sm underline disabled:opacity-50"
                      disabled={isResendingInvite}
                      onClick={() => handleResendInvite(selected)}
                    >
                      {isResendingInvite ? "Sending..." : "Send Telegram invite"}
                    </button>
                  )}
                </div>
              </DetailItem>
              <DetailItem label="Created By">
                {selected.createdByName
                  ? `${titleCase(selected.createdByName)} (${humanise(selected.createdByRole ?? "")})`
                  : "-"}
              </DetailItem>
            </DetailGrid>
          </div>
        )}
      </DetailModal>

      <DetailModal
        open={inviteResultOpen}
        onOpenChange={(open) => {
          setInviteResultOpen(open);
          if (!open) setInviteResult(null);
        }}
        title="Telegram Invite Sent"
      >
        {inviteResult && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label="Invite Link">
                <a href={inviteResult.deepLink} target="_blank" rel="noopener noreferrer" className="underline break-all">
                  {inviteResult.deepLink}
                </a>
              </DetailItem>
              <DetailItem label="Code">{inviteResult.code}</DetailItem>
              <DetailItem label="Expires In">
                {Math.round(inviteResult.expiresInSeconds / 60)} minute(s)
              </DetailItem>
            </DetailGrid>
            <p className="mt-3 text-sm text-muted-foreground">
              Share this link with the invitee. After they open it and share their phone number in
              Telegram, the account is active and they sign in on the login page under{" "}
              <span className="font-semibold">Phone number</span> — the code arrives in Telegram.
            </p>
            <button
              type="button"
              className="btn_outline_black mt-3"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteResult.deepLink);
                  toast.success("Link copied");
                } catch {
                  toast.error("Could not copy the link");
                }
              }}
            >
              Copy Link
            </button>
          </div>
        )}
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
