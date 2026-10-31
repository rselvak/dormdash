# My App

A mobile-first web application with authentication, security headers, and a
test → production CI/CD pipeline.

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4
- **Auth:** Clerk (passwords, MFA, OAuth, sessions)
- **Mobile:** responsive UI + installable PWA manifest
- **CI/CD:** GitHub Actions → Vercel (test and production environments)

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your Clerk keys
npm run dev
```

Open <http://localhost:3000>.

If you do not have Clerk keys yet, run the Clerk CLI from the project root. It
can provision temporary development keys without an account:

```bash
npx clerk@latest init --accountless --framework next
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |

## Project structure

```
src/
├── app/
│   ├── dashboard/          Protected page (server-side auth check)
│   ├── sign-in/            Clerk sign-in route
│   ├── sign-up/            Clerk sign-up route
│   ├── layout.tsx          Root layout, metadata, PWA wiring
│   ├── manifest.ts         Web app manifest
│   └── page.tsx            Public landing page
├── components/             Header, mobile tab bar, footer
├── lib/                    Site config and small utilities
└── proxy.ts                Clerk middleware + route protection
tests/                      Vitest unit tests
.github/workflows/          CI, CodeQL, test deploy, prod deploy
```

> **Next.js 16 note:** the file that used to be `middleware.ts` is now
> `proxy.ts`, and `params` / `searchParams` / `cookies()` / `headers()` are
> async. The version-matched docs live in `node_modules/next/dist/docs/`.

## Authentication and authorization

Clerk handles credentials, MFA, OAuth, and session tokens. This app enforces
authorization in the server code itself:

- `src/proxy.ts` runs `clerkMiddleware()` to establish the auth context and add
  the Content-Security-Policy. It deliberately does **not** decide access.
- `src/app/dashboard/page.tsx` calls `await auth.protect()` before rendering.

Clerk deprecated path-based middleware checks (`createRouteMatcher`) because
path matching can drift from how Next.js routes requests. Check authorization in
every page, layout, route handler, and Server Action that touches protected
data — do not rely on the proxy alone.

Public routes: `/`, `/sign-in`, `/sign-up`. Everything under `/dashboard`
requires a session.

## CI/CD

### Continuous integration — `.github/workflows/ci.yml`

Runs on every push to `main`/`test` and every pull request:

1. `npm ci`
2. Lint
3. Typecheck
4. Unit tests
5. Production build
6. `npm audit --audit-level=high`

### Test environment — `.github/workflows/deploy-test.yml`

On push to the `test` branch: pull the Vercel preview environment, build,
deploy, then smoke test the URL. Every pull request also gets its own Vercel
preview URL through the Vercel GitHub integration.

### Production — `.github/workflows/deploy-prod.yml`

Production is a **manual** deploy. Merging to `main` runs CI but does not ship.
To release: **Actions → Deploy to Production → Run workflow**. The workflow
builds with `--prod`, deploys, then smoke tests the URL.

This is deliberate. GitHub Free does not allow required reviewers on private
repos, so a manual trigger is the gate that works on every plan. On a paid plan
you can add a required reviewer to the `production` environment for a second
approval step without changing the workflow.

### Required repository secrets

| Secret | Used by | Notes |
| --- | --- | --- |
| `VERCEL_TOKEN` | both deploy workflows | Vercel → Account → Tokens |
| `VERCEL_ORG_ID` | both deploy workflows | From `vercel link` / project settings |
| `VERCEL_PROJECT_ID` | both deploy workflows | From `vercel link` / project settings |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | CI build | Safe to expose; still keep it in secrets |
| `CLERK_SECRET_KEY` | CI build, deploys | **Never** commit this |

Set them under **Settings → Secrets and variables → Actions**. Scope the Vercel
ones to the `test` and `production` environments so production values are only
readable after deployment is triggered.

Until `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` exist, the deploy
workflows skip themselves with a notice instead of failing. CI keeps running.

### One-time setup

1. Create the GitHub repository and push this code.
2. Import the repository into Vercel and copy the project/org IDs.
3. Add the secrets above.
4. Create the `test` and `production` environments in GitHub.
5. Create a `test` branch (`git checkout -b test && git push -u origin test`).
6. Turn off Vercel Deployment Protection for the test environment, or add a
   bypass token to the smoke test, otherwise the check receives HTTP 401.

### Branch protection

`main` is protected by a ruleset named `protect-main`:

- no deletion and no force-push;
- the `Lint, typecheck, test, build` check must pass, and the branch must be up
  to date before merging.

That means changes land through a pull request, not a direct push. Rulesets and
required reviewers require a public repo or a paid plan.

### Rollback

Vercel keeps every deployment. Promote the previous one from the Vercel
dashboard. Keep database migrations backwards compatible (expand/contract) so a
rollback does not break the previous code.

## Adding a database

The recommended next step is PostgreSQL with Prisma:

```bash
npm install prisma @prisma/client
npx prisma init
```

Then add `DATABASE_URL` to `.env.local`, GitHub Environments, and Vercel, and
uncomment the `prisma migrate deploy` step in both deploy workflows.

## PWA notes

`src/app/manifest.ts` makes the app installable. `public/icons/icon.svg` is a
placeholder — add 192×192 and 512×512 PNG icons (plus an `apple-touch-icon.png`)
before shipping to iOS, which does not accept SVG icons.
