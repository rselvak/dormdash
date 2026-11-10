import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { collegeKey } from "@/lib/college";

const eventTypes = ["COLLEGE_PICKUP","COLLEGE_DROP_OFF","CARPOOL","VANPOOL","BUSPOOL","PACKAGE_DELIVERY","ANNOUNCEMENT"] as const;
const schema = z.object({
  name: z.string().trim().min(1).max(160),
  college: z.string().trim().min(1).max(200),
  startsAt: z.iso.datetime({ offset: true }),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  timeZone: z.string().min(1).max(100).default("America/Los_Angeles"),
  type: z.enum(eventTypes),
  status: z.enum(["DRAFT","PUBLISHED"]).default("DRAFT"),
  paymentRequired: z.boolean().default(false),
  totalCostCents: z.number().int().nonnegative().nullable().optional(),
  individualCostCents: z.number().int().nonnegative().nullable().optional(),
  maxParticipants: z.number().int().positive().max(10000),
}).superRefine((v, ctx) => {
  if (v.dueAt && new Date(v.dueAt) > new Date(v.startsAt)) ctx.addIssue({code:"custom",path:["dueAt"],message:"Due date cannot be after event start"});
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
      ...(publishedOnly ? {status:"PUBLISHED" as const,collegeKey:{in:keys},startsAt:{gte:new Date()}} : {OR:[{status:"PUBLISHED" as const,collegeKey:{in:keys}},{parentId:parent.id}]}),
      ...(!publishedOnly && (start || end) ? {startsAt:{...(start?{gte:new Date(start)}:{}),...(end?{lt:new Date(end)}:{})}} : {}),
    },
    orderBy:{startsAt:"asc"},
    take:500,
    select:{id:true,parentId:true,name:true,college:true,startsAt:true,timeZone:true,dueAt:true,type:true,status:true,paymentRequired:true,totalCostCents:true,individualCostCents:true,maxParticipants:true,participants:{select:{parentId:true}}},
  });
  return NextResponse.json({colleges:[...new Set(parent.students.map(s=>s.college.trim()))],events:events.map(e=>({id:e.id,name:e.name,college:e.college,startsAt:e.startsAt,dueAt:e.dueAt,type:e.type,status:e.status,maxParticipants:e.maxParticipants,paymentRequired:e.paymentRequired,totalCostCents:e.totalCostCents,individualCostCents:e.individualCostCents,isOwner:e.parentId===parent.id,isJoined:e.participants.some(p=>p.parentId===parent.id),participantCount:e.participants.length}))});
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
  const parent = await prisma.parent.findUnique({where:{clerkUserId:userId},select:{id:true}});
  if (!parent) return NextResponse.json({error:"Complete parent registration first"},{status:403});
  const v=parsed.data;
  if(!parent.students.some(s=>collegeKey(s.college)===collegeKey(v.college))) return NextResponse.json({error:"Select a college registered to one of your students"},{status:403});
  const event=await prisma.event.create({data:{
    parentId:parent.id,name:v.name,college:v.college,collegeKey:collegeKey(v.college),startsAt:new Date(v.startsAt),dueAt:v.dueAt?new Date(v.dueAt):null,
    timeZone:v.timeZone,type:v.type,status:v.status,paymentRequired:v.paymentRequired,
    totalCostCents:v.paymentRequired?(v.totalCostCents??null):null,
    individualCostCents:v.paymentRequired?(v.individualCostCents??null):null,
    maxParticipants:v.maxParticipants,
    participants:{create:{parentId:parent.id}},
  }});
  return NextResponse.json({event},{status:201});
  } catch (error) {
    console.error("Failed to create event", error);
    return NextResponse.json({error:"Unable to create event. Check database migrations and server logs."},{status:500});
  }
}
