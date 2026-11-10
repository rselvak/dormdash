import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await auth.protect();
  return <main className="mx-auto w-full max-w-5xl px-4 py-10" aria-label="Dashboard" />;
}
