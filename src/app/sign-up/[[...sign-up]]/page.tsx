import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegistrationForm } from "@/components/registration-form";
import { getRegistration } from "@/lib/registrations";

export const metadata: Metadata = {
  title: "Sign up",
};

export default async function SignUpPage() {
  const { userId } = await auth();

  if (!userId) {
    return <RegistrationForm mode="signup" />;
  }

  const registration = await getRegistration(userId);

  if (registration) {
    redirect("/");
  }

  const user = await currentUser();
  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  return <RegistrationForm mode="onboarding" accountEmail={accountEmail} />;
}
