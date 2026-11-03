import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AddChildForm } from "@/components/add-child-form";
import { getRegistration } from "@/lib/registrations";

export const metadata: Metadata = {
  title: "Add a student",
};

export default async function NewStudentPage() {
  await auth.protect();

  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const registration = await getRegistration(userId);

  if (!registration) {
    redirect("/sign-up");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <Link
        href="/dashboard"
        className="text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Add another child
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Register another student under {registration.name}&apos;s account. You
        can add up to 10 students in total.
      </p>

      <div className="mt-6">
        <AddChildForm />
      </div>
    </div>
  );
}
