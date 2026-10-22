"use client";

import { ClockIcon } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Start times on the half hour, grouped by part of the day.
const slots = (from: number, to: number) =>
  Array.from({ length: (to - from) * 2 }, (_, i) => {
    const minutes = from * 60 + i * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
  });

const groups = [
  { label: "Morning", times: slots(6, 12) },
  { label: "Afternoon", times: slots(12, 17) },
  { label: "Evening", times: slots(17, 21) },
];

export function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export default function TimePicker({
  id,
  value,
  onChange,
  onBlur,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
    >
      <PopoverTrigger
        id={id}
        aria-invalid={invalid || undefined}
        className="flex h-12 w-full items-center justify-between border border-input bg-ink-soft px-4 text-left text-sm transition-colors outline-none focus-visible:border-ring aria-expanded:border-ring aria-invalid:border-destructive"
      >
        <span className={value ? "text-foreground" : "text-cream/40"}>
          {value ? formatTime(value) : "Choose a start time"}
        </span>
        <ClockIcon className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-72 gap-4 p-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-xs tracking-[0.2em] text-cream-dim uppercase">{group.label}</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {group.times.map((time) => (
                <button
                  type="button"
                  key={time}
                  onClick={() => {
                    onChange(time);
                    setOpen(false);
                    onBlur?.();
                  }}
                  className={cn(
                    "border py-2 text-xs transition",
                    time === value
                      ? "border-gold bg-gold font-semibold text-ink"
                      : "border-cream/15 text-cream hover:border-cream/50"
                  )}
                >
                  {formatTime(time)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
