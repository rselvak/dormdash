import { eventDay, eventTypes } from "@/lib/event-ui";
import { serviceSummary, type TripService } from "@/lib/trip-services";

type CalendarDownloadEvent = {
  id: string; name: string; startsAt: Date; endsAt: Date | null; allDay: boolean; timeZone: string;
  updatedAt: Date; status: string; type: string; college: string | null; dorm: string | null;
  instructions: string | null; cancellationReason?: string | null; dueAt: Date | null; services: TripService[];
};

// RFC 5545 text escaping prevents line breaks in event content from creating properties.
function text(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
function timestamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function date(value: Date, timeZone: string) {
  return eventDay({ startsAt: value.toISOString(), allDay: true, timeZone }).replace(/-/g, "");
}
// Fold at 75 UTF-8 octets without splitting a multibyte character.
function fold(line: string) {
  const result: string[] = [];
  let current = "", bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) { result.push(current); current = " "; bytes = 1; }
    current += character; bytes += size;
  }
  result.push(current);
  return result.join("\r\n");
}

export function eventCalendarFile(event: CalendarDownloadEvent, eventUrl: string, now = new Date()) {
  const type = eventTypes.find(item => item.value === event.type)?.label ?? event.type;
  const notes = [
    `Event type: ${type}`,
    event.status === "CANCELLED" ? `Cancelled: ${event.cancellationReason || "Contact the organizer for details."}` : null,
    event.instructions,
    event.services.length ? `Services offered: ${serviceSummary(event.services)}` : null,
    event.dueAt ? `Respond to event by: ${event.dueAt.toLocaleString("en-US", { timeZone: event.timeZone })} (${event.timeZone})` : null,
    `Event details: ${eventUrl}`,
    "This is a saved copy. Check DormDash for event changes.",
  ].filter(Boolean).join("\n\n");
  const timing = event.allDay ? (() => {
    const start = date(event.startsAt, event.timeZone);
    let end: string;
    if (event.endsAt) end = date(event.endsAt, event.timeZone);
    else {
      const next = new Date(`${start.slice(0,4)}-${start.slice(4,6)}-${start.slice(6,8)}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate()+1);
      end = next.toISOString().slice(0,10).replace(/-/g, "");
    }
    return [`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`];
  })() : [`DTSTART:${timestamp(event.startsAt)}`, ...(event.endsAt && event.endsAt > event.startsAt ? [`DTEND:${timestamp(event.endsAt)}`] : [])];
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DormDash//Event Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${text(event.id)}@dormdash`, `DTSTAMP:${timestamp(now)}`, `LAST-MODIFIED:${timestamp(event.updatedAt)}`,
    ...timing, `SUMMARY:${text(event.name)}`, `DESCRIPTION:${text(notes)}`,
    `LOCATION:${text([event.college,event.dorm].filter(Boolean).join(" - "))}`,
    `URL:${eventUrl.replace(/[\r\n]/g, "")}`, "CLASS:PRIVATE", `STATUS:${event.status === "CANCELLED" ? "CANCELLED" : event.status === "DRAFT" ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(fold).join("\r\n");
}
