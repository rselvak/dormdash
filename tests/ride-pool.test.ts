import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ridePoolFields, validateRidePool } from "@/lib/ride-pool";

const schema = z.object({type:z.string(),...ridePoolFields}).superRefine(validateRidePool);
describe("Ride Pool locations",()=>{
  it("requires both locations, rejecting blank input",()=>{
    for(const value of [undefined,null,"","   "]){
      expect(schema.safeParse({type:"CARPOOL",origin:value,destination:"Stanford"}).success).toBe(false);
      expect(schema.safeParse({type:"CARPOOL",origin:"San Jose",destination:value}).success).toBe(false);
    }
  });
  it("trims valid locations and limits their length",()=>{
    expect(schema.parse({type:"CARPOOL",origin:" San Jose ",destination:" Stanford "})).toMatchObject({origin:"San Jose",destination:"Stanford"});
    expect(schema.safeParse({type:"CARPOOL",origin:"x".repeat(301),destination:"Stanford"}).success).toBe(false);
  });
  it("does not require a route for other event types",()=>{
    expect(schema.safeParse({type:"COLLEGE_PICKUP"}).success).toBe(true);
  });
});
