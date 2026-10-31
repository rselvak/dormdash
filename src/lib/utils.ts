/**
 * Joins class names, dropping anything falsy.
 * Small local helper so the UI layer does not need an extra dependency.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Builds up-to-two-letter initials from a display name, falling back to the
 * first character of an email address.
 */
export function initials(name?: string | null, email?: string | null): string {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map((part) => part[0]);
    return letters.join("").toUpperCase();
  }

  const local = (email ?? "").split("@")[0]?.trim();
  return local ? local.slice(0, 2).toUpperCase() : "?";
}
