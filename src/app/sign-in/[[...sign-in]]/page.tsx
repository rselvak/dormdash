import { ClerkFailed, ClerkLoading, SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<p role="status" className="text-sm text-muted">Loading sign in…</p>}>
        <ClerkLoading>
          <p role="status" className="text-sm text-muted">Loading sign in…</p>
        </ClerkLoading>
        <ClerkFailed>
          <p role="alert" className="max-w-sm p-4 text-sm text-red-600">Sign in could not load. Check your internet connection and reload this page.</p>
        </ClerkFailed>
        <SignIn forceRedirectUrl="/" />
      </Suspense>
    </div>
  );
}
