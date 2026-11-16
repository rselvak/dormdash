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
import { POST as cancelEvent } from "@/app/api/events/[id]/cancel/route";
import { GET as notifications, PATCH as readNotification } from "@/app/api/notifications/route";
import { GET as listEvents } from "@/app/api/events/route";
import { GET as searchEvents } from "@/app/api/events/search/route";
import { GET as myEvents } from "@/app/api/my-events/route";

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
  it("separates organizing, accepted and waiting commitments and excludes unrelated events", async () => {
    await join(1);await join(2);
    const mine=(section:string)=>myEvents(new Request("http://localhost/api/my-events?section="+section));
    as(0);
    const organized=await (await mine("organizing")).json();
    expect(organized.counts).toEqual({organizing:1,accepted:0,waiting:0,past:0});
    expect(organized.events[0]).toMatchObject({id:eventId,isOwner:true});
    as(1);
    const accepted=await (await mine("accepted")).json();
    expect(accepted.counts).toEqual({organizing:0,accepted:1,waiting:0,past:0});
    expect(accepted.events[0]).toMatchObject({id:eventId,participationStatus:"ACCEPTED"});
    as(2);
    const waiting=await (await mine("waiting")).json();
    expect(waiting.counts).toEqual({organizing:0,accepted:0,waiting:1,past:0});
    expect(waiting.events[0]).toMatchObject({id:eventId,participationStatus:"WAITLISTED"});
    as(3);
    expect((await (await mine("organizing")).json()).counts).toEqual({organizing:0,accepted:0,waiting:0,past:0});
    expect((await mine("invalid")).status).toBe(400);
    expect((await myEvents(new Request("http://localhost/api/my-events?offset=-1"))).status).toBe(400);
  });
  it("paginates personal events without dropping older commitments", async () => {
    await db.event.createMany({data:Array.from({length:26},(_,i)=>({parentId:parents[0].id,name:`${prefix}-page-${i}`,college,collegeKey:collegeKey(college),startsAt:new Date(Date.now()+86400000*(i+2)),type:"CARPOOL" as const,status:"DRAFT" as const,maxParticipants:2}))});
    as(0);
    const first=await (await myEvents(new Request("http://localhost/api/my-events?section=organizing"))).json();
    expect(first.counts.organizing).toBe(27);
    expect(first.events).toHaveLength(25);
    expect(first.nextOffset).toBe(25);
    const second=await (await myEvents(new Request("http://localhost/api/my-events?section=organizing&offset=25"))).json();
    expect(second.events).toHaveLength(2);
    expect(second.nextOffset).toBeNull();
    expect(second.events.some((e:{id:string})=>first.events.some((f:{id:string})=>f.id===e.id))).toBe(false);
  });
  it("moves elapsed commitments to past while keeping an ongoing all-day event current", async () => {
    await join(1);
    await db.event.update({where:{id:eventId},data:{allDay:true,startsAt:new Date(Date.now()-3600000),endsAt:new Date(Date.now()+3600000)}});
    as(1);
    const mine=(section:string)=>myEvents(new Request("http://localhost/api/my-events?section="+section));
    expect((await (await mine("accepted")).json()).counts).toMatchObject({accepted:1,past:0});
    await db.event.update({where:{id:eventId},data:{endsAt:new Date(Date.now()-1000)}});
    const past=await (await mine("past")).json();
    expect(past.counts).toMatchObject({accepted:0,past:1});
    expect(past.events[0].id).toBe(eventId);
    as(0);
    expect((await (await mine("past")).json()).counts).toMatchObject({organizing:0,past:1});
  });
  it("retains cancelled commitments and access after college changes but hides private drafts", async () => {
    await join(1);
    as(0);await cancelEvent(request("POST",{reason:"Weather"}),context());
    as(1);
    const mine=()=>myEvents(new Request("http://localhost/api/my-events?section=accepted"));
    expect((await (await mine()).json()).events[0]).toMatchObject({id:eventId,status:"CANCELLED"});
    const student=parents[1].students[0].id;
    await db.student.update({where:{id:student},data:{college:"Another college"}});
    try {
      expect((await GET(request("GET"),context())).status).toBe(200);
      await db.event.update({where:{id:eventId},data:{status:"PUBLISHED",cancellationReason:null,cancelledAt:null}});
      expect((await GET(request("GET"),context())).status).toBe(200);
      await db.event.update({where:{id:eventId},data:{status:"DRAFT"}});
      expect((await GET(request("GET"),context())).status).toBe(404);
      expect((await (await mine()).json()).events).toEqual([]);
    } finally {await db.student.update({where:{id:student},data:{college}});}
  });
  it("cancels with a reason, notifies accepted and waitlisted parents once, and retains participation", async () => {
    await join(1);await join(2);
    as(0);
    expect((await cancelEvent(request("POST",{reason:"Driver is unavailable"}),context())).status).toBe(200);
    const event=await db.event.findUniqueOrThrow({where:{id:eventId},include:{participants:true,notifications:true}});
    expect(event).toMatchObject({status:"CANCELLED",cancellationReason:"Driver is unavailable"});
    expect(event.cancelledAt).toBeInstanceOf(Date);
    expect(event.participants).toHaveLength(3);
    expect(event.notifications.map(n=>n.parentId).sort()).toEqual([parents[1].id,parents[2].id].sort());
    expect((await cancelEvent(request("POST",{reason:"Second attempt"}),context())).status).toBe(200);
    expect(await db.eventNotification.count({where:{eventId}})).toBe(2);
    expect((await db.event.findUniqueOrThrow({where:{id:eventId}})).cancellationReason).toBe("Driver is unavailable");
    expect((await join(3)).status).toBe(409);
    expect((await withdraw(1)).status).toBe(409);
    expect(await db.eventParticipant.count({where:{eventId}})).toBe(3);
    as(1);
    const detail=await (await GET(request("GET"),context())).json();
    expect(detail.event).toMatchObject({status:"CANCELLED",cancellationReason:"Driver is unavailable"});
    const inbox=await (await notifications()).json();
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.notifications[0].event).toMatchObject({id:eventId,cancellationReason:"Driver is unavailable"});
    const noticeId=inbox.notifications[0].id;
    as(3);
    expect((await (await readNotification(request("PATCH",{id:noticeId}))).json()).updated).toBe(0);
    expect((await (await notifications()).json()).notifications).toEqual([]);
    as(1);
    expect((await readNotification(request("PATCH",{id:noticeId}))).status).toBe(200);
    expect((await (await notifications()).json()).unreadCount).toBe(0);
  });
  it("requires the organizer and a nonempty reason, and rejects cancelling a draft", async () => {
    as(1);
    expect((await cancelEvent(request("POST",{reason:"Not mine"}),context())).status).toBe(403);
    as(0);
    for(const reason of ["", "   ", "x".repeat(2001)]) expect((await cancelEvent(request("POST",{reason}),context())).status).toBe(400);
    await db.event.update({where:{id:eventId},data:{status:"DRAFT"}});
    expect((await cancelEvent(request("POST",{reason:"Private"}),context())).status).toBe(409);
    expect(await db.eventNotification.count({where:{eventId}})).toBe(0);
  });
  it("keeps cancelled events in calendar and search, and prevents reopening", async () => {
    as(0);
    await cancelEvent(request("POST",{reason:"Weather"}),context());
    const body=await (await listEvents(new Request("http://localhost/api/events?published=upcoming"))).json();
    expect(body.events.find((e:{id:string})=>e.id===eventId)?.status).toBe("CANCELLED");
    const results=await (await searchEvents(new Request("http://localhost/api/events/search?college="+encodeURIComponent(college)))).json();
    expect(results.events.find((e:{id:string})=>e.id===eventId)).toMatchObject({status:"CANCELLED",cancellationReason:"Weather"});
    const event=await db.event.findUniqueOrThrow({where:{id:eventId}});
    expect((await PATCH(request("PATCH",{name:event.name,college,type:event.type,services:[],status:"PUBLISHED",startsAt:event.startsAt.toISOString(),dueAt:null,maxParticipants:2,waitingListAllowed:true,maxWaitingList:2}),context())).status).toBe(409);
    expect((await db.event.findUniqueOrThrow({where:{id:eventId}})).status).toBe("CANCELLED");
  });
  it("serializes cancellation with concurrent joins and notifies every successful join", async () => {
    // Auth is captured before the first database call, so simultaneous requests keep their own identity.
    as(1);const joining=POST(request("POST",{studentId:parents[1].students[0].id}),context());
    await Promise.resolve();
    as(0);const cancelling=cancelEvent(request("POST",{reason:"Schedule changed"}),context());
    const [joined,cancelled]=await Promise.all([joining,cancelling]);
    expect(cancelled.status).toBe(200);
    expect([201,409]).toContain(joined.status);
    const participant=await db.eventParticipant.findUnique({where:{eventId_parentId:{eventId,parentId:parents[1].id}}});
    expect(await db.eventNotification.count({where:{eventId,parentId:parents[1].id}})).toBe(participant?1:0);
    expect((await db.event.findUniqueOrThrow({where:{id:eventId}})).status).toBe("CANCELLED");
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
    const event=await db.event.findUniqueOrThrow({where:{id:eventId}});
    const dueAt=new Date(Date.now()+1800000).toISOString();
    as(0);
    expect((await PATCH(request("PATCH",{name:prefix,college,type:"CARPOOL",status:"PUBLISHED",maxParticipants:2,waitingListAllowed:true,maxWaitingList:2,allDay:true,startsAt:event.startsAt.toISOString(),endsAt:event.endsAt!.toISOString(),dueAt}),context())).status).toBe(200);
    expect((await (await GET(request("GET"),context())).json()).event.dueAt).toBe(dueAt);
    expect((await join(1)).status).toBe(201);
    await db.event.update({where:{id:eventId},data:{dueAt:new Date(Date.now()-1000)}});
    expect((await join(2)).status).toBe(409);
    await db.event.update({where:{id:eventId},data:{dueAt:null}});
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
  it("stores offered and requested trip services for accepted and waiting participants",async()=>{
    await db.event.update({where:{id:eventId},data:{type:"COLLEGE_PICKUP",services:["PACKAGE_DELIVERY","PASSENGER_TRANSPORT"]}});
    const choices=[["PACKAGE_DELIVERY"],["PASSENGER_TRANSPORT"],["PACKAGE_DELIVERY","PASSENGER_TRANSPORT"]];
    for(let i=0;i<choices.length;i++){
      as(i+1);
      const response=await POST(request("POST",{studentId:parents[i+1].students[0].id,requestedServices:choices[i]}),context());
      expect(response.status).toBe(201);
      expect((await response.json()).participationStatus).toBe(i===0?"ACCEPTED":"WAITLISTED");
      const row=await db.eventParticipant.findUniqueOrThrow({where:{eventId_parentId:{eventId,parentId:parents[i+1].id}}});
      expect(row.requestedServices).toEqual(choices[i]);
    }
    as(0);
    const response=await PATCH(request("PATCH",{name:prefix,college,type:"COLLEGE_PICKUP",services:["PASSENGER_TRANSPORT"],startsAt:new Date(Date.now()+86400000).toISOString(),dueAt:null,status:"PUBLISHED",maxParticipants:2,waitingListAllowed:true,maxWaitingList:2}),context());
    expect(response.status).toBe(409);
  });
  it("rejects missing or unavailable service requests",async()=>{
    await db.event.update({where:{id:eventId},data:{type:"COLLEGE_PICKUP",services:["PACKAGE_DELIVERY"]}});
    as(1);
    for(const requestedServices of [[],["PASSENGER_TRANSPORT"]])expect((await POST(request("POST",{studentId:parents[1].students[0].id,requestedServices}),context())).status).toBe(400);
  });
  it("enforces response deadlines for every event type, including waiting-list requests",async()=>{
    as(1);
    for(const type of ["COLLEGE_PICKUP","COLLEGE_DROP_OFF","CARPOOL","VANPOOL","BUSPOOL","PACKAGE_DELIVERY","ANNOUNCEMENT"] as const){
      for(const maxParticipants of [1,2]){
        await db.event.update({where:{id:eventId},data:{type,maxParticipants,dueAt:new Date(Date.now()-1000),services:type==="COLLEGE_PICKUP"?["PASSENGER_TRANSPORT"]:[]}});
        const response=await POST(request("POST",{studentId:parents[1].students[0].id,requestedServices:type==="COLLEGE_PICKUP"?["PASSENGER_TRANSPORT"]:[]}),context());
        expect(response.status,`${type}, capacity ${maxParticipants}`).toBe(409);
      }
    }
    expect(await db.eventParticipant.count({where:{eventId}})).toBe(1);
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
    const response = await createEvent(request("POST", { name: prefix, college, instructions: "Meet at the main gate.\nBring labelled packages.", color: "#db2777", startsAt: new Date(Date.now() + 86400000).toISOString(), type: "CARPOOL", maxParticipants: 1, waitingListAllowed: true, maxWaitingList: 3 }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.event).toMatchObject({ waitingListAllowed: true, maxWaitingList: 3, color: "#db2777", instructions: "Meet at the main gate.\nBring labelled packages." });
    eventId = body.event.id;
    expect((await (await GET(request("GET"), context())).json()).event.color).toBe("#db2777");
    const update = { name: prefix, college, instructions: "Meet at the north gate.", color: "#0891b2", startsAt: body.event.startsAt, dueAt: null, type: "CARPOOL", status: "PUBLISHED", maxParticipants: 1, waitingListAllowed: true, maxWaitingList: 3 };
    expect((await PATCH(request("PATCH", update), context())).status).toBe(200);
    const updated=(await (await GET(request("GET"), context())).json()).event;
    expect(updated.color).toBe("#0891b2");
    expect(updated.instructions).toBe("Meet at the north gate.");
  });
});
