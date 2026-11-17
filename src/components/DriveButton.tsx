"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadFromDrive, driveEnabled, loadPicker, pickFromDrive } from "@/lib/googleDrive";

/** A photo to upload: chosen from the computer, or fetched from Google Drive when its turn comes. */
export type UploadSource = { name: string; file: () => Promise<File> };

export const fromComputer = (files: File[]): UploadSource[] =>
  files.map((f) => ({ name: f.name, file: () => Promise.resolve(f) }));

function DriveLogo() {
  return (
    <svg viewBox="0 0 87.3 78" aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44A9.06 9.06 0 0 0 0 53h27.5z" fill="#00ac47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335" />
      <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

/**
 * Opens the Google Drive picker. The picked photos come back as upload
 * sources, downloaded one by one as the uploader gets to them. Hidden until
 * the Google keys are set (docs/google-drive-setup.md).
 */
export function DriveButton({
  disabled,
  onPicked,
  size,
  className,
}: {
  disabled?: boolean;
  onPicked: (sources: UploadSource[]) => void;
  size?: "default" | "lg";
  className?: string;
}) {
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (driveEnabled) loadPicker().catch(() => {}); // retried on click
  }, []);

  if (!driveEnabled) return null;

  async function pick() {
    setOpening(true);
    try {
      const files = await pickFromDrive();
      if (files.length) onPicked(files.map((f) => ({ name: f.name, file: () => downloadFromDrive(f) })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open Google Drive");
    } finally {
      setOpening(false);
    }
  }

  return (
    <Button type="button" variant="outline" size={size} disabled={disabled || opening} onClick={pick} className={className}>
      <DriveLogo /> {opening ? "Opening Drive…" : "From Google Drive"}
    </Button>
  );
}
