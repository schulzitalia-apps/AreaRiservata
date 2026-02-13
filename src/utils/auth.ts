import { RootState } from "@/components/Store";
import { AppRole } from "@/types/roles";

export function getUserGrade(state: RootState): AppRole | "disconnesso" {
  const s = state.session;
  if (s.status !== "authenticated" || !s.user?.role) return "disconnesso";
  return s.user.role;
}

export function hasRole(state: RootState, roles: AppRole[]) {
  const r = getUserGrade(state);
  return r !== "disconnesso" && roles.includes(r);
}


