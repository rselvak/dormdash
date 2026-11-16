import { auth } from "@clerk/nextjs/server";
import { EventsCalendar } from "@/components/events-calendar";
import { LandingPage } from "@/components/landing-page";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    return <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Home</h1>
      <p className="mt-1 text-sm text-muted">Plan trips, publish events, and discover rides shared by other parents.</p>
      <EventsCalendar />
    </main>;
  }
  return <LandingPage />;
}
