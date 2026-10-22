"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { photoCategories, type Shot } from "@/data/gallery";

type Upload = { name: string; state: "uploading" | "done" | "error"; message?: string };

type Signature = { timestamp: number; signature: string; folder: string; apiKey: string; cloudName: string };

// Browser → Cloudinary directly (signed by our API), then the result is
// registered with our API so it shows on the site.
async function uploadOne(file: File, category: string, alt: string) {
  const sig = await adminFetch<Signature>("/photos/sign", { method: "POST" });

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

  await adminFetch("/photos", {
    method: "POST",
    body: JSON.stringify({ publicId: data.public_id, category, alt }),
  });
}

export default function GalleryAdmin() {
  const [photos, setPhotos] = useState<Shot[] | null>(null);
  const [category, setCategory] = useState<string>(photoCategories[0]);
  const [alt, setAlt] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    return adminFetch<{ photos: Shot[] }>("/photos")
      .then((d) => setPhotos(d.photos))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploads(list.map((f) => ({ name: f.name, state: "uploading" })));

    // A few at a time: fast, without saturating a phone connection.
    const queue = list.map((file, i) => ({ file, i }));
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { file, i } = job;
        try {
          await uploadOne(file, category, alt);
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
    if (!photo.id || !confirm("Delete this photo from the site?")) return;
    try {
      await adminFetch(`/photos/${photo.id}`, { method: "DELETE" });
      setPhotos((p) => p?.filter((x) => x.id !== photo.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const busy = uploads.some((u) => u.state === "uploading");

  return (
    <>
      <h1 className="mb-8 font-display text-4xl font-semibold">Gallery</h1>

      <section className="viewfinder mb-12 p-8 text-cream/40">
        <div className="grid gap-6 text-cream md:grid-cols-[200px_1fr_auto] md:items-end">
          <label>
            <span className="field-label">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="field">
              {photoCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Description (optional)</span>
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="e.g. Ama & Kofi's wedding, Aburi"
              className="field"
            />
          </label>
          <label
            className={`cursor-pointer bg-gold px-8 py-3 text-center text-xs font-semibold tracking-[0.2em] text-ink uppercase transition hover:bg-cream ${busy ? "pointer-events-none opacity-50" : ""}`}
          >
            {busy ? "Uploading…" : "Choose photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {uploads.length > 0 && (
          <ul className="mt-6 space-y-1 text-sm">
            {uploads.map((u, i) => (
              <li key={i} className="flex justify-between gap-4 text-cream-dim">
                <span className="truncate">{u.name}</span>
                <span className={u.state === "error" ? "text-red-400" : u.state === "done" ? "text-gold" : ""}>
                  {u.state === "uploading" ? "Uploading…" : u.state === "done" ? "✓ Added" : u.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="mb-4 text-gold">{error}</p>}
      {!photos && !error && <p className="text-cream-dim">Loading…</p>}
      {photos?.length === 0 && (
        <p className="text-cream-dim">No photos yet — the site is showing placeholder images until you upload some.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos?.map((p) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden bg-ink-soft">
            <Image src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-ink/90 p-3 text-xs">
              <span className="tracking-wider uppercase">{p.category}</span>
              <button onClick={() => remove(p)} className="text-red-400 hover:text-red-300">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
