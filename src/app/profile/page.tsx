import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";

import { getRegistration, type Registration } from "@/lib/registrations";
import { initials } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Profile",
};

function formatDate(value?: number | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

const yearLabels = ["", "1st year", "2nd year", "3rd year", "4th year"];

function StudentCard({
  student,
  index,
}: {
  student: Registration["students"][number];
  index: number;
}) {
  const details = [
    { label: "Email", value: student.email },
    { label: "Phone", value: student.phone ?? "Not provided" },
    { label: "College", value: student.college },
    { label: "Dorm", value: student.dorm ?? "Not provided" },
    {
      label: "Year",
      value: student.year ? (yearLabels[student.year] ?? "—") : "Not provided",
    },
    { label: "Major", value: student.major },
  ];

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Student {index + 1}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold">
            {student.name}
          </h3>
        </div>
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
        >
          {initials(student.name, student.email)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {details.map((detail) => (
          <div key={detail.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              {detail.label}
            </dt>
            <dd className="mt-0.5 text-sm break-words">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export default async function ProfilePage() {
  await auth.protect();

  const { userId } = await auth();
  const user = await currentUser();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  let registration: Registration | null = null;
  let databaseError = false;

  if (userId) {
    try {
      registration = await getRegistration(userId);
    } catch (error) {
      databaseError = true;
      console.error("Failed to load registration", error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground"
        >
          {initials(name, email)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {name || "Welcome"}
          </h1>
          <p className="truncate text-sm text-muted">
            {email ?? "Signed in"}
          </p>
        </div>
      </div>

      {registration ? (
        <>
          <section
            aria-labelledby="family-heading"
            className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="family-heading" className="text-base font-semibold">
                Family details
              </h2>
              <p className="text-xs text-muted">
                Registered {formatDate(registration.createdAt.getTime())}
              </p>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Parent 1
                </dt>
                <dd className="mt-1 text-sm">
                  <span className="font-medium">{registration.name}</span>
                  <br />
                  {registration.email}
                  <br />
                  {registration.phone}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Parent 2
                </dt>
                <dd className="mt-1 text-sm">
                  {registration.parent2Name ? (
                    <>
                      <span className="font-medium">
                        {registration.parent2Name}
                      </span>
                      <br />
                      {registration.parent2Email}
                      <br />
                      {registration.parent2Phone}
                    </>
                  ) : (
                    <span className="text-muted">Not provided</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="students-heading" className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="students-heading" className="text-base font-semibold">
                  Students
                </h2>
                <p className="text-xs text-muted">
                  {registration.students.length}{" "}
                  {registration.students.length === 1 ? "student" : "students"}{" "}
                  registered
                </p>
              </div>

              <Link
                href="/dashboard/students/new"
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:border-accent"
              >
                + Add another child
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {registration.students.map((student, index) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  index={index}
                />
              ))}
            </div>
          </section>

          <p className="mt-8 text-xs text-muted">
            Account member since {formatDate(user?.createdAt)}. Parent 1&apos;s
            email is the login id for this account.
          </p>
        </>
      ) : databaseError ? (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">
            We couldn&apos;t load your registration
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Your account is signed in, but the database did not respond. Refresh
            the page in a moment. If it keeps happening, the database connection
            for this environment needs to be checked.
          </p>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">
            Finish your registration
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Your account is created, but we do not have your family details yet.
            Add the parent and student information to start using DormDash.
          </p>
          <Link
            href="/sign-up"
            className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Complete registration
          </Link>
        </section>
      )}
    </div>
  );
}
