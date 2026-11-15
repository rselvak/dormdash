import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COLLEGES } from "@/lib/colleges";
import { getCollegeHousing, getDormOptions, HOUSING_CAMPUSES } from "@/lib/college-housing";
import { DormSelect } from "@/components/dorm-select";

describe("college housing directory", () => {
  it("covers all requested UC/CSU campuses, Stanford, and USC using exact college keys", () => {
    const target = COLLEGES.filter(c => /^(University of California-|California State |California Polytechnic State University-)/.test(c.name)
      || ["San Diego State University", "San Francisco State University", "San Jose State University", "Sonoma State University", "Cal Poly Maritime Academy", "Stanford University", "University of Southern California"].includes(c.name));
    expect(target).toHaveLength(34);
    expect(new Set(HOUSING_CAMPUSES.map(c => c.college)).size).toBe(34);
    for (const college of target) expect(getDormOptions(college.name).length, college.name).toBeGreaterThan(0);
    for (const campus of HOUSING_CAMPUSES) expect(COLLEGES.some(c => c.name === campus.college)).toBe(true);
  });
  it("has source links and unique nonempty residence names within the form's length limit", () => {
    for (const campus of HOUSING_CAMPUSES) {
      expect(campus.sources.length).toBeGreaterThan(0);
      for (const source of campus.sources) expect(new URL(source).protocol).toBe("https:");
      expect(new Set(campus.residences).size).toBe(campus.residences.length);
      for (const residence of campus.residences) {
        expect(residence).toBe(residence.trim());
        expect(residence.length).toBeGreaterThan(0);
        expect(residence.length).toBeLessThanOrEqual(120);
      }
    }
  });
  it("isolates college lists and supports missing campuses without inventing names", () => {
    expect(getDormOptions("University of California-Santa Barbara")).toContain("San Nicolas Hall");
    expect(getDormOptions("Stanford University")).not.toContain("San Nicolas Hall");
    expect(getCollegeHousing("  STANFORD UNIVERSITY  ")?.college).toBe("Stanford University");
    expect(getDormOptions("College without a verified list")).toEqual([]);
  });
});

describe("dorm dropdown", () => {
  const render = (college: string, value = "") => renderToStaticMarkup(createElement(DormSelect, { college, value, onChange: () => {}, id: "dorm" }));
  it("shows college-specific options, a selected dorm, and a manual fallback", () => {
    const html = render("University of California-Santa Barbara", "San Nicolas Hall");
    expect(html).toContain('<select');
    expect(html).toContain('value="San Nicolas Hall" selected=""');
    expect(html).toContain("Other / not listed");
    expect(html).not.toContain("Branner Hall");
    expect(html).not.toContain('type="text"');
  });
  it("preserves a previously saved dorm that is absent from the directory", () => {
    const html = render("Stanford University", "My existing residence");
    expect(html).toContain('value="__other_dorm__" selected=""');
    expect(html).toContain('value="My existing residence"');
  });
  it("disables selection until a college is selected and explains missing lists", () => {
    expect(render("")).toContain('disabled=""');
    const missing = render("College without a verified list");
    expect(missing).not.toContain('disabled=""');
    expect(missing).toContain("not available yet");
    expect(missing).toContain("Other / not listed");
  });
});
