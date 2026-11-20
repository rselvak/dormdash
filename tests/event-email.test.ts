import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { offerCutoff, offerDeadline, OFFER_WINDOW_MS } from "@/lib/spot-offer-policy";

const mocks = vi.hoisted(() => ({ db: { eventEmail: { findMany: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() }, eventParticipant: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn(), update: vi.fn() }, event: { findUnique: vi.fn() }, $queryRaw: vi.fn(), $transaction: vi.fn() } }));
vi.mock("@/lib/db", () => ({ getPrisma: () => mocks.db }));
vi.mock("@/lib/email-app-url", () => ({ emailAppUrl: () => "https://app.example.test" }));
import { dispatchEventEmails, eventEmailContent } from "@/lib/event-email";

const event = () => ({ id: "event-1", name: "Campus <trip>", status: "PUBLISHED", timeZone: "America/Los_Angeles", startsAt: new Date(Date.now()+3*86400000), endsAt: null, dueAt: null, allDay: false, cancellationReason: "Rain & <unsafe roads>" });
describe("event email and offer policy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("BREVO_API_KEY", "unit-test-key"); vi.stubEnv("BREVO_SENDER_EMAIL", "test@example.test");
    mocks.db.eventEmail.findMany.mockResolvedValue([{id:"550e8400-e29b-41d4-a716-446655440000"}]);
    mocks.db.eventEmail.updateMany.mockResolvedValue({count:1});
    mocks.db.eventEmail.findUniqueOrThrow.mockResolvedValue({id:"550e8400-e29b-41d4-a716-446655440000",eventId:"event-1",kind:"SPOT_OFFERED",participantId:"participant",offerVersion:2,attempts:1,parent:{email:"parent@example.test"},event:event()});
    mocks.db.eventParticipant.findUnique.mockResolvedValue({id:"participant",status:"OFFERED",offerVersion:2,offerCreatedAt:new Date(),offerExpiresAt:null});
    mocks.db.eventParticipant.count.mockResolvedValue(1);
    mocks.db.event.findUnique.mockResolvedValue(event());
    mocks.db.$transaction.mockImplementation(async (callback: (db: typeof mocks.db)=>unknown) => callback(mocks.db));
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("{}",{status:201})));
  });
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
  it("gives 12 hours, capped by the joining deadline or event start",()=>{
    const sent=new Date("2030-01-01T00:00:00Z"), e={...event(),startsAt:new Date("2030-01-03T00:00:00Z")};
    expect(offerDeadline(e,sent).getTime()-sent.getTime()).toBe(OFFER_WINDOW_MS);
    expect(offerDeadline({...e,dueAt:new Date("2030-01-01T02:00:00Z")},sent).toISOString()).toBe("2030-01-01T02:00:00.000Z");
    expect(offerCutoff({...e,allDay:true,endsAt:new Date("2030-01-04T00:00:00Z")})).toEqual(new Date("2030-01-04T00:00:00Z"));
  });
  it.each([[24,6,4],[6,12,0.5],[72,2,12],[1,0,1]])("allocates %s hours remaining across %s parents as %s hours",(hours,parents,expected)=>{
    const now=new Date("2030-01-01T00:00:00Z");
    const e={...event(),startsAt:new Date(now.getTime()+hours*3600000)};
    expect(offerDeadline(e,now,parents).getTime()-now.getTime()).toBe(expected*3600000);
  });
  it("uses the earlier closing deadline and never extends beyond a closed event",()=>{
    const now=new Date("2030-01-01T00:00:00Z");
    expect(offerDeadline({...event(),startsAt:new Date(now.getTime()+24*3600000),dueAt:new Date(now.getTime()+6*3600000)},now,12).getTime()-now.getTime()).toBe(30*60000);
    expect(offerDeadline({...event(),dueAt:new Date(now.getTime()-1000)},now,12)).toEqual(now);
  });
  it("escapes cancellation reasons and gives explicit signed-in offer links",()=>{
    const cancelled=eventEmailContent("CANCELLED",event(),"https://app.example.test");
    expect(cancelled.htmlContent).toContain("Rain &amp; &lt;unsafe roads&gt;");
    expect(cancelled.textContent).toContain("Reason: Rain & <unsafe roads>");
    const offered=eventEmailContent("SPOT_OFFERED",event(),"https://app.example.test",2,"participant");
    expect(offered.textContent).toContain("/offers/event-1?version=2&participant=participant&intent=accept");
    expect(offered.textContent).toContain("intent=decline");
    expect(offered.textContent).toContain("Opening a link does not accept or decline");
  });
  it("sends privately, uses provider idempotency and freezes the adaptive deadline before delivery",async()=>{
    const now = new Date();
    const e={...event(),dueAt:new Date(now.getTime()+24*3600000)};
    mocks.db.event.findUnique.mockResolvedValue(e);
    mocks.db.eventParticipant.count.mockResolvedValue(6);
    expect(await dispatchEventEmails()).toEqual({sent:1,configured:true});
    const payload=JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(payload.to).toEqual([{email:"parent@example.test"}]);
    expect(payload.headers.idempotencyKey).toBe("550e8400-e29b-41d4-a716-446655440000");
    const deadline=mocks.db.eventParticipant.update.mock.calls[0][0].data.offerExpiresAt as Date;
    expect(Math.abs(deadline.getTime()-now.getTime()-4*3600000)).toBeLessThan(2000);
    expect(payload.textContent).toContain(deadline.toLocaleString("en-US",{timeZone:e.timeZone,dateStyle:"full",timeStyle:"long"}));
    expect(payload.textContent).not.toContain("within 12 hours");
    expect(mocks.db.eventParticipant.update.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(fetch).mock.invocationCallOrder[0]);
    expect(mocks.db.eventParticipant.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{offerSentAt:expect.any(Date)}}));
  });
  it("preserves an existing deadline when the queue changes or delivery is retried",async()=>{
    const expiresAt=new Date(Date.now()+1234567);
    mocks.db.eventParticipant.findUnique.mockResolvedValue({id:"participant",status:"OFFERED",offerVersion:2,offerCreatedAt:new Date(),offerExpiresAt:expiresAt});
    mocks.db.eventParticipant.count.mockResolvedValue(50);
    expect((await dispatchEventEmails()).sent).toBe(1);
    expect(mocks.db.eventParticipant.update).not.toHaveBeenCalled();
    const payload=JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(payload.textContent).toContain(expiresAt.toLocaleString("en-US",{timeZone:"America/Los_Angeles",dateStyle:"full",timeStyle:"long"}));
  });
  it("keeps failed messages for retry without advancing the response deadline",async()=>{
    vi.mocked(fetch).mockRejectedValue(new Error("secret provider detail"));
    expect(await dispatchEventEmails()).toEqual({sent:0,configured:true});
    expect(mocks.db.eventParticipant.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.eventEmail.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({status:"PENDING",lastError:"Delivery failed",availableAt:expect.any(Date)})}));
  });
  it("treats Brevo's duplicate acknowledgement as delivered",async()=>{
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({code:"duplicate_parameter"}),{status:400}));
    expect((await dispatchEventEmails()).sent).toBe(1);
  });
  it.each(["ACCEPTED","EXPIRED","DECLINED"])("does not send obsolete %s offers",async status=>{
    mocks.db.eventParticipant.findUnique.mockResolvedValue({status,offerVersion:2});
    expect((await dispatchEventEmails()).sent).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not send offers after event cancellation",async()=>{
    const job=await mocks.db.eventEmail.findUniqueOrThrow();
    job.event.status="CANCELLED";
    expect((await dispatchEventEmails()).sent).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retains the outbox when configuration is missing",async()=>{
    vi.stubEnv("BREVO_API_KEY","");
    expect(await dispatchEventEmails()).toEqual({sent:0,configured:false});
    expect(mocks.db.eventEmail.findMany).not.toHaveBeenCalled();
  });
});
