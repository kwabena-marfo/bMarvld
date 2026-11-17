# Importing photos from Google Drive

Every photo upload in the admin (**Gallery**, and a client's **proofs** and
**edited photos**) has a box to paste a Google Drive link into, next to the
usual upload button. Paste a folder link (or a single photo's link) and click
**Import from Drive**: the site lists the photos in it, and Cloudinary downloads
each one from Drive straight into the same folder a computer upload goes to.
The photos never pass through the browser, so it's quick even on a phone.

```
Drive folder ("Anyone with the link") ──► site lists it (Drive API key) ──► Cloudinary fetches each photo ──► site
```

The site only ever shows the Cloudinary copy, so once the import has finished
the Drive folder can be unshared, moved or deleted without changing anything.

The only setup is one Google API key.

---

## 1 · The API key (once)

1. Open <https://console.cloud.google.com/> and create a project, e.g. **bMarvld**
   (any Google account will do).
2. **APIs & Services › Library**: enable **Google Drive API**.
3. **APIs & Services › Credentials › Create credentials › API key**. Edit the key:
   - **API restrictions › Restrict key**: tick only **Google Drive API**.
   - Leave **Application restrictions** at **None**. The key is used by the
     site's server and by Cloudinary, so a website or IP restriction would block it.
4. Copy the key.

The key can only read files that are already shared with "Anyone with the
link", so it can't see anything private. It stays on the server and is never
sent to the browser.

## 2 · Give the site the key

Add it to `.env.local` and to the Vercel project (**Settings › Environment
Variables**, Production, Preview and Development):

```
GOOGLE_API_KEY=AIza...
```

Redeploy (and restart `npm run dev` locally). Until it's set, an import shows
"Google Drive import isn't set up yet".

## Using it

1. In Google Drive, right-click the shoot's folder › **Share** › under
   **General access** choose **Anyone with the link** › **Copy link**.
2. Paste the link into the box under the upload button and click
   **Import from Drive** (or press Enter).
3. The photos import three at a time, with the same progress and error messages
   as a computer upload. Keep the page open until it finishes.
4. Optionally set the folder back to **Restricted** afterwards.

Good to know:

- Only photos directly in the folder are imported. Subfolders are skipped (the
  site says how many); paste their links separately.
- Photos are imported in name order (`IMG_2.jpg` before `IMG_10.jpg`), and keep
  their Drive file names, which is what the client's picks list shows.
- The 10 MB-a-photo limit still applies. A bigger photo is listed as failed:
  export it smaller, or for proofs upload it from the computer instead, which
  scales it down to fit.
