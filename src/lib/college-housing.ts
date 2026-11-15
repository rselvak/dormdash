import data from "@/data/college-housing.json";

export const HOUSING_REVIEWED_ON = data.reviewedOn;
export const HOUSING_CAMPUSES = data.campuses;
const byCollege = new Map(data.campuses.map(campus => [campus.college.toLowerCase(), campus]));

export function getCollegeHousing(college: string) {
  return byCollege.get(college.trim().toLowerCase());
}

export function getDormOptions(college: string): readonly string[] {
  return [...(getCollegeHousing(college)?.residences ?? [])].sort((a, b) => a.localeCompare(b));
}
