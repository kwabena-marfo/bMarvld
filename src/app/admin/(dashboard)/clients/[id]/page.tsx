"use client";

import { ArrowLeftIcon, CopyIcon, DownloadIcon, HeartIcon, StarIcon, Trash2Icon, UploadIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BulkBar, SelectOverlay, useBulkSelect } from "@/components/BulkSelect";
import { DriveImport } from "@/components/DriveImport";
import PhotoLightbox from "@/components/PhotoLightbox";
import { fromDrive, fromFiles, MAX_UPLOAD_BYTES, UploadReview, type PendingPhoto } from "@/components/UploadReview";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DELIVERY_DAYS, galleryStatusLabels, type GalleryStatus } from "@/data/clientGalleries";
import { adminFetch } from "@/lib/admin-api";
import { uploadClientPhoto, type PhotoKind } from "@/lib/clientUpload";
import { formatDate } from "@/lib/formatDate";
import { sendJson } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Photo = { id: string; name: string; width: number; height: number; src: string; full: string };
type ShareInfo = { url: string; expiresAt: string };
type Gallery = {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  title: string;
  maxSelections: number | null;
  status: GalleryStatus;
  proofs: Photo[];
  selected: string[];
  submittedAt?: string;
  proofLink?: ShareInfo;
  finals: Photo[];
  finalLink?: ShareInfo;
  deliveredAt?: string;
  featured: string[]; // edits the client starred for the site
  clearedAt?: string; // the delivery link closed and the photos were deleted
  clearedPicks: string[];
};


export default function ClientGalleryAdmin() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [pickedOnly, setPickedOnly] = useState(false);

  const load = useCallback(() => {
    return adminFetch<{ gallery: Gallery }>(`/clients/${id}`)
      .then((d) => setGallery(d.gallery))
      .catch((e) => toast.error(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!gallery) return <p className="text-cream-dim">Loading…</p>;

  const selected = new Set(gallery.selected);
  const picked = gallery.proofs.filter((p) => selected.has(p.id));
  const proofsShown = pickedOnly ? picked : gallery.proofs;

  async function removeGallery() {
    try {
      await sendJson(`/api/admin/clients/${id}`, undefined, "DELETE");
      toast.success("Gallery deleted");
      router.replace("/admin/clients");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function reopen() {
    try {
      await sendJson(`/api/admin/clients/${id}/reopen`);
      toast.success("The client can change their selection again");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reopen");
    }
  }

  // Numbered for the editor, keeping each file's own name and extension: "1.IMG_3500.JPG", "2.Felicia-0040.jpg", …
  const pickedList = picked.map((p, i) => `${i + 1}.${p.name}`);
  const pickedNames = pickedList.join("\n");

  function copy(text: string, done: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(done))
      .catch(() => toast.error("Couldn't copy. Select the text instead"));
  }

  const copyNames = () => copy(pickedNames, `${picked.length} file names copied`);

  return (
    <>
      <Link href="/admin/clients" className="mb-6 inline-flex items-center gap-2 text-sm text-cream-dim hover:text-cream">
        <ArrowLeftIcon className="size-4" /> All clients
      </Link>

      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">{gallery.clientName}</h1>
          <p className="mt-1 text-cream-dim">
            {gallery.title} · {gallery.clientPhone}
            {gallery.clientEmail && ` · ${gallery.clientEmail}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={gallery.status === "submitted" ? "default" : "outline"} className="tracking-wider uppercase">
            {galleryStatusLabels[gallery.status]}
          </Badge>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete gallery" />}>
              <Trash2Icon className="text-destructive" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {gallery.clientName}&apos;s gallery?</AlertDialogTitle>
                <AlertDialogDescription>
                  All its proofs and edited photos are deleted from Cloudinary and both links stop working. This
                  can&apos;t be undone.
                  {gallery.featured.length > 0 &&
                    (gallery.featured.length === 1
                      ? " The photo they featured stays on the site (manage it in Favourites)."
                      : ` The ${gallery.featured.length} photos they featured stay on the site (manage them in Favourites).`)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={removeGallery}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {gallery.clearedAt && (
        <div className="mb-10 border border-cream/20 bg-ink-soft p-5 text-sm">
          <p>
            Photos cleared on {formatDate(new Date(gallery.clearedAt))}. The delivery link closed, so this
            gallery&apos;s proofs and edits were deleted from Cloudinary.
            {gallery.featured.length > 0 && " The photos the client featured are still on the site."}
          </p>
          {gallery.clearedPicks.length > 0 && (
            <>
              <p className="mt-3 text-xs tracking-[0.2em] text-cream-dim uppercase">
                They had picked ({gallery.clearedPicks.length})
              </p>
              <pre className="mt-2 max-h-40 overflow-auto text-xs leading-relaxed text-cream-dim select-text">
                {gallery.clearedPicks.join("\n")}
              </pre>
            </>
          )}
        </div>
      )}

      <Step n={1} title="Proofs" hint="Upload the shoot at full size (up to 10 MB a photo). The client only ever sees smaller, watermarked copies.">
        <Uploader galleryId={id} kind="proofs" label="Upload proofs" onDone={load} />
        {gallery.proofs.length > 0 && (
          <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-cream-dim">
            <span>
              {gallery.proofs.length} proofs · {picked.length}
              {gallery.maxSelections ? ` of ${gallery.maxSelections}` : ""} picked
            </span>
            <label className="flex items-center gap-2">
              <Switch checked={pickedOnly} onCheckedChange={setPickedOnly} />
              Picked only
            </label>
          </div>
        )}
        <PhotoGrid
          galleryId={id}
          kind="proofs"
          photos={proofsShown}
          selected={selected}
          onRemoved={load}
          empty={pickedOnly ? "The client hasn't picked any photos yet." : undefined}
        />
      </Step>

      <Step
        n={2}
        title="Client picks their favourites"
        hint={
          gallery.maxSelections
            ? `They can choose up to ${gallery.maxSelections} photos.`
            : "There's no limit on how many they can choose."
        }
      >
        <SelectionLimit key={String(gallery.maxSelections)} galleryId={id} value={gallery.maxSelections} picked={picked.length} onSaved={load} />
        {gallery.submittedAt ? (
          <div className="mb-6 border border-gold/40 bg-gold/5 p-4 text-sm">
            <p>
              <span className="text-gold">●</span> {gallery.clientName} sent {picked.length} photos on{" "}
              {formatDate(new Date(gallery.submittedAt))}. Their selection is locked.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reopen}>
              Let them change it
            </Button>
          </div>
        ) : null}
        <ShareLink
          galleryId={id}
          kind="proof"
          link={gallery.proofLink}
          defaultDays={14}
          disabled={!gallery.proofs.length}
          disabledHint="Upload the proofs first."
          onShared={load}
        />
        {picked.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs tracking-[0.2em] text-cream-dim uppercase">Files to edit ({picked.length})</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={copyNames}>
                  <CopyIcon /> Copy file names
                </Button>
                {/* A plain link: the API redirects to a zip Cloudinary builds, which downloads directly. */}
                <a href={`/api/admin/clients/${id}/picks/zip`} className={buttonVariants({ size: "sm" })}>
                  <DownloadIcon /> Download picks
                </a>
              </div>
            </div>
            <p className="mb-3 text-xs text-cream-dim">
              The download is full size, with no watermark, and keeps your file names.
            </p>
            {/* One row per file: drag to select any lines, or copy a single name with its button. */}
            <ol className="max-h-72 overflow-auto border border-cream/10 bg-ink-soft py-2 font-mono text-xs text-cream-dim">
              {pickedList.map((line) => (
                <li key={line} className="group flex items-center justify-between gap-3 px-4 py-1 hover:bg-cream/5">
                  <span className="select-text">{line}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Copy ${line}`}
                    className="pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => copy(line, `Copied ${line}`)}
                  >
                    <CopyIcon />
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Step>

      <Step n={3} title="Edited photos" hint="Upload the finished edits at full size. The client gets them without a watermark.">
        <Uploader galleryId={id} kind="finals" label="Upload edited photos" onDone={load} />
        <div className="mt-6">
          {gallery.featured.length > 0 && (
            <p className="mb-3 text-sm text-cream-dim">
              <StarIcon className="mr-1 mb-0.5 inline size-4 fill-gold text-gold" />
              {gallery.clientName} featured {gallery.featured.length} on the site&apos;s{" "}
              <Link href="/admin/favourites" className="text-cream underline-offset-4 hover:underline">
                Client favourites
              </Link>
              .
            </p>
          )}
          <PhotoGrid
            galleryId={id}
            kind="finals"
            photos={gallery.finals}
            selected={new Set(gallery.featured)}
            onRemoved={load}
          />
        </div>
      </Step>

      <Step
        n={4}
        title="Deliver"
        hint="Sends the client a link to view and download their edited photos. When it closes, this gallery's proofs and edits are deleted from Cloudinary. The client gets a reminder a day before, and photos they featured on the site stay. Extend the link to give them longer."
      >
        <ShareLink
          galleryId={id}
          kind="final"
          link={gallery.finalLink}
          defaultDays={DELIVERY_DAYS}
          disabled={!gallery.finals.length}
          disabledHint="Upload the edited photos first."
          onShared={load}
        />
      </Step>
    </>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mb-12 border-t border-cream/10 pt-8">
      <p className="text-xs tracking-[0.4em] text-gold uppercase">Step {n}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-cream-dim">{hint}</p>
      {children}
    </section>
  );
}

// How many photos the client may pick; empty for no limit.
function SelectionLimit({
  galleryId,
  value,
  picked,
  onSaved,
}: {
  galleryId: string;
  value: number | null;
  picked: number;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [busy, setBusy] = useState(false);
  const next = draft.trim() === "" ? null : Number(draft);
  const valid = next === null || (Number.isInteger(next) && next >= 1 && next <= 1000);
  const changed = next !== value;

  async function save() {
    setBusy(true);
    try {
      await sendJson(`/api/admin/clients/${galleryId}`, { maxSelections: next }, "PATCH");
      toast.success(next === null ? "No limit on picks now" : `They can now pick up to ${next}`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the limit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && changed) save();
        }}
      >
        <label className="flex items-center gap-2 text-sm text-cream-dim">
          Photos they can pick
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            placeholder="No limit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!valid}
            className="w-28"
          />
        </label>
        <Button type="submit" variant="outline" disabled={!valid || !changed || busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </form>
      <p className={cn("mt-2 text-xs", valid ? "text-cream-dim" : "text-destructive")}>
        {!valid
          ? "Use a whole number from 1 to 1000, or leave it empty for no limit."
          : next !== null && picked > next
            ? `They've already picked ${picked}; they'll need to unselect ${picked - next} before they can send.`
            : "Leave empty for no limit. The client sees the new number next time they open their link."}
      </p>
    </div>
  );
}

type UploadState = { total: number; done: number; failed: { name: string; message: string }[] };

function Uploader({ galleryId, kind, label, onDone }: { galleryId: string; kind: PhotoKind; label: string; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState | null>(null);
  const [review, setReview] = useState<PendingPhoto[] | null>(null);
  const busy = !!state && state.done + state.failed.length < state.total;

  // Computer files go up from the browser; Drive photos are fetched by Cloudinary.
  const send = ({ source }: PendingPhoto) =>
    source.kind === "file"
      ? uploadClientPhoto(galleryId, kind, source.file)
      : sendJson(`/api/admin/clients/${galleryId}/${kind}/drive`, { fileId: source.id });

  // Over 10 MB, a computer proof is scaled down; anything else is refused.
  const warning = (p: PendingPhoto) =>
    p.size <= MAX_UPLOAD_BYTES
      ? undefined
      : kind === "proofs" && p.source.kind === "file"
        ? "Over 10 MB: will be scaled down"
        : "Over 10 MB: won't upload";

  async function upload(photos: PendingPhoto[]) {
    setReview(null);
    setState({ total: photos.length, done: 0, failed: [] });
    // A few at a time: fast, without saturating a phone connection.
    const queue = [...photos];
    const worker = async () => {
      for (let photo = queue.shift(); photo; photo = queue.shift()) {
        const { name } = photo;
        try {
          await send(photo);
          setState((s) => s && { ...s, done: s.done + 1 });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Upload failed";
          setState((s) => s && { ...s, failed: [...s.failed, { name, message }] });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    onDone();
  }

  return (
    <div>
      <div className="flex flex-wrap items-start gap-2">
        <Button type="button" disabled={busy} onClick={() => input.current?.click()}>
          <UploadIcon /> {busy ? `Uploading ${state.done + state.failed.length + 1} of ${state.total}…` : label}
        </Button>
        <DriveImport
          disabled={busy}
          className="w-full max-w-xl sm:w-auto sm:flex-1"
          onFound={(photos) => setReview(fromDrive(photos))}
        />
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) setReview(fromFiles(files));
        }}
      />
      <UploadReview photos={review} warning={warning} onCancel={() => setReview(null)} onConfirm={upload} />
      {state && !busy && (
        <p className="mt-3 text-sm text-cream-dim">
          {state.done} uploaded{state.failed.length > 0 && `, ${state.failed.length} failed`}.
        </p>
      )}
      {state && state.failed.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-destructive">
          {state.failed.map((f, i) => (
            <li key={i}>
              {f.name}: {f.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PhotoGrid({
  galleryId,
  kind,
  photos,
  selected,
  onRemoved,
  empty,
}: {
  galleryId: string;
  kind: PhotoKind;
  photos: Photo[];
  selected?: Set<string>;
  onRemoved: () => void;
  empty?: string;
}) {
  // One confirm dialog for the whole grid, opened for the photo being deleted.
  const [confirming, setConfirming] = useState<Photo | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const bulk = useBulkSelect(photos.map((p) => p.id));

  function describeBulk(ids: string[]) {
    const marked = ids.filter((id) => selected?.has(id)).length;
    if (kind === "finals") {
      return "The client won't see or be able to download these edits any more. They're removed from Cloudinary. This can't be undone.";
    }
    return `${
      marked ? `The client picked ${marked} of them; ${marked === 1 ? "it's" : "they're"} taken out of their selection. ` : ""
    }They're removed from the client's gallery and from Cloudinary. This can't be undone.`;
  }

  async function remove(photo: Photo) {
    try {
      await sendJson(`/api/admin/clients/${galleryId}/${kind}/${photo.id}`, undefined, "DELETE");
      toast.success(`${photo.name} deleted`);
      onRemoved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (!photos.length) return empty ? <p className="text-sm text-cream-dim">{empty}</p> : null;

  return (
    <>
      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirming?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {kind === "proofs"
                ? confirming && selected?.has(confirming.id)
                  ? "The client picked this photo. It's removed from their selection and from Cloudinary. This can't be undone."
                  : "It's removed from the client's gallery and from Cloudinary. This can't be undone."
                : "The client won't see or be able to download this edit any more. It's removed from Cloudinary and can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => confirming && remove(confirming)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BulkBar
        selection={bulk}
        total={photos.length}
        deleteUrl={`/api/admin/clients/${galleryId}/${kind}/delete`}
        noun={kind === "proofs" ? ["proof", "proofs"] : ["edit", "edits"]}
        describe={describeBulk}
        onDeleted={onRemoved}
        className="mb-3"
      />
      <PhotoLightbox
        photos={photos}
        index={open}
        onIndex={setOpen}
        actions={(p) => (
          <p className="flex items-center gap-2 text-sm text-cream-dim">
            {selected?.has(p.id) &&
              (kind === "proofs" ? (
                <HeartIcon className="size-4 fill-gold text-gold" aria-label="Picked" />
              ) : (
                <StarIcon className="size-4 fill-gold text-gold" aria-label="Featured" />
              ))}
            {p.name}
            {selected?.has(p.id) && (kind === "proofs" ? " · picked by the client" : " · featured on the site")}
          </p>
        )}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {photos.map((p, i) => {
          const isPicked = selected?.has(p.id);
          return (
            <figure key={p.id} className={cn("group relative bg-ink-soft", isPicked && "ring-2 ring-gold")}>
              <SelectOverlay selection={bulk} id={p.id} label={p.name} />
              <button type="button" className="block w-full cursor-zoom-in" onClick={() => setOpen(i)} aria-label={`View ${p.name}`}>
                <Image
                  src={p.src}
                  alt={p.name}
                  width={p.width}
                  height={p.height}
                  unoptimized
                  className="aspect-square w-full object-cover"
                />
              </button>
              {/* Proofs: the client picked it. Edits: they featured it on the site. */}
              {isPicked &&
                (kind === "proofs" ? (
                  <HeartIcon className="absolute top-2 left-2 size-5 fill-gold text-gold drop-shadow" aria-label="Picked" />
                ) : (
                  <StarIcon className="absolute top-2 left-2 size-5 fill-gold text-gold drop-shadow" aria-label="Featured" />
                ))}
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-linear-to-t from-ink/90 p-1 pl-2 text-[10px] text-cream-dim">
                <span className="truncate">{p.name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${p.name}`}
                  // Shows on hover with a mouse; always visible on touch screens, which can't hover.
                  className="pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => setConfirming(p)}
                >
                  <Trash2Icon className="text-destructive" />
                </Button>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}

function ShareLink({
  galleryId,
  kind,
  link,
  defaultDays,
  disabled,
  disabledHint,
  onShared,
}: {
  galleryId: string;
  kind: "proof" | "final";
  link?: ShareInfo;
  defaultDays: number;
  disabled: boolean;
  disabledHint: string;
  onShared: () => void;
}) {
  const [days, setDays] = useState(String(defaultDays));
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const url = link?.url;
  const expired = link && new Date(link.expiresAt) < new Date();

  async function share() {
    setBusy(true);
    try {
      await sendJson(`/api/admin/clients/${galleryId}/share/${kind}`, { days: Number(days), notify });
      toast.success(notify ? "Link sent to the client" : "Link ready to copy");
      onShared();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {url && (
        <div className="flex flex-wrap items-center gap-2">
          <Input readOnly value={url} className="max-w-xl flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))}
          >
            <CopyIcon /> Copy
          </Button>
          <span className={cn("w-full text-sm", expired ? "text-destructive" : "text-cream-dim")}>
            {expired ? "Expired" : "Open until"} {formatDate(new Date(link!.expiresAt))}
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-cream-dim">
          Open for
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-20"
          />
          days
        </label>
        <label className="flex items-center gap-2 text-sm text-cream-dim">
          <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
          Text &amp; email it to the client
        </label>
        <Button disabled={disabled || busy || !(Number(days) >= 1)} onClick={share}>
          {busy ? "Working…" : link ? (notify ? "Extend & resend" : "Extend link") : notify ? "Send link" : "Create link"}
        </Button>
      </div>
      {disabled && <p className="text-sm text-cream-dim">{disabledHint}</p>}
    </div>
  );
}
