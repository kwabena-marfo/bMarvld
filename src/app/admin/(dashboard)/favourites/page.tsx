"use client";

import { Trash2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyList, ListPagination, ListSearch, useAdminList, useListParams } from "@/components/AdminList";
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
import { formatDate } from "@/lib/formatDate";
import { sendJson } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Favourite = {
  id: string;
  galleryId: string;
  clientName: string;
  title: string;
  createdAt: string;
  width: number;
  height: number;
  src: string;
};
type FavouriteList = { photos: Favourite[]; total: number; pageSize: number };

// Edits clients starred on their delivery page. They go live in "Client
// favourites" on the home page straight away; this is where they come down.
export default function FavouritesAdmin() {
  const list = useListParams();
  const { q, page } = list;
  const { data, error, loading, reload } = useAdminList<FavouriteList>(
    `/featured?${new URLSearchParams({ q, page: String(page) })}`
  );
  const [confirming, setConfirming] = useState<Favourite | null>(null);

  async function remove(photo: Favourite) {
    try {
      await sendJson(`/api/admin/featured/${photo.id}`, undefined, "DELETE");
      toast.success("Taken off the site");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  }

  const photos = data?.photos;

  return (
    <>
      <h1 className="mb-2 font-display text-4xl font-semibold">Client favourites</h1>
      <p className="mb-6 text-sm text-cream-dim">
        Edited photos clients chose to feature on the home page, up to 2 each. They stay up after a client&apos;s
        gallery is deleted. Remove any you&apos;d rather not show.
      </p>

      <ListSearch value={q} onSearch={list.setQuery} placeholder="Search client or shoot…" className="mb-6" />

      {error && <p className="text-gold">{error}</p>}
      {!data && !error && <p className="text-cream-dim">Loading…</p>}
      {photos?.length === 0 && !loading && (
        <EmptyList q={q} empty="No client has featured a photo yet." noun="favourites" />
      )}

      <div
        className={cn(
          "grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 lg:grid-cols-4",
          loading && data && "opacity-50"
        )}
      >
        {photos?.map((p) => (
          <figure key={p.id} className="bg-ink-soft">
            <div className="relative aspect-square">
              <Image src={p.src} alt={`Featured by ${p.clientName}`} fill unoptimized className="object-cover" />
            </div>
            <figcaption className="flex items-start justify-between gap-2 p-3 text-xs">
              <div className="min-w-0">
                <Link href={`/admin/clients/${p.galleryId}`} className="block truncate text-sm text-cream hover:text-gold">
                  {p.clientName}
                </Link>
                <p className="truncate text-cream-dim">{p.title}</p>
                <p className="text-cream-dim">Featured {formatDate(new Date(p.createdAt))}</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Take off the site" onClick={() => setConfirming(p)}>
                <Trash2Icon className="text-destructive" />
              </Button>
            </figcaption>
          </figure>
        ))}
      </div>

      {data && (
        <ListPagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          noun={["favourite", "favourites"]}
          onPage={list.setPage}
        />
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take this photo off the site?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.clientName}&apos;s photo is removed from Client favourites and its copy is deleted from
              Cloudinary. If their delivery link is still open, they&apos;ll see it un-starred. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => confirming && remove(confirming)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
