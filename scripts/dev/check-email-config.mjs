import { readFileSync } from "node:fs";
import { parse } from "dotenv";

// Report presence only. Never print an API key or sender email into workflow logs.
const config = parse(readFileSync(process.argv[2], "utf8"));
const keys = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "APP_URL"];
const configured = Object.fromEntries(keys.map(key => [key, !!config[key]?.trim()]));
let appOrigin = null;
try { appOrigin = new URL(config.APP_URL).origin; } catch { /* Not configured. */ }
console.log(JSON.stringify({ emailConfiguration: configured, appOrigin }));
if (!configured.BREVO_API_KEY || !configured.BREVO_SENDER_EMAIL) console.log("::warning::Brevo credentials are missing; optional student-verification email is disabled for this environment.");
if (!appOrigin) console.log("APP_URL is absent or invalid; verification links will use the Vercel deployment URL when available.");
