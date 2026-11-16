import Link from "next/link";

const features = [
  { title: "Trips to and from college", icon: "route", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300", body: "Organize a Trip To College or Trip From College. Set the date, college, dorm, response deadline, and instructions so everyone knows the plan." },
  { title: "Package delivery", icon: "package", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", body: "Heading to campus? Offer to take packages for other students. On a Trip To College, parents can request package delivery, passenger transport, or both." },
  { title: "Ride Pool", icon: "car", color: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", body: "Make carpool plans with an origin, destination, and passenger limit. Find shared rides, or organize Amtrak and Buspool events with other parents." },
  { title: "Waiting lists that move", icon: "waiting", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300", body: "Let parents join a waiting list when an event is full. If an accepted participant withdraws, the earliest waiting participant moves into the available place." },
  { title: "Search your college community", icon: "search", color: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300", body: "Find published events for your students’ colleges. Narrow your search by event type, dates, dorm, or major, then open an event to view details and respond." },
  { title: "Your plans in My Events", icon: "calendar", color: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", body: "See Organizing, Accepted, Waiting list, and Past events in one place. Explore the colorful calendar and download events to your personal calendar." },
  { title: "Share to WhatsApp", icon: "chat", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", body: "Organizers can share published event details and a link to WhatsApp. Choose your chat or group, review the message, and tap Send." },
  { title: "Keep everyone informed", icon: "bell", color: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", body: "Cancel an event with a reason and notify accepted and waitlisted participants in the app. Download the participant list to Excel when it’s time to coordinate." },
] as const;

type IconName = typeof features[number]["icon"] | "shield";
function FeatureIcon({ name, className = "size-6" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    route: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v8a4 4 0 0 0 8 0V9a4 4 0 0 1 4-4h2"/></>,
    package: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v9M7.5 5.5l9 5"/></>,
    car: <><path d="m5 7 2-4h10l2 4M4 7h16l2 6v6H2v-6l2-6ZM2 13h20M5 19v2M19 19v2M6 10h1M17 10h1"/></>,
    waiting: <><path d="M4 5h9M4 10h6M4 15h4"/><circle cx="16" cy="15" r="6"/><path d="M16 12v3l2 1"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18m-14 5 3 3 6-6"/></>,
    chat: <><path d="M21 11.5a9 9 0 0 1-13 8L3 21l1.5-5a9 9 0 1 1 16.5-4.5Z"/><path d="M8 9c1 4 3 6 7 7l2-2-3-2-1 1-2-2 1-1-2-3-2 2Z"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
  };
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function LandingPage() {
  return <div className="mx-auto w-full max-w-5xl px-4">
    <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.2fr_1fr]" aria-labelledby="welcome-heading">
      <div>
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true"/>For parents. For students. For the journey.</p>
        <h1 id="welcome-heading" className="text-4xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">College plans.<br/><span className="text-accent">A community to share them.</span></h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">DormDash helps parents coordinate campus trips, share rides, and send packages to their students. Find the right event, reserve a place, and keep your plans together.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/sign-up" className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">Join DormDash</Link>
          <Link href="/sign-in" className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-6 py-3 text-sm font-semibold transition-colors hover:border-accent">Sign in</Link>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">Create an account, add your student, and connect through their college.</p>
      </div>
      <div className="relative rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-100 via-violet-50 to-emerald-50 p-5 dark:border-indigo-900 dark:from-indigo-950/70 dark:via-violet-950/30 dark:to-emerald-950/30 sm:p-7" aria-label="Illustration of planning a college trip">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">A little planning. A lot of connection.</p>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-indigo-900/5">
          <div className="flex items-start justify-between gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><FeatureIcon name="route"/></span><span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">Example trip</span></div>
          <h2 className="mt-4 text-xl font-semibold">Heading to campus?</h2>
          <p className="mt-1 text-sm text-muted">Bring a passenger. Take a package. Help a family.</p>
          <div className="my-5 flex items-center justify-between gap-2 rounded-xl border border-dashed border-indigo-300 bg-accent/5 p-3 text-sm dark:border-indigo-800"><span>Home</span><span className="text-accent" aria-hidden="true">→</span><span>College</span></div>
          <div className="flex flex-wrap gap-2"><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">Passenger transport</span><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">Package delivery</span></div>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-card p-4 dark:border-emerald-900"><span className="text-emerald-700 dark:text-emerald-400"><FeatureIcon name="waiting"/></span><div><p className="text-sm font-semibold">Full event? Stay in line.</p><p className="mt-1 text-xs leading-5 text-muted">An optional waiting list helps the next parent get a place when one opens.</p></div></div>
      </div>
    </section>

    <section aria-labelledby="features-heading" className="pb-14">
      <div className="mb-6 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-widest text-accent">Made for college families</p><h2 id="features-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">From the first plan to the campus drop-off.</h2><p className="mt-3 text-sm leading-6 text-muted">The tools to organize, discover, and manage the events that bring your college community together.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">{features.map(feature=><article key={feature.title} className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6"><span className={`mb-4 flex size-11 items-center justify-center rounded-xl ${feature.color}`}><FeatureIcon name={feature.icon}/></span><h3 className="text-lg font-semibold">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p></article>)}</div>
    </section>

    <section aria-labelledby="how-it-works-heading" className="mb-14 rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 id="how-it-works-heading" className="text-2xl font-semibold">Your next campus connection starts here.</h2>
      <ol className="mt-6 grid gap-6 sm:grid-cols-3">{[
        ["Add your student", "Choose their college, major, and residence so you can find the community that matters to your family."],
        ["Find or create an event", "Search for a ride or campus trip, or organize your own and choose the services you can offer."],
        ["Keep your plans together", "Select your student when responding. Track your commitments in My Events and share event details with your group."],
      ].map(([title,body],index)=><li key={title}><span className="mb-3 flex size-8 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent" aria-hidden="true">{index+1}</span><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{body}</p></li>)}</ol>
    </section>

    <section aria-labelledby="security-heading" className="mb-14 rounded-3xl border-2 border-emerald-300 bg-emerald-50/60 p-6 dark:border-emerald-800 dark:bg-emerald-950/20 sm:p-8">
      <div className="flex items-center gap-3"><span className="text-emerald-700 dark:text-emerald-400"><FeatureIcon name="shield" className="size-8"/></span><h2 id="security-heading" className="text-2xl font-semibold">Your community, with thoughtful access.</h2></div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Sign in to take part. DormDash checks who can view and manage events, and keeps your private drafts private.</p>
      <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">{["Secure account sign-in and session management", "Published event discovery for your students’ colleges", "Organizer controls for editing and cancellation", "Private drafts visible only to their creator"].map(item=><li key={item} className="flex items-start gap-2"><span className="font-bold text-emerald-700 dark:text-emerald-400" aria-hidden="true">✓</span>{item}</li>)}</ul>
    </section>

    <section className="mb-12 rounded-3xl bg-indigo-700 px-6 py-9 text-center text-white sm:px-10"><h2 className="text-2xl font-semibold sm:text-3xl">Make the next trip a shared one.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-indigo-100">A ride, a package, a plan to meet your student. Bring your college community along with DormDash.</p><Link href="/sign-up" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-50">Create your account</Link></section>
  </div>;
}
