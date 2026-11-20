import { flushEventEmails } from "@/lib/event-email";
import { activeParticipation } from "@/lib/spot-offer-policy";
import { isPastEvent } from "@/lib/event-policy";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/db";

const schema = z.object({ reason: z.string().trim().min(1).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const prisma = getPrisma();
    const parent = await prisma.parent.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "Complete registration first" }, { status: 403 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a cancellation reason (up to 2,000 characters)." }, { status: 400 });
    const { id } = await params;
    const result = await prisma.$transaction(async tx => {
      // Serialize with joins, withdrawals and edits so nobody joins after cancellation.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id }, select: { startsAt:true,endsAt:true,allDay:true,parentId: true, status: true, participants: { select: { parentId: true, status:true } } } });
      if (!event) return { status: 404, error: "Event not found" };
      if (event.parentId !== parent.id) return { status: 403, error: "Only the organizer can cancel this event" };
      if (isPastEvent(event)) return {status:409,error:"Past events are read-only"};
      if (event.status === "CANCELLED") return { status: 200 };
      if (event.status !== "PUBLISHED") return { status: 409, error: "Only published events can be cancelled" };
      await tx.event.update({ where: { id }, data: { status: "CANCELLED", cancellationReason: parsed.data.reason, cancelledAt: new Date() } });
      const recipients = event.participants.filter(participant => participant.parentId !== parent.id && activeParticipation.some(status=>status===participant.status));
      if (recipients.length) await tx.eventNotification.createMany({ data: recipients.map(participant => ({ eventId: id, parentId: participant.parentId })), skipDuplicates: true });
      await tx.eventEmail.updateMany({ where: { eventId: id, kind: "SPOT_OFFERED", status: { in: ["PENDING", "SENDING"] } }, data: { status: "CANCELLED", leaseToken: null, leaseUntil: null } });
      if (recipients.length) await tx.eventEmail.createMany({ data: recipients.map(participant => ({ uniqueKey: `cancel:${id}:${participant.parentId}`, eventId: id, parentId: participant.parentId, kind: "CANCELLED" })), skipDuplicates: true });
      return { status: 200 };
    });
    if(result.status===200)await flushEventEmails(id);
    return NextResponse.json(result.status === 200 ? { ok: true } : { error: result.error }, { status: result.status });
  } catch (error) {
    console.error("Event cancellation failed", error);
    return NextResponse.json({ error: "Unable to cancel event" }, { status: 500 });
  }
}
