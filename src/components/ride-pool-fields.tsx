"use client";

export function RidePoolFields({ origin, destination, onOriginChange, onDestinationChange }: { origin: string; destination: string; onOriginChange: (value: string) => void; onDestinationChange: (value: string) => void }) {
  return <>
    <label className="text-sm">Origin *<input type="text" required maxLength={300} value={origin} onChange={e => onOriginChange(e.target.value)} placeholder="Starting location" className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
    <label className="text-sm">Destination *<input type="text" required maxLength={300} value={destination} onChange={e => onDestinationChange(e.target.value)} placeholder="Destination location" className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
  </>;
}
