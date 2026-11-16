import { z } from "zod";

export const TRIP_SERVICES = ["PACKAGE_DELIVERY", "PASSENGER_TRANSPORT"] as const;
export type TripService = typeof TRIP_SERVICES[number];
export const tripServicesSchema = z.array(z.enum(TRIP_SERVICES)).max(2).refine(values => new Set(values).size === values.length, "Choose each service only once.");
export const serviceLabels: Record<TripService, string> = { PACKAGE_DELIVERY: "Package delivery", PASSENGER_TRANSPORT: "Passenger transport" };
export function serviceSummary(services: readonly TripService[]) {
  return services.map(service => serviceLabels[service]).join(" + ");
}
export function validateTripServices(value: { type: string; services: TripService[] }, ctx: z.RefinementCtx) {
  if (value.type === "COLLEGE_PICKUP" && !value.services.length) ctx.addIssue({code:"custom",path:["services"],message:"Choose at least one service offered."});
  if (value.type !== "COLLEGE_PICKUP" && value.services.length) ctx.addIssue({code:"custom",path:["services"],message:"Services offered applies only to Trip To College."});
}
