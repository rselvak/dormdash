import { auth } from "@clerk/nextjs/server";
import { SpotOfferPage } from "@/components/spot-offer-page";

export default async function OfferPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string; participant?: string; intent?: string }> }) {
  await auth.protect();
  const { id } = await params;
  const { version, intent, participant } = await searchParams;
  const parsed = Number(version);
  return <main className="mx-auto max-w-xl space-y-6 px-4 py-12"><h1 className="text-2xl font-semibold">Spot offered</h1>{Number.isSafeInteger(parsed)&&parsed>0&&participant?<SpotOfferPage participantId={participant} eventId={id} version={parsed} intent={intent}/>:<p>This offer link is invalid. Check My Events for your current status.</p>}</main>;
}
