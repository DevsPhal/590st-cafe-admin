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
import { statusTone } from "@/features/user/components/UserManagementView";
import { titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import type { Gender, TelegramLinkCodeResponse, UserResponse, UserStatus } from "@/store/api/types";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { formatPhone, formatPhoneInput } from "@/lib/phone";
import { usePersistentState } from "@/hooks/usePersistentState";
import { filteredPage, filteredQueryArgs } from "@/hooks/useFilteredPaging";
import { staffCreateSchema, staffInviteSchema, staffUpdateSchema } from "@/lib/formSchemas";
import { useI18n } from "@/contexts/I18nContext";
import { useFormErrors } from "@/hooks/useFormErrors";
import { Button } from "@/components/common/Button";

type StaffKind = "ADMIN" | "BARISTA";

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
  const { t } = useI18n();
  const { role, isAdmin } = useCurrentRole();
  const { confirm, confirmDialog } = useConfirmDialog();
  const canManageAdmins = role === "SUPER_ADMIN";
  const [kind, setKind] = usePersistentState<StaffKind>("staff:kind", "BARISTA");
  const [formKind, setFormKind] = usePersistentState<StaffKind>("staff:formKind", "BARISTA");
  const [page, setPage] = usePersistentState("staff:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("staff:searchTerm", "");
  const [statusFilter, setStatusFilter] = usePersistentState("staff:statusFilter", "");
  const isFiltering = Boolean(searchTerm.trim() || statusFilter);

  const adminQuery = useListAdminsQuery(
    filteredQueryArgs(page, size, isFiltering),
    { skip: !canManageAdmins || kind !== "ADMIN" }
  );
  const baristaQuery = useListBaristasQuery(
    filteredQueryArgs(page, size, isFiltering),
    { skip: !isAdmin || kind !== "BARISTA" }
  );
  const active = kind === "ADMIN" ? adminQuery : baristaQuery;
  const list = listLoadState(active);

  const [createAdmin, { isLoading: isCreatingAdmin }] = useCreateAdminMutation();
  const [createBarista, { isLoading: isCreatingBarista }] = useCreateBaristaMutation();
  const [updateAdmin, { isLoading: isUpdatingAdmin }] = useUpdateAdminMutation();
  const [updateBarista, { isLoading: isUpdatingBarista }] = useUpdateBaristaMutation();
  const [deleteAdmin, { isLoading: isDeletingAdmin }] = useDeleteAdminMutation();
  const [deleteBarista, { isLoading: isDeletingBarista }] = useDeleteBaristaMutation();
  const isDeleting = isDeletingAdmin || isDeletingBarista;
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
  // One check per mode, so each submit keeps its exact shape; the open mode's messages are shown.
  const inviteValidation = useFormErrors(staffInviteSchema, form);
  const updateValidation = useFormErrors(staffUpdateSchema, form);
  const createValidation = useFormErrors(staffCreateSchema, form);
  const isInviteMode = !selected && creationMode === "TELEGRAM";
  const validation = isInviteMode ? inviteValidation : selected ? updateValidation : createValidation;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imagePreview = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : undefined), [imageFile]);
  const [inviteResult, setInviteResult] = usePersistentState<TelegramLinkCodeResponse | null>("staff:inviteResult", null);
  const [inviteResultOpen, setInviteResultOpen] = usePersistentState("staff:inviteResultOpen", false);

  useEffect(() => {
    if (!imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const handlePickImage = (file: File | null) => {
    if (submitting.current) return;
    setImageFile(file);
  };

  const staff = useMemo(() => active.data?.content ?? [], [active.data]);

  const matchingStaff = useMemo(
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
  const view = filteredPage(matchingStaff, active.data, page, size, isFiltering);
  const visibleStaff = view.rows;

  const activeCount = staff.filter((s) => s.status === "ACTIVE").length;

  const staffTableHeaders = [
    t("table.no", "No"),
    t("staff.table.staff", "Staff"),
    t("fields.phone_number", "Phone Number"),
    t("staff.fields.gender", "Gender"),
    t("fields.role", "Role"),
    t("fields.created_by", "Created By"),
    t("fields.status", "Status"),
    t("table.action", "Action"),
  ];

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
    inviteValidation.reset();
    updateValidation.reset();
    createValidation.reset();
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (submitting.current) return;
    if (!isAdmin || (formKind === "ADMIN" && !canManageAdmins)) {
      toast.error(t("staff.toast.cannot_manage_role", "Your account cannot manage this staff role."));
      return;
    }
    const gender = (form.gender || undefined) as Gender | undefined;
    const isInvite = !selected && Boolean(formKind) && creationMode === "TELEGRAM";

    if (isInvite) {
      const invite = inviteValidation.validate();
      if (!invite) return;
      submitting.current = true;
      try {
        const body = { ...invite, gender };
        const result = formKind === "ADMIN" ? await inviteAdmin(body).unwrap() : await inviteBarista(body).unwrap();
        setKind(formKind);
        setPage(1);
        setFormOpen(false);
        setForm(EMPTY_FORM);
        setInviteResult(result);
        setInviteResultOpen(true);
      } catch (err) {
        inviteValidation.showServerError(err, t("staff.toast.invite_failed", "Could not send the Telegram invite."));
      } finally {
        submitting.current = false;
      }
      return;
    }

    const updates = selected ? updateValidation.validate() : null;
    const created = selected ? null : createValidation.validate();
    if (!updates && !created) return;

    submitting.current = true;
    let detailsSaved = false;
    try {
      let savedMember: UserResponse;
      if (selected && updates) {
        const body = { ...updates, gender, status: form.status };
        if (formKind === "ADMIN") {
          savedMember = await updateAdmin({ id: selected.id, body }).unwrap();
        } else {
          savedMember = await updateBarista({ id: selected.id, body }).unwrap();
        }
      } else {
        const body = { ...created!, gender };
        if (formKind === "ADMIN") {
          savedMember = await createAdmin(body).unwrap();
        } else {
          savedMember = await createBarista(body).unwrap();
        }
      }
      detailsSaved = true;
      setSelected(savedMember);
      setForm((current) => ({ ...current, password: "" }));
      if (imageFile) {
        await uploadAvatar({ id: savedMember.id, role: formKind, file: imageFile }).unwrap();
      }
      toast.success(selected
        ? t("staff.toast.updated", "Staff member updated")
        : formKind === "ADMIN"
          ? t("staff.toast.admin_created", "Admin created")
          : t("staff.toast.barista_created", "Barista created"));
      setKind(formKind);
      setPage(1);
      setFormOpen(false);
      setSelected(null);
      setForm(EMPTY_FORM);
      setImageFile(null);
    } catch (err) {
      if (detailsSaved) {
        toast.error(t("staff.toast.photo_upload_failed", "Staff details saved, but the photo was not uploaded. {error} Submit again to retry.", {
          error: apiErrorMessage(err as never, t("staff.toast.please_try_again", "Please try again.")),
        }));
      } else {
        validation.showServerError(err, t("staff.toast.save_failed", "Could not save the staff member."));
      }
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
      toast.error(apiErrorMessage(err as never, t("staff.toast.resend_failed", "Could not resend the Telegram invite.")));
    }
  };

  const handleDelete = async (member: UserResponse) => {
    if (!isAdmin || (member.role === "ADMIN" && !canManageAdmins)) return;
    if (!(await confirm({
      title: t("staff.confirm.remove_title", "Remove staff member"),
      description: t("staff.confirm.remove_description", "Remove {name}?", { name: member.fullName }),
      confirmLabel: t("actions.remove", "Remove"),
      tone: "danger",
    }))) return;
    try {
      if (member.role === "ADMIN") {
        await deleteAdmin(member.id).unwrap();
      } else {
        await deleteBarista(member.id).unwrap();
      }
      toast.success(t("staff.toast.removed", "Staff member removed"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("staff.toast.remove_failed", "Could not remove the staff member.")));
    }
  };

  const isSaving =
    isCreatingAdmin || isCreatingBarista || isUpdatingAdmin || isUpdatingBarista || isUploadingAvatar ||
    isInvitingAdmin || isInvitingBarista;
  const isResendingInvite = isResendingAdmin || isResendingBarista;

  return (
    <PageShell>
      <PageHeader
        title={t("staff.title", "Staff")}
        breadcrumbs={[{ label: t("breadcrumb.home", "Home"), href: "/" }, { label: t("staff.title", "Staff") }]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatTile
          title={kind === "ADMIN" ? t("staff.stats.all_admins", "All Admins") : t("staff.stats.all_baristas", "All Baristas")}
          value={String(active.data?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile title={t("staff.stats.active_this_page", "Active (this page)")} value={String(activeCount)} tone="green" />
      </div>

      <FilterPanel>
        <SelectField
          label={t("staff.filters.staff_type", "Staff Type")}
          value={kind}
          onChange={(e) => {
            if (!e.target.value) return;
            const nextKind = e.target.value as StaffKind;
            if (nextKind === "ADMIN" && !canManageAdmins) return;
            setKind(nextKind);
            setPage(1);
          }}
        >
          <option value="BARISTA">{t("staff.list.baristas", "Baristas")}</option>
          {canManageAdmins && <option value="ADMIN">{t("staff.list.admins", "Admins")}</option>}
        </SelectField>
        <TextField
          label={t("staff.filters.name_or_email", "Name or Email")}
          placeholder={t("staff.filters.search_placeholder", "Search staff")}
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />
        <SelectField
          label={t("fields.status", "Status")}
          placeholder={t("staff.filters.all_statuses", "All statuses")}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="ACTIVE">{enumLabel(t, "user_status", "ACTIVE")}</option>
          <option value="PENDING_VERIFICATION">{enumLabel(t, "user_status", "PENDING_VERIFICATION")}</option>
          <option value="DEACTIVATED">{enumLabel(t, "user_status", "DEACTIVATED")}</option>
          <option value="SUSPENDED">{enumLabel(t, "user_status", "SUSPENDED")}</option>
          <option value="BANNED">{enumLabel(t, "user_status", "BANNED")}</option>
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setStatusFilter(""); setPage(1); }} onSearch={active.refetch} />
      </FilterPanel>

      <DataCard
        title={kind === "ADMIN" ? t("staff.list.admins", "Admins") : t("staff.list.baristas", "Baristas")}
        meta={t("staff.list.total", "Total: {count}", { count: active.data?.totalElements ?? 0 })}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageAdmins && <TableActions onRegister={() => handleOpenForm(undefined, "ADMIN")} primaryLabel={t("staff.list.add_admin", "Add Admin")} />}
            {isAdmin && <TableActions onRegister={() => handleOpenForm(undefined, "BARISTA")} primaryLabel={t("staff.list.add_barista", "Add Barista")} />}
          </div>
        }
      >
        <SimpleTable headers={staffTableHeaders}>
          <TableState
            colSpan={staffTableHeaders.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleStaff.length === 0}
            emptyLabel={
              isFiltering
                ? t("staff.empty.no_match", "No staff match these filters.")
                : kind === "ADMIN"
                  ? t("staff.empty.no_admins", "No admins yet.")
                  : t("staff.empty.no_baristas", "No baristas yet.")
            }
            onRetry={active.refetch}
          />
          {list.showRows &&
            visibleStaff.map((member, index) => (
              <Row key={member.id} striped={index % 2 === 1}>
                <Cell>{view.offset + index + 1}</Cell>
                <Cell>
                  <StaffIdentityCell name={member.fullName} email={member.email} avatarUrl={member.avatarUrl} />
                </Cell>
                <Cell className="tabular-nums whitespace-nowrap">{formatPhone(member.phoneNumber) || "-"}</Cell>
                <Cell>{member.gender ? enumLabel(t, "gender", member.gender) : "-"}</Cell>
                <Cell>{enumLabel(t, "role", member.role)}</Cell>
                <Cell>{member.createdByName ? titleCase(member.createdByName) : "-"}</Cell>
                <Cell>
                  <StatusBadge
                    label={enumLabel(t, "user_status", member.status)}
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
        onOpenChange={(open) => {
          if (submitting.current) return;
          setFormOpen(open);
          if (!open) setImageFile(null);
        }}
        title={
          selected
            ? t("staff.form.title_modify", "Modify Staff")
            : formKind === "ADMIN"
              ? t("staff.form.title_register_admin", "Register Admin")
              : t("staff.form.title_register_barista", "Register Barista")
        }
        submitLabel={t("actions.submit", "Submit")}
        onSubmit={handleSubmit}
        isLoading={isSaving}
      >
        <ModalGrid>
          <FormSelect label={t("staff.form.account_role", "Account Role")} value={formKind} disabled={Boolean(selected) || isSaving}
            onChange={(event) => {
              const nextKind = event.target.value as StaffKind;
              if (nextKind === "BARISTA" || (nextKind === "ADMIN" && canManageAdmins)) setFormKind(nextKind);
            }}>
            <option value="BARISTA">{enumLabel(t, "role", "BARISTA")}</option>
            {canManageAdmins && <option value="ADMIN">{enumLabel(t, "role", "ADMIN")}</option>}
          </FormSelect>
          {!selected && (
            <FormSelect
              label={t("staff.form.setup_method", "Setup Method")}
              value={creationMode}
              disabled={isSaving}
              onChange={(event) => setCreationMode(event.target.value as CreationMode)}
            >
              <option value="PASSWORD">{t("staff.form.setup_password", "Email & Password")}</option>
              <option value="TELEGRAM">{t("staff.form.setup_telegram", "Invite via Telegram")}</option>
            </FormSelect>
          )}
          {(selected || creationMode === "PASSWORD") && (
            <div className="md:col-span-3">
              {(imagePreview || selected?.avatarUrl) && <DetailImage src={imagePreview || selected?.avatarUrl || undefined} alt={t("staff.form.photo_alt", "Staff profile photo")} />}
              <FormImageUpload label={t("staff.form.profile_photo", "Profile Photo")} file={imageFile} onChange={handlePickImage} disabled={isSaving}
                emptyLabel={selected?.avatarUrl ? t("staff.form.photo_replace", "Choose a photo to replace the current one") : t("staff.form.photo_none", "No photo selected")} />
              <p className="mt-2 text-sm text-muted-foreground">{t("staff.form.photo_hint", "Optional. JPEG, PNG, WebP, or GIF, up to 5 MB. Saved when you submit.")}</p>
              {imageFile && <button type="button" className="mt-2 text-sm underline" disabled={isSaving} onClick={() => setImageFile(null)}>{t("staff.form.clear_photo", "Clear selected photo")}</button>}
            </div>
          )}
          <FormInput
            label={t("fields.full_name", "Full Name")}
            placeholder={t("staff.form.full_name_placeholder", "e.g. Sophal Nem")}
            value={form.fullName}
            error={validation.errors.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
          {(selected || creationMode === "PASSWORD") && (
            <FormInput
              label={t("fields.email", "Email")}
              type="email"
              placeholder="user@gmail.com"
              value={form.email}
              error={validation.errors.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              readOnly={Boolean(selected)}
              required={!selected}
            />
          )}
          {!selected && creationMode === "PASSWORD" && (
            <FormInput
              label={t("fields.password", "Password")}
              type="password"
              placeholder={t("staff.form.password_placeholder", "Min 8 chars, mixed case, digit + symbol")}
              value={form.password}
              error={validation.errors.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          )}
          <FormPhoneInput
            value={form.phoneNumber}
            error={validation.errors.phoneNumber}
            onChange={(phoneNumber) => setForm({ ...form, phoneNumber })}
            required={!selected && creationMode === "TELEGRAM"}
          />
          {!selected && creationMode === "TELEGRAM" && (
            <p className="md:col-span-3 text-sm text-muted-foreground">
              {formKind === "ADMIN"
                ? t("staff.form.telegram_hint_admin", "No email or password needed — the admin activates their account by opening the Telegram invite link and confirming this phone number, then signs in on the login page under the")
                : t("staff.form.telegram_hint_barista", "No email or password needed — the barista activates their account by opening the Telegram invite link and confirming this phone number, then signs in on the login page under the")}{" "}
              <span className="font-semibold">{t("staff.form.phone_tab", "Phone number")}</span>{t("staff.form.telegram_hint_end", " tab.")}
            </p>
          )}
          <FormSelect
            label={t("staff.fields.gender", "Gender")}
            placeholder={t("staff.form.gender_placeholder", "Select gender")}
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </FormSelect>
          {selected ? (
            <FormSelect
              label={t("fields.status", "Status")}
              placeholder={t("staff.form.status_placeholder", "Select status")}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as UserStatus })}
            >
              <option value="ACTIVE">{enumLabel(t, "user_status", "ACTIVE")}</option>
              <option value="DEACTIVATED">{enumLabel(t, "user_status", "DEACTIVATED")}</option>
              <option value="SUSPENDED">{enumLabel(t, "user_status", "SUSPENDED")}</option>
              <option value="BANNED">{enumLabel(t, "user_status", "BANNED")}</option>
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
        title={t("staff.detail.title", "Staff Detail")}
        onEdit={() => {
          const member = selected;
          setDetailOpen(false);
          if (member) handleOpenForm(member);
        }}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            {selected.avatarUrl && <DetailImage src={selected.avatarUrl} alt={t("staff.detail.photo_alt", "{name}'s profile photo", { name: selected.fullName })} />}
            <DetailGrid>
              <DetailItem label={t("fields.full_name", "Full Name")}>{titleCase(selected.fullName)}</DetailItem>
              <DetailItem label={t("fields.email", "Email")}>{selected.email}</DetailItem>
              <DetailItem label={t("fields.phone_number", "Phone Number")}>{formatPhone(selected.phoneNumber) || "-"}</DetailItem>
              <DetailItem label={t("staff.fields.gender", "Gender")}>
                {selected.gender ? enumLabel(t, "gender", selected.gender) : "-"}
              </DetailItem>
              <DetailItem label={t("fields.role", "Role")}>{enumLabel(t, "role", selected.role)}</DetailItem>
              <DetailItem label={t("fields.status", "Status")}>
                <StatusBadge
                  label={enumLabel(t, "user_status", selected.status)}
                  tone={statusTone(selected.status)}
                />
              </DetailItem>
              <DetailItem label="Telegram">
                <div className="flex items-center gap-3">
                  <span>{selected.telegramLinked ? t("staff.detail.linked", "Linked") : t("staff.detail.not_linked", "Not linked")}</span>
                  {!selected.telegramLinked && (
                    <button
                      type="button"
                      className="text-sm underline disabled:opacity-50"
                      disabled={isResendingInvite}
                      onClick={() => handleResendInvite(selected)}
                    >
                      {isResendingInvite ? t("states.sending", "Sending...") : t("staff.detail.send_invite", "Send Telegram invite")}
                    </button>
                  )}
                </div>
              </DetailItem>
              <DetailItem label={t("fields.created_by", "Created By")}>
                {selected.createdByName
                  ? `${titleCase(selected.createdByName)} (${enumLabel(t, "role", selected.createdByRole)})`
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
        title={t("staff.invite_result.title", "Telegram Invite Sent")}
      >
        {inviteResult && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label={t("staff.invite_result.invite_link", "Invite Link")}>
                <a href={inviteResult.deepLink} target="_blank" rel="noopener noreferrer" className="underline break-all">
                  {inviteResult.deepLink}
                </a>
              </DetailItem>
              <DetailItem label={t("staff.invite_result.code", "Code")}>{inviteResult.code}</DetailItem>
              <DetailItem label={t("staff.invite_result.expires_in", "Expires In")}>
                {t("staff.invite_result.expires_minutes", "{count} minute(s)", { count: Math.round(inviteResult.expiresInSeconds / 60) })}
              </DetailItem>
            </DetailGrid>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("staff.invite_result.hint", "Share this link with the invitee. After they open it and share their phone number in Telegram, the account is active and they sign in on the login page under")}{" "}
              <span className="font-semibold">{t("staff.invite_result.phone_tab", "Phone number")}</span>{t("staff.invite_result.hint_end", " — the code arrives in Telegram.")}
            </p>
            <Button
             
              variant="outline" className="mt-3"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteResult.deepLink);
                  toast.success(t("staff.toast.link_copied", "Link copied"));
                } catch {
                  toast.error(t("staff.toast.copy_failed", "Could not copy the link."));
                }
              }}
            >
              {t("staff.invite_result.copy_link", "Copy Link")}
            </Button>
          </div>
        )}
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
