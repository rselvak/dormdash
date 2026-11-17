"use client";

import { isPastEvent } from "@/lib/event-policy";
import { useEffect, useRef } from "react";
import { eventColorStyle } from "@/lib/event-color";
import { eventDay, localDate, type CalendarEvent } from "@/lib/event-ui";
import { timedEventLayout } from "@/lib/calendar-view";

export function calendarEventTime(event: CalendarEvent) {
  return event.allDay ? "All day" : new Date(event.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function eventName(event: CalendarEvent) {
  return (event.status === "CANCELLED" ? "Cancelled: " : event.status === "DRAFT" ? "Draft: " : "") + event.name;
}

export function CalendarTimeGrid({ dates, events, onOpen, onCreate }: {
  dates: Date[];
  events: CalendarEvent[];
  onOpen: (id: string) => void;
  onCreate: (day: string, hour?: number, allDay?: boolean) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const firstDay = localDate(dates[0]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 7 * 64; }, [firstDay]);
  const columns = `64px repeat(${dates.length}, minmax(0, 1fr))`;
  const today = localDate(new Date());
  return <div ref={scroll} className="max-h-[640px] overflow-auto rounded-xl border border-border bg-card" aria-label="Hourly calendar. Times shown in your local time zone.">
    <div className={dates.length === 7 ? "min-w-[800px]" : "min-w-[280px]"}>
      <div className="sticky top-0 z-20 bg-card shadow-sm">
        <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
          <div className="px-1 py-4 text-center text-[10px] text-muted">Local time</div>
          {dates.map(date => <div key={localDate(date)} className="border-l border-border p-2 text-center">
            <p className="text-xs text-muted">{date.toLocaleDateString("en-US", { weekday: "short" })}</p>
            <span aria-current={localDate(date) === today ? "date" : undefined} className={"mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold " + (localDate(date) === today ? "bg-accent text-accent-foreground" : "")}>{date.getDate()}</span>
          </div>)}
        </div>
        <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
          <span className="p-2 text-right text-xs text-muted">All day</span>
          {dates.map(date => <div key={localDate(date)} className="space-y-1 border-l border-border p-1">
            {events.filter(event => event.allDay && eventDay(event) === localDate(date)).map(event => <button key={event.id} type="button" onClick={() => onOpen(event.id)} style={isPastEvent(event)?{backgroundColor:"#e5e7eb",color:"#6b7280",filter:"grayscale(1)"}:eventColorStyle(event.color, event.type)} className="block w-full truncate rounded px-2 py-1 text-left text-xs font-medium" title={eventName(event)}>{eventName(event)}</button>)}
            <button type="button" disabled={localDate(date)<today} onClick={e => {if(e.detail===0)onCreate(localDate(date), undefined, true)}} onDoubleClick={() => onCreate(localDate(date), undefined, true)} className="w-full rounded px-1 text-left text-xs text-muted hover:bg-accent/10" aria-label={"Create all-day event on " + localDate(date)}>+</button>
          </div>)}
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: columns }}>
        <div>{Array.from({ length: 24 }, (_, hour) => <div key={hour} className="h-16 border-t border-border pr-2 pt-1 text-right text-[10px] text-muted">{hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}</div>)}</div>
        {dates.map(date => {
          const day = localDate(date);
          const timed = events.filter(event => !event.allDay && eventDay(event) === day);
          return <div key={day} className={"relative h-[1536px] border-l border-border " + (day === today ? "bg-accent/5" : "")}>
            {Array.from({ length: 24 }, (_, hour) => <button key={hour} type="button" disabled={new Date(day+"T"+String(hour).padStart(2,"0")+":00").getTime()<=Date.now()} onClick={e => {if(e.detail===0)onCreate(day,hour)}} onDoubleClick={() => onCreate(day,hour)} aria-label={`Create event on ${day} at ${hour}:00`} className="block h-16 w-full border-t border-border text-left disabled:bg-accent/5 disabled:cursor-not-allowed hover:bg-accent/10 focus-visible:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"><span className="block h-8 border-b border-dashed border-border/50" /></button>)}
            {timedEventLayout(timed).map(({ event, minute, duration, column, columns: count }) => <button key={event.id} type="button" onClick={() => onOpen(event.id)} title={`${calendarEventTime(event)} · ${eventName(event)}`} className="absolute z-10 overflow-hidden rounded border border-card px-1 py-0.5 text-left text-[11px] leading-tight shadow-sm hover:brightness-95 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-accent" style={{ ...(isPastEvent(event)?{backgroundColor:"#e5e7eb",color:"#6b7280",filter:"grayscale(1)"}:eventColorStyle(event.color, event.type)), top: minute / 60 * 64, height: duration / 60 * 64, left: `${column / count * 100}%`, width: `${100 / count}%` }}>
              <span className="block truncate font-semibold">{calendarEventTime(event)} · {eventName(event)}</span>
            </button>)}
          </div>;
        })}
      </div>
    </div>
  </div>;
}
