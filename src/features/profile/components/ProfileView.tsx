"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
import {
  useChangePasswordMutation,
  useGetCurrentUserQuery,
  useRemoveAvatarMutation,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from "@/store/api/authApi";
import type { Gender, UpdateProfileRequest } from "@/store/api/types";
import { humanise, statusTone } from "@/features/user/components/UserManagementView";
import { titleCase } from "@/lib/utils";
import { formatPhoneInput, isValidPhone, PHONE_INVALID_MESSAGE, samePhone } from "@/lib/phone";

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];

/** Matches the API's ValidationPatterns.STRONG_PASSWORD_REGEX so we fail fast in the browser. */
const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const EMPTY_PASSWORD_FORM = { current: "", next: "", confirm: "" };

/**
 * The signed-in account's own page: full detail plus the three things staff previously had no
 * way to do for themselves — edit their name/phone/gender, change their avatar, and change
 * their password. All of it goes through `/api/users/me`, which is open to any authenticated
 * account; `/api/admin/admins/{id}` is SUPER_ADMIN-only, so an admin or barista could not
 * maintain their own record before this existed.
 *
 * The super admin has no `User` row behind it — it signs in from SUPER_ADMIN_EMAIL /
 * SUPER_ADMIN_PASSWORD so the shop can never be locked out by a bad database. Its display
 * profile is still its own to maintain, and is stored separately; only the email and password
 * remain configuration, and only those two are disabled here.
 */
export default function ProfileView() {
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

  // The super admin signs in from configuration, so its email and password are the two things
  // that still cannot be changed here. Its name, phone, gender and avatar are persisted like
  // anyone else's and are editable.
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isPasswordConfigDriven = isSuperAdmin;

  // Re-seed the form from the server whenever the profile changes — including right after a
  // save, so the inputs show exactly what was persisted (a trimmed name, a cleared phone).
  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? "");
    setPhoneNumber(formatPhoneInput(user.phoneNumber));
    setGender(user.gender ?? "");
  }, [user]);

  const isDirty =
    !!user &&
    (fullName !== (user.fullName ?? "") ||
      !samePhone(phoneNumber, user.phoneNumber) ||
      gender !== (user.gender ?? ""));

  const handleSaveProfile = async () => {
    if (!user) return;

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      toast.error("Full name must be at least 2 characters");
      return;
    }

    // Send only what actually changed: the API treats null as "leave alone", and an untouched
    // phone number should not be re-validated against the Cambodian format on every save.
    const body: UpdateProfileRequest = {};
    if (trimmedName !== user.fullName) body.fullName = trimmedName;
    if (!samePhone(phoneNumber, user.phoneNumber)) {
      if (!isValidPhone(phoneNumber)) {
        toast.error(PHONE_INVALID_MESSAGE);
        return;
      }
      body.phoneNumber = phoneNumber.trim();
    }
    if (gender && gender !== user.gender) body.gender = gender as Gender;

    if (Object.keys(body).length === 0) {
      toast("Nothing to save");
      return;
    }

    try {
      await updateProfile(body).unwrap();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not update your profile."));
    }
  };

  const handleResetForm = () => {
    if (!user) return;
    setFullName(user.fullName ?? "");
    setPhoneNumber(formatPhoneInput(user.phoneNumber));
    setGender(user.gender ?? "");
  };

  const handleChangePassword = async () => {
    if (!password.current) {
      toast.error("Enter your current password");
      return;
    }
    if (password.next !== password.confirm) {
      toast.error("The new passwords do not match");
      return;
    }
    if (!STRONG_PASSWORD.test(password.next)) {
      toast.error(
        "New password needs at least 8 characters, with an uppercase, a lowercase, a number and a symbol."
      );
      return;
    }
    if (password.next === password.current) {
      toast.error("The new password must be different from the current one");
      return;
    }

    try {
      await changePassword({
        currentPassword: password.current,
        newPassword: password.next,
      }).unwrap();
      setPassword(EMPTY_PASSWORD_FORM);
      toast.success("Password changed. Other devices will need to sign in again.");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not change your password."));
    }
  };

  const handlePickAvatar = async (file: File | null) => {
    // Clear the input value so re-picking the same file still fires a change event.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be 5 MB or smaller");
      return;
    }

    try {
      await uploadAvatar(file).unwrap();
      toast.success("Photo updated");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not upload your photo."));
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await removeAvatar().unwrap();
      toast.success("Photo removed");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not remove your photo."));
    }
  };

  const header = (
    <PageHeader
      title="My Profile"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Profile" }]}
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
          fallback="Could not load your account."
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
          <DataCard title="Photo" meta="Shown beside your name across the dashboard.">
            <div className="flex flex-col items-center gap-4 p-2 pb-4">
              <div className="relative h-28 w-28 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.fullName}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-gray-400">
                    {user.fullName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                {avatarBusy ? (
                  <span className="absolute inset-0 grid place-items-center bg-white/70">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  </span>
                ) : null}
              </div>

              <p className="text-center text-xs text-gray-400">
                JPG or PNG, up to 5&nbsp;MB.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handlePickAvatar(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="btn_primary_black"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload />
                  {user.avatarUrl ? "Replace" : "Upload"}
                </button>
                {user.avatarUrl ? (
                  <button
                    type="button"
                    className="btn_outline_black"
                    disabled={avatarBusy}
                    onClick={handleRemoveAvatar}
                  >
                    <Trash2 />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </DataCard>

          <DataCard title="Account" meta={isSuperAdmin ? undefined : "Managed by a super admin."}>
            <div className="admin_modal_form_wrap p-2">
              <DetailGrid>
                <DetailItem label="Role">{humanise(user.role)}</DetailItem>
                <DetailItem label="Status">
                  <StatusBadge
                    label={humanise(user.status)}
                    tone={statusTone(user.status)}
                  />
                </DetailItem>
                {/* The super admin is a configuration account with no Telegram to link. */}
                {!isSuperAdmin ? (
                  <DetailItem label="Telegram">
                    <span className="inline-flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 text-gray-400" />
                      {user.telegramLinked ? "Linked" : "Not linked"}
                    </span>
                  </DetailItem>
                ) : null}
                <DetailItem label="Created By">
                  {user.createdByName
                    ? `${titleCase(user.createdByName)} (${humanise(user.createdByRole ?? "")})`
                    : "Self-registered"}
                </DetailItem>
              </DetailGrid>
            </div>
          </DataCard>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <DataCard
            title="Personal Information"
            meta="Your own details — you don't need a super admin to change these."
          >
            <div className="space-y-6 p-2">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormInput
                  label="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  required
                />
                <FormInput
                  label="Email"
                  value={user.email}
                  readOnly
                  placeholder="—"
                />
                <FormPhoneInput value={phoneNumber} onChange={setPhoneNumber} />
                <FormSelect
                  label="Gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="Not set"
                >
                  {GENDERS.map((option) => (
                    <option key={option} value={option}>
                      {humanise(option)}
                    </option>
                  ))}
                </FormSelect>
              </div>

              <p className="flex items-start gap-2 text-xs text-gray-400">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Your email is your sign-in name and cannot be changed here — ask a super admin if
                it needs to move.
              </p>

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-6">
                <button
                  type="button"
                  className="btn_outline_black"
                  onClick={handleResetForm}
                  disabled={!isDirty || isSaving}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="btn_primary_black"
                  onClick={handleSaveProfile}
                  disabled={!isDirty || isSaving}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </DataCard>

          <DataCard
            title="Password"
            meta="Changing it signs your other devices out."
          >
            <div className="space-y-6 p-2">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormInput
                  label="Current Password"
                  type="password"
                  value={password.current}
                  onChange={(e) =>
                    setPassword((prev) => ({ ...prev, current: e.target.value }))
                  }
                  placeholder="••••••••"
                  required
                  readOnly={isPasswordConfigDriven}
                />
                <div className="hidden md:block" aria-hidden />
                <FormInput
                  label="New Password"
                  type="password"
                  value={password.next}
                  onChange={(e) => setPassword((prev) => ({ ...prev, next: e.target.value }))}
                  placeholder="••••••••"
                  required
                  readOnly={isPasswordConfigDriven}
                />
                <FormInput
                  label="Confirm New Password"
                  type="password"
                  value={password.confirm}
                  onChange={(e) =>
                    setPassword((prev) => ({ ...prev, confirm: e.target.value }))
                  }
                  placeholder="••••••••"
                  required
                  readOnly={isPasswordConfigDriven}
                />
              </div>

              <p className="flex items-start gap-2 text-xs text-gray-400">
                <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                At least 8 characters, including an uppercase letter, a lowercase letter, a number
                and a symbol.
              </p>

              <div className="flex justify-end border-t border-gray-100 pt-6">
                <button
                  type="button"
                  className="btn_primary_black"
                  onClick={handleChangePassword}
                  disabled={
                    isPasswordConfigDriven ||
                    isChangingPassword ||
                    !password.current ||
                    !password.next ||
                    !password.confirm
                  }
                >
                  {isChangingPassword ? <Loader2 className="animate-spin" /> : <KeyRound />}
                  {isChangingPassword ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>
          </DataCard>
        </section>
      </div>
    </PageShell>
  );
}

/** Same grid as the loaded page, so nothing jumps when the profile arrives. */
function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" role="status" aria-label="Loading your profile">
      <section className="space-y-6 lg:col-span-1">
        <DataCard title="Photo">
          <div className="flex flex-col items-center gap-4 p-2 pb-4">
            <SkeletonBlock className="h-28 w-28 rounded-full" />
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="h-10 w-28" />
          </div>
        </DataCard>
        <DataCard title="Account">
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
        {["Personal Information", "Password"].map((title) => (
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
