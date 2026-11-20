"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";
import { sendStudentVerification } from "@/lib/student-email-verification";

export async function resendStudentVerification(studentId: string) {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "Sign in to request verification." };
  const parent = await getPrisma().parent.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
  if (!parent || typeof studentId !== "string" || studentId.length > 100) return { ok: false, message: "Student not found." };
  try {
    const result = await sendStudentVerification(studentId, parent.id);
    revalidatePath("/profile");
    return result;
  } catch { return { ok: false, message: "Unable to send verification. Try again shortly." }; }
}
