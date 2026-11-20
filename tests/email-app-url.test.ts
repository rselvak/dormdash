import { describe, expect, it } from "vitest";
import { emailAppUrl } from "@/lib/email-app-url";

describe("email verification app URLs",()=>{
  it("uses the current preview deployment instead of an old deployment or localhost",()=>{
    expect(emailAppUrl({VERCEL_ENV:"preview",VERCEL_URL:"current.vercel.app",APP_URL:"https://old.vercel.app"})).toBe("https://current.vercel.app");
  });
  it("uses the configured production domain and falls back from invalid configuration",()=>{
    expect(emailAppUrl({VERCEL_ENV:"production",VERCEL_URL:"current.vercel.app",APP_URL:"https://dormdash.example"})).toBe("https://dormdash.example");
    expect(emailAppUrl({VERCEL_ENV:"production",VERCEL_URL:"current.vercel.app",APP_URL:"not-a-url"})).toBe("https://current.vercel.app");
  });
  it("allows localhost only for local development",()=>{
    expect(emailAppUrl({NODE_ENV:"development"})).toBe("http://localhost:3000");
    expect(emailAppUrl({NODE_ENV:"production",APP_URL:"http://localhost:3000"})).toBeNull();
    expect(emailAppUrl({APP_URL:"javascript:alert(1)"})).toBeNull();
  });
});
