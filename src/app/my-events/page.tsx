import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { getRegistration } from "@/lib/registrations";
import { MyEvents } from "@/components/my-events";

export const metadata: Metadata = { title: "My Events" };

export default async function MyEventsPage() {
  await auth.protect();
  const { userId } = await auth();
  const registration = userId ? await getRegistration(userId) : null;
  return <main className="mx-auto w-full max-w-5xl px-4 py-10">
    <h1 className="text-2xl font-semibold">My Events</h1>
    {registration ? <><p className="mt-2 text-sm text-muted">Find events you organize, your confirmed places, and your waiting lists.</p><MyEvents colleges={[...new Set(registration.students.map(student => student.college.trim()))]} /></> : <p className="mt-3 text-muted">Complete your <Link href="/profile" className="underline">parent and student registration</Link> to see your events.</p>}
  </main>;
}
