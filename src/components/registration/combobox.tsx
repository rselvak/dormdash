"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import { controlClass } from "@/components/registration/form-controls";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary text shown on the right, such as a city. */
  description?: string;
};

type ComboboxProps = {
  id: string;
  name?: string;
  value: string;
  options: readonly ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  emptyMessage?: string;
  maxResults?: number;
};

const DEFAULT_MAX_RESULTS = 60;

export function Combobox({
  id,
  name,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  invalid,
  emptyMessage = "No matches. Try a different spelling.",
  maxResults = DEFAULT_MAX_RESULTS,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = `${id}-listbox`;

  const exactMatch = useMemo(
    () => options.some((option) => option.value === value),
    [options, value],
  );

  const matches = useMemo(() => {
    // Opening a combobox that already holds a selection should show every
    // option so the user can pick a different one. While the user is typing,
    // keep filtering even if the text happens to match a complete option.
    const needle = (open && exactMatch && !typing ? "" : value)
      .trim()
      .toLowerCase();

    if (!needle) return options;

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.description?.toLowerCase().includes(needle),
    );
  }, [exactMatch, open, options, typing, value]);

  const results = useMemo(
    () => matches.slice(0, maxResults),
    [matches, maxResults],
  );
  const truncated = matches.length > results.length;

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const active = document.getElementById(`${id}-option-${activeIndex}`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, id, open]);

  function optionId(index: number) {
    return `${id}-option-${index}`;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
    setOpen(true);
    setTyping(true);
    setActiveIndex(0);
  }

  function select(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
    setTyping(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(results.length > 0 ? 0 : -1);
        return;
      }
      if (results.length === 0) return;
      setActiveIndex((current) =>
        current < 0 ? 0 : (current + 1) % results.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(results.length > 0 ? results.length - 1 : -1);
        return;
      }
      if (results.length === 0) return;
      setActiveIndex((current) =>
        current <= 0 ? results.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" && open) {
      const option =
        results[activeIndex] ??
        options.find(
          (candidate) =>
            candidate.value.toLowerCase() === value.trim().toLowerCase(),
        );

      if (option) {
        event.preventDefault();
        select(option);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
      setTyping(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="relative" onBlur={handleBlur} data-combobox="">
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? optionId(activeIndex) : undefined
        }
        aria-invalid={invalid || undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          setOpen(true);
          setTyping(false);
        }}
        onClick={() => {
          setOpen(true);
          setTyping(false);
        }}
        onKeyDown={handleKeyDown}
        className={controlClass(invalid)}
      />

      {open && !disabled ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          {results.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={placeholder}
              className="max-h-64 overflow-y-auto py-1"
            >
              {results.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={option.value === value}
                  // Keep focus on the input so a click does not blur the
                  // combobox before the click handler runs.
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm",
                    index === activeIndex ? "bg-accent/10" : "hover:bg-accent/5",
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      option.value === value && "font-semibold",
                    )}
                  >
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="shrink-0 text-xs text-muted">
                      {option.description}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-muted">{emptyMessage}</p>
          )}

          {truncated ? (
            <p className="border-t border-border px-3 py-2 text-xs text-muted">
              Showing the first {maxResults} matches. Keep typing to narrow the
              list.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
