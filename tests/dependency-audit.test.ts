import { describe, expect, it } from "vitest";
import { checkAudit } from "../scripts/audit-dependencies.mjs";

const now = Date.parse("2026-11-17T00:00:00Z");
const node = "node_modules/picomatch";
const lock = { packages: { [node]: { dev: true }, "node_modules/vitest": { dev: true } } };
const finding = (url = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf") => ({ severity: "high", nodes: [node], via: [{ name: "picomatch", severity: "high", url }] });
const report = (item = finding()) => ({ auditReportVersion: 2, vulnerabilities: { picomatch: item } });
describe("temporary development dependency exception", () => {
  it("allows only the named advisory in development dependencies and its dependent findings", () => {
    const audit = { ...report(), vulnerabilities: { ...report().vulnerabilities, vitest: { severity: "high", nodes: ["node_modules/vitest"], via: ["picomatch"] } } };
    expect(checkAudit(audit, lock, now)).toEqual({ blocked: [], exceptions: ["picomatch", "vitest"] });
  });
  it("blocks the same advisory in production dependencies", () => {
    expect(checkAudit(report(), { packages: { [node]: {} } }, now).blocked).toEqual(["picomatch"]);
  });
  it("blocks unrelated advisories even in the same package", () => {
    expect(checkAudit(report(finding("https://github.com/advisories/OTHER")), lock, now).blocked).toEqual(["picomatch"]);
  });
  it("does not excuse critical or unexplained high findings", () => {
    expect(checkAudit(report({ ...finding(), severity: "critical" }), lock, now).blocked).toEqual(["picomatch"]);
    expect(checkAudit(report({ ...finding(), via: [{ name: "other", severity: "moderate", url: "other" }] }), lock, now).blocked).toEqual(["picomatch"]);
  });
  it("expires automatically and rejects unavailable reports", () => {
    expect(checkAudit(report(), lock, Date.parse("2026-12-01T00:00:00Z")).blocked).toEqual(["picomatch"]);
    expect(checkAudit({ error: { message: "Registry unavailable" } }, lock, now).blocked).not.toHaveLength(0);
  });
});
