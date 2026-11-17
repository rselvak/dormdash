import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), parent: vi.fn(), event: vi.fn(), update: vi.fn(), remove: vi.fn(), create: vi.fn(), participant: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => {
  const tx = { $queryRaw: vi.fn(), event: { findUnique: mocks.event, update: mocks.update, delete: mocks.remove }, eventParticipant: { findUnique: mocks.participant, create: mocks.create } };
  return { getPrisma: () => ({ ...tx, parent: { findUnique: mocks.parent }, $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) }) };
});
import { DELETE as deleteDraft, PATCH } from "@/app/api/events/[id]/route";
import { POST as cancel } from "@/app/api/events/[id]/cancel/route";
import { POST as join, DELETE as withdraw } from "@/app/api/events/[id]/join/route";
import { POST as create } from "@/app/api/events/route";

const context = () => ({ params: Promise.resolve({ id: "event" }) });
const request = (method: string, body?: unknown) => new Request("http://localhost/api/events/event", { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
const future = () => new Date(Date.now() + 86400000);
const past = () => new Date(Date.now() - 86400000);
const updateBody = () => ({ name: "Trip", college: "Stanford University", type: "CARPOOL", origin: "Home", destination: "Campus", status: "DRAFT", startsAt: future().toISOString(), dueAt: null, maxParticipants: 4 });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user" });
  mocks.parent.mockResolvedValue({ id: "owner", students: [{ id: "student", college: "Stanford University" }] });
});
describe("draft deletion permissions", () => {
  it("allows the creator to delete a future draft", async () => {
    mocks.event.mockResolvedValue({ parentId: "owner", status: "DRAFT", startsAt: future() });
    expect((await deleteDraft(request("DELETE"), context())).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: "event" } });
  });
  it.each([
    ["someone-else", "DRAFT", false, 403], ["owner", "PUBLISHED", false, 409], ["owner", "DRAFT", true, 409],
  ])("rejects deletion for %s / %s / past=%s", async (parentId, status, ended, code) => {
    mocks.event.mockResolvedValue({ parentId, status, startsAt: ended ? past() : future() });
    expect((await deleteDraft(request("DELETE"), context())).status).toBe(code);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await deleteDraft(request("DELETE"), context())).status).toBe(401);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
describe("past events are immutable", () => {
  beforeEach(() => mocks.event.mockResolvedValue({ parentId: "owner", status: "PUBLISHED", startsAt: past(), participants: [], collegeKey: "stanford university" }));
  it("rejects edits even when rescheduling into the future", async () => {
    expect((await PATCH(request("PATCH", updateBody()), context())).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects cancellation", async () => {
    expect((await cancel(request("POST", { reason: "Weather" }), context())).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects joining or withdrawing", async () => {
    expect((await join(request("POST", { studentId: "student" }), context())).status).toBe(409);
    expect((await withdraw(request("DELETE"), context())).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects new events scheduled in the past", async () => {
    const response = await create(request("POST", { ...updateBody(), startsAt: past().toISOString() }));
    expect(response.status).toBe(400);
  });
});
describe("bus stop participation", () => {
  it("rejects a stop that is not offered by the organizer", async () => {
    mocks.event.mockResolvedValue({ status: "PUBLISHED", type: "BUSPOOL", startsAt: future(), collegeKey: "stanford university", busStops: ["Campus", "Station"] });
    const response = await join(request("POST", { studentId: "student", selectedStop: "Other" }), context());
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("prevents removing a stop already selected by a participant", async () => {
    mocks.event.mockResolvedValue({ parentId: "owner", status: "PUBLISHED", startsAt: future(), participants: [{ selectedStop: "Campus", requestedServices: [], status: "ACCEPTED" }] });
    expect((await PATCH(request("PATCH", { ...updateBody(), type: "BUSPOOL", busStops: ["Station"] }), context())).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
