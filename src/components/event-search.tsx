"use client";

import { useMemo, useState } from "react";
import { DormSelect } from "@/components/dorm-select";
import { getCollegeMajors } from "@/lib/colleges";
import { eventDateLabel } from "@/lib/event-ui";
import { eventColorStyle } from "@/lib/event-color";
import { EventDetailsDialog } from "@/components/event-details-dialog";

const eventTypes = [
  ["", "All event types"], ["COLLEGE_PICKUP", "College pickup"], ["COLLEGE_DROP_OFF", "College drop-off"],
  ["CARPOOL", "Carpool"], ["VANPOOL", "Vanpool"], ["BUSPOOL", "Buspool"],
  ["PACKAGE_DELIVERY", "Package delivery"], ["ANNOUNCEMENT", "Announcement"],
] as const;
type Result = {allDay:boolean;timeZone:string; color: string | null; id: string; name: string; college: string | null; dorm: string | null; major: string | null; type: string; startsAt: string; participantCount: number; maxParticipants: number };

export function EventSearch({ colleges, studentCount }: { colleges: string[]; studentCount: number }) {
  const [college, setCollege] = useState(studentCount === 1 ? colleges[0] ?? "" : "");
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dorm, setDorm] = useState("");
  const [major, setMajor] = useState("");
  const majorOptions = useMemo(() => getCollegeMajors(college), [college]);
  const [events, setEvents] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  async function refreshResults() {
    if (!lastQuery) return;
    try {
      const response = await fetch("/api/events/search?" + lastQuery, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not refresh results");
      setEvents(body.events);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh results");
    }
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSearched(false);
    setEvents([]);
    if (!college) { setError("Select a college to search."); return; }
    if (Boolean(start) !== Boolean(end)) { setError("Enter both start and end dates to search a date range."); return; }
    if (start && end && start > end) { setError("Start date must not be after end date."); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ college });
      if (type) params.set("type", type);
      if (start && end) { params.set("start", start); params.set("end", end); }
      if (dorm.trim()) params.set("dorm", dorm.trim());
      if (major.trim()) params.set("major", major.trim());
      const response = await fetch("/api/events/search?" + params.toString(), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Search failed");
      setEvents(body.events);
      setLastQuery(params.toString());
      setSearched(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Search failed"); }
    finally { setLoading(false); }
  }

  return <div className="mt-6 space-y-6">
    <form onSubmit={search} className="grid gap-4 rounded-2xl border-2 border-indigo-400 border-l-4 bg-indigo-50/40 p-5 dark:border-indigo-500 dark:bg-indigo-950/20 sm:grid-cols-2 sm:p-6">
      <label className="text-sm font-medium">College <span className="text-red-600">*</span>
        <select required value={college} onChange={e => { setCollege(e.target.value); setDorm(""); setMajor(""); }} className="mt-2 w-full rounded-lg border border-border bg-background p-3">
          <option value="">Select a college</option>
          {colleges.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Event type
        <select value={type} onChange={e => setType(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-3">
          {eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Start date
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-3" />
      </label>
      <label className="text-sm font-medium">End date
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-3" />
      </label>
      <DormSelect key={college} college={college} value={dorm} onChange={setDorm} label="Dorm name" emptyLabel="Any dorm" />
      <label className="text-sm font-medium">Major name
        <select disabled={!college} value={major} onChange={e => setMajor(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-3 disabled:opacity-50">
          <option value="">{college ? "All majors" : "Choose a college first"}</option>
          {majorOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted sm:col-span-2">Without a complete date range, only upcoming events are included. Past events are available when you specify both dates.</p>
      <div className="sm:col-span-2"><button type="submit" disabled={loading || !college} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">{loading ? "Searching…" : "Search events"}</button></div>
    </form>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {searched && <section aria-live="polite" className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/30 p-5 dark:border-emerald-400 dark:bg-emerald-950/15"><h2 className="mb-3 text-lg font-semibold">{events.length} matching {events.length === 1 ? "event" : "events"}</h2>
      {events.length === 0 && <p className="text-sm text-muted">No published events match these filters. Try a different date range or fewer filters.</p>}
      <p className="mb-3 text-xs text-muted">Select an event to view details and available actions.</p>
      <div className="grid gap-3">{events.map((e, index) => <button key={e.id} type="button" onClick={() => setActiveId(e.id)} aria-label={`View details for ${e.name}`} style={{borderLeftColor:eventColorStyle(e.color,e.type).backgroundColor}} className={"w-full rounded-xl border-2 border-l-[6px] border-border p-5 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent "+(index%2===0?"bg-card":"bg-accent/5")}>
        <span className="block font-semibold">{e.name}</span>
        <span className="mt-2 block text-sm text-muted">{e.college} · {eventTypes.find(([value]) => value === e.type)?.[1] ?? e.type}</span>
        <span className="mt-1 block text-sm">{eventDateLabel(e)}</span>
        {(e.dorm || e.major) && <span className="mt-1 block text-sm text-muted">{[e.dorm && "Dorm: " + e.dorm, e.major && "Major: " + e.major].filter(Boolean).join(" · ")}</span>}
        <span className="mt-2 block text-xs text-muted">{e.participantCount} / {e.maxParticipants} participants</span>
        <span className="mt-3 block text-sm font-medium text-accent">View details &amp; actions →</span>
      </button>)}</div>
    </section>}
    {activeId && <EventDetailsDialog key={activeId} eventId={activeId} colleges={colleges} onClose={() => setActiveId(null)} onChanged={refreshResults} />}
  </div>;
}
