import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { promoteWaitingList } from "@/lib/event-participation";
import { offerCutoff, DELIVERY_WINDOW_MS } from "@/lib/spot-offer-policy";
import { flushEventEmails } from "@/lib/event-email";

const schema = z.object({ action: z.enum(["accept", "decline"]), participantId: z.string().min(1), version: z.number().int().positive() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Sign in to respond to this offer" }, { status: 401 });
    const db = getPrisma();
    const parent = await db.parent.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "Complete registration first" }, { status: 403 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid offer response" }, { status: 400 });
    const { id } = await params;
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id } });
      if (!event || event.status !== "PUBLISHED") return { status: 409, error: "This event is no longer accepting offers" };
      const mine = await tx.eventParticipant.findUnique({ where: { eventId_parentId: { eventId: id, parentId: parent.id } } });
      if (!mine || mine.id !== parsed.data.participantId || mine.offerVersion !== parsed.data.version) return { status: 409, error: "This offer is no longer valid" };
      if (mine.status === "ACCEPTED" && parsed.data.action === "accept") return { status: 200 };
      if (mine.status === "DECLINED" && parsed.data.action === "decline") return { status: 200 };
      if (mine.status !== "OFFERED") return { status: 409, error: "This offer is no longer available" };
      const now = new Date();
      if (offerCutoff(event) <= now || (mine.offerExpiresAt && mine.offerExpiresAt <= now) || (!mine.offerExpiresAt && mine.offerCreatedAt && mine.offerCreatedAt.getTime() + DELIVERY_WINDOW_MS <= now.getTime())) {
        await tx.eventParticipant.update({ where: { id: mine.id }, data: { status: "EXPIRED" } });
        await promoteWaitingList(tx, id, event.maxParticipants);
        return { status: 409, error: "This offer has expired" };
      }
      if (parsed.data.action === "accept") {
        const accepted = await tx.eventParticipant.count({ where: { eventId: id, status: "ACCEPTED" } });
        if (accepted >= event.maxParticipants) return { status: 409, error: "No place is available. Contact the organizer." };
      }
      await tx.eventParticipant.update({ where: { id: mine.id }, data: { status: parsed.data.action === "accept" ? "ACCEPTED" : "DECLINED" } });
      await tx.eventEmail.updateMany({ where: { participantId: mine.id, offerVersion: mine.offerVersion, kind: "SPOT_OFFERED", status: { in: ["PENDING", "SENDING"] } }, data: { status: "CANCELLED", leaseToken: null, leaseUntil: null } });
      await promoteWaitingList(tx, id, event.maxParticipants);
      return { status: 200 };
    });
    await flushEventEmails(id);
    return NextResponse.json(result.status === 200 ? { ok: true } : { error: result.error }, { status: result.status });
  } catch (error) { console.error("Offer response failed", error); return NextResponse.json({ error: "Unable to respond to offer" }, { status: 500 }); }
}
