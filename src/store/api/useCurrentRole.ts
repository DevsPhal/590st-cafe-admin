import { useGetCurrentUserQuery } from "./authApi";
import type { Role } from "./types";

/// A simple hook to get the current user's role and whether they are an admin or barista. It uses the `useGetCurrentUserQuery` hook from the authApi slice, which fetches the current user's data from the API. The hook returns the role, isLoading, isAdmin, and isBarista flags.
export function useCurrentRole() {
  const { data: user, isLoading } = useGetCurrentUserQuery();
  const role: Role | undefined = user?.role;

  return {
    role,
    isLoading,
    /** Super admin inherits every ADMIN authority, so it counts as an admin here. */
    isAdmin: role === "ADMIN" || role === "SUPER_ADMIN",
    isBarista: role === "BARISTA",
  };
}
