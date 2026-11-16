"use client";
import { TRIP_SERVICES, serviceLabels, type TripService } from "@/lib/trip-services";

export function TripServiceChoices({ value, onChange, offered = TRIP_SERVICES, label = "Services offered *" }: {
  value: TripService[]; onChange: (services: TripService[]) => void; offered?: readonly TripService[]; label?: string;
}) {
  return <fieldset className="space-y-2 rounded-lg border border-border p-3 sm:col-span-2">
    <legend className="px-1 text-sm font-medium">{label}</legend>
    <div className="flex flex-wrap gap-x-6 gap-y-2">{offered.map(service => <label key={service} className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={value.includes(service)} onChange={event => onChange(event.target.checked ? [...value, service] : value.filter(item => item !== service))}/>{serviceLabels[service]}
    </label>)}</div>
    <p className="text-xs text-muted">Choose one or both services.</p>
  </fieldset>;
}
