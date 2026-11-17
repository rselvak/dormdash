type ScheduledEvent = { startsAt: string | Date; allDay?: boolean; endsAt?: string | Date | null; timeZone?: string };

// An all-day event remains current until its exclusive end at local midnight.
export function isPastEvent(event: ScheduledEvent, now = Date.now()) {
  return new Date(event.allDay && event.endsAt ? event.endsAt : event.startsAt).getTime() <= now;
}

export function canCreateSchedule(event: ScheduledEvent, now = Date.now()) {
  if (!event.allDay) return !isPastEvent(event, now);
  try {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const day = (value: Date) => {
    const parts = format.formatToParts(value);
    return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
  };
  return !isPastEvent(event, now) && day(new Date(event.startsAt)) >= day(new Date(now));
  } catch { return false; }
}
