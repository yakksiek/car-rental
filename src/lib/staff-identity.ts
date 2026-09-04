// others
import { translator, type Locale } from "./i18n/types";
import { staff } from "./i18n/staff";
import type { AppRole } from "../types";

// Derives the staff display identity (avatar initials, name, role label) used by
// the shared shell's account chip (L2) and the dashboard hero. Kept I/O-free and
// in one place so the chip and hero never drift. We have no profile name field
// yet (S-08), so the name is humanised from the email local-part.
//
// Only the ROLE LABEL is copy — the initials and the humanised name are derived
// from the address and are the same in every locale. `displayName` falls back to
// the role word when the address has no usable local part, which is why the
// fallback localizes too.

export interface StaffIdentity {
  initials: string;
  displayName: string;
  roleLabel: string;
}

export function roleLabel(role: AppRole | null, locale: Locale): string {
  const t = translator(locale, staff);
  return role === "admin" ? t("roleAdmin") : t("roleEmployee");
}

export function staffIdentity(email: string | null | undefined, role: AppRole | null, locale: Locale): StaffIdentity {
  const local = (email ?? "").split("@")[0] ?? "";
  const parts = local.split(/[.\-_]+/).filter(Boolean);

  const initials =
    parts.length > 0
      ? parts
          .slice(0, 2)
          .map((p) => p[0].toUpperCase())
          .join("")
      : (email?.[0]?.toUpperCase() ?? "?");

  const displayName =
    parts.length > 0
      ? parts.map((p) => p[0].toUpperCase() + p.slice(1)).join(" ")
      : translator(locale, staff)("roleEmployee");

  return { initials, displayName, roleLabel: roleLabel(role, locale) };
}
