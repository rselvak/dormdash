export function emailAppUrl(env: Record<string, string | undefined> = process.env) {
  const deployment = env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined;
  const candidates = [
    ...(env.VERCEL_ENV === "preview" ? [deployment] : []),
    env.APP_URL, env.NEXT_PUBLIC_APP_URL, deployment,
    env.NODE_ENV === "development" ? "http://localhost:3000" : undefined,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      const local = !env.VERCEL_URL && env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
      if ((url.protocol === "https:" || local) && !url.username && !url.password) return url.origin;
    } catch { /* Ignore invalid configuration and try the deployment URL. */ }
  }
  return null;
}
