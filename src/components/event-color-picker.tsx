"use client";

import { useId } from "react";
import { eventColorStyle } from "@/lib/event-color";

const palette = [
  ["Blue", "#2563eb"], ["Emerald", "#059669"], ["Violet", "#7c3aed"],
  ["Orange", "#ea580c"], ["Cyan", "#0891b2"], ["Amber", "#d97706"], ["Pink", "#db2777"],
] as const;

export function EventColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const id = useId();
  return <fieldset className="space-y-2 sm:col-span-2">
    <legend className="text-sm font-medium">Event color</legend>
    <div className="flex flex-wrap items-center gap-2">
      {palette.map(([name, color]) => <button key={color} type="button" aria-label={name}
        aria-pressed={value.toLowerCase() === color} onClick={() => onChange(color)}
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={eventColorStyle(color, "")}>
        {value.toLowerCase() === color ? <span aria-hidden="true">✓</span> : null}
      </button>)}
      <label htmlFor={id} className="ml-2 text-sm">Custom color</label>
      <input id={id} type="color" value={value} onChange={event => onChange(event.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
      <span className="rounded px-3 py-1 text-xs font-medium" style={eventColorStyle(value, "")}>Event preview</span>
    </div>
  </fieldset>;
}
