import data from "@/data/college-housing.json";
import additionalData from "@/data/additional-colleges.json";

export const HOUSING_REVIEWED_ON = data.reviewedOn;
export const HOUSING_CAMPUSES = [...data.campuses, ...additionalData.colleges.map(college => ({college:college.name,sources:college.housingSources,residences:college.residences}))];
const byCollege = new Map(HOUSING_CAMPUSES.map(campus => [campus.college.toLowerCase(), campus]));

export function getCollegeHousing(college: string) {
  return byCollege.get(college.trim().toLowerCase());
}

export function getDormOptions(college: string): readonly string[] {
  return [...(getCollegeHousing(college)?.residences ?? [])].sort((a, b) => a.localeCompare(b));
}
