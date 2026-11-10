import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { collegeKey } from "@/lib/college";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
async function identity() {
  const { userId } = await auth();
  if (!userId) return null;
  return getPrisma().parent.findUnique({where:{clerkUserId:userId},select:{id:true,students:{select:{id:true,name:true,email:true,college:true}}}});
}
export async function GET(_request:Request,{params}:Context) {
  try {
    const parent=await identity();
    if(!parent) return NextResponse.json({error:"Sign in and complete registration"},{status:401});
    const {id}=await params;
    const event=await getPrisma().event.findUnique({where:{id},include:{participants:{select:{parentId:true,studentId:true}}}});
    if(!event || (event.parentId!==parent.id && (event.status!=="PUBLISHED" || !event.collegeKey || !parent.students.some(s=>collegeKey(s.college)===event.collegeKey)))) return NextResponse.json({error:"Event not found"},{status:404});
    const isOwner=event.parentId===parent.id;
    const mine=event.participants.find(p=>p.parentId===parent.id);
    return NextResponse.json({event:{id:event.id,name:event.name,college:event.college,startsAt:event.startsAt,dueAt:event.dueAt,type:event.type,status:event.status,maxParticipants:event.maxParticipants,paymentRequired:event.paymentRequired,totalCostCents:event.totalCostCents,individualCostCents:event.individualCostCents,participantCount:event.participants.length,isOwner,isJoined:!!mine,selectedStudentId:mine?.studentId??null},students:parent.students});
  } catch(error) {console.error("Event detail failed",error);return NextResponse.json({error:"Could not load event"},{status:500});}
}
const editSchema=z.object({name:z.string().trim().min(1).max(160),college:z.string().trim().min(1).max(200),startsAt:z.iso.datetime({offset:true}),dueAt:z.iso.datetime({offset:true}).nullable(),type:z.enum(["COLLEGE_PICKUP","COLLEGE_DROP_OFF","CARPOOL","VANPOOL","BUSPOOL","PACKAGE_DELIVERY","ANNOUNCEMENT"]),status:z.enum(["DRAFT","PUBLISHED"]),maxParticipants:z.number().int().positive().max(10000)}).refine(v=>!v.dueAt || new Date(v.dueAt)<=new Date(v.startsAt),{message:"Deadline must be before event",path:["dueAt"]});
export async function PATCH(request:Request,{params}:Context) {
  try {
    const parent=await identity();
    if(!parent) return NextResponse.json({error:"Unauthorized"},{status:401});
    const {id}=await params;
    const parsed=editSchema.safeParse(await request.json());
    if(!parsed.success) return NextResponse.json({error:"Invalid event details",details:z.flattenError(parsed.error)},{status:400});
    const result=await getPrisma().$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
      const event=await tx.event.findUnique({where:{id},select:{parentId:true,_count:{select:{participants:true}}}});
      if(!event) return {status:404,error:"Event not found"};
      if(event.parentId!==parent.id) return {status:403,error:"Only the creator can edit this event"};
      if(parsed.data.maxParticipants<event._count.participants) return {status:409,error:"Capacity cannot be below current participation"};
      if(!parent.students.some(s=>collegeKey(s.college)===collegeKey(parsed.data.college))) return {status:403,error:"College must belong to one of your students"};
      await tx.event.update({where:{id},data:{...parsed.data,collegeKey:collegeKey(parsed.data.college),startsAt:new Date(parsed.data.startsAt),dueAt:parsed.data.dueAt?new Date(parsed.data.dueAt):null}});
      return {status:200};
    });
    return NextResponse.json(result.status===200?{ok:true}:{error:result.error},{status:result.status});
  } catch(error) {console.error("Event update failed",error);return NextResponse.json({error:"Unable to update event"},{status:500});}
}
