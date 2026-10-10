// Client-side (unsigned) uploads to Cloudinary.
//
// The browser uploads the file straight to Cloudinary and we store the returned
// `secure_url` — this bypasses the backend entirely (its object storage is not
// configured and its JSON body limit is ~100KB, so files can't go through it).
//
// Configure two PUBLIC values (safe to expose to the browser — that is how
// unsigned uploads work; never put the Cloudinary API *secret* in the client):
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME     e.g. "dsa-portal"
//   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET  an *unsigned* upload preset name
//
// In Cloudinary: Settings → Upload → Upload presets → add an **Unsigned** preset
// (optionally lock it down: allowed formats, a target folder, max file size).

// These are PUBLIC values (cloud name + an *unsigned* preset) — they ship in the
// client bundle on the live site regardless, so committing them as defaults is
// safe and means uploads work in every environment without per-host env config.
// Override per-environment with the NEXT_PUBLIC_CLOUDINARY_* vars if needed.
// (Lock the preset down in Cloudinary — allowed formats, folder, limits — to
// limit abuse, since any unsigned preset is by nature exposed to the browser.)
const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dxpbjxzfv'
const UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'dsa_academy'

/** True when the two public Cloudinary env vars are set. */
export function cloudinaryConfigured(): boolean {
  return !!CLOUD_NAME && !!UPLOAD_PRESET
}

export interface CloudinaryResult {
  url: string // secure_url — the hosted file/image URL
  publicId?: string // public_id — identifies the asset in Cloudinary
  resourceType: string // "image" | "video" | "raw"
  format?: string
  bytes?: number
}

interface CloudinaryUploadResponse {
  secure_url?: unknown
  public_id?: unknown
  resource_type?: unknown
  format?: unknown
  bytes?: unknown
  error?: { message?: string }
}

/**
 * Turn Cloudinary's upload response into a result, or throw a message the
 * uploader can act on. Only an https `secure_url` counts as success: a 200 with
 * no usable URL is a failed upload, not an empty link to save.
 */
export function parseCloudinaryUpload(
  status: number,
  ok: boolean,
  data: CloudinaryUploadResponse | null,
): CloudinaryResult {
  if (!ok) {
    throw new Error(
      data?.error?.message ||
        `Upload failed (HTTP ${status}). Please try again or paste a link.`,
    )
  }
  const url = typeof data?.secure_url === 'string' ? data.secure_url : ''
  let valid = false
  try {
    valid = new URL(url).protocol === 'https:'
  } catch {
    valid = false
  }
  if (!valid) {
    throw new Error(
      'The upload finished but Cloudinary did not return a file link. Please try again.',
    )
  }
  return {
    url,
    publicId: typeof data?.public_id === 'string' ? data.public_id : undefined,
    resourceType:
      typeof data?.resource_type === 'string' ? data.resource_type : 'raw',
    format: typeof data?.format === 'string' ? data.format : undefined,
    bytes: typeof data?.bytes === 'number' ? data.bytes : undefined,
  }
}

/**
 * Upload a file to Cloudinary and return its hosted URL.
 *
 * `resource_type=auto` lets Cloudinary handle images, video, PDFs and other raw
 * files with the same call. Throws a clear error when Cloudinary isn't
 * configured or the upload fails, so callers can fall back to a pasted link.
 */
export async function uploadToCloudinary(
  file: File,
  folder = 'dsa',
): Promise<CloudinaryResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'File upload isn’t configured yet. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET, then reload.',
    )
  }

  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', UPLOAD_PRESET)
  if (folder) form.append('folder', folder)

  let res: Response
  try {
    res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: 'POST', body: form },
    )
  } catch {
    throw new Error('Could not reach Cloudinary. Check your connection and try again.')
  }

  const data = (await res
    .json()
    .catch(() => null)) as CloudinaryUploadResponse | null

  return parseCloudinaryUpload(res.status, res.ok, data)
}
