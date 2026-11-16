import { z } from "zod";

export const ridePoolFields = {
  origin: z.string().trim().max(300).nullable().optional(),
  destination: z.string().trim().max(300).nullable().optional(),
};

export function validateRidePool(value: { type: string; origin?: string | null; destination?: string | null }, ctx: z.RefinementCtx) {
  if (value.type !== "CARPOOL") return;
  for (const field of ["origin", "destination"] as const) {
    if (!value[field]) ctx.addIssue({ code: "custom", path: [field], message: `${field === "origin" ? "Origin" : "Destination"} is required for Ride Pool.` });
  }
}
