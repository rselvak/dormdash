import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventCalendarFile } from "@/lib/event-calendar";

const mocks=vi.hoisted(()=>({auth:vi.fn(),parent:vi.fn(),event:vi.fn()}));
vi.mock("@clerk/nextjs/server",()=>({auth:mocks.auth}));
vi.mock("@/lib/db",()=>({getPrisma:()=>({parent:{findUnique:mocks.parent},event:{findUnique:mocks.event}})}));
import { GET } from "@/app/api/events/[id]/calendar/route";

const event={id:"event-123",name:"Trip to college",parentId:"owner",collegeKey:"stanford university",college:"Stanford University",dorm:"Branner Hall",instructions:"Meet at the main gate.\nBring packages.",startsAt:new Date("2026-11-15T17:30:00Z"),endsAt:null,dueAt:null,allDay:false,timeZone:"America/Los_Angeles",updatedAt:new Date("2026-11-14T10:00:00Z"),status:"PUBLISHED",type:"CARPOOL",services:[]};
const unfold=(file:string)=>file.replace(/\r\n /g,"");
const request=()=>GET(new Request("https://dormdash.example/api/events/event-123/calendar"),{params:Promise.resolve({id:"event-123"})});

describe("iCalendar files",()=>{
  it("marks cancelled downloads and includes the organizer's reason",()=>{
    const file=unfold(eventCalendarFile({...event,status:"CANCELLED",cancellationReason:"Heavy rain"},"https://dormdash.example/?event=event-123"));
    expect(file).toContain("STATUS:CANCELLED\r\n");
    expect(file).toContain("Cancelled: Heavy rain");
  });
  it("exports timed events in UTC with stable identity, instructions, and location",()=>{
    const file=unfold(eventCalendarFile(event,"https://dormdash.example/?event=event-123"));
    expect(file).toContain("DTSTART:20261115T173000Z\r\n");
    expect(file).toContain("UID:event-123@dormdash\r\n");
    expect(file).toContain("LOCATION:Stanford University - Branner Hall");
    expect(file).toContain("Meet at the main gate.\\nBring packages.");
    expect(file).toContain("URL:https://dormdash.example/?event=event-123");
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(file).not.toContain("DTEND:");
  });
  it("exports all-day events as dates with an exclusive end across daylight saving changes",()=>{
    const file=eventCalendarFile({...event,allDay:true,startsAt:new Date("2026-11-01T07:00:00Z"),endsAt:new Date("2026-11-02T08:00:00Z")},"https://dormdash.example/");
    expect(file).toContain("DTSTART;VALUE=DATE:20261101");
    expect(file).toContain("DTEND;VALUE=DATE:20261102");
  });
  it("escapes control characters and folds Unicode lines at 75 bytes",()=>{
    const file=eventCalendarFile({...event,name:"Trip, college; test\\name\r\nBEGIN:VEVENT",instructions:"行📦".repeat(120)},"https://dormdash.example/");
    expect(file.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(unfold(file)).toContain("SUMMARY:Trip\\, college\\; test\\\\name\\nBEGIN:VEVENT");
    for(const line of file.split("\r\n"))expect(Buffer.byteLength(line,"utf8")).toBeLessThanOrEqual(75);
    expect(unfold(file)).toContain("行📦".repeat(120));
  });
});

describe("calendar download permissions",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({userId:"user"});
    mocks.parent.mockResolvedValue({id:"owner",students:[{college:"Stanford University"}]});
    mocks.event.mockResolvedValue(event);
  });
  it("returns an ICS attachment and deep link for eligible users",async()=>{
    const response=await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain(".ics");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(unfold(await response.text())).toContain("URL:https://dormdash.example/?event=event-123");
  });
  it("allows owners to download private drafts",async()=>{
    mocks.event.mockResolvedValue({...event,status:"DRAFT"});
    const response=await request();
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("STATUS:TENTATIVE");
  });
  it("allows published events at the viewer's student's college",async()=>{
    mocks.parent.mockResolvedValue({id:"other-parent",students:[{college:"Stanford University"}]});
    expect((await request()).status).toBe(200);
  });
  it("requires sign-in and registration",async()=>{
    mocks.auth.mockResolvedValue({userId:null});
    expect((await request()).status).toBe(401);
    expect(mocks.event).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({userId:"user"});
    mocks.parent.mockResolvedValue(null);
    expect((await request()).status).toBe(403);
  });
  it("hides other parents' drafts and events at unrelated colleges",async()=>{
    mocks.parent.mockResolvedValue({id:"other-parent",students:[{college:"Other University"}]});
    expect((await request()).status).toBe(404);
    mocks.parent.mockResolvedValue({id:"other-parent",students:[{college:"Stanford University"}]});
    mocks.event.mockResolvedValue({...event,status:"DRAFT"});
    expect((await request()).status).toBe(404);
    mocks.event.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
  });
});
