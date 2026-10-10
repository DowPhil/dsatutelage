# Cloudinary uploads — what to verify before relying on PDF and ZIP files

*Written 2026-10-11. Nothing here was tested against the real Cloudinary
account — no file has been uploaded to it from this work. Treat every
"check" below as unverified until someone signs in and confirms it.*

## How uploads work today

- The browser uploads straight to Cloudinary (`src/lib/cloudinary.ts`):
  `POST https://api.cloudinary.com/v1_1/<cloud name>/auto/upload` with
  `file`, `upload_preset` and `folder` (multipart, built by the browser).
- It is an **unsigned** upload: only the cloud name and the preset name are
  used (both public, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` /
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, with defaults in the code). No API
  key or secret is in the frontend.
- The app keeps Cloudinary's `secure_url` (https only; anything else is
  treated as a failed upload) plus `public_id`, `resource_type`, `format` and
  `bytes`, and saves them with the material (`POST /api/courses/:id/materials`).
- `resource_type=auto` lets Cloudinary decide: PDFs are normally stored as
  **image** resources, Office documents as **raw**, videos as **video**.

## PDF files — dashboard setting to check

Cloudinary blocks *delivery* (opening/downloading) of PDF and ZIP files on
many accounts by default, even though the upload succeeds and a URL is
returned. The upload then looks fine but the link answers **401** when a
student opens it.

Check, in the Cloudinary Console:

1. **Settings → Security → "PDF and ZIP files delivery"** — the checkbox
   **"Allow delivery of PDF and ZIP files"** must be **on** for PDF links to
   open. (Older consoles label it the same way under *Security*.)
2. Then confirm on staging: upload one small test PDF through the admin
   Library (to a staging/test cloud, not production), open the saved link in a
   private browser window, and check it downloads rather than returning 401.

Until that is confirmed, do not assume uploaded PDFs are viewable.

## ZIP files — not accepted

ZIP files are **not** on the list of files the upload forms accept
(`materialFileError` in `src/lib/materialUpload.ts` — PDF, Word, PowerPoint,
Excel, text, video, audio and images only), so they are refused before
anything is uploaded. Delivery of ZIPs depends on the same Security setting as
PDFs, and on how the preset handles archives; it has not been verified. If ZIP
support is wanted later, add `zip` to the list **after** confirming on staging
that a ZIP uploaded with the preset can be downloaded.

## Upload preset — settings to check

Cloudinary Console → **Settings → Upload → Upload presets** → the preset the
app uses (`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, default name in
`src/lib/cloudinary.ts`):

- **Signing mode: Unsigned.** A signed preset makes every browser upload fail
  with "Upload preset must be whitelisted for unsigned uploads".
- **Allowed formats** — if set, must include the formats above (at least
  `pdf`, `docx`, `pptx`, `mp4`, `jpg`, `png`), or those uploads are refused.
- **Max file size / resource limits** — the account plan's limits (commonly
  much lower for images/raw than for video) apply. Large PDFs or videos may be
  refused with a size error; the app shows Cloudinary's message.
- **Folder** — the app sends `folder=materials` for course materials; check
  the preset does not override it unexpectedly.
- **Delivery type** should be *upload* (public). An *authenticated* or
  *private* delivery type would return URLs students cannot open.

## Files that are not cleaned up

If a file is uploaded but never saved as a material (the form is closed, or
the save keeps failing), the file stays in Cloudinary. Deleting it needs the
API secret (a signed backend endpoint) or a delete token; neither exists yet.
The app avoids re-uploading on a retry (the saved link is reused), which keeps
this rare. Periodic clean-up of the `materials` folder against saved materials
would need a small backend job with the API secret.

## Manual staging checks

1. Upload a PDF, a PPTX and a short MP4 through the admin Library and the
   tutor Course Materials form, choosing After-School SS1 for one and SS2 for
   another. Each must save and show a link.
2. Open each saved link in a private window: it must open/download (no 401).
3. As an SS1 and an SS2 student, confirm each sees only their class's
   After-School materials plus the "every class" ones.
