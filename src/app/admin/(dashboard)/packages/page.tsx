"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { depositFor, formatCedis, type Package } from "@/data/packages";
import { adminFetch } from "@/lib/admin-api";
import { ApiError, applyFieldErrors, sendJson } from "@/lib/forms";
import { matchesSearch, paginate } from "@/lib/listQuery";
import { packageSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const pageSize = 10;

// The API takes features as a list; the form edits them one per line.
const formSchema = packageSchema.omit({ features: true }).extend({ featuresText: z.string().max(1200) });
type FormValues = z.output<typeof formSchema>;

const toPayload = ({ featuresText, ...rest }: FormValues) => ({
  ...rest,
  features: featuresText
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean),
});

const emptyPackage: FormValues = {
  name: "",
  price: 0,
  depositPercent: 50,
  duration: "",
  featuresText: "",
  active: true,
};

export default function PackagesAdmin() {
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [editing, setEditing] = useState<Package | "new" | null>(null);

  const load = useCallback(() => {
    return adminFetch<{ packages: Package[] }>("/packages")
      .then((d) => setPackages(d.packages))
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setActive(pkg: Package, active: boolean) {
    setPackages((list) => list?.map((p) => (p.id === pkg.id ? { ...p, active } : p)) ?? null);
    try {
      await sendJson(`/api/admin/packages/${pkg.id}`, { active }, "PATCH");
      toast.success(active ? `${pkg.name} is now bookable` : `${pkg.name} is hidden from the site`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
      load();
    }
  }

  async function move(index: number, by: -1 | 1) {
    if (!packages) return;
    const next = [...packages];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setPackages(next);
    try {
      await sendJson("/api/admin/packages/reorder", { ids: next.map((p) => p.id) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder");
      load();
    }
  }

  async function remove(pkg: Package) {
    try {
      await sendJson(`/api/admin/packages/${pkg.id}`, undefined, "DELETE");
      setPackages((list) => list?.filter((p) => p.id !== pkg.id) ?? null);
      toast.success(`${pkg.name} deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  const list = useListParams();
  const found = packages?.filter((p) => matchesSearch(list.q, p.name, p.duration, p.price, ...p.features));
  const shown = found && paginate(found, list.page, pageSize);
  // Moving packages only makes sense while the whole list is in view.
  const reorderable = !list.q;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">Packages</h1>
          <p className="mt-2 text-sm text-cream-dim">
            Prices, deposits and what&apos;s offered. Switch a package off to hide it from the site.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon /> Add package
        </Button>
      </div>

      <ListSearch value={list.q} onSearch={list.setQuery} placeholder="Search packages…" className="mb-6" />

      {!packages && <p className="text-cream-dim">Loading…</p>}
      {found?.length === 0 && <EmptyList q={list.q} empty="No packages yet — add your first one." noun="packages" />}

      <div className="grid gap-3">
        {shown?.items.map((p, n) => {
          // Position in the full list, which is the order shown on the site.
          const i = shown.offset + n;
          return (
            <div
              key={p.id}
              className={cn(
                "grid gap-4 border border-cream/15 p-5 md:items-center",
                reorderable ? "md:grid-cols-[auto_1fr_auto]" : "md:grid-cols-[1fr_auto]",
              )}
            >
              {reorderable && (
                <div className="flex gap-1 md:flex-col">
                  <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === (packages?.length ?? 0) - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDownIcon />
                  </Button>
                </div>
              )}

              <div className={p.active ? "" : "opacity-50"}>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-display text-xl">{p.name}</p>
                  {!p.active && <Badge variant="outline">Hidden</Badge>}
                </div>
                <p className="mt-1 text-sm">
                  <span className="text-gold">{formatCedis(p.price)}</span>
                  <span className="text-cream-dim">
                    {" "}
                    · {p.depositPercent}% deposit ({formatCedis(depositFor(p))}) · {p.duration}
                  </span>
                </p>
                {p.features.length > 0 && <p className="mt-1 text-sm text-cream-dim">{p.features.join(" · ")}</p>}
              </div>

              <div className="flex items-center gap-2">
                <label className="mr-2 flex items-center gap-2 text-xs tracking-[0.15em] text-cream-dim uppercase">
                  <Switch checked={p.active} onCheckedChange={(checked) => setActive(p, checked)} />
                  Available
                </label>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                  <PencilIcon />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${p.name}`} />}
                  >
                    <Trash2Icon className="text-destructive" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        It disappears from the site. Existing bookings keep their price and details. To hide it
                        temporarily, switch it off instead.
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
          );
        })}
      </div>

      {found && (
        <ListPagination
          page={list.page}
          pageSize={pageSize}
          total={found.length}
          noun={["package", "packages"]}
          onPage={list.setPage}
        />
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {editing !== null && (
            <PackageForm
              key={editing === "new" ? "new" : editing.id}
              pkg={editing === "new" ? null : editing}
              onSaved={(saved) => {
                setPackages((list) => {
                  if (!list) return [saved];
                  return list.some((p) => p.id === saved.id)
                    ? list.map((p) => (p.id === saved.id ? saved : p))
                    : [...list, saved];
                });
                toast.success(`${saved.name} saved`);
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PackageForm({ pkg, onSaved }: { pkg: Package | null; onSaved: (pkg: Package) => void }) {
  const form = useForm<z.input<typeof formSchema>, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: pkg
      ? {
          name: pkg.name,
          price: pkg.price,
          depositPercent: pkg.depositPercent,
          duration: pkg.duration,
          featuresText: pkg.features.join("\n"),
          active: pkg.active,
        }
      : emptyPackage,
  });

  const [price, depositPercent] = useWatch({ control: form.control, name: ["price", "depositPercent"] });
  const preview =
    Number.isFinite(price) && Number.isFinite(depositPercent) && price > 0
      ? depositFor({ price, depositPercent })
      : null;

  async function onSubmit(values: FormValues) {
    try {
      const { package: saved } = pkg
        ? await sendJson<{ package: Package }>(`/api/admin/packages/${pkg.id}`, toPayload(values), "PATCH")
        : await sendJson<{ package: Package }>("/api/admin/packages", toPayload(values));
      onSaved(saved);
    } catch (err) {
      // The API reports the feature list as "features"; the form edits it as featuresText.
      if (err instanceof ApiError && err.fieldErrors.features) {
        err.fieldErrors.featuresText = err.fieldErrors.features;
        delete err.fieldErrors.features;
      }
      if (!applyFieldErrors(form.setError, err)) {
        toast.error(err instanceof Error ? err.message : "Could not save");
      }
    }
  }

  // Number inputs: an empty box is NaN, which the schema reports as "Enter a …".
  const numberProps = (onChange: (n: number) => void) => ({
    type: "number" as const,
    inputMode: "decimal" as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(e.target.value === "" ? Number.NaN : e.target.valueAsNumber),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <DialogHeader className="mb-6">
        <DialogTitle className="font-display text-2xl">{pkg ? `Edit ${pkg.name}` : "New package"}</DialogTitle>
      </DialogHeader>

      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pkg-name">Name</FieldLabel>
              <Input {...field} id="pkg-name" placeholder="e.g. Studio Portrait" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="price"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="pkg-price">Price (GH₵)</FieldLabel>
                <Input
                  id="pkg-price"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={Number.isNaN(field.value) ? "" : String(field.value)}
                  min={0}
                  step="any"
                  aria-invalid={fieldState.invalid}
                  {...numberProps(field.onChange)}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="depositPercent"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="pkg-deposit">Deposit (%)</FieldLabel>
                <Input
                  id="pkg-deposit"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={Number.isNaN(field.value) ? "" : String(field.value)}
                  min={1}
                  max={100}
                  step={1}
                  aria-invalid={fieldState.invalid}
                  {...numberProps(field.onChange)}
                />
                {fieldState.error ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <FieldDescription>
                    {preview !== null ? `Client pays ${formatCedis(preview)} to book` : "Share of the price paid to book"}
                  </FieldDescription>
                )}
              </Field>
            )}
          />
        </div>

        <Controller
          name="duration"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pkg-duration">Duration</FieldLabel>
              <Input {...field} id="pkg-duration" placeholder="e.g. 1 hour, Full day" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="featuresText"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pkg-features">What&apos;s included</FieldLabel>
              <Textarea
                {...field}
                id="pkg-features"
                rows={5}
                placeholder={"One per line, e.g.\n15 edited photos\nOnline gallery"}
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="active"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="pkg-active" checked={field.value} onCheckedChange={field.onChange} />
              <FieldLabel htmlFor="pkg-active" className="normal-case tracking-normal text-sm text-cream">
                Available to book on the site
              </FieldLabel>
            </Field>
          )}
        />
      </FieldGroup>

      <DialogFooter className="mt-8">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : pkg ? "Save changes" : "Add package"}
        </Button>
      </DialogFooter>
    </form>
  );
}
