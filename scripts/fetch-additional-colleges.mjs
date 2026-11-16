// Refresh undergraduate program categories without changing curated housing data.
// Source: U.S. Department of Education College Scorecard (public domain).
// Usage: SCORECARD_API_KEY=... node scripts/fetch-additional-colleges.mjs
// With no key supplied, the public DEMO_KEY is used (subject to lower rate limits).
import fs from "node:fs/promises";

const file = new URL("../src/data/additional-colleges.json", import.meta.url);
const data = JSON.parse(await fs.readFile(file, "utf8"));
const url = new URL("https://api.data.gov/ed/collegescorecard/v1/schools.json");
url.search = new URLSearchParams({
  api_key: process.env.SCORECARD_API_KEY || "DEMO_KEY",
  id: data.colleges.map(college => college.unitid).join(","),
  fields: "id,school.name,school.city,latest.programs.cip_4_digit",
  per_page: "100",
});
const response = await fetch(url);
if (!response.ok) throw new Error(`Scorecard request failed (HTTP ${response.status}).`);
const payload = await response.json();
const updated = data.colleges.map(college => {
  const row = payload.results.find(row => row.id === college.unitid);
  if (!row || row["school.name"] !== college.name) throw new Error(`Campus identity changed for ${college.name}; review before updating.`);
  const majors = [...new Set(row["latest.programs.cip_4_digit"]
    .filter(program => [1, 2, 3].includes(program.credential.level))
    .map(program => program.title.trim().replace(/\.$/, "").replace(/\s+/g, " ")))].sort((a, b) => a.localeCompare(b));
  if (!majors.length || majors.some(major => !major || major.length > 120)) throw new Error(`Review program names for ${college.name}.`);
  return { ...college, city: row["school.city"], majors };
});
await fs.writeFile(file, JSON.stringify({ ...data, programsRetrievedOn: new Date().toISOString().slice(0, 10), colleges: updated }, null, 2) + "\n");
console.log(`Updated programs for ${updated.length} universities. Housing lists were preserved.`);
