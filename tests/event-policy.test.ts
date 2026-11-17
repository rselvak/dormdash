import { describe, expect, it } from "vitest";
import { canCreateSchedule, isPastEvent } from "@/lib/event-policy";
import { z } from "zod";
import { ridePoolFields, validateRidePool } from "@/lib/ride-pool";

const now = Date.parse("2026-11-17T20:00:00Z");
describe("event time rules", () => {
  it("rejects past and already-started timed events", () => {
    expect(canCreateSchedule({ startsAt: new Date(now - 1) }, now)).toBe(false);
    expect(canCreateSchedule({ startsAt: new Date(now) }, now)).toBe(false);
    expect(canCreateSchedule({ startsAt: new Date(now + 1) }, now)).toBe(true);
  });
  it("keeps today's all-day events active until their exclusive end", () => {
    const event = { startsAt: "2026-11-17T08:00:00Z", endsAt: "2026-11-18T08:00:00Z", allDay: true };
    expect(isPastEvent(event, now)).toBe(false);
    expect(isPastEvent(event, Date.parse(event.endsAt))).toBe(true);
  });
  it("rejects creating an all-day event on a past date even with a future end", () => {
    expect(canCreateSchedule({ startsAt: "2026-11-16T08:00:00Z", endsAt: "2026-11-18T08:00:00Z", allDay: true, timeZone: "America/Los_Angeles" }, now)).toBe(false);
  });
});

const route = z.object({ type: z.string(), ...ridePoolFields }).superRefine(validateRidePool);
describe("transport routes and named stops", () => {
  it.each(["COLLEGE_DROP_OFF", "VANPOOL", "CARPOOL"])("requires source and destination for %s", type => {
    expect(route.safeParse({ type, transportType: "TRAIN" }).success).toBe(false);
    expect(route.safeParse({ type, origin: "Campus", destination: "Station", transportType: "TRAIN" }).success).toBe(true);
  });
  it("requires Train or Bus for public transport", () => {
    expect(route.safeParse({ type: "VANPOOL", origin: "Campus", destination: "Station" }).success).toBe(false);
    expect(route.safeParse({ type: "VANPOOL", origin: "Campus", destination: "Station", transportType: "BUS" }).success).toBe(true);
  });
  it("requires nonempty, unique bus stop names", () => {
    for (const busStops of [[], [""], ["Main Gate", "main gate"], [" Main Gate ", "Main Gate"]]) expect(route.safeParse({ type: "BUSPOOL", busStops }).success).toBe(false);
    expect(route.parse({ type: "BUSPOOL", busStops: [" Main Gate ", "Station"] }).busStops).toEqual(["Main Gate", "Station"]);
  });
});
