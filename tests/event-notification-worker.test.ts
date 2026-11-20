import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(()=>({ db:{event:{findMany:vi.fn(),findUnique:vi.fn()},$transaction:vi.fn(),$queryRaw:vi.fn()},promote:vi.fn(),dispatch:vi.fn() }));
vi.mock("@/lib/db",()=>({getPrisma:()=>mocks.db}));
vi.mock("@/lib/event-participation",()=>({promoteWaitingList:mocks.promote}));
vi.mock("@/lib/event-email",()=>({dispatchEventEmails:mocks.dispatch}));
import { POST } from "@/app/api/jobs/event-notifications/route";
beforeEach(()=>{
  vi.resetAllMocks(); vi.stubEnv("CRON_SECRET","test-worker-secret");
  mocks.db.event.findMany.mockResolvedValue([{id:"event"}]);
  mocks.db.event.findUnique.mockResolvedValue({maxParticipants:3});
  mocks.db.$transaction.mockImplementation(async (fn:(db:typeof mocks.db)=>unknown)=>fn(mocks.db));
  mocks.dispatch.mockResolvedValue({sent:2,configured:true});
});
afterEach(()=>vi.unstubAllEnvs());
it.each([undefined,"Bearer wrong","test-worker-secret"])("rejects unauthenticated worker requests (%s)",async authorization=>{
  expect((await POST(new Request("https://app.test/api/jobs/event-notifications",{method:"POST",headers:authorization?{authorization}:{}}))).status).toBe(401);
  expect(mocks.db.event.findMany).not.toHaveBeenCalled();
});
it("checks expiring offers while holding the event lock and dispatches queued messages",async()=>{
  const response=await POST(new Request("https://app.test/api/jobs/event-notifications",{method:"POST",headers:{authorization:"Bearer test-worker-secret"}}));
  expect(await response.json()).toEqual({checked:1,sent:2,configured:true});
  expect(mocks.db.$queryRaw).toHaveBeenCalled();
  expect(mocks.promote).toHaveBeenCalledWith(mocks.db,"event",3);
  expect(mocks.dispatch).toHaveBeenCalledWith(undefined,20);
});
