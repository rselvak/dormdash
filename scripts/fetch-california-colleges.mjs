// One-off generator for src/data/california-colleges.json.
//
// Source: U.S. Department of Education College Scorecard bulk downloads
// (public domain):
//   - Most-Recent-Cohorts-Institution_*.csv
//   - Most-Recent-Cohorts-Field-of-Study_*.csv
//
// Usage:
//   node scripts/fetch-california-colleges.mjs <institution.csv> <field-of-study.csv>
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const OUT = path.join(process.cwd(), "src", "data", "california-colleges.json");

// Scorecard credential levels: 1 = undergraduate certificate, 2 = associate's,
// 3 = bachelor's. Anything higher is graduate/professional study.
const UNDERGRAD_LEVELS = new Set(["1", "2", "3"]);

function parseCsvLine(line, maxFields = Infinity) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (inQuotes) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
      if (fields.length >= maxFields) return fields;
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields.slice(0, maxFields);
}

async function readLines(file, onLine) {
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  for await (const line of reader) {
    lineNumber += 1;
    await onLine(line, lineNumber);
  }
}

function cleanTitle(title) {
  return String(title || "")
    .trim()
    .replace(/\.$/, "")
    .replace(/\s+/g, " ");
}

async function loadInstitutions(file) {
  const institutions = new Map();
  let header = null;

  await readLines(file, async (line, lineNumber) => {
    const fields = parseCsvLine(line);

    if (lineNumber === 1) {
      header = fields.map((field) => field.trim());
      return;
    }

    const row = Object.fromEntries(
      header.map((name, index) => [name, fields[index] ?? ""]),
    );

    if (row.STABBR !== "CA") return;

    institutions.set(row.UNITID, {
      unitid: row.UNITID,
      name: row.INSTNM.trim(),
      city: row.CITY.trim(),
      predominant: Number(row.PREDDEG || 0),
    });
  });

  return institutions;
}

async function loadPrograms(file, institutions) {
  let header = null;
  let unitidIndex = -1;
  let cipIndex = -1;
  let titleIndex = -1;
  let levelIndex = -1;

  await readLines(file, async (line, lineNumber) => {
    if (lineNumber === 1) {
      header = parseCsvLine(line).map((field) => field.trim());
      unitidIndex = header.indexOf("UNITID");
      cipIndex = header.indexOf("CIPCODE");
      titleIndex = header.indexOf("CIPDESC");
      levelIndex = header.indexOf("CREDLEV");
      return;
    }

    const fields = parseCsvLine(line, Math.max(unitidIndex, cipIndex, titleIndex, levelIndex) + 1);
    const unitid = fields[unitidIndex];
    const institution = institutions.get(unitid);
    if (!institution) return;

    if (!UNDERGRAD_LEVELS.has(fields[levelIndex])) return;

    const code = String(fields[cipIndex] || "").trim().padStart(4, "0");
    const title = cleanTitle(fields[titleIndex]);
    if (!code || !title) return;

    if (!institution.majors) institution.majors = new Map();
    if (!institution.majors.has(code)) institution.majors.set(code, title);
  });
}

async function main() {
  const [institutionFile, programFile] = process.argv.slice(2);

  if (!institutionFile || !programFile) {
    console.error(
      "Usage: node scripts/fetch-california-colleges.mjs <institution.csv> <field-of-study.csv>",
    );
    process.exit(1);
  }

  console.log("Reading California institutions...");
  const institutions = await loadInstitutions(institutionFile);
  console.log(`  ${institutions.size} institutions`);

  console.log("Reading undergraduate programs...");
  await loadPrograms(programFile, institutions);

  const nameCounts = new Map();
  const eligible = [...institutions.values()].filter(
    (institution) => institution.name && institution.majors?.size > 0,
  );

  for (const institution of eligible) {
    nameCounts.set(
      institution.name,
      (nameCounts.get(institution.name) || 0) + 1,
    );
  }

  const colleges = eligible
    .map((institution) => ({
      name:
        nameCounts.get(institution.name) > 1 && institution.city
          ? `${institution.name} (${institution.city})`
          : institution.name,
      city: institution.city,
      majors: [...institution.majors.values()].sort((a, b) =>
        a.localeCompare(b),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const majorNames = [
    ...new Set(colleges.flatMap((college) => college.majors)),
  ].sort((a, b) => a.localeCompare(b));
  const majorIndex = new Map(
    majorNames.map((major, index) => [major, index]),
  );

  const payload = {
    source:
      "U.S. Department of Education, College Scorecard (undergraduate programs)",
    state: "CA",
    generatedAt: new Date().toISOString(),
    majors: majorNames,
    colleges: colleges.map((college) => ({
      name: college.name,
      city: college.city,
      majors: college.majors.map((major) => majorIndex.get(major)),
    })),
  };

  await fsp.mkdir(path.dirname(OUT), { recursive: true });
  await fsp.writeFile(OUT, JSON.stringify(payload), "utf8");

  const stats = await fsp.stat(OUT);
  console.log(
    `Wrote ${colleges.length} colleges, ${majorNames.length} unique majors, ${(
      stats.size / 1024
    ).toFixed(0)} KB to ${OUT}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
