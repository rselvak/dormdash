// Run in the test deployment workflow. Never print credential values.
const env = process.env;
if (env.GITHUB_REF !== "refs/heads/test") throw new Error("This setup is restricted to the test branch.");
const pooledHost = "ep-misty-water-bfugi5zd-pooler.c-5.us-west-2.aws.neon.tech";
const directHost = "ep-misty-water-bfugi5zd.c-5.us-west-2.aws.neon.tech";
for (const [key, host] of [["TEST_DATABASE_URL", pooledHost], ["TEST_DATABASE_URL_UNPOOLED", directHost]]) {
  if (!env[key] || new URL(env[key]).hostname !== host) throw new Error(`Unexpected development database target for ${key}`);
}
if (!env.TEST_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") || !env.TEST_CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Clerk development keys are required.");
for (const key of ["VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_ORG_ID"]) {
  if (!env[key]) throw new Error(`Missing ${key}`);
}

const variables = {
  DATABASE_URL: env.TEST_DATABASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: env.TEST_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: env.TEST_CLERK_SECRET_KEY,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/my-events",
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/my-events",
};
for (const [key, value] of Object.entries(variables)) {
  const url = new URL(`https://api.vercel.com/v10/projects/${encodeURIComponent(env.VERCEL_PROJECT_ID)}/env`);
  url.searchParams.set("teamId", env.VERCEL_ORG_ID);
  url.searchParams.set("upsert", "true");
  const response = await fetch(url, {
    method: "POST", headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, type: key === "DATABASE_URL" || key === "CLERK_SECRET_KEY" ? "sensitive" : "encrypted", target: ["preview"] }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    let detail = String(data.error?.message || data.error?.code || "Request rejected");
    for (const value of [...Object.values(variables), env.VERCEL_TOKEN]) {
      if (value && value.length > 8) detail = detail.replaceAll(value, "[redacted]");
    }
    throw new Error(`Unable to configure test preview variable ${key} (HTTP ${response.status}): ${detail}`);
  }
  console.log(`Configured ${key} for the test preview only.`);
}
