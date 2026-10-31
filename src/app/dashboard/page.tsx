import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";

import { initials } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

function formatDate(value?: number | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

export default async function DashboardPage() {
  // Defense in depth: the proxy already guards /dashboard, but every server
  // entry point re-checks authorization instead of trusting the edge alone.
  await auth.protect();

  const user = await currentUser();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  const details = [
    { label: "Email", value: email ?? "Not provided" },
    { label: "User ID", value: user?.id ?? "—", mono: true },
    { label: "Member since", value: formatDate(user?.createdAt) },
    { label: "Last sign in", value: formatDate(user?.lastSignInAt) },
  ];

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
            This page is only visible to signed-in users.
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {details.map((detail) => (
          <div
            key={detail.label}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              {detail.label}
            </dt>
            <dd
              className={`mt-1 text-sm break-words ${
                detail.mono ? "font-mono text-xs" : ""
              }`}
            >
              {detail.value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-base font-semibold">Recommended next steps</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>
            Turn on multi-factor authentication for your Clerk application in
            the dashboard.
          </li>
          <li>
            Connect a PostgreSQL database and add your first table with Prisma.
          </li>
          <li>
            Push to GitHub and let the CI workflow run lint, type checks, tests,
            and a production build.
          </li>
        </ul>
      </section>
    </div>
  );
}
