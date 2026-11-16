import { z } from "zod";

export const scheduleFields = {
  allDay: z.boolean().default(false),
  endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
};

export function validateSchedule(value: { allDay: boolean; startsAt: string; endsAt?: string | null; dueAt?: string | null }, ctx: z.RefinementCtx) {
  if (value.allDay && (!value.endsAt || new Date(value.endsAt) <= new Date(value.startsAt))) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "An all-day event needs an end after its start." });
  }
  if (value.allDay && value.dueAt) ctx.addIssue({ code: "custom", path: ["dueAt"], message: "All-day events do not have a joining deadline." });
}
