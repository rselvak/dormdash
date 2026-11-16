import { z } from "zod";

export const scheduleFields = {
  allDay: z.boolean().default(false),
  endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
};

export function validateSchedule(value: { allDay: boolean; startsAt: string; endsAt?: string | null; dueAt?: string | null }, ctx: z.RefinementCtx) {
  if (value.allDay && (!value.endsAt || new Date(value.endsAt) <= new Date(value.startsAt))) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "An all-day event needs an end after its start." });
  }
  const limit=value.allDay ? value.endsAt : value.startsAt;
  if(value.dueAt && limit && (value.allDay ? new Date(value.dueAt)>=new Date(limit) : new Date(value.dueAt)>new Date(limit))) {
    ctx.addIssue({code:"custom",path:["dueAt"],message:value.allDay?"Response deadline must be before the all-day event ends.":"Response deadline must be on or before the event starts."});
  }
}
