"use client";

import { LinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendJson } from "@/lib/forms";

export type DrivePhoto = { id: string; name: string; size: number };

/**
 * A box to paste a Google Drive folder (or photo) link into. Finds the photos
 * and hands them back for review; the caller then imports the chosen ones.
 */
export function DriveImport({
  disabled,
  onFound,
  className,
}: {
  disabled?: boolean;
  onFound: (photos: DrivePhoto[]) => void;
  className?: string;
}) {
  const [link, setLink] = useState("");
  const [finding, setFinding] = useState(false);

  async function find() {
    if (!link.trim()) return;
    setFinding(true);
    try {
      const { photos, subfolders } = await sendJson<{ photos: DrivePhoto[]; subfolders: number }>(
        "/api/admin/drive/list",
        { link }
      );
      const skipped =
        subfolders > 0
          ? ` ${subfolders === 1 ? "A subfolder was" : `${subfolders} subfolders were`} skipped; paste ${subfolders === 1 ? "its link" : "their links"} separately.`
          : "";
      if (!photos.length) {
        toast.error(`No photos in that folder.${skipped}`);
        return;
      }
      if (skipped) toast.info(skipped.trim());
      setLink("");
      onFound(photos);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that link");
    } finally {
      setFinding(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Input
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // the gallery page wraps this in a form
              find();
            }
          }}
          placeholder="Paste a Google Drive folder link"
          aria-label="Google Drive folder or photo link"
          disabled={disabled || finding}
          className="min-w-0 flex-1 basis-60"
        />
        <Button type="button" variant="outline" disabled={disabled || finding || !link.trim()} onClick={find}>
          <LinkIcon /> {finding ? "Finding photos…" : "Import from Drive"}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-cream-dim">
        Share the folder as &quot;Anyone with the link&quot; first. You can turn sharing off once it&apos;s imported.
      </p>
    </div>
  );
}
