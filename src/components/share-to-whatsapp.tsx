"use client";

import { type CalendarEvent, eventDateLabel, eventTypes } from "@/lib/event-ui";
import { serviceSummary } from "@/lib/trip-services";

export type ShareableEvent = Pick<CalendarEvent, "id" | "name" | "type" | "status" | "startsAt" | "allDay" | "timeZone" | "college" | "dorm" | "dueAt" | "services">;

export function ShareToWhatsApp({ event, isOwner }: { event: ShareableEvent; isOwner: boolean }) {
  if (!isOwner || event.status !== "PUBLISHED") return null;

  function share() {
    const link = new URL("/", window.location.origin);
    link.searchParams.set("event", event.id);
    const text = [
      event.name,
      eventTypes.find(type => type.value === event.type)?.label,
      eventDateLabel(event),
      [event.college, event.dorm].filter(Boolean).join(" · "),
      event.services.length ? `Services offered: ${serviceSummary(event.services)}` : null,
      event.dueAt ? `Respond to event by: ${new Date(event.dueAt).toLocaleString()}` : null,
      `View event and respond: ${link.href}`,
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return <button type="button" onClick={share} className="inline-flex rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">Share to WhatsApp</button>;
}
