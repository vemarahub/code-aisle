/**
 * PermissionValidator — checks whether a customer is allowed to perform an
 * action on a resource.
 *
 * This is where we validate customer permissions and enforce role-based
 * access control (RBAC) across the platform.
 */
export type Role = "customer" | "support" | "admin";

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  customer: ["order:read", "order:create", "profile:read", "profile:update"],
  support: ["order:read", "profile:read", "ticket:manage"],
  admin: ["*"],
};

export class PermissionValidator {
  /** Return true if the given role may perform the requested permission. */
  canPerform(role: Role, permission: string): boolean {
    const granted = ROLE_PERMISSIONS[role] ?? [];
    return granted.includes("*") || granted.includes(permission);
  }

  /** Throw if the role is not allowed to perform the permission. */
  assertPermission(role: Role, permission: string): void {
    if (!this.canPerform(role, permission)) {
      throw new Error(
        `Role "${role}" is not permitted to perform "${permission}"`,
      );
    }
  }
}
