"use client";

import { useState } from "react";

const eventTypes = [
  ["", "All event types"], ["COLLEGE_PICKUP", "College pickup"], ["COLLEGE_DROP_OFF", "College drop-off"],
  ["CARPOOL", "Carpool"], ["VANPOOL", "Vanpool"], ["BUSPOOL", "Buspool"],
  ["PACKAGE_DELIVERY", "Package delivery"], ["ANNOUNCEMENT", "Announcement"],
] as const;
type Result = { id: string; name: string; college: string | null; dorm: string | null; major: string | null; type: string; startsAt: string; participantCount: number; maxParticipants: number };

export function EventSearch({ colleges, studentCount }: { colleges: string[]; studentCount: number }) {
  const [college, setCollege] = useState(studentCount === 1 ? colleges[0] ?? "" : "");
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dorm, setDorm] = useState("");
  const [major, setMajor] = useState("");
  const [events, setEvents] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setSearched(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Search failed"); }
    finally { setLoading(false); }
  }

  return <div className="mt-6 space-y-6">
    <form onSubmit={search} className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-6">
      <label className="text-sm font-medium">College <span className="text-red-600">*</span>
        <select required value={college} onChange={e => setCollege(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-3">
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
      <label className="text-sm font-medium">Dorm name
        <input type="text" maxLength={120} placeholder="e.g. San Nicolas" value={dorm} onChange={e => setDorm(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-3" />
      </label>
      <label className="text-sm font-medium">Major name
        <input type="text" maxLength={120} placeholder="e.g. Computer Science" value={major} onChange={e => setMajor(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-3" />
      </label>
      <p className="text-xs text-muted sm:col-span-2">Without a complete date range, only upcoming events are included. Past events are available when you specify both dates.</p>
      <div className="sm:col-span-2"><button type="submit" disabled={loading || !college} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">{loading ? "Searching…" : "Search events"}</button></div>
    </form>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {searched && <section aria-live="polite"><h2 className="mb-3 text-lg font-semibold">{events.length} matching {events.length === 1 ? "event" : "events"}</h2>
      {events.length === 0 && <p className="text-sm text-muted">No published events match these filters. Try a different date range or fewer filters.</p>}
      <div className="grid gap-3">{events.map(e => <article key={e.id} className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold">{e.name}</h3>
        <p className="mt-2 text-sm text-muted">{e.college} · {eventTypes.find(([value]) => value === e.type)?.[1] ?? e.type}</p>
        <p className="mt-1 text-sm">{new Date(e.startsAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })}</p>
        {(e.dorm || e.major) && <p className="mt-1 text-sm text-muted">{[e.dorm && "Dorm: " + e.dorm, e.major && "Major: " + e.major].filter(Boolean).join(" · ")}</p>}
        <p className="mt-2 text-xs text-muted">{e.participantCount} / {e.maxParticipants} participants</p>
      </article>)}</div>
    </section>}
  </div>;
}
