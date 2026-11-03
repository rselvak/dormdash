import collegeData from "@/data/california-colleges.json";

/**
 * California colleges and the undergraduate programs each one offers.
 *
 * Generated from the U.S. Department of Education's College Scorecard
 * (public domain) by `scripts/fetch-california-colleges.mjs`. The dataset is
 * bundled with the app so the registration form can search it instantly and
 * the server can validate submissions without a network call.
 */
export type College = {
  name: string;
  city: string;
  majors: string[];
};

export const COLLEGE_DATA_SOURCE = collegeData.source;

export const COLLEGES: readonly College[] = collegeData.colleges.map(
  (college) => ({
    name: college.name,
    city: college.city,
    majors: college.majors.map((index) => collegeData.majors[index]),
  }),
);

const collegesByName = new Map(COLLEGES.map((college) => [college.name, college]));

export const COLLEGE_OPTIONS = COLLEGES.map((college) => ({
  value: college.name,
  label: college.name,
  description: college.city,
}));

export function getCollege(name: string): College | undefined {
  return collegesByName.get(name.trim());
}

export function getCollegeMajors(name: string): readonly string[] {
  return getCollege(name)?.majors ?? [];
}

export function isKnownCollege(name: string): boolean {
  return collegesByName.has(name.trim());
}

export function isMajorOffered(collegeName: string, major: string): boolean {
  return getCollege(collegeName)?.majors.includes(major.trim()) ?? false;
}
