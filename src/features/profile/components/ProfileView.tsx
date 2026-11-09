"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Check,
  KeyRound,
  Loader2,
  Mail,
  Send,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";

import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { UserAvatar } from "@/components/common/UserAvatar";
import {
  AdminTopActions,
  DataCard,
  DetailGrid,
  DetailItem,
  ErrorState,
  FormInput,
  FormPhoneInput,
  FormSelect,
  SkeletonBlock,
  StatusBadge,
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useI18n } from "@/contexts/I18nContext";
import {
  useChangePasswordMutation,
  useGetCurrentUserQuery,
  useRemoveAvatarMutation,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from "@/store/api/authApi";
import { changePasswordSchema, profileSchema } from "@/lib/formSchemas";
import type { Gender, UpdateProfileRequest } from "@/store/api/types";
import { statusTone } from "@/features/user/components/UserManagementView";
import { titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { formatPhoneInput, samePhone } from "@/lib/phone";
import { useFormErrors } from "@/hooks/useFormErrors";
import { IMAGE_ACCEPT, imageFileProblem } from "@/lib/imageFile";
import { Button } from "@/components/common/Button";

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];


const EMPTY_PASSWORD_FORM = { current: "", next: "", confirm: "" };

export default function ProfileView() {
  const { t } = useI18n();
  const { data: user, isLoading, isFetching, error, refetch } = useGetCurrentUserQuery();

  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();
  const [uploadAvatar, { isLoading: isUploading }] = useUploadAvatarMutation();
  const [removeAvatar, { isLoading: isRemovingAvatar }] = useRemoveAvatarMutation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState<string>("");
  const [password, setPassword] = useState(EMPTY_PASSWORD_FORM);
  const profileValidation = useFormErrors(profileSchema, { fullName, phoneNumber });
  const passwordValidation = useFormErrors(changePasswordSchema, password);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [seededFrom, setSeededFrom] = useState<typeof user>(undefined);
  if (user && user !== seededFrom) {
    setSeededFrom(user);
    setFullName(user.fullName ?? "");
    setPhoneNumber(formatPhoneInput(user.phoneNumber));
    setGender(user.gender ?? "");
  }

  const isDirty =
    !!user &&
    (fullName !== (user.fullName ?? "") ||
      !samePhone(phoneNumber, user.phoneNumber) ||
      gender !== (user.gender ?? ""));

  const handleSaveProfile = async () => {
    if (!user) return;

    const parsed = profileValidation.validate();
    if (!parsed) return;

    const body: UpdateProfileRequest = {};
    if (parsed.fullName !== user.fullName) body.fullName = parsed.fullName;
    if (!samePhone(phoneNumber, user.phoneNumber)) body.phoneNumber = parsed.phoneNumber ?? "";
    if (gender && gender !== user.gender) body.gender = gender as Gender;

    if (Object.keys(body).length === 0) {
      toast(t("profile.toast.nothing_to_save", "Nothing to save."));
      return;
    }

    try {
      await updateProfile(body).unwrap();
      toast.success(t("profile.toast.profile_updated", "Profile updated"));
    } catch (err) {
      profileValidation.showServerError(err, t("profile.toast.profile_update_failed", "Could not update your profile."));
    }
  };

  const handleResetForm = () => {
    if (!user) return;
    setFullName(user.fullName ?? "");
    setPhoneNumber(formatPhoneInput(user.phoneNumber));
    setGender(user.gender ?? "");
    profileValidation.reset();
  };

  const handleChangePassword = async () => {
    if (!passwordValidation.validate()) return;

    try {
      await changePassword({
        currentPassword: password.current,
        newPassword: password.next,
      }).unwrap();
      setPassword(EMPTY_PASSWORD_FORM);
      toast.success(
        t(
          "profile.toast.password_changed",
          "Password changed. Other devices will need to sign in again."
        )
      );
    } catch (err) {
      passwordValidation.showServerError(err, t("profile.toast.password_change_failed", "Could not change your password."), {
        currentPassword: "current",
        newPassword: "next",
      });
    }
  };

  const handlePickAvatar = async (file: File | null) => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    const problem = imageFileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    try {
      await uploadAvatar(file).unwrap();
      toast.success(t("profile.toast.photo_updated", "Photo updated"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("profile.toast.photo_upload_failed", "Could not upload your photo.")));
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await removeAvatar().unwrap();
      toast.success(t("profile.toast.photo_removed", "Photo removed"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("profile.toast.photo_remove_failed", "Could not remove your photo.")));
    }
  };

  const header = (
    <PageHeader
      title={t("profile.title", "My Profile")}
      breadcrumbs={[
        { label: t("breadcrumb.home", "Home"), href: "/" },
        { label: t("profile.breadcrumb.profile", "Profile") },
      ]}
      rightSlot={<AdminTopActions />}
    />
  );

  if (isLoading) {
    return (
      <PageShell>
        {header}
        <ProfileSkeleton />
      </PageShell>
    );
  }

  if (error || !user) {
    return (
      <PageShell>
        {header}
        <ErrorState
          error={error}
          fallback={t("profile.errors.load", "Could not load your account.")}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      </PageShell>
    );
  }

  const avatarBusy = isUploading || isRemovingAvatar;

  return (
    <PageShell>
      {header}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-1">
          <DataCard
            title={t("profile.photo.title", "Photo")}
            meta={t("profile.photo.meta", "Shown beside your name across the dashboard.")}
          >
            <div className="flex flex-col items-center gap-4 p-2 pb-4">
              <UserAvatar
                src={user.avatarUrl}
                name={user.fullName}
                alt={user.fullName}
                sizes="112px"
                className="h-28 w-28 border border-gray-200 bg-gray-100 text-3xl font-semibold text-gray-400"
              >
                {avatarBusy ? (
                  <span className="absolute inset-0 grid place-items-center bg-white/70">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  </span>
                ) : null}
              </UserAvatar>

              <p className="text-center text-xs text-gray-400">
                {t("profile.photo.hint", "JPG or PNG, up to 5\u00a0MB.")}
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="sr-only"
                onChange={(e) => handlePickAvatar(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                 
                  variant="primary"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload />
                  {user.avatarUrl
                    ? t("profile.photo.replace", "Replace")
                    : t("profile.photo.upload", "Upload")}
                </Button>
                {user.avatarUrl ? (
                  <Button
                   
                    variant="outline"
                    disabled={avatarBusy}
                    onClick={handleRemoveAvatar}
                  >
                    <Trash2 />
                    {t("actions.remove", "Remove")}
                  </Button>
                ) : null}
              </div>
            </div>
          </DataCard>

          <DataCard
            title={t("profile.account.title", "Account")}
            meta={isSuperAdmin ? undefined : t("profile.account.meta", "Managed by a super admin.")}
          >
            <div className="admin_modal_form_wrap p-2">
              <DetailGrid>
                <DetailItem label={t("fields.role", "Role")}>{enumLabel(t, "role", user.role)}</DetailItem>
                <DetailItem label={t("fields.status", "Status")}>
                  <StatusBadge
                    label={enumLabel(t, "user_status", user.status)}
                    tone={statusTone(user.status)}
                  />
                </DetailItem>
                {!isSuperAdmin ? (
                  <DetailItem label="Telegram">
                    <span className="inline-flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 text-gray-400" />
                      {user.telegramLinked
                        ? t("profile.account.linked", "Linked")
                        : t("profile.account.not_linked", "Not linked")}
                    </span>
                  </DetailItem>
                ) : null}
                <DetailItem label={t("fields.created_by", "Created By")}>
                  {isSuperAdmin
                    ? t("profile.account.server_config", "Server configuration")
                    : user.createdByName
                      ? `${titleCase(user.createdByName)} (${enumLabel(t, "role", user.createdByRole)})`
                      : t("profile.account.self_registered", "Self-registered")}
                </DetailItem>
              </DetailGrid>
            </div>
          </DataCard>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <DataCard
            title={t("profile.personal.title", "Personal Information")}
            meta={t(
              "profile.personal.meta",
              "Your own details — you don't need a super admin to change these."
            )}
          >
            <div className="space-y-6 p-2">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormInput
                  label={t("fields.full_name", "Full Name")}
                  value={fullName}
                  error={profileValidation.errors.fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("profile.personal.name_placeholder", "Your name")}
                  required
                />
                <FormInput
                  label={t("fields.email", "Email")}
                  value={user.email}
                  readOnly
                  placeholder="—"
                />
                <FormPhoneInput value={phoneNumber} onChange={setPhoneNumber} error={profileValidation.errors.phoneNumber} />
                <FormSelect
                  label={t("profile.personal.gender", "Gender")}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder={t("profile.personal.gender_placeholder", "Not set")}
                >
                  {GENDERS.map((option) => (
                    <option key={option} value={option}>
                      {enumLabel(t, "gender", option)}
                    </option>
                  ))}
                </FormSelect>
              </div>

              <p className="flex items-start gap-2 text-xs text-gray-400">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {isSuperAdmin
                  ? t(
                      "profile.personal.super_admin_email_note",
                      "The super admin signs in with the email set in the server configuration, so it is changed there."
                    )
                  : t(
                      "profile.personal.email_note",
                      "Your email is your sign-in name and cannot be changed here — ask a super admin if it needs to move."
                    )}
              </p>

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-6">
                <Button
                 
                  variant="outline"
                  onClick={handleResetForm}
                  disabled={!isDirty || isSaving}
                >
                  {t("actions.reset", "Reset")}
                </Button>
                <Button
                 
                  variant="primary"
                  onClick={handleSaveProfile}
                  disabled={!isDirty || isSaving}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                  {isSaving ? t("states.saving", "Saving...") : t("actions.save_changes", "Save Changes")}
                </Button>
              </div>
            </div>
          </DataCard>

          <DataCard
            title={t("fields.password", "Password")}
            meta={
              isSuperAdmin
                ? undefined
                : t("profile.password.meta", "Changing it signs your other devices out.")
            }
          >
            {isSuperAdmin ? (
              <p className="flex items-start gap-2 p-2 pb-4 text-xs text-gray-400">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t(
                  "profile.password.super_admin_note",
                  "The super admin password is set in the server configuration and can't be changed from the dashboard."
                )}
              </p>
            ) : (
              <div className="space-y-6 p-2">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <FormInput
                    label={t("profile.password.current", "Current Password")}
                    type="password"
                    value={password.current}
                    error={passwordValidation.errors.current}
                    onChange={(e) =>
                      setPassword((prev) => ({ ...prev, current: e.target.value }))
                    }
                    placeholder="••••••••"
                    required
                  />
                  <div className="hidden md:block" aria-hidden />
                  <FormInput
                    label={t("profile.password.new", "New Password")}
                    type="password"
                    value={password.next}
                    error={passwordValidation.errors.next}
                    onChange={(e) => setPassword((prev) => ({ ...prev, next: e.target.value }))}
                    placeholder="••••••••"
                    required
                  />
                  <FormInput
                    label={t("profile.password.confirm", "Confirm New Password")}
                    type="password"
                    value={password.confirm}
                    error={passwordValidation.errors.confirm}
                    onChange={(e) =>
                      setPassword((prev) => ({ ...prev, confirm: e.target.value }))
                    }
                    placeholder="••••••••"
                    required
                  />
                </div>

                <p className="flex items-start gap-2 text-xs text-gray-400">
                  <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t(
                    "profile.password.hint",
                    "At least 8 characters, including an uppercase letter, a lowercase letter, a number and a symbol."
                  )}
                </p>

                <div className="flex justify-end border-t border-gray-100 pt-6">
                  <Button
                   
                    variant="primary"
                    onClick={handleChangePassword}
                    disabled={
                      isChangingPassword ||
                      !password.current ||
                      !password.next ||
                      !password.confirm
                    }
                  >
                    {isChangingPassword ? <Loader2 className="animate-spin" /> : <KeyRound />}
                    {isChangingPassword
                      ? t("profile.password.changing", "Changing...")
                      : t("profile.password.change", "Change Password")}
                  </Button>
                </div>
              </div>
            )}
          </DataCard>
        </section>
      </div>
    </PageShell>
  );
}

function ProfileSkeleton() {
  const { t } = useI18n();
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      role="status"
      aria-label={t("profile.loading_aria", "Loading your profile")}
    >
      <section className="space-y-6 lg:col-span-1">
        <DataCard title={t("profile.photo.title", "Photo")}>
          <div className="flex flex-col items-center gap-4 p-2 pb-4">
            <SkeletonBlock className="h-28 w-28 rounded-full" />
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="h-10 w-28" />
          </div>
        </DataCard>
        <DataCard title={t("profile.account.title", "Account")}>
          <div className="grid grid-cols-2 gap-5 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-5 w-24" />
              </div>
            ))}
          </div>
        </DataCard>
      </section>
      <section className="space-y-6 lg:col-span-2">
        {[
          t("profile.personal.title", "Personal Information"),
          t("fields.password", "Password"),
        ].map((title) => (
          <DataCard key={title} title={title}>
            <div className="grid grid-cols-1 gap-5 p-2 pb-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <SkeletonBlock className="h-3 w-24" />
                  <SkeletonBlock className="h-11 w-full" />
                </div>
              ))}
            </div>
          </DataCard>
        ))}
      </section>
    </div>
  );
}
