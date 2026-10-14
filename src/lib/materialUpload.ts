// Shared rules for the admin Library and tutor Course Materials upload forms:
// which class a material is for, what a valid draft is, and the request body
// for POST /courses/:id/materials. Kept free of React so it can be tested.

import { AFTERSCHOOL_LEVELS } from './timetable'
import { CLASS_LEVELS } from './registration'
import type { CloudinaryResult } from './cloudinary'

export interface ClassOption {
  /** Sent to the API as `classLevel` — the class label students register with. */
  value: string
  label: string
}

/** After-School is split by class on the timetable; uploads follow it. */
export const AFTERSCHOOL_CLASS_OPTIONS: ClassOption[] = AFTERSCHOOL_LEVELS.map(
  (level) => ({
    value: level.toUpperCase(),
    label: `After-School ${level.toUpperCase()}`,
  }),
)

/**
 * The class a COURSE can be tied to (admin course form), matching what the
 * backend accepts (utils/classLevels.resolveCourseClassLevel):
 *  - After-School: SS1 or SS2, required — the two classes are separate courses.
 *  - Any other category: optional ("All classes"), one of the classes students
 *    register in.
 */
export function courseClassChoices(category: string): {
  required: boolean
  options: ClassOption[]
} {
  if (category === 'afterschool') {
    return { required: true, options: AFTERSCHOOL_CLASS_OPTIONS }
  }
  return {
    required: false,
    options: CLASS_LEVELS.map((level) => ({ value: level, label: level })),
  }
}

export interface CourseForUpload {
  category?: string
  classLevel?: string
}

/** "After-School SS2" for display; '' when the material is for every class. */
export function classLevelLabel(
  category: string | undefined,
  classLevel: string | undefined,
): string {
  if (!classLevel) return ''
  return category === 'afterschool' ? `After-School ${classLevel}` : classLevel
}

/**
 * The classes a material for this course can be for. Empty ⇒ no choice needed
 * (the course's category already names the class). One ⇒ the course is tied
 * to that class. Two ⇒ After-School: the uploader must pick SS1 or SS2.
 */
export function classOptionsForCourse(
  course?: CourseForUpload | null,
): ClassOption[] {
  if (!course) return []
  if (course.classLevel) {
    return [
      {
        value: course.classLevel,
        label: classLevelLabel(course.category, course.classLevel),
      },
    ]
  }
  if (course.category === 'afterschool') return AFTERSCHOOL_CLASS_OPTIONS
  return []
}

/** The class to send: the uploader's pick, or the course's only class. */
export function resolveClassLevel(
  course: CourseForUpload | null | undefined,
  picked: string,
): string {
  const options = classOptionsForCourse(course)
  if (options.length === 1) return options[0].value
  return options.some((o) => o.value === picked) ? picked : ''
}

/** A hosted http(s) link — the Cloudinary secure_url, or a pasted link. */
export function isHostedUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const MATERIAL_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'odt', 'odp',
  'mp4', 'mov', 'm4v', 'webm', 'mkv', 'mp3', 'm4a', 'wav',
  'jpg', 'jpeg', 'png', 'webp', 'gif',
]

/** Why this file cannot be uploaded as a learning material, or null. */
export function materialFileError(file: {
  name: string
  size: number
}): string | null {
  if (!file.size) return 'That file is empty. Choose another file.'
  const ext = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase()
    : ''
  if (!MATERIAL_EXTENSIONS.includes(ext)) {
    return `“.${ext || '?'}” files can’t be uploaded. Use a PDF, Word, PowerPoint, Excel, video, audio or image file.`
  }
  return null
}

export interface MaterialDraft {
  title: string
  url: string
  classLevel: string
}

/** Why this draft cannot be saved yet, or null when it can. */
export function materialDraftError(
  draft: MaterialDraft,
  course: CourseForUpload | null | undefined,
  { uploading = false }: { uploading?: boolean } = {},
): string | null {
  if (uploading) return 'Wait for the file to finish uploading.'
  if (!course) return 'Choose the course this material is for.'
  if (draft.title.trim().length < 2) return 'Enter a title.'
  if (!isHostedUrl(draft.url)) {
    return 'Upload a file, or paste its https:// link.'
  }
  const options = classOptionsForCourse(course)
  if (options.length > 1 && !resolveClassLevel(course, draft.classLevel)) {
    return `Choose the class: ${options.map((o) => o.label).join(' or ')}.`
  }
  return null
}

/**
 * The POST /courses/:id/materials body. The URL is the one Cloudinary returned
 * (never one built by hand); the upload's metadata goes with it only while the
 * URL field still holds that upload (not a link pasted over it).
 */
export function buildMaterialPayload(
  draft: MaterialDraft & {
    type: string
    isDownloadable: boolean
    paid?: boolean
    description?: string
    durationSeconds?: number
  },
  course: CourseForUpload | null | undefined,
  upload?: CloudinaryResult | null,
): Record<string, unknown> {
  const url = draft.url.trim()
  const classLevel = resolveClassLevel(course, draft.classLevel)
  const fromUpload = upload && upload.url === url ? upload : null
  return {
    title: draft.title.trim(),
    type: draft.type,
    url,
    isDownloadable: draft.isDownloadable,
    paid: draft.paid === true,
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.durationSeconds ? { durationSeconds: draft.durationSeconds } : {}),
    ...(classLevel ? { classLevel } : {}),
    ...(fromUpload
      ? {
          publicId: fromUpload.publicId,
          resourceType: fromUpload.resourceType,
          format: fromUpload.format,
          fileSizeBytes: fromUpload.bytes,
        }
      : {}),
  }
}
