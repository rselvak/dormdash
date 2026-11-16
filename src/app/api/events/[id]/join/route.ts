import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { collegeKey } from "@/lib/college";
import { z } from "zod";

import { promoteWaitingList } from "@/lib/event-participation";

type Context={params:Promise<{id:string}>};
const schema=z.object({studentId:z.string().trim().min(1)});
export async function POST(request:Request,{params}:Context) {
  try {
    const {userId}=await auth();
    if(!userId) return NextResponse.json({error:"Unauthorized"},{status:401});
    const parent=await getPrisma().parent.findUnique({where:{clerkUserId:userId},select:{id:true,students:{select:{college:true}}}});
    if(!parent) return NextResponse.json({error:"Complete registration first"},{status:403});
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success) return NextResponse.json({error:"Invalid student selection"},{status:400});
    const {id}=await params;
    const result=await getPrisma().$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
      const event=await tx.event.findUnique({where:{id}});
      if(!event) return {status:404,error:"Event not found"};
      if(event.status!=="PUBLISHED" || !event.collegeKey || !parent.students.some(s=>collegeKey(s.college)===event.collegeKey)) return {status:404,error:"Event not found"};
      const existing=await tx.eventParticipant.findUnique({where:{eventId_parentId:{eventId:id,parentId:parent.id}}});
      if(existing) return {status:409,error:"You have already joined"};
      if(event.dueAt && event.dueAt.getTime()<Date.now()) return {status:409,error:"Joining deadline has passed"};
      if((event.allDay && event.endsAt ? event.endsAt : event.startsAt).getTime()<Date.now()) return {status:409,error:"This event has already started"};
      await promoteWaitingList(tx,id,event.maxParticipants);
      const accepted=await tx.eventParticipant.count({where:{eventId:id,status:"ACCEPTED"}});
      const waiting=await tx.eventParticipant.count({where:{eventId:id,status:"WAITLISTED"}});
      const participationStatus=accepted<event.maxParticipants?"ACCEPTED":"WAITLISTED";
      if(participationStatus==="WAITLISTED" && !event.waitingListAllowed) return {status:409,error:"This event is full"};
      if(participationStatus==="WAITLISTED" && event.maxWaitingList!=null && waiting>=event.maxWaitingList) return {status:409,error:"The waiting list is full"};
      if(parsed.data.studentId) {
        const student=await tx.student.findFirst({where:{id:parsed.data.studentId,parentId:parent.id},select:{id:true}});
        if(!student) return {status:400,error:"Select one of your registered students"};
        const eligible=await tx.student.findFirst({where:{id:parsed.data.studentId,parentId:parent.id,college:{not:""}},select:{college:true}});
        if(!eligible || collegeKey(eligible.college)!==event.collegeKey) return {status:400,error:"Student must attend the event college"};
      }
      await tx.eventParticipant.create({data:{eventId:id,parentId:parent.id,studentId:parsed.data.studentId,status:participationStatus,joinedAt:new Date()}});
      return {status:201,participationStatus};
    });
    return NextResponse.json(result.status===201?{ok:true,participationStatus:result.participationStatus}:{error:result.error},{status:result.status});
  } catch(error) {console.error("Event join failed",error);return NextResponse.json({error:"Could not join event"},{status:500});}
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const prisma = getPrisma();
    const parent = await prisma.parent.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "Complete registration first" }, { status: 403 });
    const { id } = await params;
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id }, select: { maxParticipants: true } });
      if (!event) return { status: 404, error: "Event not found" };
      const mine = await tx.eventParticipant.findUnique({ where: { eventId_parentId: { eventId: id, parentId: parent.id } } });
      if (!mine) return { status: 404, error: "You have not joined this event" };
      await tx.eventParticipant.delete({ where: { id: mine.id } });
      await promoteWaitingList(tx, id, event.maxParticipants);
      return { status: 200 };
    });
    return NextResponse.json(result.status === 200 ? { ok: true } : { error: result.error }, { status: result.status });
  } catch (error) {
    console.error("Event withdrawal failed", error);
    return NextResponse.json({ error: "Could not withdraw from event" }, { status: 500 });
  }
}
