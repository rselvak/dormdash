import type { Prisma } from "@/generated/prisma/client";

export const myEventSections = ["organizing", "accepted", "waiting", "past"] as const;
export type MyEventSection = typeof myEventSections[number];
export const myEventLabels: Record<MyEventSection, string> = {
  organizing: "Organizing", accepted: "Accepted", waiting: "Waiting list", past: "Past events",
};

export function myEventFilters(parentId: string, now: Date): Record<MyEventSection, Prisma.EventWhereInput> {
  const upcoming: Prisma.EventWhereInput = { OR: [
    { allDay: true, endsAt: { gt: now } },
    { AND: [{ OR: [{ allDay: false }, { endsAt: null }] }, { startsAt: { gt: now } }] },
  ] };
  const ended: Prisma.EventWhereInput = { OR: [
    { allDay: true, endsAt: { lte: now } },
    { AND: [{ OR: [{ allDay: false }, { endsAt: null }] }, { startsAt: { lte: now } }] },
  ] };
  const visibleParticipation: Prisma.EventWhereInput = { status: { in: ["PUBLISHED", "CANCELLED"] }, participants: { some: { parentId } } };
  return {
    organizing: { AND: [{ parentId }, upcoming] },
    accepted: { AND: [{ parentId: { not: parentId }, status: { in: ["PUBLISHED", "CANCELLED"] }, participants: { some: { parentId, status: "ACCEPTED" } } }, upcoming] },
    waiting: { AND: [{ parentId: { not: parentId }, status: { in: ["PUBLISHED", "CANCELLED"] }, participants: { some: { parentId, status: { in: ["WAITLISTED", "OFFERED"] } } } }, upcoming] },
    past: { AND: [{ OR: [{ parentId }, visibleParticipation] }, ended] },
  };
}
