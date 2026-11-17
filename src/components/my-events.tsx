"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EventDetailsDialog } from "@/components/event-details-dialog";
import { eventColorStyle } from "@/lib/event-color";
import { type CalendarEvent, eventDateLabel, eventTypes, readApi } from "@/lib/event-ui";
import { myEventLabels, myEventSections, type MyEventSection } from "@/lib/my-events";

type Event = {createdBy?:string}&Pick<CalendarEvent, "id" | "name" | "college" | "dorm" | "major" | "type" | "color" | "startsAt" | "allDay" | "timeZone" | "status" | "cancellationReason" | "isOwner" | "participationStatus" | "participantCount" | "maxParticipants" | "waitingListCount">;
const descriptions: Record<MyEventSection, string> = {
  organizing: "Upcoming events you created, including private drafts.",
  accepted: "Upcoming events where your place is confirmed. Events you organize are in Organizing.",
  waiting: "Upcoming events where you are on the waiting list.",
  past: "Events you organized or joined whose scheduled time has passed, newest first.",
};
const empty: Record<MyEventSection, string> = {
  organizing: "You have no upcoming events to organize.", accepted: "You have no upcoming accepted invitations.",
  waiting: "You are not on any upcoming waiting lists.", past: "You have no past events yet.",
};

export function MyEvents({ colleges }: { colleges: string[] }) {
  const [section, setSection] = useState<MyEventSection>("organizing");
  const [events, setEvents] = useState<Event[]>([]);
  const [counts, setCounts] = useState<Record<MyEventSection, number> | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const requestId = useRef(0);
  const invalidateRequest = useCallback(() => { requestId.current++; }, []);

  const load = useCallback(async (offset = 0) => {
    const id = ++requestId.current;
    setLoading(true);setError("");
    try {
      const data = await readApi(await fetch(`/api/my-events?section=${section}&offset=${offset}`, { cache: "no-store" }));
      if (id !== requestId.current) return;
      setEvents(current => offset ? [...current, ...data.events.filter((event: Event) => !current.some(item => item.id === event.id))] : data.events);
      setCounts(data.counts);setNextOffset(data.nextOffset);
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Unable to load your events");
    } finally { if (id === requestId.current) setLoading(false); }
  }, [section]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
    return invalidateRequest;
  }, [load, invalidateRequest]);

  return <section className="mt-6 space-y-5" aria-label="My event commitments">
    <div className="flex flex-wrap gap-2" aria-label="Event categories">{myEventSections.map(key => <button key={key} type="button" aria-pressed={section === key} onClick={() => { if (key !== section) { requestId.current++;setSection(key);setEvents([]);setNextOffset(null);setLoading(true);setError(""); } }} className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${section === key ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card hover:border-accent"}`}>{myEventLabels[key]}{counts ? ` (${counts[key]})` : ""}</button>)}</div>
    <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50/30 p-5 dark:border-indigo-700 dark:bg-indigo-950/15">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{myEventLabels[section]}</h2><p className="mt-1 text-sm text-muted">{descriptions[section]}</p></div><button type="button" disabled={loading} onClick={() => void load()} className="rounded-full border border-border px-3 py-2 text-sm disabled:opacity-50">Refresh</button></div>
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}<button type="button" onClick={() => void load()} className="ml-2 underline">Retry</button></p>}
      <div aria-busy={loading} className="mt-4 grid gap-3">{events.map((event, index) => <button key={event.id} type="button" onClick={() => setActiveId(event.id)} style={{ borderLeftColor: event.status === "CANCELLED" ? "#dc2626" : eventColorStyle(event.color, event.type).backgroundColor }} className={`w-full rounded-xl border-2 border-l-[6px] border-border p-4 text-left hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${section === "past" ? "grayscale opacity-60 " : ""}${index % 2 ? "bg-accent/5" : "bg-card"}`}>
        <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{event.name}</span><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${event.status === "CANCELLED" ? "border-red-500 text-red-700 dark:text-red-400" : "border-border"}`}>{event.status === "CANCELLED" ? "Cancelled" : event.status === "DRAFT" ? "Private draft" : event.isOwner ? "Organizing" : event.participationStatus === "WAITLISTED" ? "Waiting list" : "Accepted"}</span></span>
        <span className="mt-2 block text-sm">{eventDateLabel(event)}</span><span className="mt-1 block text-xs text-muted">Created by {event.createdBy||"Organizer"}</span>
        <span className="mt-1 block text-sm text-muted">{[event.college, eventTypes.find(type => type.value === event.type)?.label, event.dorm, event.major].filter(Boolean).join(" · ")}</span>
        {event.status === "CANCELLED" ? <span className="mt-2 block whitespace-pre-wrap break-words text-sm">Reason: {event.cancellationReason}</span> : <span className="mt-2 block text-xs text-muted">{event.participantCount} / {event.maxParticipants} participants{event.waitingListCount > 0 ? ` · ${event.waitingListCount} waiting` : ""}</span>}
        <span className="mt-3 block text-sm font-medium text-accent">View details &amp; actions →</span>
      </button>)}</div>
      {loading && <p role="status" className="mt-4 text-sm text-muted">Loading your events…</p>}
      {!loading && !error && !events.length && <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-sm"><p>{empty[section]}</p><Link href={section === "organizing" ? "/" : "/dashboard"} className="mt-3 inline-block font-medium text-accent underline">{section === "organizing" ? "Create an event" : "Search events"}</Link></div>}
      {!loading && nextOffset !== null && <button type="button" onClick={() => void load(nextOffset)} className="mt-4 rounded-full border-2 border-accent px-4 py-2 text-sm font-semibold">Load more</button>}
    </div>
    {activeId && <EventDetailsDialog key={activeId} eventId={activeId} colleges={colleges} onClose={() => setActiveId(null)} onChanged={() => load()} />}
  </section>;
}
