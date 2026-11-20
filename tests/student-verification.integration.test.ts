import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const mocks=vi.hoisted(()=>({db:null as unknown}));
vi.mock("@/lib/db",()=>({getPrisma:()=>mocks.db}));
import { confirmStudentVerification, sendStudentVerification, studentVerificationReset, verificationHash } from "@/lib/student-email-verification";

const url=process.env.DORMDASH_TEST_DATABASE_URL;
describe.skipIf(!url)("student verification database flow",()=>{
  let db:PrismaClient,parentId:string,studentId:string;
  const prefix=`student-verification-test-${crypto.randomUUID()}`;
  const fetcher=vi.fn();
  beforeAll(async()=>{
    db=new PrismaClient({adapter:new PrismaPg({connectionString:url!})});mocks.db=db;
    const parent=await db.parent.create({data:{clerkUserId:prefix,name:"Verification test",email:`${prefix}@example.test`,phone:"5551234567",students:{create:{name:"Test student",email:`${prefix}@stanford.edu`,college:"Stanford University",major:"Computer Science"}}},include:{students:true}});
    parentId=parent.id;studentId=parent.students[0].id;
  });
  beforeEach(async()=>{
    vi.stubEnv("BREVO_API_KEY","fake-test-key");vi.stubEnv("BREVO_SENDER_EMAIL","test@example.test");vi.stubEnv("APP_URL","https://dormdash.example");
    fetcher.mockReset().mockResolvedValue({ok:true});vi.stubGlobal("fetch",fetcher);
    await db.student.update({where:{id:studentId},data:{verifyCollegeEmail:true,collegeEmailVerifiedAt:null,emailVerificationTokenHash:null,emailVerificationExpiresAt:null,emailVerificationSentAt:null}});
  });
  afterAll(async()=>{
    vi.unstubAllGlobals();vi.unstubAllEnvs();
    if(db){if(parentId)await db.parent.delete({where:{id:parentId}});await db.$disconnect();}
  });
  const tokenFromEmail=()=>/token=([a-f0-9]{64})/.exec(JSON.parse(fetcher.mock.calls[0][1].body).textContent)![1];
  it("stores a hash, verifies once, and rejects replay",async()=>{
    expect((await sendStudentVerification(studentId,parentId)).ok).toBe(true);
    const token=tokenFromEmail();
    expect((await db.student.findUniqueOrThrow({where:{id:studentId}})).emailVerificationTokenHash).toBe(verificationHash(token));
    expect(await confirmStudentVerification(token)).toBe(true);
    expect(await confirmStudentVerification(token)).toBe(false);
    expect((await db.student.findUniqueOrThrow({where:{id:studentId}})).collegeEmailVerifiedAt).not.toBeNull();
  });
  it("allows only one concurrent resend and rejects other parents",async()=>{
    const results=await Promise.all([sendStudentVerification(studentId,parentId),sendStudentVerification(studentId,parentId)]);
    expect(results.filter(result=>result.ok)).toHaveLength(1);expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await sendStudentVerification(studentId,"another-parent")).ok).toBe(false);
  });
  it("rejects expired links and invalidates links when the toggle is turned off",async()=>{
    await sendStudentVerification(studentId,parentId);const token=tokenFromEmail();
    await db.student.update({where:{id:studentId},data:{emailVerificationExpiresAt:new Date(Date.now()-1000)}});
    expect(await confirmStudentVerification(token)).toBe(false);
    const current=await db.student.findUniqueOrThrow({where:{id:studentId}});
    await db.student.update({where:{id:studentId},data:{verifyCollegeEmail:false,...studentVerificationReset(current,{...current,verifyCollegeEmail:false})}});
    expect(await confirmStudentVerification(token)).toBe(false);
    expect((await sendStudentVerification(studentId,parentId)).ok).toBe(false);
  });
});
