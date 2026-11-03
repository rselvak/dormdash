"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  describeUniqueError,
  getRegistration,
  saveRegistration,
} from "@/lib/registrations";
import {
  registrationSchema,
  toFieldErrors,
} from "@/lib/validation/registration";

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * Saves the registration for the signed-in Clerk user. Called after Clerk has
 * verified the email and created the session.
 */
export async function completeRegistration(
  input: unknown,
): Promise<ActionResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false,
      message: "Your session expired. Sign in again to finish registering.",
    };
  }

  const parsed = registrationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  try {
    // The Clerk user may have been created, but the database write may have
    // failed or the response may have been lost. Treat an existing record as
    // success so a retry is always safe.
    const existing = await getRegistration(userId);

    if (existing) {
      return { ok: true };
    }

    // Parent 1's email is the login id, so it must match the verified Clerk
    // account email rather than an arbitrary value typed into the form.
    const user = await currentUser();
    const accountEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();

    if (accountEmail && accountEmail !== parsed.data.parent.email) {
      return {
        ok: false,
        message:
          "Parent 1's email must match the email on your account. Sign out and register again with the right address.",
        fieldErrors: {
          "parent.email":
            "This must match the email address you signed up with.",
        },
      };
    }

    await saveRegistration(userId, parsed.data);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    const uniqueMessage = describeUniqueError(error);

    if (uniqueMessage) {
      return { ok: false, message: uniqueMessage };
    }

    console.error("Failed to save registration", error);
    return {
      ok: false,
      message:
        "We couldn't save your registration. Your account was created; please try again.",
    };
  }
}
