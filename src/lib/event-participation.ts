import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { activeParticipation, DELIVERY_WINDOW_MS, offerCutoff } from "@/lib/spot-offer-policy";

export const waitingListFields = {
  waitingListAllowed: z.boolean().default(false),
  maxWaitingList: z.number().int().nonnegative().max(2147483647).nullable().optional(),
};

// Call only inside a transaction holding the event's FOR UPDATE row lock.
export async function promoteWaitingList(tx: Prisma.TransactionClient, eventId: string, capacity: number) {
  const now = new Date();
  const event = await tx.event.findUnique({ where: { id: eventId } });
  if (!event || event.status !== "PUBLISHED") return;
  const cutoff = offerCutoff(event);
  const expired = await tx.eventParticipant.findMany({ where: { eventId, status: "OFFERED", OR: [
    { offerExpiresAt: { lte: now } },
    { offerExpiresAt: null, offerCreatedAt: { lte: new Date(now.getTime() - DELIVERY_WINDOW_MS) } },
    ...(cutoff <= now ? [{}] : []),
  ] }, select: { id: true } });
  if (expired.length) {
    const ids = expired.map(item => item.id);
    await tx.eventParticipant.updateMany({ where: { id: { in: ids }, status: "OFFERED" }, data: { status: "EXPIRED" } });
    await tx.eventEmail.updateMany({ where: { participantId: { in: ids }, kind: "SPOT_OFFERED", status: { in: ["PENDING", "SENDING"] } }, data: { status: "CANCELLED", leaseToken: null, leaseUntil: null } });
  }
  await tx.event.update({ where: { id: eventId }, data: { waitingListCheckedAt: now } });
  if (cutoff <= now) return;
  const reserved = await tx.eventParticipant.count({ where: { eventId, status: { in: ["ACCEPTED", "OFFERED"] } } });
  const slots = capacity - reserved;
  if (slots <= 0) return;
  const next = await tx.eventParticipant.findMany({
    where: { eventId, status: "WAITLISTED" },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    take: slots,
    select: { id: true, parentId: true, offerVersion: true },
  });
  for (const participant of next) {
    const version = participant.offerVersion + 1;
    await tx.eventParticipant.update({ where: { id: participant.id }, data: { status: "OFFERED", offerVersion: version, offerCreatedAt: now, offerSentAt: null, offerExpiresAt: null } });
    await tx.eventEmail.create({ data: { uniqueKey: `offer:${participant.id}:${version}`, kind: "SPOT_OFFERED", eventId, parentId: participant.parentId, participantId: participant.id, offerVersion: version } });
  }
}

export function participationSummary(participants: { parentId: string; status: string; joinedAt: Date }[], parentId: string) {
  const mine = participants.find(p => p.parentId === parentId);
  return {
    participantCount: participants.filter(p => p.status === "ACCEPTED").length,
    waitingListCount: participants.filter(p => p.status === "WAITLISTED").length,
    offeredCount: participants.filter(p => p.status === "OFFERED").length,
    isJoined: !!mine && activeParticipation.some(status => status === mine.status),
    participationStatus: mine?.status ?? null,
    joinedAt: mine?.joinedAt ?? null,
  };
}
