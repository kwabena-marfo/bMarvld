"use client";

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminFetch } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

// Search and paging shared by the admin lists. The search text and page live in
// the address (?q=…&page=…), so coming back from a client's gallery, refreshing
// or sharing the link keeps your place.

// Changing the address with the history API updates useSearchParams without a
// round trip to the server.
function setParams(changes: Record<string, string | null>) {
  const next = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  const search = next.toString();
  window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
}

/** Sets filters; any change goes back to the first page. */
const setFilters = (changes: Record<string, string | null>) => setParams({ ...changes, page: null });
const setQuery = (q: string) => setFilters({ q: q || null });
const setPage = (page: number) => {
  setParams({ page: page > 1 ? String(page) : null });
  window.scrollTo({ top: 0, behavior: "smooth" });
};

export function useListParams() {
  const params = useSearchParams();
  return {
    q: params.get("q") ?? "",
    page: Math.max(1, Number.parseInt(params.get("page") ?? "") || 1),
    get: (key: string) => params.get(key),
    set: setFilters,
    setQuery,
    setPage,
  };
}

/**
 * Loads a page of a list from the admin API. While the next page or search is on
 * its way the previous results stay up (with `loading` set), so the list doesn't
 * jump about.
 */
export function useAdminList<T>(path: string) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string }>({
    path: null,
    data: null,
    error: "",
  });

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    adminFetch<T>(path)
      .then((data) => {
        if (current) setState({ path, data, error: "" });
      })
      .catch((e: Error) => {
        if (current) setState((s) => ({ ...s, path, error: e.message }));
      });
    return () => {
      current = false;
    };
  }, [path, version]);

  return {
    data: state.data,
    error: state.error,
    loading: state.path !== path,
    /** Loads the same page again, after a change. */
    reload: () => setVersion((v) => v + 1),
  };
}

/** A search box that waits until you pause typing before it searches. */
export function ListSearch({
  value,
  onSearch,
  placeholder,
  className,
}: {
  value: string;
  onSearch: (q: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text, value, onSearch]);

  return (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-cream/40" />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && text) {
            e.preventDefault();
            setText("");
            onSearch("");
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pr-10 pl-11 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            onSearch("");
          }}
          className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-cream/50 hover:text-cream"
          aria-label="Clear search"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Page numbers to show: the first, the last, and the ones around the current page. */
function pageNumbers(page: number, pageCount: number) {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/** "21 to 40 of 87 bookings" plus previous / page numbers / next. */
export function ListPagination({
  page,
  pageSize,
  total,
  noun,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: [singular: string, plural: string];
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // A page that no longer exists (after a search narrowed the list, or the last
  // item on it was deleted) moves back to the last page there is.
  useEffect(() => {
    if (total > 0 && page > pageCount) onPage(pageCount);
  }, [total, page, pageCount, onPage]);

  if (total === 0) return null;
  const current = Math.min(page, pageCount);
  const first = (current - 1) * pageSize + 1;
  const last = Math.min(total, current * pageSize);
  const label = total === 1 ? noun[0] : noun[1];

  return (
    // Bottom margin keeps the last buttons clear of the floating theme switch.
    <nav
      aria-label="Pages"
      className="mt-6 mb-16 flex flex-wrap items-center justify-between gap-3 text-sm text-cream-dim"
    >
      <p>{pageCount > 1 ? `${first} to ${last} of ${total} ${label}` : `${total} ${label}`}</p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" disabled={current === 1} onClick={() => onPage(current - 1)} aria-label="Previous page">
            <ChevronLeftIcon />
          </Button>
          {pageNumbers(current, pageCount).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-cream/40">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === current ? "outline" : "ghost"}
                size="icon"
                onClick={() => onPage(p)}
                aria-label={`Page ${p}`}
                aria-current={p === current ? "page" : undefined}
                className={cn("tabular-nums", p === current && "border-gold text-gold")}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled={current === pageCount}
            onClick={() => onPage(current + 1)}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </nav>
  );
}

/** The message when a list is empty: "nothing yet" or "nothing matches". */
export function EmptyList({ q, empty, noun }: { q: string; empty: string; noun: string }) {
  return <p className="text-cream-dim">{q ? `No ${noun} match “${q}”.` : empty}</p>;
}
