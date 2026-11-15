import { z } from "zod";

export const eventColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid event color.").nullable().optional();
const defaults: Record<string, string> = {
  COLLEGE_PICKUP: "#2563eb", COLLEGE_DROP_OFF: "#059669", CARPOOL: "#7c3aed",
  VANPOOL: "#ea580c", BUSPOOL: "#0891b2", PACKAGE_DELIVERY: "#d97706", ANNOUNCEMENT: "#db2777",
};

export function eventColorStyle(color: string | null | undefined, type: string) {
  const backgroundColor = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : defaults[type] ?? "#4f46e5";
  const rgb = [1, 3, 5].map(offset => {
    const value = parseInt(backgroundColor.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return { backgroundColor, color: luminance > 0.179 ? "#000000" : "#ffffff" };
}
