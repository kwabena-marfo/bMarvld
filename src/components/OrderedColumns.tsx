"use client";

import { Children, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Column counts by screen width, widest first: 4 on laptops, 3 on tablets, 2 on phones.
const breakpoints: [query: string, columns: number][] = [
  ["(min-width: 1024px)", 4],
  ["(min-width: 640px)", 3],
];

function subscribe(onChange: () => void) {
  const lists = breakpoints.map(([q]) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", onChange));
  return () => lists.forEach((l) => l.removeEventListener("change", onChange));
}

const columnCount = () => breakpoints.find(([q]) => window.matchMedia(q).matches)?.[1] ?? 2;

/**
 * Photos of different heights stacked in columns (like CSS columns), but placed
 * row by row: 1, 2, 3, 4 across the top, then 5, 6, 7, 8… so they read in order
 * left to right. CSS columns would fill the first column top to bottom instead.
 */
export default function OrderedColumns({ children, className }: { children: ReactNode; className?: string }) {
  const n = useSyncExternalStore(subscribe, columnCount, () => 2);
  const items = Children.toArray(children);
  const columns = Array.from({ length: n }, (_, c) => items.filter((_, i) => i % n === c));

  return (
    <div className={cn("flex items-start gap-3", className)}>
      {columns.map((column, c) => (
        <div key={c} className="min-w-0 flex-1">
          {column}
        </div>
      ))}
    </div>
  );
}
