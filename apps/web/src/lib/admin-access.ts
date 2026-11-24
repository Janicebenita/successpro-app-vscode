import type { DecodedIdToken } from "firebase-admin/auth";
import { getSessionUser } from "./session";

export const ADMIN_ROLES = ["super_admin", "ops_admin", "support_admin", "finance_admin", "mentor_admin", "content_admin", "advertiser_admin", "auditor"] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

export function adminRolesFor(user: Pick<DecodedIdToken, "email" | "email_verified"> & Record<string, unknown>) {
  const roles = new Set<AdminRole>();
  const claimRoles = Array.isArray(user.adminRoles) ? user.adminRoles : typeof user.adminRole === "string" ? [user.adminRole] : [];
  for (const role of claimRoles) if ((ADMIN_ROLES as readonly string[]).includes(String(role))) roles.add(role as AdminRole);
  const bootstrapEmail = process.env.SUCCESSPRO_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (bootstrapEmail && user.email_verified === true && user.email?.toLowerCase() === bootstrapEmail) roles.add("super_admin");
  return [...roles];
}

export async function requireAdmin(allowed: readonly AdminRole[]) {
  const user = await getSessionUser();
  if (!user) return null;
  const roles = adminRolesFor(user);
  if (!roles.some((role) => role === "super_admin" || allowed.includes(role))) return null;
  return { user, roles };
}
