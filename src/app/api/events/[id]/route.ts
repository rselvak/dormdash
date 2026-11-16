import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { collegeKey } from "@/lib/college";
import { z } from "zod";

import { participationSummary, promoteWaitingList, waitingListFields } from "@/lib/event-participation";

import { eventColorSchema } from "@/lib/event-color";

import { scheduleFields, validateSchedule } from "@/lib/event-schedule";

import { tripServicesSchema, validateTripServices } from "@/lib/trip-services";

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
    const event=await getPrisma().event.findUnique({where:{id},include:{participants:{select:{parentId:true,studentId:true,status:true,joinedAt:true,requestedServices:true}}}});
    if(!event || (event.parentId!==parent.id && !(event.status==="CANCELLED"&&event.participants.some(p=>p.parentId===parent.id)) && ((event.status!=="PUBLISHED"&&event.status!=="CANCELLED") || !event.collegeKey || !parent.students.some(s=>collegeKey(s.college)===event.collegeKey)))) return NextResponse.json({error:"Event not found"},{status:404});
    const isOwner=event.parentId===parent.id;
    const mine=event.participants.find(p=>p.parentId===parent.id);
    return NextResponse.json({event:{id:event.id,name:event.name,color:event.color,instructions:event.instructions,college:event.college,dorm:event.dorm,major:event.major,startsAt:event.startsAt,allDay:event.allDay,endsAt:event.endsAt,timeZone:event.timeZone,dueAt:event.dueAt,type:event.type,services:event.services,requestedServices:mine?.requestedServices??[],status:event.status,cancellationReason:event.cancellationReason,cancelledAt:event.cancelledAt,maxParticipants:event.maxParticipants,paymentRequired:event.paymentRequired,totalCostCents:event.totalCostCents,individualCostCents:event.individualCostCents,waitingListAllowed:event.waitingListAllowed,maxWaitingList:event.maxWaitingList,...participationSummary(event.participants,parent.id),isOwner,selectedStudentId:mine?.studentId??null},students:parent.students});
  } catch(error) {console.error("Event detail failed",error);return NextResponse.json({error:"Could not load event"},{status:500});}
}
const editSchema=z.object({services:tripServicesSchema.default([]),...waitingListFields,...scheduleFields,timeZone:z.string().min(1).max(100).optional(),color:eventColorSchema,instructions:z.string().trim().max(4000).nullable().optional(),name:z.string().trim().min(1).max(160),college:z.string().trim().min(1).max(200),dorm:z.string().trim().max(120).nullable().optional(),major:z.string().trim().max(120).nullable().optional(),startsAt:z.iso.datetime({offset:true}),dueAt:z.iso.datetime({offset:true}).nullable(),type:z.enum(["COLLEGE_PICKUP","COLLEGE_DROP_OFF","CARPOOL","VANPOOL","BUSPOOL","ANNOUNCEMENT"]),status:z.enum(["DRAFT","PUBLISHED"]),maxParticipants:z.number().int().positive().max(10000)}).superRefine(validateSchedule).superRefine(validateTripServices);
export async function PATCH(request:Request,{params}:Context) {
  try {
    const parent=await identity();
    if(!parent) return NextResponse.json({error:"Unauthorized"},{status:401});
    const {id}=await params;
    const parsed=editSchema.safeParse(await request.json());
    if(!parsed.success) return NextResponse.json({error:"Invalid event details",details:z.flattenError(parsed.error)},{status:400});
    const result=await getPrisma().$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
      const event=await tx.event.findUnique({where:{id},select:{parentId:true,status:true,participants:{select:{status:true,requestedServices:true}},waitingListAllowed:true,maxWaitingList:true}});
      if(!event) return {status:404,error:"Event not found"};
      if(event.parentId!==parent.id) return {status:403,error:"Only the creator can edit this event"};
      if(event.status==="CANCELLED") return {status:409,error:"Cancelled events cannot be edited or republished"};
      if(event.participants.some(p=>p.requestedServices.some(service=>!parsed.data.services.includes(service)))) return {status:409,error:"Cannot remove a service already requested by a participant"};
      const accepted=event.participants.filter(p=>p.status==="ACCEPTED").length;
      const waiting=event.participants.length-accepted;
      const remainingWaiting=Math.max(0,waiting-Math.max(0,parsed.data.maxParticipants-accepted));
      if(remainingWaiting>0 && (!parsed.data.waitingListAllowed || (parsed.data.maxWaitingList!=null && parsed.data.maxWaitingList<remainingWaiting))) return {status:409,error:"Waiting list settings cannot remove existing waiting participants"};
      if(parsed.data.maxParticipants<accepted) return {status:409,error:"Capacity cannot be below current participation"};
      if(!parent.students.some(s=>collegeKey(s.college)===collegeKey(parsed.data.college))) return {status:403,error:"College must belong to one of your students"};
      await tx.event.update({where:{id},data:{...parsed.data,instructions:parsed.data.instructions===undefined?undefined:parsed.data.instructions||null,endsAt:parsed.data.allDay&&parsed.data.endsAt?new Date(parsed.data.endsAt):null,maxWaitingList:parsed.data.waitingListAllowed?(parsed.data.maxWaitingList??null):null,collegeKey:collegeKey(parsed.data.college),startsAt:new Date(parsed.data.startsAt),dueAt:parsed.data.dueAt?new Date(parsed.data.dueAt):null}});
      await promoteWaitingList(tx,id,parsed.data.maxParticipants);
      return {status:200};
    });
    return NextResponse.json(result.status===200?{ok:true}:{error:result.error},{status:result.status});
  } catch(error) {console.error("Event update failed",error);return NextResponse.json({error:"Unable to update event"},{status:500});}
}
