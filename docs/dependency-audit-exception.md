# Temporary development dependency audit exception

PR #33 passes build, lint, type checks, tests, and CodeQL. The remaining audit
failure is GHSA-fc5q-39xc-vjpf in Picomatch, with no published patched version
as of November 17, 2026 (latest: 4.0.7).

Picomatch is used by development tooling (Vitest/Vite and ESLint glob matching).
It is absent from `npm ls picomatch --omit=dev`. The exception does not fix the
underlying ReDoS vulnerability: development tools must not process untrusted
glob patterns. Application forms do not supply patterns to this tooling.

The CI exception is restricted to this exact advisory and dependent findings
whose complete installed paths are marked development-only in package-lock.json.
All other high/critical findings, including any production use of Picomatch,
remain blocking. Failed or unsupported audit responses also remain blocking.

The exception expires December 1, 2026 at 00:00 UTC. Upgrade every affected
Picomatch version and remove the exception as soon as a patched release exists.
Run `npm audit` to see the full unfiltered findings and `npm run audit:ci` to
evaluate the temporary policy. Moderate findings retain CI's existing behavior.
