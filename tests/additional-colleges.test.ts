import { describe, expect, it } from "vitest";
import data from "@/data/additional-colleges.json";
import { COLLEGE_OPTIONS, getCollege, getCollegeMajors, isRegistrationCollege } from "@/lib/colleges";
import { getDormOptions } from "@/lib/college-housing";
import { studentSchema } from "@/lib/validation/registration";

const requested = [
  "University of Illinois Urbana-Champaign", "University of Chicago", "Purdue University-Main Campus",
  "University of Washington-Seattle Campus", "New York University", "Georgia Institute of Technology-Main Campus",
  "Indiana University-Bloomington", "Massachusetts Institute of Technology", "Princeton University",
  "Harvard University", "Yale University", "University of Pennsylvania", "Duke University",
  "Johns Hopkins University", "Northwestern University", "Carnegie Mellon University", "Cornell University",
  "Brown University", "Rice University", "University of Michigan-Ann Arbor", "Rutgers University-New Brunswick",
];

describe("additional university support", () => {
  it("enables all 21 requested main campuses alongside the existing 34", () => {
    expect(data.colleges.map(college => college.name).sort()).toEqual([...requested].sort());
    expect(new Set(data.colleges.map(college => college.unitid)).size).toBe(21);
    expect(COLLEGE_OPTIONS).toHaveLength(55);
    for (const name of requested) {
      expect(isRegistrationCollege(name), name).toBe(true);
      expect(getCollegeMajors(name).length, name).toBeGreaterThan(0);
      expect(getDormOptions(name).length, name).toBeGreaterThan(0);
    }
  });
  it("provides program and housing provenance with valid dropdown values", () => {
    for (const college of data.colleges) {
      expect(college.housingSources.length).toBeGreaterThan(0);
      expect(college.housingReviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const url of college.housingSources) expect(new URL(url).hostname).toMatch(/\.edu$/);
      expect(new Set(college.majors).size).toBe(college.majors.length);
      for (const major of college.majors) {
        expect(major).toBe(major.trim());
        expect(major.length).toBeGreaterThan(0);
        expect(major.length).toBeLessThanOrEqual(120);
      }
      expect(studentSchema.safeParse({name:"Test Student",email:"test@example.com",college:college.name,major:college.majors[0],dorm:college.residences[0],year:1}).success,college.name).toBe(true);
    }
  });
  it("makes common abbreviations searchable without storing them as college keys", () => {
    for (const [alias, name] of [["UIUC","University of Illinois Urbana-Champaign"],["NYU","New York University"],["MIT","Massachusetts Institute of Technology"],["Georgia Tech","Georgia Institute of Technology-Main Campus"]]) {
      const option=COLLEGE_OPTIONS.find(option=>option.keywords.includes(alias));
      expect(option?.value).toBe(name);
      expect(getCollege(alias)).toBeUndefined();
    }
  });
  it("isolates campus residence lists and excludes known closed or future housing", () => {
    expect(getDormOptions("University of Illinois Urbana-Champaign")).toContain("Allen Hall");
    expect(getDormOptions("Massachusetts Institute of Technology")).toContain("Baker House");
    expect(getDormOptions("Massachusetts Institute of Technology")).not.toContain("McCormick Hall");
    expect(getDormOptions("University of Washington-Seattle Campus")).not.toContain("Haggett Hall");
    expect(getDormOptions("Stanford University")).not.toContain("Baker House");
    expect(getDormOptions("Rutgers University-New Brunswick")).toContain("Sojourner Truth Apartments");
  });
});
