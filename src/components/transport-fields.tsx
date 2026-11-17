"use client";

export function TransportFields({ type, transportType, busStops, onTransportType, onBusStops, selectedStop, onSelectedStop }: {
  type: string; transportType: string; busStops: string[];
  onTransportType: (value: string) => void; onBusStops: (value: string[]) => void;
  selectedStop?: string; onSelectedStop?: (value: string) => void;
}) {
  if (type === "VANPOOL") return <label className="text-sm">Transport type *<select required value={transportType} onChange={e => onTransportType(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="">Choose Train or Bus</option><option value="TRAIN">Train</option><option value="BUS">Bus</option></select></label>;
  if (type !== "BUSPOOL") return null;
  return <fieldset className="space-y-2 rounded-lg border border-border p-3 sm:col-span-2"><legend className="px-1 text-sm font-semibold">Bus stops *</legend><p className="text-xs text-muted">Add named stops. Each participant will choose a stop when joining.</p>{busStops.map((stop, index) => <div key={index} className="flex gap-2"><input aria-label={`Stop ${index + 1} name`} required maxLength={120} value={stop} onChange={e => onBusStops(busStops.map((value, i) => i === index ? e.target.value : value))} className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-sm"/><button type="button" aria-label={`Remove stop ${index + 1}`} onClick={() => onBusStops(busStops.filter((_, i) => i !== index))} className="text-sm underline">Remove</button></div>)}<button type="button" disabled={busStops.length >= 50} onClick={() => onBusStops([...busStops, ""])} className="rounded-full border border-border px-3 py-1 text-sm">+ Add stop</button>{onSelectedStop&&<label className="block text-sm">Your stop *<select required value={selectedStop||""} onChange={e=>onSelectedStop(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="">Select your stop</option>{busStops.filter(stop=>stop.trim()).map((stop,index)=><option key={index} value={stop.trim()}>{stop.trim()}</option>)}</select></label>}</fieldset>;
}
