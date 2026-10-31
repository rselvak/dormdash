import { describe, expect, it } from "vitest";

import { cn, initials } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
});

describe("initials", () => {
  it("uses the first letters of the first two name parts", () => {
    expect(initials("Ada Lovelace", "ada@example.com")).toBe("AL");
  });

  it("falls back to the email local part", () => {
    expect(initials(null, "grace@example.com")).toBe("GR");
  });

  it("falls back to a placeholder when nothing is available", () => {
    expect(initials(undefined, undefined)).toBe("?");
  });
});
