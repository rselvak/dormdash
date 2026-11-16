import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { collegeKey } from "@/lib/college";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: null as unknown }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ getPrisma: () => mocks.db }));
import { POST, DELETE } from "@/app/api/events/[id]/join/route";
import { PATCH, GET } from "@/app/api/events/[id]/route";
import { POST as createEvent } from "@/app/api/events/route";

// Opt in with an explicitly selected disposable/development database, never DATABASE_URL.
const url = process.env.DORMDASH_TEST_DATABASE_URL;
describe.skipIf(!url)("waiting list database flow", () => {
  let db: PrismaClient;
  const parents: { id: string; clerkUserId: string; students: { id:string }[] }[] = [];
  let eventId: string;
  const college = "Stanford University";
  const prefix = `waiting-list-test-${crypto.randomUUID()}`;
  const context = () => ({ params: Promise.resolve({ id: eventId }) });
  const request = (method: string, body?: unknown) => new Request("http://localhost/api/events", {
    method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const as = (index: number) => mocks.auth.mockResolvedValue({ userId: parents[index].clerkUserId });
  const join = async (index: number) => { as(index); return POST(request("POST", { studentId: parents[index].students[0].id }), context()); };
  const withdraw = async (index: number) => { as(index); return DELETE(request("DELETE"), context()); };
  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    mocks.db = db;
    for (let i = 0; i < 6; i++) parents.push(await db.parent.create({ data: {
      clerkUserId: `${prefix}-${i}`, name: "Waiting list test", email: `${prefix}-${i}@example.test`, phone: "5551234567",
      students: { create: { name: "Test student", email: `${prefix}-${i}@student.test`, college, major: "Test" } },
    },include:{students:{select:{id:true}}} }));
  });
  beforeEach(async () => {
    await db.event.deleteMany({ where: { parentId: { in: parents.map(p => p.id) } } });
    const event = await db.event.create({ data: {
      parentId: parents[0].id, name: prefix, college, collegeKey: collegeKey(college),
      startsAt: new Date(Date.now() + 86400000), type: "CARPOOL", status: "PUBLISHED",
      maxParticipants: 2, waitingListAllowed: true, maxWaitingList: 2,
      participants: { create: { parentId: parents[0].id } },
    } });
    eventId = event.id;
  });
  afterAll(async () => {
    if (db) {
      await db.parent.deleteMany({ where: { clerkUserId: { startsWith: prefix } } });
      await db.$disconnect();
    }
  });
  it("accepts to capacity, queues excess responses, enforces the limit and rejects duplicates", async () => {
    expect((await (await join(1)).json()).participationStatus).toBe("ACCEPTED");
    expect((await (await join(2)).json()).participationStatus).toBe("WAITLISTED");
    expect((await join(2)).status).toBe(409);
    expect((await (await join(3)).json()).participationStatus).toBe("WAITLISTED");
    expect((await join(4)).status).toBe(409);
    as(2);
    const detail = await (await GET(request("GET"), context())).json();
    expect(detail.event).toMatchObject({ participantCount: 2, waitingListCount: 2, participationStatus: "WAITLISTED" });
    expect(new Date(detail.event.joinedAt).getTime()).toBeGreaterThan(0);
  });
  it("requires a registered student for accepted and waiting-list responses", async () => {
    as(1);
    for (const studentId of [null, "", "not-my-student"]) {
      expect((await POST(request("POST", { studentId }), context())).status).toBe(400);
    }
    await join(1);
    as(2);
    expect((await POST(request("POST", { studentId: null }), context())).status).toBe(400);
    expect(await db.eventParticipant.count({where:{eventId}})).toBe(2);
  });
  it("keeps today's all-day events joinable until their end", async () => {
    await db.event.update({where:{id:eventId},data:{allDay:true,startsAt:new Date(Date.now()-3600000),endsAt:new Date(Date.now()+3600000)}});
    expect((await join(1)).status).toBe(201);
    await db.event.update({where:{id:eventId},data:{endsAt:new Date(Date.now()-1000)}});
    expect((await join(2)).status).toBe(409);
  });
  it("requires event type, college, and capacity when creating an event",async()=>{
    as(0);
    const valid={name:prefix,college,type:"CARPOOL",maxParticipants:2,startsAt:new Date(Date.now()+86400000).toISOString()};
    for(const key of ["college","type","maxParticipants"] as const){
      const body={...valid,[key]:undefined};
      expect((await createEvent(request("POST",body))).status).toBe(400);
    }
  });
  it("promotes the earliest response and preserves its timestamp", async () => {
    await join(1); await join(2); await join(3);
    await db.eventParticipant.update({ where: { eventId_parentId: { eventId, parentId: parents[2].id } }, data: { joinedAt: new Date("2026-01-01T00:00:00Z") } });
    const before = await db.eventParticipant.findUniqueOrThrow({ where: { eventId_parentId: { eventId, parentId: parents[2].id } } });
    expect((await withdraw(1)).status).toBe(200);
    const after = await db.eventParticipant.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.status).toBe("ACCEPTED");
    expect(after.joinedAt).toEqual(before.joinedAt);
    expect(await db.eventParticipant.count({ where: { eventId, status: "WAITLISTED" } })).toBe(1);
  });
  it("leaving the waiting list does not displace accepted users", async () => {
    await join(1); await join(2); await join(3);
    expect((await withdraw(2)).status).toBe(200);
    expect(await db.eventParticipant.count({ where: { eventId, status: "ACCEPTED" } })).toBe(2);
    expect(await db.eventParticipant.count({ where: { eventId, status: "WAITLISTED" } })).toBe(1);
  });
  it("serializes concurrent joins and withdrawals without overbooking", async () => {
    mocks.auth.mockReset();
    for (const p of parents.slice(1)) mocks.auth.mockResolvedValueOnce({ userId: p.clerkUserId });
    const responses = await Promise.all(parents.slice(1).map(p => POST(request("POST", { studentId: p.students[0].id }), context())));
    expect(responses.filter(r => r.status === 201)).toHaveLength(3);
    expect(await db.eventParticipant.count({ where: { eventId, status: "ACCEPTED" } })).toBe(2);
    expect(await db.eventParticipant.count({ where: { eventId, status: "WAITLISTED" } })).toBe(2);
    const accepted = await db.eventParticipant.findMany({ where: { eventId, status: "ACCEPTED" } });
    mocks.auth.mockReset();
    for (const p of accepted) mocks.auth.mockResolvedValueOnce({ userId: parents.find(parent => parent.id === p.parentId)!.clerkUserId });
    await Promise.all(accepted.map(() => DELETE(request("DELETE"), context())));
    expect(await db.eventParticipant.count({ where: { eventId, status: "ACCEPTED" } })).toBe(2);
    expect(await db.eventParticipant.count({ where: { eventId, status: "WAITLISTED" } })).toBe(0);
  });
  it("rejects full events with waiting lists disabled, and allows unlimited waiting lists", async () => {
    await join(1);
    await db.event.update({ where: { id: eventId }, data: { waitingListAllowed: false } });
    expect((await join(2)).status).toBe(409);
    await db.event.update({ where: { id: eventId }, data: { waitingListAllowed: true, maxWaitingList: null } });
    for (const index of [2, 3, 4, 5]) expect((await join(index)).status).toBe(201);
  });
  it("rejects expired deadlines and unauthorized withdrawals", async () => {
    await db.event.update({ where: { id: eventId }, data: { dueAt: new Date(Date.now() - 1000) } });
    expect((await join(1)).status).toBe(409);
    expect((await withdraw(1)).status).toBe(404);
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await DELETE(request("DELETE"), context())).status).toBe(401);
  });
  it("capacity increases promote waiting users and edits cannot remove existing waiting users", async () => {
    await join(1); await join(2); await join(3);
    const body = { name: prefix, college, startsAt: new Date(Date.now() + 86400000).toISOString(), dueAt: null, type: "CARPOOL", status: "PUBLISHED", maxParticipants: 2, waitingListAllowed: false };
    as(0);
    expect((await PATCH(request("PATCH", body), context())).status).toBe(409);
    expect((await PATCH(request("PATCH", { ...body, waitingListAllowed: true, maxWaitingList: 1 }), context())).status).toBe(409);
    expect((await PATCH(request("PATCH", { ...body, maxParticipants: 4 }), context())).status).toBe(200);
    expect(await db.eventParticipant.count({ where: { eventId, status: "ACCEPTED" } })).toBe(4);
  });
  it("creates an event with waiting list settings", async () => {
    as(0);
    const response = await createEvent(request("POST", { name: prefix, college, color: "#db2777", startsAt: new Date(Date.now() + 86400000).toISOString(), type: "CARPOOL", maxParticipants: 1, waitingListAllowed: true, maxWaitingList: 3 }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.event).toMatchObject({ waitingListAllowed: true, maxWaitingList: 3, color: "#db2777" });
    eventId = body.event.id;
    expect((await (await GET(request("GET"), context())).json()).event.color).toBe("#db2777");
    const update = { name: prefix, college, color: "#0891b2", startsAt: body.event.startsAt, dueAt: null, type: "CARPOOL", status: "PUBLISHED", maxParticipants: 1, waitingListAllowed: true, maxWaitingList: 3 };
    expect((await PATCH(request("PATCH", update), context())).status).toBe(200);
    expect((await (await GET(request("GET"), context())).json()).event.color).toBe("#0891b2");
  });
});
