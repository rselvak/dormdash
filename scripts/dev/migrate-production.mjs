import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";

// This file is populated by `vercel pull --environment=production` in the workflow.
const config = parse(readFileSync(".vercel/.env.production.local"));
if (!config.DATABASE_URL) throw new Error("Vercel production DATABASE_URL is missing");
const target = new URL(config.DATABASE_URL_UNPOOLED || config.DATABASE_URL);
if (target.hostname.endsWith(".neon.tech")) target.hostname = target.hostname.replace("-pooler.", ".");
if (target.hostname === "ep-misty-water-bfugi5zd.c-5.us-west-2.aws.neon.tech") throw new Error("Refusing to use the development database for production deployment");
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: target.toString() }, stdio: "inherit",
});
process.exit(result.status ?? 1);
