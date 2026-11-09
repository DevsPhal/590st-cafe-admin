"use client";

import { useMemo } from "react";
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
  FormModal,
  FormInput,
  FormPhoneInput,
  FormSelect,
  ModalGrid,
  PaginationFooter,
  Row,
  RowActions,
  SelectField,
  SimpleTable,
  StatTile,
  StatusBadge,
  TableState,
  listLoadState,
  TextField,
} from "@/components/common/AdminKit";
import { UserAvatar } from "@/components/common/UserAvatar";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useI18n } from "@/contexts/I18nContext";
import { usePageSize, useRefreshOptions } from "@/contexts/AdminPreferencesContext";
import { useListUsersQuery, useUpdateUserStatusMutation, useUpdateUserMutation, useDeleteUserMutation } from "@/store/api/userApi";
import type { Gender, Role, UserResponse, UserStatus } from "@/store/api/types";
import { humanise, titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { formatPhone, formatPhoneInput } from "@/lib/phone";
import { usePersistentState } from "@/hooks/usePersistentState";
import { filteredPage, filteredQueryArgs } from "@/hooks/useFilteredPaging";
import { userAccountSchema } from "@/lib/formSchemas";
import { useFormErrors } from "@/hooks/useFormErrors";

export { humanise };

const USER_STATUSES: UserStatus[] = [
  "ACTIVE",
  "PENDING_VERIFICATION",
  "DEACTIVATED",
  "SUSPENDED",
  "BANNED",
  "DELETED",
];

export function statusTone(
  status: UserStatus
): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING_VERIFICATION") return "warning";
  if (status === "DEACTIVATED") return "neutral";
  return "danger";
}

export default function UserManagementView({
  role,
  title: titleProp,
  emptyLabel: emptyLabelProp,
}: {
  role?: Role;
  title?: string;
  emptyLabel?: string;
} = {}) {
  const { t } = useI18n();
  const title = titleProp ?? t("users.title", "Users");
  const emptyLabel = emptyLabelProp ?? t("users.empty.default", "No user accounts found.");
  const userTableHeaders = [
    t("table.no", "No"),
    t("users.table.avatar", "Avatar"),
    t("fields.full_name", "Full Name"),
    t("fields.email", "Email"),
    t("fields.phone_number", "Phone Number"),
    t("fields.role", "Role"),
    "Telegram",
    t("fields.status", "Status"),
    t("table.action", "Action"),
  ];
  const { confirm, confirmDialog } = useConfirmDialog();
  const [page, setPage] = usePersistentState(`users-${role ?? "all"}:page`, 1);
  const [size, setSize] = usePageSize();
  const refresh = useRefreshOptions();
  const [searchTerm, setSearchTerm] = usePersistentState(`users-${role ?? "all"}:searchTerm`, "");
  const [statusFilter, setStatusFilter] = usePersistentState(`users-${role ?? "all"}:statusFilter`, "");
  const isFiltering = Boolean(searchTerm.trim() || statusFilter);
  const [roleFilter, setRoleFilter] = usePersistentState<string>(`users-${role ?? "all"}:roleFilter`, role ?? "");

  const effectiveRole = (role ?? roleFilter) || undefined;

  const {
    data: userPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListUsersQuery({
    ...filteredQueryArgs(page, size, isFiltering),
    ...(effectiveRole ? { role: effectiveRole as Role } : {}),
  }, refresh);
  const list = listLoadState({ isFetching, currentData, error });

  const [updateStatus, { isLoading: isUpdating }] = useUpdateUserStatusMutation();
  const [updateUser, { isLoading: isSavingProfile }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const [detailOpen, setDetailOpen] = usePersistentState(`users-${role ?? "all"}:detailOpen`, false);
  const [statusOpen, setStatusOpen] = usePersistentState(`users-${role ?? "all"}:statusOpen`, false);
  const [editOpen, setEditOpen] = usePersistentState(`users-${role ?? "all"}:editOpen`, false);
  const [fullName, setFullName] = usePersistentState(`users-${role ?? "all"}:fullName`, "");
  const [phoneNumber, setPhoneNumber] = usePersistentState(`users-${role ?? "all"}:phoneNumber`, "");
  const [gender, setGender] = usePersistentState<Gender | "">(`users-${role ?? "all"}:gender`, "");
  const [selected, setSelected] = usePersistentState<UserResponse | null>(`users-${role ?? "all"}:selected`, null);
  const validation = useFormErrors(userAccountSchema, { fullName, phoneNumber });
  const [nextStatus, setNextStatus] = usePersistentState<UserStatus>(`users-${role ?? "all"}:nextStatus`, "ACTIVE");

  const users = useMemo(() => userPage?.content ?? [], [userPage]);

  const matchingUsers = useMemo(
    () =>
      users.filter((user) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !term ||
          user.fullName.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || user.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [users, searchTerm, statusFilter]
  );
  const view = filteredPage(matchingUsers, userPage, page, size, isFiltering);
  const visibleUsers = view.rows;

  const activeCount = users.filter((u) => u.status === "ACTIVE").length;

  const handleSaveProfile = async () => {
    if (!selected) return;
    const parsed = validation.validate();
    if (!parsed) return;
    try {
      await updateUser({ id: selected.id, body: {
        fullName: parsed.fullName, phoneNumber: parsed.phoneNumber ?? "", ...(gender ? { gender } : {}),
      } }).unwrap();
      toast.success(t("users.toast.updated", "Account updated"));
      setEditOpen(false);
      setSelected(null);
    } catch (err) {
      validation.showServerError(err, t("users.toast.update_failed", "Could not update the account."));
    }
  };

  const handleDelete = async (user: UserResponse) => {
    if (!(await confirm({
      title: t("users.confirm.delete_title", "Delete user account"),
      description: t(
        "users.confirm.delete_description",
        "Delete {name}'s account? They will lose access. Past orders and attendance will be retained.",
        { name: user.fullName }
      ),
      confirmLabel: t("actions.delete", "Delete"),
      tone: "danger",
    }))) return;
    try {
      await deleteUser(user.id).unwrap();
      toast.success(t("users.toast.deleted", "Account deleted"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("users.toast.delete_failed", "Could not delete the account.")));
    }
  };

  const handleSubmitStatus = async () => {
    if (!selected) return;
    try {
      await updateStatus({ id: selected.id, status: nextStatus }).unwrap();
      toast.success(
        t("users.toast.status_updated", "{name} is now {status}", {
          name: selected.fullName,
          status: enumLabel(t, "user_status", nextStatus),
        })
      );
      setStatusOpen(false);
      setSelected(null);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("users.toast.status_failed", "Could not update the account status.")));
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={title}
        breadcrumbs={[{ label: t("breadcrumb.home", "Home"), href: "/" }, { label: title }]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatTile title={t("users.stats.all", "All {title}", { title })} value={String(userPage?.totalElements ?? 0)} tone="gray" />
        <StatTile title={t("users.stats.active_page", "Active (this page)")} value={String(activeCount)} tone="green" />
      </div>

      <FilterPanel>
        <TextField
          label={t("users.filters.name_or_email", "Name or Email")}
          placeholder={t("users.filters.search_placeholder", "Search accounts")}
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />
        {role ? null : (
          <SelectField
            label={t("fields.role", "Role")}
            placeholder={t("users.filters.all_roles", "All roles")}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ADMIN">{enumLabel(t, "role", "ADMIN")}</option>
            <option value="BARISTA">{enumLabel(t, "role", "BARISTA")}</option>
            <option value="CUSTOMER">{enumLabel(t, "role", "CUSTOMER")}</option>
          </SelectField>
        )}
        <SelectField
          label={t("fields.status", "Status")}
          placeholder={t("users.filters.all_statuses", "All statuses")}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {USER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {enumLabel(t, "user_status", status)}
            </option>
          ))}
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setStatusFilter(""); setRoleFilter(role ?? ""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard title={title} meta={t("users.meta.total", "Total: {count}", { count: userPage?.totalElements ?? 0 })}>
        <SimpleTable headers={userTableHeaders}>
          <TableState
            colSpan={userTableHeaders.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleUsers.length === 0}
            emptyLabel={isFiltering ? t("users.empty.filtered", "No accounts match these filters.") : emptyLabel}
            onRetry={refetch}
          />
          {list.showRows &&
            visibleUsers.map((user, index) => (
              <Row key={user.id} striped={index % 2 === 1}>
                <Cell>{view.offset + index + 1}</Cell>
                <Cell>
                  <UserAvatar
                    src={user.avatarUrl}
                    name={user.fullName}
                    sizes="40px"
                    className="h-10 w-10 bg-(--placeholder-bg) text-sm font-semibold text-(--placeholder-ink-strong)"
                  />
                </Cell>
                <Cell className="font-semibold">{titleCase(user.fullName)}</Cell>
                <Cell>{user.email}</Cell>
                <Cell className="tabular-nums whitespace-nowrap">{formatPhone(user.phoneNumber) || "-"}</Cell>
                <Cell>{enumLabel(t, "role", user.role)}</Cell>
                <Cell>
                  <StatusBadge
                    label={user.telegramLinked ? t("users.telegram.linked", "Linked") : t("users.telegram.not_linked", "Not linked")}
                    tone={user.telegramLinked ? "success" : "neutral"}
                  />
                </Cell>
                <Cell>
                  <button type="button" aria-label={t("users.table.change_status_aria", "Change status for {name}", { name: user.fullName })} disabled={isUpdating || isDeleting}
                    onClick={() => { setSelected(user); setNextStatus(user.status); setStatusOpen(true); }}>
                    <StatusBadge label={enumLabel(t, "user_status", user.status)} tone={statusTone(user.status)} />
                  </button>
                </Cell>
                <Cell>
                  <RowActions
                    onView={() => {
                      setSelected(user);
                      setDetailOpen(true);
                    }}
                    onEdit={() => {
                      setSelected(user);
                      setFullName(user.fullName);
                      setPhoneNumber(formatPhoneInput(user.phoneNumber));
                      setGender(user.gender ?? "");
                      validation.reset();
                      setEditOpen(true);
                    }}
                    onDelete={user.status !== "DELETED" ? () => handleDelete(user) : undefined}
                    isLoading={isUpdating || isSavingProfile || isDeleting}
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

      <FormModal open={editOpen} onOpenChange={setEditOpen} title={t("users.form.edit_title", "Edit Account")} submitLabel={t("actions.save", "Save")} onSubmit={handleSaveProfile} isLoading={isSavingProfile}>
        <ModalGrid>
          <FormInput label={t("fields.full_name", "Full Name")} value={fullName} onChange={(event) => setFullName(event.target.value)} required error={validation.errors.fullName} />
          <FormPhoneInput value={phoneNumber} onChange={setPhoneNumber} error={validation.errors.phoneNumber} />
          <FormSelect label={t("users.fields.gender", "Gender")} value={gender} onChange={(event) => setGender(event.target.value as Gender | "")}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </FormSelect>
        </ModalGrid>
      </FormModal>

      <FormModal
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title={t("users.status_form.title", "Change Account Status")}
        submitLabel={t("actions.save", "Save")}
        onSubmit={handleSubmitStatus}
        isLoading={isUpdating}
      >
        <ModalGrid>
          <FormSelect
            label={t("users.status_form.status_for", "Status for {name}", { name: selected?.fullName ?? "" })}
            placeholder={t("users.status_form.placeholder", "Select status")}
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as UserStatus)}
            required
          >
            {USER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {enumLabel(t, "user_status", status)}
              </option>
            ))}
          </FormSelect>
        </ModalGrid>
      </FormModal>

      <DetailModal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
        title={t("users.detail.title", "Account Detail")}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            <div className="mb-4 flex items-center gap-4">
              <UserAvatar
                src={selected.avatarUrl}
                name={selected.fullName}
                sizes="64px"
                className="h-16 w-16 bg-(--placeholder-bg) text-xl font-semibold text-(--placeholder-ink-strong)"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{titleCase(selected.fullName)}</p>
                {selected.telegramUsername ? (
                  <p className="truncate text-sm text-gray-500">@{selected.telegramUsername}</p>
                ) : null}
              </div>
            </div>
            <DetailGrid>
              <DetailItem label={t("fields.full_name", "Full Name")}>{titleCase(selected.fullName)}</DetailItem>
              <DetailItem label={t("fields.email", "Email")}>{selected.email || "-"}</DetailItem>
              <DetailItem label={t("fields.phone_number", "Phone Number")}>{formatPhone(selected.phoneNumber) || "-"}</DetailItem>
              <DetailItem label={t("users.fields.gender", "Gender")}>
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
                {selected.telegramLinked ? t("users.telegram.linked", "Linked") : t("users.telegram.not_linked", "Not linked")}
                {selected.telegramLinked && selected.telegramUsername ? ` (@${selected.telegramUsername})` : ""}
              </DetailItem>
              <DetailItem label={t("fields.created_by", "Created By")}>
                {selected.createdByName
                  ? `${titleCase(selected.createdByName)} (${enumLabel(t, "role", selected.createdByRole)})`
                  : t("users.detail.self_registered", "Self-registered")}
              </DetailItem>
            </DetailGrid>
          </div>
        )}
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
