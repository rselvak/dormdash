"use client";

import { useId, useState } from "react";
import { getDormOptions } from "@/lib/college-housing";
import { controlClass } from "@/components/registration/form-controls";

const OTHER = "__other_dorm__";

type Props = {
  college: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  label?: string;
  invalid?: boolean;
  emptyLabel?: string;
  inlineOther?: boolean;
};

// Parents key this component by college so changing campus clears custom mode.
export function DormSelect({ college, value, onChange, id, name, label, invalid, emptyLabel = "No dorm selected", inlineOther = false }: Props) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const options = getDormOptions(college);
  const [customMode, setCustomMode] = useState(false);
  // Preserve existing free-text dorms rather than silently replacing saved data.
  const custom = customMode || !!(value && !options.includes(value));
  return <div className={inlineOther ? "grid gap-x-4 gap-y-1.5 sm:grid-cols-2" : "space-y-1.5"}>
    <div className="space-y-1.5">
    {label && <label htmlFor={selectId} className="block text-sm">{label}</label>}
    <select id={selectId} name={custom ? undefined : name} value={custom ? OTHER : value}
      disabled={!college} aria-invalid={invalid || undefined} aria-describedby={`${selectId}-help`}
      className={controlClass(invalid)} onChange={event => {
        setCustomMode(event.target.value === OTHER);
        onChange(event.target.value === OTHER ? "" : event.target.value);
      }}>
      <option value="">{college ? emptyLabel : "Choose a college first"}</option>
      {options.map(dorm => <option key={dorm} value={dorm}>{dorm}</option>)}
      <option value={OTHER}>Other / not listed</option>
    </select>
    </div>
    {custom && <div className="space-y-1">
      <label htmlFor={`${selectId}-other`} className="block text-sm">Other dorm or residence name</label>
      <input id={`${selectId}-other`} name={name} type="text" maxLength={120} value={value}
        disabled={!college} aria-invalid={invalid || undefined} className={controlClass(invalid)}
        onChange={event => onChange(event.target.value)} />
    </div>}
    <p id={`${selectId}-help`} className={inlineOther ? "text-xs text-muted sm:col-span-2" : "text-xs text-muted"}>{!college ? "Select a college to see its dorms." : options.length ? "Choose your residence, or Other / not listed." : "This college's dorm list is not available yet. Choose Other / not listed to enter a name."}</p>
  </div>;
}
