
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { getRegistration } from "@/lib/registrations";
import { EventSearch } from "@/components/event-search";

export const metadata: Metadata = { title: "Search events" };

export default async function SearchPage() {
  await auth.protect();

  const { userId } = await auth();
  const registration = userId ? await getRegistration(userId) : null;

  if (!registration) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Search events</h1>
        <p className="mt-3 text-muted">
          Complete your parent and student registration before searching events.
        </p>
      </main>
    );
  }

  const students = registration.students.map((s) => ({
    college: s.college,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Search events</h1>
      <p className="mt-2 text-sm text-muted">
        Find published events for colleges attended by your children.
      </p>
      <EventSearch
        colleges={[...new Set(students.map((s) => s.college.trim()))]}
        studentCount={students.length}
      />
    </main>
  );
}