import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk's middleware establishes the auth context for every request and adds a
 * nonce-aware Content-Security-Policy.
 *
 * Authorization is intentionally NOT done here. Clerk deprecates path-based
 * checks (`createRouteMatcher`) because they can drift from how Next.js routes
 * requests. Each protected page, layout, route handler, and Server Action calls
 * `auth.protect()` itself — see `src/app/dashboard/page.tsx`.
 */
export default clerkMiddleware({
  contentSecurityPolicy: {
    directives: {
      "img-src": ["'self'", "https://img.clerk.com", "data:", "blob:"],
    },
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets, always run on API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
