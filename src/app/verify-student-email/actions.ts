"use server";

import { confirmStudentVerification } from "@/lib/student-email-verification";
import { revalidatePath } from "next/cache";

export async function verifyStudentEmail(token: string) {
  try {
    const ok = await confirmStudentVerification(token);
    if (ok) revalidatePath("/profile");
    return { ok, message: ok ? "College email verified. You can close this page." : "This link has expired, was already used, or is no longer valid. Ask your parent to send a new link from My Profile." };
  } catch { return { ok: false, message: "Verification is temporarily unavailable. Try again shortly." }; }
}
