import { describe, expect, it } from "vitest";
import { z } from "zod";
import { serviceSummary, tripServicesSchema, validateTripServices } from "@/lib/trip-services";
import { eventTypes } from "@/lib/event-ui";

const schema=z.object({type:z.string(),services:tripServicesSchema}).superRefine(validateTripServices);
describe("trip services",()=>{
  it.each([["PACKAGE_DELIVERY"],["PASSENGER_TRANSPORT"],["PACKAGE_DELIVERY","PASSENGER_TRANSPORT"]])("allows the service offering %j",(...services)=>{
    expect(schema.safeParse({type:"COLLEGE_PICKUP",services}).success).toBe(true);
  });
  it("requires a service for Trip To College and rejects unknown or duplicate services",()=>{
    expect(schema.safeParse({type:"COLLEGE_PICKUP",services:[]}).success).toBe(false);
    expect(tripServicesSchema.safeParse(["PACKAGE_DELIVERY","PACKAGE_DELIVERY"]).success).toBe(false);
    expect(tripServicesSchema.safeParse(["OTHER"]).success).toBe(false);
    expect(schema.safeParse({type:"CARPOOL",services:["PACKAGE_DELIVERY"]}).success).toBe(false);
  });
  it("uses the requested trip names and service descriptions",()=>{
    expect(eventTypes.find(type=>type.value==="COLLEGE_PICKUP")?.label).toBe("Trip To College");
    expect(eventTypes.find(type=>type.value==="COLLEGE_DROP_OFF")?.label).toBe("Trip From College");
    expect(serviceSummary(["PACKAGE_DELIVERY","PASSENGER_TRANSPORT"])).toBe("Package delivery + Passenger transport");
  });
});
