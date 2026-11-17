// Picking photos from the admin's Google Drive. Google's Picker lists their
// Drive; each photo they pick is then downloaded by the browser and goes up to
// Cloudinary exactly like a photo chosen from the computer, so the site only
// ever serves the Cloudinary copy.
//
// Uses the narrow drive.file scope: the site can read only the files picked
// here, never the rest of the Drive. Setup: docs/google-drive-setup.md

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
// The Google Cloud project number; the Picker needs it to grant access to the picked files.
const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

export const driveEnabled = Boolean(clientId && apiKey && appId);

export type DriveFile = { id: string; name: string; mimeType: string };

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string) {
  let loading = scripts.get(src);
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        scripts.delete(src);
        reject(new Error("Couldn't reach Google Drive. Check your connection"));
      };
      document.head.appendChild(el);
    });
    scripts.set(src, loading);
  }
  return loading;
}

let pickerReady: Promise<void> | undefined;
// Called when the button first shows, so a click opens Google's sign-in popup
// straight away (browsers block popups that open long after the click).
export function loadPicker() {
  pickerReady ??= Promise.all([
    loadScript("https://accounts.google.com/gsi/client"),
    loadScript("https://apis.google.com/js/api.js").then(() => new Promise<void>((resolve) => gapi.load("picker", resolve))),
  ]).then(
    () => undefined,
    (e) => {
      pickerReady = undefined;
      throw e;
    }
  );
  return pickerReady;
}

// Google's access token lasts an hour; kept for the session so a second pick
// doesn't ask the admin to sign in again.
let token: { value: string; expiresAt: number } | undefined;

function signIn() {
  if (token && token.expiresAt > Date.now() + 5 * 60_000) return Promise.resolve(token.value);
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId!,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (res) => {
        if (res.error || !res.access_token) return reject(new Error("Google sign-in was cancelled"));
        token = { value: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 };
        resolve(token.value);
      },
      error_callback: (err) =>
        reject(new Error(err.type === "popup_closed" ? "Google sign-in was cancelled" : "Couldn't sign in to Google")),
    });
    client.requestAccessToken({ prompt: token ? "" : undefined });
  });
}

/** Opens the Drive picker; resolves with the chosen photos, or none if the admin closes it. */
export async function pickFromDrive(): Promise<DriveFile[]> {
  if (!driveEnabled) throw new Error("Google Drive isn't set up for this site yet");
  await loadPicker();
  const accessToken = await signIn();

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setEnableDrives(true)
      .setMode(google.picker.DocsViewMode.GRID);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .setMaxItems(500)
      .setTitle("Choose photos (shift-click to pick a range)")
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey!)
      .setAppId(appId!)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve((data.docs ?? []).map(({ id, name, mimeType }) => ({ id, name, mimeType })));
          picker.dispose();
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve([]);
          picker.dispose();
        }
      })
      .build();
    picker.setVisible(true);
  });
}

/** Downloads a picked photo from Drive, ready to upload like a local file. */
export async function downloadFromDrive(file: DriveFile) {
  if (!token) throw new Error("Signed out of Google. Pick the photos again");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token.value}` } }
  );
  if (res.status === 401) throw new Error("Google sign-in expired. Pick the photos again");
  if (!res.ok) throw new Error("Couldn't download it from Google Drive");
  const blob = await res.blob();
  return new File([blob], file.name, { type: file.mimeType || blob.type });
}
