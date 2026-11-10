"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

import { siteConfig } from "@/lib/site";

function ProfileIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-foreground"
          >
            D
          </span>
          <span className="text-base tracking-tight">{siteConfig.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link
            href="/"
            className="text-muted transition-colors hover:text-foreground"
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className="text-muted transition-colors hover:text-foreground"
          >
            Search
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </Show>
          <Show when="signed-in">
            <UserButton appearance={{ elements: { avatarBox: "size-9" } }}>
              <UserButton.MenuItems>
                <UserButton.Link label="My Profile" labelIcon={<ProfileIcon />} href="/profile" />
              </UserButton.MenuItems>
            </UserButton>
          </Show>
        </div>
      </div>
    </header>
  );
}
