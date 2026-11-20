import { HOUSING_CAMPUSES } from "@/lib/college-housing";

// Use the institutional .edu domains of the curated official housing sources.
// Unknown colleges fail closed; a generic .edu address is not enough.
export function collegeEmailDomains(college: string) {
  const campus = HOUSING_CAMPUSES.find(item => item.college === college.trim());
  const domains = (campus?.sources ?? []).flatMap(source => {
    try {
      const host = new URL(source).hostname.toLowerCase();
      return host.endsWith(".edu") ? [host.split(".").slice(-2).join(".")] : [];
    } catch { return []; }
  });
  return [...new Set(domains)];
}

export function matchesCollegeEmail(email: string, college: string) {
  const domain = email.trim().toLowerCase().split("@")[1];
  return !!domain && collegeEmailDomains(college).some(allowed => domain === allowed || domain.endsWith("." + allowed));
}
