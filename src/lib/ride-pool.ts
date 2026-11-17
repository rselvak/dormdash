import { z } from "zod";

export const ridePoolFields = {
  origin: z.string().trim().max(300).nullable().optional(),
  destination: z.string().trim().max(300).nullable().optional(),
  transportType: z.enum(["TRAIN", "BUS"]).nullable().optional(),
  busStops: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
};

export function validateRidePool(value: { type: string; origin?: string | null; destination?: string | null; transportType?: string | null; busStops?: string[] }, ctx: z.RefinementCtx) {
  if (value.type === "VANPOOL" && !value.transportType) ctx.addIssue({ code: "custom", path: ["transportType"], message: "Choose Train or Bus for Public Transport." });
  if (value.type === "BUSPOOL" && (!value.busStops?.length || new Set(value.busStops.map(stop => stop.toLowerCase())).size !== value.busStops.length)) ctx.addIssue({ code: "custom", path: ["busStops"], message: "Add at least one stop and give each stop a unique name." });
  if (!["CARPOOL", "COLLEGE_DROP_OFF", "VANPOOL"].includes(value.type)) return;
  for (const field of ["origin", "destination"] as const) {
    if (!value[field]) ctx.addIssue({ code: "custom", path: [field], message: `${field === "origin" ? "Source" : "Destination"} is required for this trip.` });
  }
}
