"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2Icon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
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
import { EmptyList, ListPagination, ListSearch, useListParams } from "@/components/AdminList";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { photoCategories, type Shot } from "@/data/gallery";
import { adminFetch } from "@/lib/admin-api";
import { sendJson } from "@/lib/forms";
import { matchesSearch, paginate } from "@/lib/listQuery";
import { photoDetailsSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const pageSize = 24; // fills whole rows of 2, 3 and 4

type Upload = { name: string; state: "uploading" | "done" | "error"; message?: string };
type Signature = { timestamp: number; signature: string; folder: string; apiKey: string; cloudName: string };
type Details = z.output<typeof photoDetailsSchema>;

// Browser → Cloudinary directly (signed by our API), then the result is
// registered with our API so it shows on the site.
async function uploadOne(file: File, details: Details) {
  const sig = await sendJson<Signature>("/api/admin/photos/sign");

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Upload failed");

  await sendJson("/api/admin/photos", { publicId: data.public_id, ...details });
}

export default function GalleryAdmin() {
  const [photos, setPhotos] = useState<Shot[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const form = useForm<z.input<typeof photoDetailsSchema>, unknown, Details>({
    resolver: zodResolver(photoDetailsSchema),
    defaultValues: { category: photoCategories[0], alt: "" },
  });

  const load = useCallback(() => {
    return adminFetch<{ photos: Shot[] }>("/photos")
      .then((d) => setPhotos(d.photos))
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(files: File[], details: Details) {
    setUploads(files.map((f) => ({ name: f.name, state: "uploading" })));

    // A few at a time: fast, without saturating a phone connection.
    const queue = files.map((file, i) => ({ file, i }));
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { file, i } = job;
        try {
          await uploadOne(file, details);
          setUploads((u) => u.map((x, j) => (j === i ? { ...x, state: "done" } : x)));
        } catch (e) {
          const message = e instanceof Error ? e.message : "Upload failed";
          setUploads((u) => u.map((x, j) => (j === i ? { ...x, state: "error", message } : x)));
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    load();
  }

  async function remove(photo: Shot) {
    if (!photo.id) return;
    try {
      await sendJson(`/api/admin/photos/${photo.id}`, undefined, "DELETE");
      setPhotos((p) => p?.filter((x) => x.id !== photo.id) ?? null);
      toast.success("Photo deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const busy = uploads.some((u) => u.state === "uploading");
  const list = useListParams();
  const found = photos?.filter((p) => matchesSearch(list.q, p.category, p.alt));
  const shown = found && paginate(found, list.page, pageSize);

  return (
    <>
      <h1 className="mb-8 font-display text-4xl font-semibold">Gallery</h1>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="viewfinder mb-12 p-8 text-cream/40"
        noValidate
      >
        <div className="grid gap-6 text-cream md:grid-cols-[200px_1fr_auto] md:items-start">
          <Controller
            name="category"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="photo-category">Category</FieldLabel>
                <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                  <SelectTrigger id="photo-category" className="w-full" aria-invalid={fieldState.invalid}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {photoCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="alt"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="photo-alt">Description (optional)</FieldLabel>
                <Input
                  {...field}
                  id="photo-alt"
                  placeholder="e.g. Ama & Kofi's wedding, Aburi"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <div className="md:pt-6">
            <Button type="button" size="lg" disabled={busy} onClick={() => fileInput.current?.click()} className="w-full">
              <UploadIcon /> {busy ? "Uploading…" : "Choose photos"}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) form.handleSubmit((details) => upload(files, details))();
              }}
            />
          </div>
        </div>

        {uploads.length > 0 && (
          <ul className="mt-6 space-y-1 text-sm">
            {uploads.map((u, i) => (
              <li key={i} className="flex justify-between gap-4 text-cream-dim">
                <span className="truncate">{u.name}</span>
                <span className={cn(u.state === "error" && "text-destructive", u.state === "done" && "text-gold")}>
                  {u.state === "uploading" ? "Uploading…" : u.state === "done" ? "✓ Added" : u.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </form>

      <ListSearch value={list.q} onSearch={list.setQuery} placeholder="Search category or description…" className="mb-6" />

      {!photos && <p className="text-cream-dim">Loading…</p>}
      {found?.length === 0 && (
        <EmptyList
          q={list.q}
          empty="No uploads yet. The site is showing the bundled portfolio until you add some."
          noun="photos"
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown?.items.map((p) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden bg-ink-soft">
            <Image src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-ink/90 p-2 pl-3 text-xs">
              <span className="tracking-wider uppercase">{p.category}</span>
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete photo" />}>
                  <Trash2Icon className="text-destructive" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      It&apos;s removed from the site and from Cloudinary. This can&apos;t be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => remove(p)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      {found && (
        <ListPagination
          page={list.page}
          pageSize={pageSize}
          total={found.length}
          noun={["photo", "photos"]}
          onPage={list.setPage}
        />
      )}
    </>
  );
}
