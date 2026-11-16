import { describe, expect, it } from "vitest";
import { z } from "zod";
import { scheduleFields, validateSchedule } from "@/lib/event-schedule";
import { eventDateLabel, scheduleInput } from "@/lib/event-ui";

const schema=z.object({...scheduleFields,startsAt:z.iso.datetime({offset:true}),dueAt:z.iso.datetime({offset:true}).nullable().optional()}).superRefine(validateSchedule);
describe("all-day events",()=>{
  it("uses the selected day, removes deadlines, and ends at the next local midnight",()=>{
    const result=scheduleInput("2026-11-15T09:30",true,"2026-11-14T12:00");
    expect(result.allDay).toBe(true);
    expect(result.dueAt).toBeNull();
    const start=new Date(result.startsAt),end=new Date(result.endsAt!);
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(0);
    expect(start.getDate()).toBe(15);
    expect(end.getDate()).toBe(16);
    expect(schema.safeParse(result).success).toBe(true);
  });
  it("retains timed event deadlines",()=>{
    const result=scheduleInput("2026-11-15T09:30",false,"2026-11-14T12:00");
    expect(result.allDay).toBe(false);
    expect(result.endsAt).toBeNull();
    expect(new Date(result.startsAt).getHours()).toBe(9);
    expect(result.dueAt).not.toBeNull();
  });
  it("rejects all-day schedules without a valid end or with a separate deadline",()=>{
    const startsAt="2026-11-15T00:00:00Z";
    expect(schema.safeParse({allDay:true,startsAt}).success).toBe(false);
    expect(schema.safeParse({allDay:true,startsAt,endsAt:startsAt}).success).toBe(false);
    expect(schema.safeParse({allDay:true,startsAt,endsAt:"2026-11-16T00:00:00Z",dueAt:startsAt}).success).toBe(false);
  });
  it("labels all-day dates in the event's timezone",()=>{
    expect(eventDateLabel({allDay:true,startsAt:"2026-11-15T08:00:00Z",timeZone:"America/Los_Angeles"})).toBe("11/15/2026 · All day");
  });
});
