import Link from "next/link";
import { Show, SignUpButton } from "@clerk/nextjs";

const features = [
  {
    title: "Secure authentication",
    body: "Clerk handles password hashing, MFA, OAuth, and session management. No security code for you to get wrong.",
  },
  {
    title: "Mobile-first by default",
    body: "One responsive codebase that adapts from a 360px phone to a desktop, and installs to the home screen as a PWA.",
  },
  {
    title: "Test and prod pipelines",
    body: "GitHub Actions runs lint, type checks, tests, and a build on every pull request, then gates production behind approval.",
  },
];

const checklist = [
  "Server-side authorization on every protected route",
  "Strict security headers and a Content-Security-Policy",
  "Secrets kept out of the repository",
  "Dependency and secret scanning in CI",
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="flex flex-col items-start gap-6 py-14 sm:py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          Mobile-first · PWA ready
        </span>

        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          A web app that is ready for phones, logins, and production on day one.
        </h1>

        <p className="max-w-xl text-base leading-7 text-muted sm:text-lg">
          Next.js and TypeScript for the whole stack, Clerk for authentication,
          and a GitHub Actions pipeline that ships to test and production
          environments.
        </p>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Show when="signed-out">
            <SignUpButton mode="modal">
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Create an account
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Open your dashboard
            </Link>
          </Show>
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-medium transition-colors hover:border-accent"
          >
            See the protected area
          </Link>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="pb-14">
        <h2 id="features-heading" className="sr-only">
          What is included
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="security-heading"
        className="mb-14 rounded-2xl border border-border bg-card p-6 sm:p-8"
      >
        <h2 id="security-heading" className="text-xl font-semibold">
          Security is the default, not a later ticket
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {checklist.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-muted">
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="mt-0.5 size-4 shrink-0 text-emerald-500"
                fill="none"
              >
                <path
                  d="m4 10.5 4 4 8-9"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
