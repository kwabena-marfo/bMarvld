"use client";

import { CheckIcon, ImageOffIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Cloudinary's plan takes up to 10 MB a photo.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** A photo waiting to be uploaded: chosen on the computer, or found in a Drive folder. */
export type PendingPhoto = {
  key: string;
  name: string;
  size: number;
  source: { kind: "file"; file: File } | { kind: "drive"; id: string; thumb: string };
};

export function fromFiles(files: File[]): PendingPhoto[] {
  return files.map((file, i) => ({
    key: `file-${i}-${file.name}`,
    name: file.name,
    size: file.size,
    source: { kind: "file", file },
  }));
}

export function fromDrive(photos: { id: string; name: string; size: number }[]): PendingPhoto[] {
  return photos.map((p) => ({
    key: `drive-${p.id}`,
    name: p.name,
    size: p.size,
    source: {
      kind: "drive",
      id: p.id,
      // Drive's thumbnail service works for any file shared with "Anyone with the link".
      thumb: `https://drive.google.com/thumbnail?id=${encodeURIComponent(p.id)}&sz=w400`,
    },
  }));
}

// A computer file's preview: a temporary address for the file, set on the img
// and freed when the tile goes.
function useLocalPreview(file: File | null) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!file || !ref.current) return;
    const url = URL.createObjectURL(file);
    ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return ref;
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Shows the photos about to be uploaded, all ticked; the admin unticks any
 * they don't want, then confirms. `warning` flags photos that will fail or be
 * changed (e.g. over the size limit).
 */
export function UploadReview({
  photos,
  onCancel,
  onConfirm,
  warning,
}: {
  photos: PendingPhoto[] | null;
  onCancel: () => void;
  onConfirm: (photos: PendingPhoto[]) => void;
  warning?: (photo: PendingPhoto) => string | undefined;
}) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(photos);

  // Keeps the last list while the dialog fades out, and starts each new list fully ticked.
  if (photos && photos !== shown) {
    setShown(photos);
    setSkipped(new Set());
  }

  const list = shown ?? [];
  const chosen = list.filter((p) => !skipped.has(p.key));
  const warned = chosen.filter((p) => warning?.(p)).length;

  function toggle(key: string) {
    setSkipped((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  return (
    <Dialog open={photos !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Upload {chosen.length} of {list.length} photo{list.length === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription>
            Click a photo to leave it out.
            {warned > 0 && ` ${warned} ${warned === 1 ? "is" : "are"} flagged below.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSkipped(new Set())} disabled={!skipped.size}>
            Select all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSkipped(new Set(list.map((p) => p.key)))}
            disabled={!chosen.length}
          >
            Select none
          </Button>
        </div>

        <ul className="-mx-1 grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto px-1 py-1 sm:grid-cols-4 lg:grid-cols-6">
          {list.map((p) => (
            <ReviewTile
              key={p.key}
              photo={p}
              on={!skipped.has(p.key)}
              warning={warning?.(p)}
              onToggle={() => toggle(p.key)}
            />
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!chosen.length} onClick={() => onConfirm(chosen)}>
            Upload {chosen.length} photo{chosen.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewTile({
  photo,
  on,
  warning,
  onToggle,
}: {
  photo: PendingPhoto;
  on: boolean;
  warning?: string;
  onToggle: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const { source } = photo;
  const preview = useLocalPreview(source.kind === "file" ? source.file : null);
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        aria-label={`${on ? "Leave out" : "Include"} ${photo.name}`}
        className={cn(
          "relative block aspect-square w-full overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring",
          on ? "ring-2 ring-gold" : "opacity-40"
        )}
      >
        {broken ? (
          // Formats the browser can't show (e.g. HEIC) still upload fine.
          <span className="grid size-full place-items-center text-muted-foreground">
            <ImageOffIcon className="size-6" />
          </span>
        ) : (
          // A plain img: these are local previews and Drive thumbnails, not site images.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={preview}
            src={source.kind === "drive" ? source.thumb : undefined}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        )}
        <span
          className={cn(
            "absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border",
            on ? "border-gold bg-gold text-ink" : "border-cream/60 bg-ink/40"
          )}
        >
          {on && <CheckIcon className="size-3.5" />}
        </span>
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/90 px-1.5 pt-3 pb-1 text-left text-[10px] leading-tight text-cream">
          <span className="block truncate">{photo.name}</span>
          {photo.size > 0 && <span className="text-cream-dim">{mb(photo.size)}</span>}
          {warning && <span className="block text-destructive">{warning}</span>}
        </span>
      </button>
    </li>
  );
}
