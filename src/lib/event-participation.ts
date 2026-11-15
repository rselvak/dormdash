import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

export const waitingListFields = {
  waitingListAllowed: z.boolean().default(false),
  maxWaitingList: z.number().int().nonnegative().max(2147483647).nullable().optional(),
};

// Call only inside a transaction holding the event's FOR UPDATE row lock.
export async function promoteWaitingList(tx: Prisma.TransactionClient, eventId: string, capacity: number) {
  const accepted = await tx.eventParticipant.count({ where: { eventId, status: "ACCEPTED" } });
  const slots = capacity - accepted;
  if (slots <= 0) return;
  const next = await tx.eventParticipant.findMany({
    where: { eventId, status: "WAITLISTED" },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    take: slots,
    select: { id: true },
  });
  if (next.length) await tx.eventParticipant.updateMany({
    where: { id: { in: next.map(p => p.id) } },
    data: { status: "ACCEPTED" },
  });
}

export function participationSummary(participants: { parentId: string; status: string; joinedAt: Date }[], parentId: string) {
  const mine = participants.find(p => p.parentId === parentId);
  return {
    participantCount: participants.filter(p => p.status === "ACCEPTED").length,
    waitingListCount: participants.filter(p => p.status === "WAITLISTED").length,
    isJoined: !!mine,
    participationStatus: mine?.status ?? null,
    joinedAt: mine?.joinedAt ?? null,
  };
}
