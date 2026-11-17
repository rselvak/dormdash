import { describe, expect, it } from "vitest";
import { calendarRange, calendarTitle, moveCalendar, timedEventLayout } from "@/lib/calendar-view";
import { localDate } from "@/lib/event-ui";

describe("calendar navigation", () => {
  it("positions events at their minute and separates overlapping event blocks", () => {
    const events = [
      { startsAt: new Date(2026, 10, 16, 9, 15).toISOString(), endsAt: null },
      { startsAt: new Date(2026, 10, 16, 9, 30).toISOString(), endsAt: null },
      { startsAt: new Date(2026, 10, 16, 10, 0).toISOString(), endsAt: null },
    ];
    const layout = timedEventLayout(events);
    expect(layout.map(item => item.minute)).toEqual([555, 570, 600]);
    expect(layout.map(item => item.column)).toEqual([0, 1, 0]);
    expect(layout.map(item => item.columns)).toEqual([2, 2, 1]);
  });
  it("keeps late-night events within their day and respects explicit duration", () => {
    const layout = timedEventLayout([
      { startsAt: new Date(2026, 10, 16, 23, 45).toISOString(), endsAt: null },
      { startsAt: new Date(2026, 10, 16, 9).toISOString(), endsAt: new Date(2026, 10, 16, 11).toISOString() },
    ]);
    expect(layout.map(item => item.duration)).toEqual([120, 15]);
  });
  it("clamps month navigation at month ends and handles leap years", () => {
    expect(localDate(moveCalendar(new Date(2026, 0, 31), "month", 1))).toBe("2026-02-28");
    expect(localDate(moveCalendar(new Date(2024, 2, 31), "month", -1))).toBe("2024-02-29");
    expect(localDate(moveCalendar(new Date(2026, 11, 16), "month", 1))).toBe("2027-01-16");
  });
  it("loads complete weeks across month and year boundaries", () => {
    const { start, end } = calendarRange(new Date(2027, 0, 1), "week");
    expect(localDate(start)).toBe("2026-12-27");
    expect(localDate(end)).toBe("2027-01-03");
    expect(calendarTitle(new Date(2027, 0, 1), "week")).toContain("2026");
    expect(calendarTitle(new Date(2027, 0, 1), "week")).toContain("2027");
  });
  it("moves by the selected period without mutating the selected date", () => {
    const date = new Date(2026, 10, 16);
    expect(localDate(moveCalendar(date, "week", -1))).toBe("2026-11-09");
    expect(localDate(moveCalendar(date, "day", 1))).toBe("2026-11-17");
    expect(localDate(date)).toBe("2026-11-16");
    const { start, end } = calendarRange(date, "day");
    expect(localDate(start)).toBe("2026-11-16");
    expect(localDate(end)).toBe("2026-11-17");
  });
});
