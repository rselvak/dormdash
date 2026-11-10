import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { collegeKey } from "@/lib/college";

const types = ["COLLEGE_PICKUP", "COLLEGE_DROP_OFF", "CARPOOL", "VANPOOL", "BUSPOOL", "PACKAGE_DELIVERY", "ANNOUNCEMENT"] as const;
const querySchema = z.object({
  college: z.string().trim().min(1).max(200),
  type: z.enum(types).optional(),
  start: z.iso.date().optional(),
  end: z.iso.date().optional(),
  dorm: z.string().trim().max(120).optional(),
  major: z.string().trim().max(120).optional(),
}).refine(v => !((v.start && !v.end) || (!v.start && v.end)), {
  message: "Provide both start and end dates to search a date range.",
}).refine(v => !v.start || !v.end || v.start <= v.end, {
  message: "Start date must be on or before end date.",
});

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const prisma = getPrisma();
    const parent = await prisma.parent.findUnique({
      where: { clerkUserId: userId },
      select: { students: { select: { college: true } } },
    });
    if (!parent) return NextResponse.json({ error: "Complete registration first" }, { status: 403 });
    const colleges = [...new Set(parent.students.map(s => s.college.trim()))];
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) return NextResponse.json({ error: "Invalid search filters", details: z.flattenError(parsed.error) }, { status: 400 });
    const q = parsed.data;
    const key = collegeKey(q.college);
    if (!colleges.some(c => collegeKey(c) === key)) {
      return NextResponse.json({ error: "You can only search colleges associated with your students" }, { status: 403 });
    }
    // Without an explicit complete date range, historical events are never returned.
    // Interpret selected calendar dates in California's time zone.
    function pacificMidnight(date: string): Date {
      const probe = new Date(date + "T08:00:00Z");
      const offset = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles", timeZoneName: "shortOffset",
      }).formatToParts(probe).find(part => part.type === "timeZoneName")?.value ?? "GMT-8";
      const match = /^GMT([+-])(\\d{1,2})(?::(\\d{2}))?$/.exec(offset);
      const minutes = match ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) : -480;
      return new Date(new Date(date + "T00:00:00Z").getTime() - minutes * 60000);
    }
    const startsAt = q.start && q.end
      ? {
          gte: pacificMidnight(q.start),
          lt: pacificMidnight(new Date(new Date(q.end + "T00:00:00Z").getTime() + 86400000).toISOString().slice(0, 10)),
        }
      : { gte: new Date() };
    const events = await prisma.event.findMany({
      where: {
        status: "PUBLISHED",
        collegeKey: key,
        startsAt,
        ...(q.type ? { type: q.type } : {}),
        ...(q.dorm ? { dorm: { contains: q.dorm, mode: "insensitive" } } : {}),
        ...(q.major ? { major: { contains: q.major, mode: "insensitive" } } : {}),
      },
      orderBy: { startsAt: "asc" },
      take: 100,
      select: {
        id: true, name: true, college: true, dorm: true, major: true,
        type: true, startsAt: true, dueAt: true, maxParticipants: true,
        participants: { select: { parentId: true } },
      },
    });
    return NextResponse.json({
      events: events.map(e => ({
        id: e.id, name: e.name, college: e.college, dorm: e.dorm, major: e.major,
        type: e.type, startsAt: e.startsAt, dueAt: e.dueAt,
        participantCount: e.participants.length, maxParticipants: e.maxParticipants,
      })),
    });
  } catch (error) {
    console.error("Event search failed", error);
    return NextResponse.json({ error: "Unable to search events" }, { status: 500 });
  }
}
