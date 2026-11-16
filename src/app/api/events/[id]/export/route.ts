import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getPrisma } from "@/lib/db";
import { collegeKey } from "@/lib/college";

import { serviceSummary } from "@/lib/trip-services";

type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context) {
  try {
    const {userId}=await auth();
    if(!userId) return NextResponse.json({error:"Unauthorized"},{status:401});
    const parent=await getPrisma().parent.findUnique({where:{clerkUserId:userId},select:{id:true,students:{select:{college:true}}}});
    if(!parent) return NextResponse.json({error:"Complete registration first"},{status:403});
    const {id}=await params;
    const studentFields={id:true,name:true,college:true,major:true,dorm:true} as const;
    const event=await getPrisma().event.findUnique({where:{id},include:{participants:{orderBy:[{joinedAt:"asc"},{id:"asc"}],include:{parent:{select:{name:true,email:true,phone:true,students:{select:studentFields,orderBy:{id:"asc"}}}},student:{select:studentFields}}}}});
    if(!event || (event.parentId!==parent.id && !((event.status==="PUBLISHED"||event.status==="CANCELLED")&&event.participants.some(p=>p.parentId===parent.id)) && ((event.status!=="PUBLISHED"&&event.status!=="CANCELLED") || !event.collegeKey || !parent.students.some(s=>collegeKey(s.college)===event.collegeKey)))) return NextResponse.json({error:"Event not found"},{status:404});
    // Export is explicitly available to every registered user who can view the event.
    const workbook=new ExcelJS.Workbook();
    const sheet=workbook.addWorksheet("Participants");
    sheet.columns=[
      {header:"Status",key:"status",width:18},
      {header:"Responded at (UTC)",key:"joinedAt",width:28},
      {header:"Parent name",key:"name",width:26},
      {header:"Parent email",key:"email",width:36},
      {header:"Student name",key:"studentName",width:26},
      {header:"Student college",key:"college",width:44},
      {header:"Student major",key:"major",width:44},
      {header:"Student dorm",key:"dorm",width:30},
      {header:"Parent 1 phone",key:"phone",width:22},
      ...(event.type==="COLLEGE_PICKUP"?[{header:"Services requested",key:"requestedServices",width:44}]:[])
    ];
    sheet.getRow(1).font={bold:true};
    for(const p of event.participants) {
      const eventCollege=event.collegeKey || (event.college ? collegeKey(event.college) : null);
      const students=p.student ? [p.student] : p.parent.students.filter(student=>eventCollege && collegeKey(student.college)===eventCollege);
      // Keep the participant visible if no matching student registration exists.
      // These are student rows, not additional accepted places in the event.
      for(const student of students.length ? students : [null]) sheet.addRow({
        requestedServices:p.requestedServices?.length?serviceSummary(p.requestedServices):"Not specified",status:p.status,joinedAt:p.joinedAt.toISOString(),name:p.parent.name,email:p.parent.email,
        studentName:student?.name??"",
        college:student?.college??"",major:student?.major??"",dorm:student?.dorm??"",phone:p.parent.phone
      });
    }
    const bytes=await workbook.xlsx.writeBuffer();
    const safeName=event.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").trim().slice(0,100)||"Event";
    const encoded=encodeURIComponent(safeName+".xlsx");
    return new NextResponse(new Uint8Array(bytes),{headers:{
      "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":`attachment; filename="event-participants.xlsx"; filename*=UTF-8''${encoded}`,
      "Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff"
    }});
  } catch(error) {console.error("Participant export failed",error);return NextResponse.json({error:"Unable to download participants"},{status:500});}
}
