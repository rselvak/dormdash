import { describe, expect, it } from "vitest";
import { eventColorSchema, eventColorStyle } from "@/lib/event-color";

describe("event colors", () => {
  it.each(["red", "#fff", "#12345678", "url(test)", "#xyzxyz"])("rejects invalid color %s", color => {
    expect(eventColorSchema.safeParse(color).success).toBe(false);
  });
  it("accepts RGB hex colors and optional colors for existing clients", () => {
    expect(eventColorSchema.parse("#aBc123")).toBe("#aBc123");
    expect(eventColorSchema.safeParse(null).success).toBe(true);
    expect(eventColorSchema.safeParse(undefined).success).toBe(true);
  });
  it("keeps event text readable on dark and light custom colors", () => {
    expect(eventColorStyle("#000000", "CARPOOL").color).toBe("#ffffff");
    expect(eventColorStyle("#ffffff", "CARPOOL").color).toBe("#000000");
    expect(eventColorStyle("#ff0000", "CARPOOL").color).toBe("#000000");
  });
  it("uses type colors for old events without a saved color", () => {
    expect(eventColorStyle(null, "COLLEGE_PICKUP").backgroundColor).toBe("#2563eb");
    expect(eventColorStyle(null, "ANNOUNCEMENT").backgroundColor).toBe("#db2777");
    expect(eventColorStyle("invalid", "CARPOOL").backgroundColor).toBe("#7c3aed");
  });
});
