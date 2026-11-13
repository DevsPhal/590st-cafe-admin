import { useGetCurrentUserQuery } from "./authApi";
import type { Role } from "./types";

export function useCurrentRole() {
  const { data: user, isLoading } = useGetCurrentUserQuery();
  const role: Role | undefined = user?.role;

  return {
    role,
    isLoading,
    isAdmin: role === "ADMIN" || role === "SUPER_ADMIN",
    isBarista: role === "BARISTA",
  };
}
