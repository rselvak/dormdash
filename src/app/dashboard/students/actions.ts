"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { addStudent, describeUniqueError } from "@/lib/registrations";
import {
  singleStudentFormSchema,
  toFieldErrors,
} from "@/lib/validation/registration";

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function addChild(input: unknown): Promise<ActionResult> {
  const { userId } = await auth();

  if (!userId) {
    return { ok: false, message: "Sign in again to add a student." };
  }

  const parsed = singleStudentFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  try {
    const student = await addStudent(userId, parsed.data.student);

    if (!student) {
      return {
        ok: false,
        message:
          "We couldn't find your registration. Finish registering before adding a student.",
      };
    }

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    const uniqueMessage = describeUniqueError(error);

    if (uniqueMessage) {
      return { ok: false, message: uniqueMessage };
    }

    console.error("Failed to add student", error);
    return {
      ok: false,
      message: "We couldn't add that student. Please try again.",
    };
  }
}
