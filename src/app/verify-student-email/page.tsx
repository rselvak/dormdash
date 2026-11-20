import { ConfirmStudentEmail } from "@/components/confirm-student-email";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify college email", referrer: "no-referrer", robots: { index: false, follow: false } };

// Viewing a link never changes verification status; explicit confirmation defeats link scanners.
export default async function VerifyStudentEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="mx-auto max-w-xl space-y-5 px-4 py-12"><h1 className="text-2xl font-semibold">Verify college email</h1>{typeof token === "string" && /^[a-f0-9]{64}$/.test(token) ? <ConfirmStudentEmail token={token}/> : <p>This verification link is invalid. Ask your parent to send a new link from My Profile.</p>}</main>;
}
