import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const advisory = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const expires = Date.parse("2026-12-01T00:00:00Z");
const severe = severity => severity === "high" || severity === "critical";

// Never waive a production dependency, a different advisory, or an unknown report.
export function checkAudit(report, lock, now = Date.now()) {
  if (report.error || !report.vulnerabilities || report.auditReportVersion !== 2) return { blocked: ["Audit report unavailable or unsupported"], exceptions: [] };
  const vulnerabilities = report.vulnerabilities;
  function covered(name, visiting = new Set()) {
    const item = vulnerabilities[name];
    if (!item || item.severity !== "high" || visiting.has(name) || now >= expires) return false;
    if (!item.nodes?.length || item.nodes.some(node => lock.packages?.[node]?.dev !== true)) return false;
    if (!item.via?.length) return false;
    if (!item.via.some(cause => typeof cause === "string" ? severe(vulnerabilities[cause]?.severity) : severe(cause.severity))) return false;
    const next = new Set([...visiting, name]);
    return item.via.every(cause => typeof cause === "string"
      ? vulnerabilities[cause] && (!severe(vulnerabilities[cause].severity) || covered(cause, next))
      : !severe(cause.severity) || (cause.severity === "high" && name === "picomatch" && cause.name === "picomatch" && cause.url === advisory));
  }
  const blocked = [], exceptions = [];
  for (const [name, item] of Object.entries(vulnerabilities)) {
    if (!severe(item.severity)) continue;
    if (covered(name)) exceptions.push(name);
    else blocked.push(name);
  }
  return { blocked, exceptions };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.npm_execpath) throw new Error("Run this check with npm run audit:ci");
  const audit = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json"], { encoding: "utf8" });
  if (audit.error || ![0, 1].includes(audit.status)) throw new Error("npm audit could not complete");
  const report = JSON.parse(audit.stdout);
  const result = checkAudit(report, JSON.parse(readFileSync("package-lock.json", "utf8")));
  if (result.exceptions.length) console.warn(`Temporary development-only exception through 2026-11-30: ${advisory}\nAffected development packages: ${result.exceptions.join(", ")}\nSee docs/dependency-audit-exception.md. The underlying vulnerability remains open.`);
  if (result.blocked.length) {
    console.error(`Blocking security findings: ${result.blocked.join(", ")}`);
    process.exitCode = 1;
  } else console.log("No unexcepted high/critical dependency findings; production dependencies have no exception.");
}
