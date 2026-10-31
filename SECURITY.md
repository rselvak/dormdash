# Security Policy

## Reporting a vulnerability

Do not open a public issue for security problems. Report privately through
GitHub's **Security → Report a vulnerability** tab, or email the maintainer
directly. Include reproduction steps and the affected version. You can expect an
acknowledgement within 3 business days.

## Supported versions

Only the latest production deployment is supported. There are no long-lived
release branches.

## What is already handled

| Area | Implementation |
| --- | --- |
| Password storage | Clerk (hashed server-side; this repo never sees a hash) |
| Sessions | Clerk session tokens in `httpOnly`, `Secure`, `SameSite` cookies |
| MFA | Available in Clerk (TOTP, SMS, passkeys, backup codes) |
| OAuth | Configured in the Clerk dashboard |
| Transport | HTTPS enforced; HSTS with `includeSubDomains; preload` |
| Headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| CSP | Nonce-aware policy injected by `clerkMiddleware` |
| Route protection | `auth.protect()` in each protected page, layout, route handler, and Server Action |
| Secrets | `.env*` gitignored except `.env.example`; production secrets in GitHub Environments |
| Supply chain | `npm audit` in CI, Dependabot, CodeQL |
| Framework disclosure | `poweredByHeader: false` |

## Rules for contributors

1. **Never commit secrets.** `.env.local` stays local. If a secret leaks,
   rotate it immediately in Clerk and Vercel — removing the commit is not
   enough.
2. **Authorize on the server.** Every route handler, Server Action, and server
   component that touches user data must call `auth()` and check ownership.
   The proxy only establishes auth context; it does not authorize requests.
3. **Validate input.** Parse every request body with a schema (Zod is the
   recommended choice) before it reaches the database.
4. **No string-built SQL.** Use parameterized queries or an ORM.
5. **Keep dependencies current.** Merge Dependabot PRs promptly; the CI audit
   step fails on high-severity advisories.

## Incident response

1. Rotate the affected credentials (Clerk secret key, Vercel token, database
   password).
2. Revoke active sessions in Clerk if user accounts may be compromised.
3. Roll back the deployment from Vercel if the issue is in application code.
4. Review audit logs and document the timeline.
