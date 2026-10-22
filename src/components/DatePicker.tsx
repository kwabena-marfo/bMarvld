"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fromIso = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Inline month calendar: past days, today and unavailable (booked, blocked or
// held) dates can't be picked. Only rendered after mount, so "today" is the
// visitor's own.
export default function DatePicker({
  value,
  onChange,
  unavailable,
  invalid,
}: {
  value: string;
  onChange: (date: string) => void;
  unavailable: Set<string>;
  invalid?: boolean;
}) {
  const [today] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const isTaken = (d: Date) => unavailable.has(iso(d));

  return (
    <div aria-invalid={invalid || undefined} className="border border-input bg-ink-soft p-3 aria-invalid:border-destructive sm:p-4">
      <Calendar
        mode="single"
        selected={value ? fromIso(value) : undefined}
        onSelect={(d) => onChange(d ? iso(d) : "")}
        startMonth={today}
        disabled={[{ before: new Date(today.getTime() + 86_400_000) }, isTaken]}
        modifiers={{ booked: isTaken }}
        modifiersClassNames={{ booked: "line-through decoration-cream/50" }}
        className="w-full bg-transparent p-0 [--cell-size:--spacing(10)]"
        classNames={{ root: "w-full" }}
      />
      <p className="mt-3 text-xs text-cream-dim">
        <span className="line-through">12</span> = already booked
      </p>
    </div>
  );
}
