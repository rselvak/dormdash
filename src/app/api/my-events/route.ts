import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { myEventFilters, myEventSections } from "@/lib/my-events";
import { participationSummary } from "@/lib/event-participation";

const querySchema = z.object({
  section: z.enum(myEventSections).default("organizing"),
  offset: z.coerce.number().int().nonnegative().max(1000000).default(0),
});
const pageSize = 25;

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Invalid event filters" }, { status: 400 });
    const prisma = getPrisma();
    const parent = await prisma.parent.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "Complete registration first" }, { status: 403 });
    const { section, offset } = parsed.data;
    const filters = myEventFilters(parent.id, new Date());
    const [events, ...counts] = await Promise.all([
      prisma.event.findMany({ where: filters[section], orderBy: [{ startsAt: section === "past" ? "desc" : "asc" }, { id: "asc" }], skip: offset, take: pageSize + 1,
        select: { id: true, name: true, college: true, dorm: true, major: true, type: true, color: true, startsAt: true, allDay: true, timeZone: true, status: true, cancellationReason: true, parentId: true, maxParticipants: true,
          participants: { select: { parentId: true, status: true, joinedAt: true } } },
      }),
      ...myEventSections.map(key => prisma.event.count({ where: filters[key] })),
    ]);
    return NextResponse.json({
      events: events.slice(0, pageSize).map(({ participants, parentId, ...event }) => ({ ...event, isOwner: parentId === parent.id, ...participationSummary(participants, parent.id) })),
      counts: Object.fromEntries(myEventSections.map((key, index) => [key, counts[index]])),
      nextOffset: events.length > pageSize ? offset + pageSize : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("My events failed", error);
    return NextResponse.json({ error: "Unable to load your events" }, { status: 500 });
  }
}
