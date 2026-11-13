"use client";

import { HeartIcon } from "lucide-react";
import { useCallback, useState } from "react";
import ClientPhotoTile from "./ClientPhotoTile";
import PhotoLightbox from "./PhotoLightbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Proof = { id: string; width: number; height: number; thumb: string; full: string };

// The client's side of choosing: tap the heart on favourites (saved as they
// go, so they can come back later), then send the selection to B.Marvld.
export default function ProofSelector({
  token,
  photos,
  initialSelected,
  maxSelections,
  initiallySubmitted,
}: {
  token: string;
  photos: Proof[];
  initialSelected: string[];
  maxSelections: number | null;
  initiallySubmitted: boolean;
}) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [pickedOnly, setPickedOnly] = useState(initiallySubmitted);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const shown = pickedOnly ? photos.filter((p) => selected.has(p.id)) : photos;
  const full = maxSelections !== null && selected.size >= maxSelections;

  const toggle = useCallback(
    async (id: string) => {
      if (submitted) return;
      const select = !selected.has(id);
      if (select && full) {
        setError(`You've chosen ${maxSelections} — unselect one to swap it.`);
        return;
      }
      setError("");
      const optimistic = new Set(selected);
      if (select) optimistic.add(id);
      else optimistic.delete(id);
      setSelected(optimistic);
      try {
        const { selected: saved } = await sendJson<{ selected: string[] }>(`/api/proofs/${token}/select`, {
          photoId: id,
          selected: select,
        });
        setSelected(new Set(saved));
      } catch (e) {
        setSelected(selected);
        setError(e instanceof Error ? e.message : "Couldn't save that — check your connection and try again.");
      }
    },
    [selected, submitted, full, maxSelections, token]
  );

  async function submit() {
    setSending(true);
    setError("");
    try {
      await sendJson(`/api/proofs/${token}/submit`);
      setSubmitted(true);
      setPickedOnly(true);
      setOpen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send your selection — try again.");
    } finally {
      setSending(false);
    }
  }

  const heart = (id: string, size: "sm" | "lg") => {
    const on = selected.has(id);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggle(id);
        }}
        disabled={submitted}
        aria-pressed={on}
        aria-label={on ? "Remove from my selection" : "Add to my selection"}
        className={cn(
          "flex items-center gap-2 transition disabled:cursor-default",
          size === "sm"
            ? "absolute top-2 right-2 rounded-full bg-ink/60 p-2 backdrop-blur-sm"
            : "border px-5 py-2.5 text-xs tracking-[0.2em] uppercase",
          size === "lg" && (on ? "border-gold bg-gold text-ink" : "border-cream/40 text-cream hover:border-gold"),
          submitted && !on && "hidden"
        )}
      >
        <HeartIcon className={cn(size === "sm" ? "size-5" : "size-4", on ? "fill-current text-gold" : "text-cream")} />
        {size === "lg" && (on ? "In my selection" : "Add to my selection")}
      </button>
    );
  };

  return (
    <>
      {submitted && (
        <div className="mb-8 border border-gold/40 bg-gold/5 p-5 text-center">
          <p className="font-display text-2xl">Thank you — your selection is in!</p>
          <p className="mt-2 text-sm text-cream-dim">
            B.Marvld is editing your {selected.size} photos. You&apos;ll get a link to your finished photos as soon as
            they&apos;re ready.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {[
          { label: `All photos (${photos.length})`, value: false },
          { label: `My selection (${selected.size})`, value: true },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => setPickedOnly(f.value)}
            className={cn(
              "px-4 py-2 text-xs tracking-[0.2em] uppercase transition",
              pickedOnly === f.value ? "bg-cream text-ink" : "border border-cream/20 text-cream-dim hover:border-cream/60"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="py-16 text-center text-cream-dim">Tap the heart on the photos you love to add them here.</p>
      )}

      <div className="columns-2 gap-3 pb-32 sm:columns-3 lg:columns-4">
        {shown.map((p, i) => (
          <ClientPhotoTile
            key={p.id}
            src={p.thumb}
            width={p.width}
            height={p.height}
            label={`View photo ${i + 1}`}
            onOpen={() => setOpen(i)}
            className={cn(selected.has(p.id) && "ring-2 ring-gold")}
          >
            {heart(p.id, "sm")}
          </ClientPhotoTile>
        ))}
      </div>

      <PhotoLightbox photos={shown} index={open} onIndex={setOpen} actions={(p) => heart(p.id, "lg")} />

      {!submitted && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cream/10 bg-ink/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <p className="font-display text-lg">
                {selected.size}
                {maxSelections !== null && ` of ${maxSelections}`} chosen
              </p>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : (
                <p className="text-xs text-cream-dim">Your choices save as you go — come back any time before you send.</p>
              )}
            </div>
            <AlertDialog>
              <AlertDialogTrigger render={<Button size="lg" disabled={!selected.size || sending} />}>
                {sending ? "Sending…" : "Send my selection"}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send these {selected.size} photos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {maxSelections !== null && selected.size < maxSelections
                      ? `You can still choose ${maxSelections - selected.size} more. `
                      : ""}
                    Once you send, B.Marvld starts editing and your selection is locked.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep choosing</AlertDialogCancel>
                  <AlertDialogAction onClick={submit}>Send selection</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </>
  );
}
