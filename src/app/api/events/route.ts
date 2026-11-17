import { canCreateSchedule } from "@/lib/event-policy";
import { ridePoolFields, validateRidePool } from "@/lib/ride-pool";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { collegeKey } from "@/lib/college";

import { participationSummary, waitingListFields } from "@/lib/event-participation";

import { eventColorSchema } from "@/lib/event-color";

import { scheduleFields, validateSchedule } from "@/lib/event-schedule";

import { tripServicesSchema, validateTripServices } from "@/lib/trip-services";

const eventTypes = ["COLLEGE_PICKUP","COLLEGE_DROP_OFF","CARPOOL","VANPOOL","BUSPOOL"] as const;
const schema = z.object({
  selectedStop:z.string().trim().min(1).max(120).nullable().optional(),
  ...scheduleFields,...ridePoolFields,
  services:tripServicesSchema.default([]),
  color: eventColorSchema,
  instructions:z.string().trim().max(4000).nullable().optional(),
  name: z.string().trim().min(1).max(160),
  college: z.string().trim().min(1).max(200),
  dorm: z.string().trim().max(120).nullable().optional(),
  major: z.string().trim().max(120).nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  timeZone: z.string().min(1).max(100).default("America/Los_Angeles"),
  type: z.enum(eventTypes),
  status: z.enum(["DRAFT","PUBLISHED"]).default("DRAFT"),
  paymentRequired: z.boolean().default(false),
  totalCostCents: z.number().int().nonnegative().nullable().optional(),
  individualCostCents: z.number().int().nonnegative().nullable().optional(),
  ...waitingListFields,
  maxParticipants: z.number().int().positive().max(10000),
}).superRefine((v, ctx) => {
  validateSchedule(v,ctx);
  validateTripServices(v,ctx);
  validateRidePool(v,ctx);
  if (!v.paymentRequired && (v.totalCostCents != null || v.individualCostCents != null)) ctx.addIssue({code:"custom",path:["paymentRequired"],message:"Costs require payment enabled"});
  if (v.paymentRequired && v.totalCostCents == null && v.individualCostCents == null) ctx.addIssue({code:"custom",path:["totalCostCents"],message:"Provide a total or individual cost"});
});

export async function GET(request: Request) {
  try {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({error:"Unauthorized"},{status:401});
  const prisma = getPrisma();
  const parent = await prisma.parent.findUnique({where:{clerkUserId:userId},select:{id:true,students:{select:{college:true}}}});
  if (!parent) return NextResponse.json({error:"Complete parent registration first"},{status:403});
  const keys=[...new Set(parent.students.map(s=>collegeKey(s.college)))];
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if ((start && Number.isNaN(Date.parse(start))) || (end && Number.isNaN(Date.parse(end)))) return NextResponse.json({error:"Invalid date range"},{status:400});
  const publishedOnly = url.searchParams.get("published") === "upcoming";
  const events = await prisma.event.findMany({
    where:{
      ...(publishedOnly ? {status:{in:["PUBLISHED","CANCELLED"]},collegeKey:{in:keys},OR:[{startsAt:{gte:new Date()}},{allDay:true,endsAt:{gt:new Date()}}]} : {OR:[{status:{in:["PUBLISHED","CANCELLED"]},collegeKey:{in:keys}},{parentId:parent.id},{status:"CANCELLED",participants:{some:{parentId:parent.id}}}]}),
      ...(!publishedOnly && (start || end) ? {startsAt:{...(start?{gte:new Date(start)}:{}),...(end?{lt:new Date(end)}:{})}} : {}),
    },
    orderBy:{startsAt:"asc"},
    take:500,
    select:{parent:{select:{name:true}},transportType:true,busStops:true,id:true,parentId:true,name:true,color:true,origin:true,destination:true,instructions:true,college:true,dorm:true,major:true,startsAt:true,allDay:true,endsAt:true,timeZone:true,dueAt:true,type:true,services:true,status:true,cancellationReason:true,cancelledAt:true,paymentRequired:true,totalCostCents:true,individualCostCents:true,maxParticipants:true,waitingListAllowed:true,maxWaitingList:true,participants:{select:{parentId:true,status:true,joinedAt:true}}},
  });
  return NextResponse.json({colleges:[...new Set(parent.students.map(s=>s.college.trim()))],events:events.map(e=>({createdBy:e.parent?.name??"Organizer",transportType:e.transportType,busStops:e.busStops,id:e.id,name:e.name,color:e.color,origin:e.origin,destination:e.destination,instructions:e.instructions,college:e.college,dorm:e.dorm,major:e.major,startsAt:e.startsAt,allDay:e.allDay,endsAt:e.endsAt,timeZone:e.timeZone,dueAt:e.dueAt,type:e.type,services:e.services,status:e.status,cancellationReason:e.cancellationReason,cancelledAt:e.cancelledAt,maxParticipants:e.maxParticipants,paymentRequired:e.paymentRequired,totalCostCents:e.totalCostCents,individualCostCents:e.individualCostCents,isOwner:e.parentId===parent.id,waitingListAllowed:e.waitingListAllowed,maxWaitingList:e.maxWaitingList,...participationSummary(e.participants,parent.id)}))});
  } catch (error) {
    console.error("Failed to list events", error);
    return NextResponse.json({error:"Unable to load events. Check database migrations and server logs."},{status:500});
  }
}

export async function POST(request: Request) {
  try {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({error:"Unauthorized"},{status:401});
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({error:"Invalid JSON"},{status:400}); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({error:"Invalid event",details:z.flattenError(parsed.error)},{status:400});
  const prisma = getPrisma();
  const parent = await prisma.parent.findUnique({where:{clerkUserId:userId},select:{id:true,students:{select:{college:true}}}});
  if (!parent) return NextResponse.json({error:"Complete parent registration first"},{status:403});
  const v=parsed.data;
  if(!canCreateSchedule(v)) return NextResponse.json({error:"Events cannot be created in the past."},{status:400});
  if(v.type==="BUSPOOL" && (!v.selectedStop || !v.busStops.includes(v.selectedStop)))return NextResponse.json({error:"Select your stop for this Buspool event."},{status:400});
  if(!parent.students.some(s=>collegeKey(s.college)===collegeKey(v.college))) return NextResponse.json({error:"Select a college registered to one of your students"},{status:403});
  const event=await prisma.event.create({data:{
    parentId:parent.id,origin:["CARPOOL","COLLEGE_DROP_OFF","VANPOOL"].includes(v.type)?v.origin:null,destination:["CARPOOL","COLLEGE_DROP_OFF","VANPOOL"].includes(v.type)?v.destination:null,transportType:v.type==="VANPOOL"?v.transportType:null,busStops:v.type==="BUSPOOL"?v.busStops:[],name:v.name,color:v.color??null,instructions:v.instructions||null,college:v.college,collegeKey:collegeKey(v.college),dorm:v.dorm||null,major:v.major||null,startsAt:new Date(v.startsAt),dueAt:v.dueAt?new Date(v.dueAt):null,
    allDay:v.allDay,endsAt:v.allDay&&v.endsAt?new Date(v.endsAt):null,timeZone:v.timeZone,type:v.type,services:v.services,status:v.status,paymentRequired:v.paymentRequired,
    totalCostCents:v.paymentRequired?(v.totalCostCents??null):null,
    individualCostCents:v.paymentRequired?(v.individualCostCents??null):null,
    maxParticipants:v.maxParticipants,waitingListAllowed:v.waitingListAllowed,maxWaitingList:v.waitingListAllowed?(v.maxWaitingList??null):null,
    participants:{create:{parentId:parent.id,selectedStop:v.type==="BUSPOOL"?v.selectedStop:null}},
  }});
  return NextResponse.json({event},{status:201});
  } catch (error) {
    console.error("Failed to create event", error);
    return NextResponse.json({error:"Unable to create event. Check database migrations and server logs."},{status:500});
  }
}
