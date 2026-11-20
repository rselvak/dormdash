import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { matchesCollegeEmail } from "@/lib/college-email";
import { emailAppUrl } from "@/lib/email-app-url";

export const verificationHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function sendStudentVerification(studentId: string, parentId: string) {
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  const configuredUrl = emailAppUrl();
  if (!key || !sender || !configuredUrl) return { ok: false, message: "Verification email is not available yet. Your registration is saved." };
  const base = new URL(configuredUrl);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) return { ok: false, message: "Verification email is not available yet." };
  const db = getPrisma();
  const student = await db.student.findFirst({ where: { id: studentId, parentId } });
  if (!student || !student.verifyCollegeEmail) return { ok: false, message: "Save the student with college email verification enabled first." };
  if (student.collegeEmailVerifiedAt) return { ok: true, message: "College email is already verified." };
  if (!matchesCollegeEmail(student.email, student.college)) return { ok: false, message: "Use an email address from the selected college." };
  const token = randomBytes(32).toString("hex");
  const hash = verificationHash(token);
  const now = new Date();
  // A database compare-and-set prevents concurrent sends and limits resends to one/minute.
  const claim = await db.student.updateMany({ where: {
    id: studentId, parentId, email: student.email, college: student.college,
    verifyCollegeEmail: true, collegeEmailVerifiedAt: null,
    OR: [{ emailVerificationSentAt: null }, { emailVerificationSentAt: { lt: new Date(now.getTime() - 60000) } }],
  }, data: { emailVerificationTokenHash: hash, emailVerificationExpiresAt: new Date(now.getTime() + 86400000), emailVerificationSentAt: now } });
  if (!claim.count) return { ok: false, message: "Wait one minute before sending another verification email, then refresh your profile." };
  const link = new URL("/verify-student-email", base);
  link.searchParams.set("token", token);
  const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": key, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000), body: JSON.stringify({
      sender: { email: sender, name: process.env.BREVO_SENDER_NAME || "DormDash" },
      to: [{ email: student.email }], subject: "Verify your college email for DormDash",
      htmlContent: `<p>A parent requested email verification for a student at ${escape(student.college)} on DormDash.</p><p><a href="${escape(link.toString())}">Review and verify college email</a></p><p>This link expires in 24 hours. If you did not expect this request, ignore it.</p>`,
      textContent: `A parent requested college email verification for ${student.college} on DormDash. Review and confirm: ${link.toString()}\nThis link expires in 24 hours. Ignore it if you did not expect this request.`,
    }) });
    if (!response.ok) throw new Error("Email provider rejected request");
    return { ok: true, message: "Verification email sent. The student must open the link and confirm." };
  } catch {
    await db.student.updateMany({ where: { id: studentId, emailVerificationTokenHash: hash }, data: { emailVerificationTokenHash: null, emailVerificationExpiresAt: null } });
    return { ok: false, message: "The verification email could not be sent. Try again in a minute." };
  }
}

export async function sendPendingStudentVerifications(clerkUserId: string) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) return;
  const parent = await getPrisma().parent.findUnique({ where: { clerkUserId }, select: { id: true, students: { where: { verifyCollegeEmail: true, collegeEmailVerifiedAt: null }, select: { id: true } } } });
  if (!parent) return;
  // Mail failure must not turn a successfully saved family registration into an error.
  await Promise.allSettled(parent.students.map(student => sendStudentVerification(student.id, parent.id)));
}

export async function confirmStudentVerification(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const result = await getPrisma().student.updateMany({ where: { emailVerificationTokenHash: verificationHash(token), verifyCollegeEmail: true, collegeEmailVerifiedAt: null, emailVerificationExpiresAt: { gt: new Date() } }, data: { collegeEmailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationExpiresAt: null } });
  return result.count === 1;
}

export function studentVerificationReset(old: { email: string; college: string; verifyCollegeEmail: boolean }, next: { email: string; college: string; verifyCollegeEmail: boolean }) {
  return !next.verifyCollegeEmail || old.email.toLowerCase() !== next.email.toLowerCase() || old.college !== next.college || old.verifyCollegeEmail !== next.verifyCollegeEmail
    ? { collegeEmailVerifiedAt: null, emailVerificationTokenHash: null, emailVerificationExpiresAt: null }
    : {};
}
