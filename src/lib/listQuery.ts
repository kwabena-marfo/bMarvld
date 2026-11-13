// Search and paging for the admin lists. Used by the API (as Mongo filters) and
// by the pages that filter small lists in the browser, so a search behaves the
// same everywhere: every word must appear somewhere, case doesn't matter, and
// digits match phone numbers however they were spaced ("0240" finds "024 0…").

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isNumber = (word: string) => /^\+?\d+$/.test(word);

export function searchWords(q: string | undefined) {
  return (q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
}

/** A Mongo filter matching documents where each word of `q` is in one of `fields`. */
export function searchFilter(q: string | undefined, fields: string[]) {
  const words = searchWords(q);
  if (!words.length) return {};
  return {
    $and: words.map((word) => {
      const pattern = isNumber(word) ? word.split("").map(escapeRegex).join("[\\s-]*") : escapeRegex(word);
      return { $or: fields.map((f) => ({ [f]: { $regex: pattern, $options: "i" } })) };
    }),
  };
}

/** The same rule as searchFilter, for lists already in the browser. */
export function matchesSearch(q: string | undefined, ...values: (string | number | null | undefined)[]) {
  const words = searchWords(q);
  if (!words.length) return true;
  const text = values.filter((v) => v != null).join(" ").toLowerCase();
  const digits = text.replace(/[\s-]/g, "");
  return words.every((w) => text.includes(w) || (isNumber(w) && digits.includes(w)));
}

export function pageParams(page: string | undefined, pageSize: string | undefined, defaultSize = 20) {
  const p = Math.max(1, Number.parseInt(page ?? "") || 1);
  const size = Math.min(100, Math.max(1, Number.parseInt(pageSize ?? "") || defaultSize));
  return { page: p, pageSize: size, skip: (p - 1) * size };
}

export type PageParams = ReturnType<typeof pageParams>;

/** One page of a list held in the browser; a page past the end shows the last one. */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  return { page: current, offset: (current - 1) * pageSize, items: items.slice((current - 1) * pageSize, current * pageSize) };
}
