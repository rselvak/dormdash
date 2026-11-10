import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

type Context={params:Promise<{id:string}>};
const schema=z.object({studentId:z.string().nullable()});
export async function POST(request:Request,{params}:Context) {
  try {
    const {userId}=await auth();
    if(!userId) return NextResponse.json({error:"Unauthorized"},{status:401});
    const parent=await getPrisma().parent.findUnique({where:{clerkUserId:userId},select:{id:true}});
    if(!parent) return NextResponse.json({error:"Complete registration first"},{status:403});
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success) return NextResponse.json({error:"Invalid student selection"},{status:400});
    const {id}=await params;
    const result=await getPrisma().$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
      const event=await tx.event.findUnique({where:{id},include:{_count:{select:{participants:true}}}});
      if(!event) return {status:404,error:"Event not found"};
      if(event.status!=="PUBLISHED" && event.parentId!==parent.id) return {status:404,error:"Event not found"};
      const existing=await tx.eventParticipant.findUnique({where:{eventId_parentId:{eventId:id,parentId:parent.id}}});
      if(existing) return {status:409,error:"You have already joined"};
      if(event.dueAt && event.dueAt.getTime()<Date.now()) return {status:409,error:"Joining deadline has passed"};
      if(event.startsAt.getTime()<Date.now()) return {status:409,error:"This event has already started"};
      if(event._count.participants>=event.maxParticipants) return {status:409,error:"This event is full"};
      if(parsed.data.studentId) {
        const student=await tx.student.findFirst({where:{id:parsed.data.studentId,parentId:parent.id},select:{id:true}});
        if(!student) return {status:400,error:"Select one of your registered students"};
      }
      await tx.eventParticipant.create({data:{eventId:id,parentId:parent.id,studentId:parsed.data.studentId}});
      return {status:201};
    });
    return NextResponse.json(result.status===201?{ok:true}:{error:result.error},{status:result.status});
  } catch(error) {console.error("Event join failed",error);return NextResponse.json({error:"Could not join event"},{status:500});}
}
