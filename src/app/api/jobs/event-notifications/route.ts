import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { promoteWaitingList } from "@/lib/event-participation";
import { dispatchEventEmails } from "@/lib/event-email";

export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getPrisma();
  const now = new Date();
  const events = await db.event.findMany({ where: { status: "PUBLISHED", AND: [
    { participants: { some: { status: { in: ["WAITLISTED", "OFFERED"] } } } },
    { OR: [{ startsAt: { gt: now } }, { allDay: true, endsAt: { gt: now } }, { participants: { some: { status: "OFFERED" } } }] },
  ] }, orderBy: [{ waitingListCheckedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }], take: 25, select: { id: true } });
  for (const { id } of events) await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id } });
    if (event) await promoteWaitingList(tx, id, event.maxParticipants);
  });
  return NextResponse.json({ checked: events.length, ...await dispatchEventEmails(undefined, 20) });
}
