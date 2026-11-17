// Importing photos from a pasted Google Drive link. The folder (or photo) must
// be shared as "Anyone with the link"; the server lists it with the Drive API,
// then Cloudinary downloads each photo from Drive itself, so photos never pass
// through the admin's browser or this server. Setup: docs/google-drive-setup.md

const API = "https://www.googleapis.com/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";
// Cloudinary's plan takes up to 10 MB a photo.
export const MAX_BYTES = 10 * 1024 * 1024;

export type DriveFile = { id: string; name: string; mimeType: string; size: number };
type RawFile = { id: string; name: string; mimeType: string; size?: string };

export class DriveError extends Error {}

function apiKey() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new DriveError("Google Drive import isn't set up yet (GOOGLE_API_KEY is missing)");
  return key;
}

const validId = (id: string) => /^[\w-]{10,}$/.test(id);

// Folder, file and old-style links: /drive/folders/ID, /drive/u/0/folders/ID,
// /file/d/ID/view, /open?id=ID, /uc?id=ID. A bare ID works too.
export function driveIdFromLink(link: string) {
  const text = link.trim();
  if (validId(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!/(^|\.)google\.com$/.test(url.hostname)) return null;
  const id = url.pathname.match(/\/(?:folders|d)\/([\w-]+)/)?.[1] ?? url.searchParams.get("id");
  return id && validId(id) ? id : null;
}

async function driveGet<T>(path: string, params: Record<string, string>) {
  const query = new URLSearchParams({ ...params, supportsAllDrives: "true", key: apiKey() });
  const res = await fetch(`${API}${path}?${query}`, { cache: "no-store" });
  // A file that isn't shared publicly looks to an API key exactly like one that doesn't exist.
  if (res.status === 404) {
    throw new DriveError("Google Drive won't share that. Set it to \"Anyone with the link\" and try again");
  }
  if (!res.ok) {
    // Usually setup: a wrong or restricted key, or the Drive API not enabled.
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    console.error("Google Drive API", res.status, body?.error?.message);
    throw new DriveError(`Google Drive refused the request: ${body?.error?.message ?? res.statusText}`);
  }
  return (await res.json()) as T;
}

const toFile = (f: RawFile): DriveFile => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: Number(f.size ?? 0) });

export async function getDriveFile(id: string) {
  if (!validId(id)) throw new DriveError("That isn't a Google Drive photo");
  return toFile(await driveGet<RawFile>(`/${id}`, { fields: "id,name,mimeType,size" }));
}

/**
 * The photos a pasted link points at: every photo directly in a folder, or the
 * one photo for a file link. Subfolders are counted, not opened.
 */
export async function listDriveLink(link: string) {
  const id = driveIdFromLink(link);
  if (!id) throw new DriveError("Paste a Google Drive folder or photo link");

  const target = await getDriveFile(id);
  if (target.mimeType !== FOLDER) {
    if (!target.mimeType.startsWith("image/")) throw new DriveError(`${target.name} isn't a photo`);
    return { photos: [target], subfolders: 0 };
  }

  const photos: DriveFile[] = [];
  let subfolders = 0;
  let pageToken: string | undefined;
  do {
    const page = await driveGet<{ files: RawFile[]; nextPageToken?: string }>("", {
      q: `'${id}' in parents and trashed = false and (mimeType contains 'image/' or mimeType = '${FOLDER}')`,
      fields: "nextPageToken,files(id,name,mimeType,size)",
      orderBy: "name_natural",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const f of page.files) {
      if (f.mimeType === FOLDER) subfolders++;
      else photos.push(toFile(f));
    }
    pageToken = page.nextPageToken;
  } while (pageToken && photos.length < 5000);

  return { photos, subfolders };
}

/** The address Cloudinary downloads a shared photo from. */
export function driveDownloadUrl(id: string) {
  return `${API}/${id}?${new URLSearchParams({ alt: "media", supportsAllDrives: "true", key: apiKey() })}`;
}

// Checked before Cloudinary fetches it, for a clear message instead of Cloudinary's.
// A computer upload scales big proofs down in the browser; a Drive import can't.
export function checkSize(file: DriveFile, { proof = false } = {}) {
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new DriveError(
      `${mb} MB is over the 10 MB limit. Export it smaller${proof ? ", or upload it from the computer to have it scaled down" : ""}`
    );
  }
}
