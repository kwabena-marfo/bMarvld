"use client";

import { useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Month calendar where past days and unavailable (booked/blocked/held) dates
// can't be picked. Only rendered after mount, so "today" is the visitor's.
export default function DatePicker({
  value,
  onChange,
  unavailable,
}: {
  value: string;
  onChange: (date: string) => void;
  unavailable: Set<string>;
}) {
  const [today] = useState(() => iso(new Date()));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  const atCurrentMonth = iso(month).slice(0, 7) <= today.slice(0, 7);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="border border-cream/20 bg-ink-soft p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={atCurrentMonth}
          className="px-3 py-1 text-cream-dim hover:text-cream disabled:opacity-20"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="font-display text-lg">
          {month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="px-3 py-1 text-cream-dim hover:text-cream"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-2 text-xs text-cream-dim">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`empty-${i}`} />;
          const key = iso(d);
          const taken = unavailable.has(key);
          const disabled = key <= today || taken;
          const selected = key === value;
          return (
            <button
              type="button"
              key={key}
              disabled={disabled}
              onClick={() => onChange(key)}
              title={taken ? "Already booked" : undefined}
              className={`aspect-square transition ${
                selected
                  ? "bg-gold font-semibold text-ink"
                  : taken
                    ? "text-cream/25 line-through"
                    : disabled
                      ? "text-cream/20"
                      : "hover:bg-cream/10"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-cream-dim">
        <span className="line-through">12</span> = already booked
      </p>
    </div>
  );
}
