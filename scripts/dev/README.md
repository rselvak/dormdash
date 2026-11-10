# DormDash development scripts (Windows PowerShell)

From the repository root:

| Command | Action |
| --- | --- |
| `npm run dev:setup` | Fast-forward pull the feature branch, install packages, generate Prisma, typecheck, and start Next.js |
| `npm run dev:check` | Typecheck, lint, and run tests |
| `npm run dev:db:status` | Read-only Prisma migration status |
| `npm run dev:db:migrate` | Confirm Neon development host and apply pending migrations |

Setup refuses to pull when the working tree is dirty, to protect local edits. It does not migrate databases.

**Database safety:** `dev:db:migrate` reads `.env.local`, shows the hostname, and asks for confirmation. A Neon hostname alone does not prove that the branch is a development branch. Check the exact host against the Neon console before confirming. Never run it against production. Prisma configuration files may override URL loading; verify the printed Prisma datasource target as well.

Keep secrets in local environment files, never commit connection strings.
