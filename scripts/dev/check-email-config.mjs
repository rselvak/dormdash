import { readFileSync } from "node:fs";
import { parse } from "dotenv";

// Report presence only. Never print an API key or sender email into workflow logs.
const config = parse(readFileSync(process.argv[2], "utf8"));
const keys = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "APP_URL"];
const configured = Object.fromEntries(keys.map(key => [key, !!config[key]?.trim()]));
let appOrigin = null;
try { appOrigin = new URL(config.APP_URL).origin; } catch { /* Not configured. */ }
console.log(JSON.stringify({ emailConfiguration: configured, appOrigin }));
if (keys.some(key => !configured[key])) console.log("::warning::Optional student-verification email is not fully configured for this environment.");
