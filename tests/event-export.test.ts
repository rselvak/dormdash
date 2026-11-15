import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

const mocks=vi.hoisted(()=>({auth:vi.fn(),parent:vi.fn(),event:vi.fn()}));
vi.mock("@clerk/nextjs/server",()=>({auth:mocks.auth}));
vi.mock("@/lib/db",()=>({getPrisma:()=>({parent:{findUnique:mocks.parent},event:{findUnique:mocks.event}})}));
import { GET } from "@/app/api/events/[id]/export/route";

const student=(id:string,college="Stanford University")=>({id,name:`Student ${id}`,email:`${id}@example.test`,college,major:"Computer Science",dorm:"Branner Hall"});
const participant=(students:ReturnType<typeof student>[],selected:ReturnType<typeof student>|null=null)=>({
  status:"ACCEPTED",joinedAt:new Date("2026-11-14T10:00:00Z"),student:selected,
  parent:{name:"Parent",email:"parent@example.test",phone:"5551234567",students},
});
const request=()=>GET(new Request("http://localhost/api/events/event/export"),{params:Promise.resolve({id:"event"})});

describe("participant Excel export",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({userId:"user"});
    mocks.parent.mockResolvedValue({id:"owner",students:[]});
  });
  it("exports registered students for the creator and unselected joins, and honors an explicit selection",async()=>{
    const first=student("first"),second=student("second"),unrelated=student("other","University of California-Berkeley");
    mocks.event.mockResolvedValue({name:"College ride",parentId:"owner",collegeKey:"stanford university",participants:[
      participant([first,second,unrelated]),participant([first,second],second),
    ]});
    const response=await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml");
    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const sheet=workbook.getWorksheet("Participants")!;
    expect(sheet.rowCount).toBe(4);
    const values=sheet.getSheetValues();
    expect(JSON.stringify(values)).not.toContain("other@example.test");
    expect(sheet.getRow(1).values).toEqual([undefined,"Status","Responded at (UTC)","Parent name","Parent email","Student name","Student email","Student college","Student major","Student dorm","Parent 1 phone"]);
    for(const [row,s] of [[2,first],[3,second],[4,second]] as const){
      expect(sheet.getRow(row).getCell(5).value).toBe(s.name);
      expect(sheet.getRow(row).getCell(6).value).toBe(s.email);
      expect(sheet.getRow(row).getCell(7).value).toBe(s.college);
      expect(sheet.getRow(row).getCell(8).value).toBe(s.major);
      expect(sheet.getRow(row).getCell(9).value).toBe(s.dorm);
    }
  });
  it("retains a participant row when no student matches the event college",async()=>{
    mocks.event.mockResolvedValue({name:"Ride",parentId:"owner",collegeKey:"stanford university",participants:[participant([student("other","Other University")])]});
    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(await (await request()).arrayBuffer());
    const row=workbook.getWorksheet("Participants")!.getRow(2);
    expect(row.getCell(3).value).toBe("Parent");
    expect(row.getCell(5).value).toBe("");
  });
  it("requires authentication",async()=>{
    mocks.auth.mockResolvedValue({userId:null});
    expect((await request()).status).toBe(401);
    expect(mocks.event).not.toHaveBeenCalled();
  });
});
