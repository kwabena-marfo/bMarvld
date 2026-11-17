# Uploading photos from Google Drive

The admin's upload buttons (**Gallery**, and a client's **proofs** and **edited
photos**) have a **From Google Drive** button next to the usual one. It opens
Google's own file picker; every photo picked there is downloaded by the browser
and uploaded to the same Cloudinary folder as a photo chosen from the computer.
The site only ever shows the Cloudinary copy, so deleting or moving the Drive
file afterwards changes nothing on the site.

```
Drive ──(Google Picker, admin signs in)──► admin's browser ──(signed upload)──► Cloudinary folder ──► site
```

The site asks Google only for the `drive.file` permission: it can read the files
the admin picks, and nothing else in their Drive.

The button stays hidden until the three keys below are set.

---

## 1 · A Google Cloud project

1. Open <https://console.cloud.google.com/> with the Google account that will own
   the setup (it doesn't have to be the one whose Drive holds the photos).
2. Create a project, e.g. **bMarvld**.
3. On the project's **Dashboard** (or **IAM & Admin › Settings**), copy the
   **Project number**. That is `NEXT_PUBLIC_GOOGLE_APP_ID`.
4. **APIs & Services › Library**: enable **Google Drive API** and **Google Picker API**.

## 2 · The sign-in screen (OAuth consent)

1. **Google Auth Platform › Branding** (older consoles: **OAuth consent screen**):
   app name **B.Marvld**, support email, the logo if you like, and
   `bmarvld.com` under authorised domains.
2. **Audience**: **External**. Then **Publish app** so it's **In production**.
   `drive.file` is a non-sensitive permission, so Google doesn't need to review
   the app. (Left in *Testing*, only the Google accounts listed as test users
   can sign in.)
3. **Data access**: add the scope `.../auth/drive.file`.

## 3 · The OAuth client ID

**Google Auth Platform › Clients › Create client** (or **Credentials › Create
credentials › OAuth client ID**):

- Application type: **Web application**
- Authorised JavaScript origins:
  - `https://bmarvld.com`
  - `https://www.bmarvld.com` (if the site answers there too)
  - `http://localhost:3000` (for local development)
- No redirect URIs are needed.

Copy the **Client ID** (ends in `.apps.googleusercontent.com`). That is
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

Vercel preview addresses aren't listed, so the Drive button only signs in on the
real domain and on localhost.

## 4 · The API key

**APIs & Services › Credentials › Create credentials › API key**, then edit it:

- **Application restrictions › Websites**: `https://bmarvld.com/*`,
  `https://www.bmarvld.com/*`, `http://localhost:3000/*`
- **API restrictions › Restrict key**: **Google Picker API** and **Google Drive API**

Copy the key. That is `NEXT_PUBLIC_GOOGLE_API_KEY`. It is meant to be public
(it's sent to the browser), and the restrictions above stop it working anywhere else.

## 5 · Give the site the keys

Add to `.env.local` and to the Vercel project (**Settings › Environment Variables**,
Production and Development):

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abc...apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_API_KEY=AIza...
NEXT_PUBLIC_GOOGLE_APP_ID=1234567890
```

`NEXT_PUBLIC_` values are built into the page, so **redeploy** after adding them
(and restart `npm run dev` locally).

## Using it

1. Click **From Google Drive**. The first time, Google asks the admin to choose
   an account and allow access to "files you use with this app".
2. Open the folder with the shoot and select the photos (click, ctrl/cmd-click,
   shift-click for a range; up to 500 at a time). Shared drives are listed too.
3. Click **Select**. The photos upload three at a time, with the same progress
   and error messages as a computer upload. Keep the tab open until it finishes.

The same 10 MB-a-photo limit applies: a bigger proof is scaled down to fit, and
a bigger edit is refused with a message.
