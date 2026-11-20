export const OFFER_WINDOW_MS = 12 * 60 * 60 * 1000;
export const DELIVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const activeParticipation = ["ACCEPTED", "WAITLISTED", "OFFERED"] as const;
export function offerCutoff(event: { startsAt: Date; endsAt: Date | null; allDay: boolean; dueAt: Date | null }) {
  const end = event.allDay && event.endsAt ? event.endsAt : event.startsAt;
  return new Date(Math.min(end.getTime(), event.dueAt?.getTime() ?? Infinity));
}
export function offerDeadline(event: Parameters<typeof offerCutoff>[0], offeredAt: Date, awaitingParents = 1) {
  const remaining = Math.max(0, offerCutoff(event).getTime() - offeredAt.getTime());
  const window = Math.min(OFFER_WINDOW_MS, Math.floor(remaining / Math.max(1, awaitingParents)));
  return new Date(offeredAt.getTime() + window);
}
