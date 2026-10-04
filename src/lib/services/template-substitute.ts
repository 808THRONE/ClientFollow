/**
 * Pure template variable substitution utility for cadence copy and scanner messages.
 * Client-safe with no server or network dependencies.
 */

export function substituteTemplateVariables(
  templateText: string,
  vars: Record<string, string | number | undefined> & {
    first_name?: string;
    service?: string;
    booking_link?: string;
  }
): string {
  const firstName = String(vars.first_name ?? "").trim() || "there";
  const service = String(vars.service ?? "").trim() || "our services";
  const bookingLink = String(vars.booking_link ?? "").trim();

  let result = templateText
    .replace(/\{\{(?:1|first_name|name)\}\}/gi, firstName)
    .replace(/\{\{(?:2|service)\}\}/gi, service)
    .replace(/\{\{(?:3|booking_link)\}\}/gi, bookingLink);

  for (const [key, val] of Object.entries(vars)) {
    if (val !== undefined && val !== null) {
      // Escape regex-special characters in the key so user-provided
      // variable names (e.g. "plan.2x") can't corrupt the pattern.
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, "gi"), String(val));
    }
  }

  return result;
}
