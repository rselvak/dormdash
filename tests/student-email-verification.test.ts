import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collegeEmailDomains, matchesCollegeEmail } from "@/lib/college-email";
import { studentSchema } from "@/lib/validation/registration";
import { emptyStudent } from "@/lib/registration-draft";

const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), auth:vi.fn(), parent:vi.fn() }));
vi.mock("@/lib/db", () => ({ getPrisma: () => ({ student: { findFirst: mocks.find, updateMany: mocks.update },parent:{findUnique:mocks.parent} }) }));
vi.mock("@clerk/nextjs/server",()=>({auth:mocks.auth}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { confirmStudentVerification, sendStudentVerification, studentVerificationReset, verificationHash } from "@/lib/student-email-verification";
import { resendStudentVerification } from "@/app/profile/student-verification-actions";

const student = { id: "student", parentId: "family", name: "Student", email: "student@stanford.edu", college: "Stanford University", major: "Computer Science", phone: "", dorm: "", year: null, verifyCollegeEmail: true, collegeEmailVerifiedAt: null };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BREVO_API_KEY", "test-secret");vi.stubEnv("BREVO_SENDER_EMAIL", "sender@example.test");vi.stubEnv("APP_URL", "https://dormdash.example");
  mocks.find.mockResolvedValue(student);mocks.update.mockResolvedValue({count:1});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe("optional college email checks", () => {
  it("defaults off and accepts non-college email addresses when off", () => {
    expect(emptyStudent().verifyCollegeEmail).toBe(false);
    expect(studentSchema.parse({...student,verifyCollegeEmail:undefined,email:"personal@example.test"}).verifyCollegeEmail).toBe(false);
  });
  it("checks exact college domains and legitimate subdomains, not generic .edu or lookalikes", () => {
    expect(collegeEmailDomains(student.college)).toContain("stanford.edu");
    expect(matchesCollegeEmail("student@sub.stanford.edu",student.college)).toBe(true);
    for(const email of ["student@berkeley.edu","student@stanford.edu.attacker.test","student@notstanford.edu"])expect(studentSchema.safeParse({...student,email}).success).toBe(false);
    expect(matchesCollegeEmail(student.email,"Unknown college")).toBe(false);
  });
  it("clears tokens and verification when email, college, or the toggle changes", () => {
    expect(studentVerificationReset(student,student)).toEqual({});
    for(const next of [{...student,email:"new@stanford.edu"},{...student,college:"Other"},{...student,verifyCollegeEmail:false}])expect(studentVerificationReset(student,next)).toMatchObject({collegeEmailVerifiedAt:null,emailVerificationTokenHash:null,emailVerificationExpiresAt:null});
  });
});
describe("verification sending and consumption", () => {
  it("stores only a hash and sends an expiring confirmation link to the saved student address", async () => {
    const fetcher=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal("fetch",fetcher);
    expect((await sendStudentVerification("student","family")).ok).toBe(true);
    expect(mocks.find).toHaveBeenCalledWith({where:{id:"student",parentId:"family"}});
    const payload=JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.to).toEqual([{email:student.email}]);
    const token=/token=([a-f0-9]{64})/.exec(payload.textContent)![1];
    expect(mocks.update.mock.calls[0][0].data.emailVerificationTokenHash).toBe(verificationHash(token));
    expect(JSON.stringify(mocks.update.mock.calls)).not.toContain(`"${token}"`);
    expect(mocks.update.mock.calls[0][0].data.emailVerificationExpiresAt.getTime()).toBeGreaterThan(Date.now()+23*3600000);
  });
  it("does not send when disabled, unconfigured, already verified, or rate limited", async () => {
    const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    vi.stubEnv("BREVO_API_KEY","");
    expect((await sendStudentVerification("student","family")).ok).toBe(false);
    vi.stubEnv("BREVO_API_KEY","test-secret");
    mocks.find.mockResolvedValueOnce({...student,verifyCollegeEmail:false});
    expect((await sendStudentVerification("student","family")).ok).toBe(false);
    mocks.find.mockResolvedValueOnce({...student,collegeEmailVerifiedAt:new Date()});
    expect((await sendStudentVerification("student","family")).ok).toBe(true);
    mocks.update.mockResolvedValueOnce({count:0});
    expect((await sendStudentVerification("student","family")).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("invalidates a failed delivery token without undoing the saved student", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false}));
    expect((await sendStudentVerification("student","family")).ok).toBe(false);
    expect(mocks.update.mock.calls[1][0].data).toEqual({emailVerificationTokenHash:null,emailVerificationExpiresAt:null});
  });
  it("atomically consumes only enabled, unexpired tokens and rejects replay", async () => {
    const token="a".repeat(64);
    expect(await confirmStudentVerification("invalid")).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(await confirmStudentVerification(token)).toBe(true);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({where:{emailVerificationTokenHash:verificationHash(token),verifyCollegeEmail:true,collegeEmailVerifiedAt:null,emailVerificationExpiresAt:{gt:expect.any(Date)}},data:{collegeEmailVerifiedAt:expect.any(Date),emailVerificationTokenHash:null,emailVerificationExpiresAt:null}});
    mocks.update.mockResolvedValueOnce({count:0});
    expect(await confirmStudentVerification(token)).toBe(false);
  });
  it("requires authentication and scopes resend requests to the parent", async()=>{
    mocks.auth.mockResolvedValueOnce({userId:null});
    expect((await resendStudentVerification("student")).ok).toBe(false);
    expect(mocks.find).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValueOnce({userId:"user"});mocks.parent.mockResolvedValueOnce({id:"family"});mocks.find.mockResolvedValueOnce(null);
    expect((await resendStudentVerification("another-familys-student")).ok).toBe(false);
    expect(mocks.find).toHaveBeenCalledWith({where:{id:"another-familys-student",parentId:"family"}});
  });
});
