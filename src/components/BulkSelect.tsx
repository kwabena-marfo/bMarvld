"use client";

import { CheckIcon, ListChecksIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/forms";
import { cn } from "@/lib/utils";

// Selecting several photos in an admin grid to delete them (or act on them) together.
// `ids` are the photos currently shown; anything no longer shown drops out.
export function useBulkSelect(ids: string[]) {
  const [active, setActive] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const chosen = ids.filter((id) => picked.has(id));

  return {
    active,
    chosen,
    has: (id: string) => active && picked.has(id),
    toggle: (id: string) =>
      setPicked((s) => {
        const next = new Set(s);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    selectAll: () => setPicked(new Set(ids)),
    clear: () => setPicked(new Set()),
    start: () => setActive(true),
    stop: () => {
      setActive(false);
      setPicked(new Set());
    },
  };
}

export type BulkSelection = ReturnType<typeof useBulkSelect>;

/**
 * "Select" to start; then a bar with the count, select all / none, and a
 * delete button that confirms first and POSTs `{ ids }` to `deleteUrl`.
 */
export function BulkBar({
  selection: s,
  total,
  deleteUrl,
  noun,
  verb = "Delete",
  describe,
  onDeleted,
  actions,
  className,
}: {
  selection: BulkSelection;
  total: number;
  deleteUrl: string;
  noun: [string, string];
  verb?: string;
  describe: (ids: string[]) => ReactNode;
  onDeleted: () => void;
  actions?: ReactNode; // more things to do with the selection, shown before Delete
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = s.chosen.length;
  const label = (count: number) => `${count} ${count === 1 ? noun[0] : noun[1]}`;

  async function remove() {
    const ids = s.chosen;
    setBusy(true);
    try {
      const { deleted } = await sendJson<{ deleted: number }>(deleteUrl, { ids });
      toast.success(`${label(deleted)} ${verb === "Delete" ? "deleted" : "removed"}`);
      s.stop();
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${verb} failed`);
    } finally {
      setBusy(false);
    }
  }

  if (!total) return null;

  if (!s.active) {
    return (
      <Button variant="outline" size="sm" className={className} onClick={s.start}>
        <ListChecksIcon /> Select
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "sticky top-2 z-20 flex flex-wrap items-center gap-2 border border-cream/15 bg-ink/95 p-2 text-sm backdrop-blur",
        className
      )}
    >
      <span className="px-1 text-cream">{n ? `${n} selected` : "Tap photos to select"}</span>
      <Button variant="ghost" size="sm" onClick={n === total ? s.clear : s.selectAll}>
        {n === total ? "Select none" : `Select all ${total}`}
      </Button>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={s.stop} disabled={busy}>
          Done
        </Button>
        {actions}
        <Button variant="destructive" size="sm" disabled={!n || busy} onClick={() => setConfirming(true)}>
          <Trash2Icon /> {busy ? "Working…" : `${verb}${n ? ` ${n}` : ""}`}
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {verb} {label(n)}?
            </AlertDialogTitle>
            <AlertDialogDescription>{describe(s.chosen)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              {verb}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Covers a tile while selecting: a click toggles it, and a tick shows it's chosen. */
export function SelectOverlay({ selection: s, id, label }: { selection: BulkSelection; id: string; label: string }) {
  if (!s.active) return null;
  const on = s.has(id);
  return (
    <button
      type="button"
      onClick={() => s.toggle(id)}
      aria-pressed={on}
      aria-label={`Select ${label}`}
      className={cn(
        "absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        on ? "bg-gold/15 ring-2 ring-gold ring-inset" : "bg-ink/10 hover:bg-ink/0"
      )}
    >
      <span
        className={cn(
          "absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border",
          on ? "border-gold bg-gold text-ink" : "border-cream/70 bg-ink/50"
        )}
      >
        {on && <CheckIcon className="size-3.5" />}
      </span>
    </button>
  );
}
