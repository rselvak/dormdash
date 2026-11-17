export type CalendarView = "day" | "week" | "month";

// Events without an end time use a compact half-hour display block.
export function timedEventLayout<T extends { startsAt: string; endsAt: string | null }>(events: T[]) {
  const items = events.map(event => {
    const start = new Date(event.startsAt);
    const minute = start.getHours() * 60 + start.getMinutes();
    const elapsed = event.endsAt ? (Date.parse(event.endsAt) - start.getTime()) / 60000 : 30;
    return { event, minute, duration: Math.min(1440 - minute, Math.max(30, elapsed)), column: 0, columns: 1 };
  }).sort((a, b) => a.minute - b.minute);
  let group: typeof items = [];
  let groupEnd = -1;
  const finish = () => {
    const columns = Math.max(1, ...group.map(item => item.column + 1));
    group.forEach(item => { item.columns = columns; });
  };
  for (const item of items) {
    if (item.minute >= groupEnd) { finish(); group = []; groupEnd = -1; }
    const occupied = new Set(group.filter(other => other.minute + other.duration > item.minute).map(other => other.column));
    while (occupied.has(item.column)) item.column++;
    group.push(item);
    groupEnd = Math.max(groupEnd, item.minute + item.duration);
  }
  finish();
  return items;
}

export function calendarRange(date: Date, view: CalendarView) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (view === "month") start.setDate(1);
  if (view === "week") start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  if (view === "month") end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + (view === "week" ? 7 : 1));
  return { start, end };
}

export function moveCalendar(date: Date, view: CalendarView, direction: number) {
  const next = new Date(date);
  if (view === "month") {
    // Clamp the selected day so January 31 advances to February, not March.
    next.setDate(1);
    next.setMonth(next.getMonth() + direction);
    next.setDate(Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  } else next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1));
  return next;
}

export function calendarTitle(date: Date, view: CalendarView) {
  if (view === "month") return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (view === "day") return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const { start, end } = calendarRange(date, view);
  end.setDate(end.getDate() - 1);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).formatRange(start, end);
}
