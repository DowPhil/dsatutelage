'use client'

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  FileText,
  Video,
  PlayCircle,
  ScrollText,
  Presentation,
  Link as LinkIcon,
  Download,
  Eye,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Loader2,
  BookOpen,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getCourses,
  getMaterials,
  getMaterialsForTrack,
  addMaterial as addLocalMaterial,
  removeMaterial as removeLocalMaterial,
  getCompleted,
  toggleComplete,
  trackProgress,
  categoryLabel,
} from '@/lib/coursesStore'
import { getUser, getToken } from '@/lib/auth'
import {
  useEntitlements,
  refreshEntitlements,
  resetDate,
} from '@/components/dashboard/useEntitlements'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'
import {
  uploadToCloudinary,
  cloudinaryConfigured,
  type CloudinaryResult,
} from '@/lib/cloudinary'
import {
  buildMaterialPayload,
  classLevelLabel,
  classOptionsForCourse,
  materialDraftError,
  materialFileError,
} from '@/lib/materialUpload'
import { normaliseTrack } from '@/lib/studentProfile'
import type { CourseMaterial, MaterialType, CourseCategory } from '@/lib/types'

const TYPE_META: Record<
  MaterialType,
  { label: string; icon: React.ElementType; tint: string }
> = {
  pdf: { label: 'PDF', icon: FileText, tint: 'bg-rose-50 text-rose-600' },
  video: { label: 'Video', icon: Video, tint: 'bg-blue-50 text-blue-600' },
  recording: {
    label: 'Recording',
    icon: PlayCircle,
    tint: 'bg-purple-50 text-purple-600',
  },
  syllabus: {
    label: 'Syllabus',
    icon: ScrollText,
    tint: 'bg-amber-50 text-amber-600',
  },
  slide: {
    label: 'Slides',
    icon: Presentation,
    tint: 'bg-emerald-50 text-emerald-600',
  },
  link: { label: 'Link', icon: LinkIcon, tint: 'bg-slate-100 text-slate-600' },
}

const MATERIAL_TYPES = Object.keys(TYPE_META) as MaterialType[]

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

function mapMaterial(m: Record<string, unknown>): CourseMaterial {
  const t = String(m.type ?? 'link')
  return {
    id: String(m.id ?? m._id ?? ''),
    courseId: String(m.courseId ?? ''),
    title: String(m.title ?? ''),
    type: (MATERIAL_TYPES as string[]).includes(t)
      ? (t as MaterialType)
      : 'link',
    url: String(m.url ?? ''),
    classLevel: m.classLevel ? String(m.classLevel) : undefined,
    description: m.description ? String(m.description) : undefined,
    isDownloadable: !!m.isDownloadable,
    durationLabel: m.durationLabel ? String(m.durationLabel) : undefined,
    createdAt: String(m.createdAt ?? ''),
  }
}

function LiveBadge({ live }: { live: boolean }) {
  return (
    <Badge
      className={`text-[8px] font-black shrink-0 ${live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
    >
      {live ? 'Live' : 'Local'}
    </Badge>
  )
}

function MaterialIcon({ type }: { type: MaterialType }) {
  const { icon: Icon, tint } = TYPE_META[type]
  return (
    <div
      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${tint}`}
    >
      <Icon size={16} strokeWidth={2.5} />
    </div>
  )
}

/** For useSyncExternalStore reads that never change after the first render. */
const noSubscription = () => () => {}

export default function CourseMaterials({
  mode,
  studentKey,
  track: trackProp,
}: {
  mode: 'tutor' | 'student'
  studentKey?: string
  track?: string
}) {
  // Client-only content (it reads browser storage): render after hydration.
  const mounted = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )

  if (!mounted) {
    return (
      <div className='py-16 flex justify-center'>
        <Loader2 className='animate-spin text-[#002EFF]' />
      </div>
    )
  }

  if (mode === 'tutor') return <TutorMaterials />

  const u = getUser()
  const track = trackProp || normaliseTrack(u?.level || u?.examType || 'jamb')
  return (
    <StudentMaterials track={track} studentKey={studentKey || u?.username || 'me'} />
  )
}

/* ---------------- Tutor: upload & manage ---------------- */
function TutorMaterials() {
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<
    { id: string; title: string; category?: string; classLevel?: string }[]
  >([])
  const [courseId, setCourseId] = useState('')
  const [materials, setMaterials] = useState<CourseMaterial[]>([])

  const [title, setTitle] = useState('')
  const [type, setType] = useState<MaterialType>('pdf')
  const [url, setUrl] = useState('')
  const [duration, setDuration] = useState('')
  const [downloadable, setDownloadable] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  // After-School materials are for SS1 or SS2; the pick survives a failed save.
  const [classLevel, setClassLevel] = useState('')
  // The Cloudinary response for the file in the form.
  const [lastUpload, setLastUpload] = useState<CloudinaryResult | null>(null)
  const saving = useRef(false)

  const course = courses.find((c) => c.id === courseId) ?? null
  const classOptions = classOptionsForCourse(course)

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    const invalid = materialFileError(file)
    if (invalid) {
      setUploadNote(invalid)
      return
    }
    setUploadNote('')
    setError('')
    // Drop the previous file's link first, so a failed upload can never leave
    // an earlier file's URL in the form.
    setUrl('')
    setLastUpload(null)
    setUploading(true)
    try {
      const uploaded = await uploadToCloudinary(file, 'materials')
      setUrl(uploaded.url)
      setLastUpload(uploaded)
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''))
      setUploadNote('File uploaded ✓')
    } catch (err) {
      // Not configured / failed — the URL field stays for a pasted link.
      setUploadNote(
        err instanceof Error ? err.message : 'Upload unavailable — paste a link.',
      )
    } finally {
      setUploading(false)
    }
  }

  // Load the tutor's courses.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (isLive()) {
        try {
          const cs = (await dsaApi.courses.list({
            tutorId: 'me',
          })) as Record<string, unknown>[]
          if (cancelled) return
          const mapped = cs.map((c) => ({
            id: String(c.id ?? c._id ?? ''),
            title: String(c.title ?? 'Course'),
            category: c.category ? String(c.category) : undefined,
            classLevel: c.classLevel ? String(c.classLevel) : undefined,
          }))
          setCourses(mapped)
          setLive(true)
          setCourseId((p) => p || mapped[0]?.id || '')
          return
        } catch (err) {
          // A signed-in tutor must not drop to the offline preview: anything
          // added there would only be saved in this browser, never uploaded.
          if (cancelled) return
          setLive(true)
          setLoading(false)
          setError(
            err instanceof Error
              ? `Could not load your courses: ${err.message}`
              : 'Could not load your courses. Check your connection and reload.',
          )
          return
        }
      }
      if (cancelled) return
      const cs = getCourses().map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
      }))
      setCourses(cs)
      setLive(false)
      setCourseId((p) => p || cs[0]?.id || '')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadMaterials = useCallback(async () => {
    if (!courseId) {
      setMaterials([])
      setLoading(false)
      return
    }
    setLoading(true)
    if (isLive()) {
      try {
        const rows = (await dsaApi.courses.materials(
          courseId,
        )) as Record<string, unknown>[]
        setMaterials(rows.map(mapMaterial))
      } catch (err) {
        setError(
          err instanceof Error
            ? `Could not load the materials: ${err.message}`
            : 'Could not load the materials.',
        )
      }
      setLoading(false)
      return
    }
    setMaterials(getMaterials(courseId))
    setLoading(false)
  }, [courseId])

  useEffect(() => {
    void loadMaterials()
  }, [loadMaterials])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    // One save at a time: a double click must not post the material twice.
    if (saving.current) return
    setError('')
    const invalid = materialDraftError({ title, url, classLevel }, course, {
      uploading,
    })
    if (invalid) return setError(invalid)
    saving.current = true
    setBusy(true)
    try {
      if (live) {
        const saved = (await dsaApi.courses.addMaterial(
          courseId,
          buildMaterialPayload(
            {
              title,
              url,
              classLevel,
              type,
              isDownloadable: downloadable,
              description: duration.trim()
                ? `Duration: ${duration.trim()}`
                : undefined,
            },
            course,
            lastUpload,
          ),
        )) as { url?: string; classLevel?: string } | undefined
        if (!saved?.url) {
          throw new Error('The server did not confirm the save. Please try again.')
        }
        const forClass = classLevelLabel(course?.category, saved.classLevel)
        setUploadNote(`Saved${forClass ? ` for ${forClass}` : ''} ✓`)
      } else {
        addLocalMaterial({
          courseId,
          title,
          type,
          url,
          isDownloadable: downloadable,
          durationLabel: duration.trim() || undefined,
          now: Date.now(),
        })
      }
      setTitle('')
      setUrl('')
      setLastUpload(null)
      setDuration('')
      setType('pdf')
      setDownloadable(true)
      await loadMaterials()
    } catch (err) {
      // Keep the form (and the uploaded file's link) so a retry needs no
      // new upload.
      setError(err instanceof Error ? err.message : 'Failed to add material')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      if (live) await dsaApi.courses.removeMaterial(id)
      else removeLocalMaterial(id)
      await loadMaterials()
    } catch {
      /* a reload will reflect the true state */
    }
  }

  if (loading && !courses.length) {
    return (
      <div className='py-16 flex justify-center'>
        <Loader2 className='animate-spin text-[#002EFF]' />
      </div>
    )
  }

  return (
    <div className='space-y-5'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
            Course Materials
          </h2>
          <p className='text-[11px] font-bold text-slate-400'>
            Upload syllabus, PDFs, videos &amp; recordings for your students.
          </p>
        </div>
        <LiveBadge live={live} />
      </div>

      {/* Course picker */}
      <div className='flex items-center gap-2 flex-wrap'>
        <BookOpen size={15} className='text-slate-400' />
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className='h-10 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
        >
          {courses.length === 0 && <option value=''>No courses assigned</option>}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.category
                ? `${c.title} — ${categoryLabel(c.category as CourseCategory)}${c.classLevel ? ` ${c.classLevel}` : ''}`
                : c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Add form */}
      <Card className='p-5 rounded-3xl border-none shadow-sm bg-white'>
        <form onSubmit={add} className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          {error && (
            <p className='sm:col-span-2 text-[11px] font-bold text-rose-600'>
              {error}
            </p>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Title (e.g. Week 3 — Trigonometry)'
            className='h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium'
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MaterialType)}
            className='h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
          >
            {MATERIAL_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {TYPE_META[tp].label}
              </option>
            ))}
          </select>
          {classOptions.length > 1 && (
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              aria-label='Class'
              className='sm:col-span-2 h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
            >
              <option value=''>Class — choose one…</option>
              {classOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <div className='sm:col-span-2 flex items-center gap-2 flex-wrap'>
            <label className='inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer text-[11px] font-black uppercase text-slate-600 transition-colors'>
              {uploading ? (
                <Loader2 size={14} className='animate-spin' />
              ) : (
                <Plus size={14} />
              )}
              {uploading ? 'Uploading…' : 'Upload file'}
              <input
                type='file'
                onChange={onPickFile}
                disabled={uploading}
                className='hidden'
              />
            </label>
            {uploadNote && (
              <span className='text-[10px] font-bold text-slate-500 flex-1 min-w-[150px]'>
                {uploadNote}
              </span>
            )}
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='File / video URL (https://…)'
            className='sm:col-span-2 h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium'
          />
          {(type === 'video' || type === 'recording') && (
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder='Duration (e.g. 12:40)'
              className='h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium'
            />
          )}
          <label className='flex items-center gap-2 text-[11px] font-bold text-slate-500'>
            <input
              type='checkbox'
              checked={downloadable}
              onChange={(e) => setDownloadable(e.target.checked)}
            />
            Allow download
          </label>
          <button
            type='submit'
            disabled={busy || uploading || !courseId}
            className='sm:col-span-2 flex items-center justify-center gap-2 h-11 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50'
          >
            <Plus size={15} /> {busy ? 'Adding…' : 'Add Material'}
          </button>
        </form>
        <p className='text-[10px] font-medium text-slate-400 mt-3 leading-relaxed'>
          {cloudinaryConfigured() ? (
            <>
              <span className='font-black text-slate-500'>Adding a PDF or video?</span>{' '}
              Use <span className='font-black'>Upload file</span> above to add it
              directly, or paste any hosted link in the URL box.
            </>
          ) : (
            <>
              <span className='font-black text-slate-500'>Adding a PDF or video?</span>{' '}
              Upload it to Google Drive, Dropbox or OneDrive, set sharing to
              “anyone with the link”, and paste that link in the URL box above.
              (Direct upload turns on once Cloudinary is configured.)
            </>
          )}
        </p>
      </Card>

      {/* Existing materials */}
      <div className='space-y-2'>
        {loading ? (
          <div className='py-6 flex justify-center'>
            <Loader2 className='animate-spin text-[#002EFF]' />
          </div>
        ) : materials.length === 0 ? (
          <p className='text-xs font-bold text-slate-400 py-6 text-center'>
            No materials yet for this course.
          </p>
        ) : (
          materials.map((m) => (
            <Card
              key={m.id}
              className='p-3 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3'
            >
              <MaterialIcon type={m.type} />
              <div className='min-w-0 flex-1'>
                <p className='text-xs font-black text-gray-800 truncate'>
                  {m.title}
                </p>
                <p className='text-[10px] font-bold text-slate-400'>
                  {TYPE_META[m.type].label}
                  {m.classLevel
                    ? ` · ${classLevelLabel(course?.category, m.classLevel)}`
                    : ''}
                  {m.durationLabel ? ` · ${m.durationLabel}` : ''}
                  {m.isDownloadable ? ' · downloadable' : ''}
                </p>
              </div>
              <a
                href={m.url}
                target='_blank'
                rel='noreferrer'
                className='p-2 text-slate-400 hover:text-[#002EFF]'
                title='Open'
              >
                <Eye size={15} />
              </a>
              <button
                onClick={() => remove(m.id)}
                className='p-2 text-slate-400 hover:text-rose-600'
                title='Remove'
              >
                <Trash2 size={15} />
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

/* ---------------- Student: browse, download, mark complete ---------------- */
type MatGroup = {
  course: { id: string; title: string; category?: string }
  progress: number
  materials: CourseMaterial[]
}

function StudentMaterials({
  track,
  studentKey,
}: {
  track: string
  studentKey: string
}) {
  const { entitlements } = useEntitlements()
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  // The plan does not include study materials (the server said so).
  const [blocked, setBlocked] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadMsg, setDownloadMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [groups, setGroups] = useState<MatGroup[]>([])
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setDone(new Set(getCompleted(studentKey)))
    if (isLive()) {
      try {
        const courses = (await dsaApi.courses.mine()) as Record<
          string,
          unknown
        >[]
        // Collect per-student completion straight from the API `completed`
        // flag on each material, so the ticks reflect the server (not the
        // client-side store).
        const completedIds = new Set<string>()
        const perCourse = await Promise.all(
          courses.map(async (c) => {
            const id = String(c.id ?? c._id ?? '')
            const rows = (await dsaApi.courses.materials(id)) as Record<
              string,
              unknown
            >[]
            const materials = rows.map((row) => {
              const mat = mapMaterial(row)
              if (row.completed) completedIds.add(mat.id)
              return mat
            })
            const p =
              typeof c.progressPercent === 'number'
                ? (c.progressPercent as number)
                : 0
            return {
              course: {
                id,
                title: String(c.title ?? 'Course'),
                category: c.category ? String(c.category) : undefined,
              },
              progress: p,
              materials,
            }
          }),
        )
        const withMats = perCourse.filter((g) => g.materials.length)
        setGroups(withMats)
        setDone(completedIds)
        setProgress(
          withMats.length
            ? Math.round(
                withMats.reduce((n, g) => n + g.progress, 0) / withMats.length,
              )
            : 0,
        )
        setLive(true)
        setLoading(false)
        return
      } catch (e) {
        // Not in the plan: say so — never fall back to stored demo material.
        const msg = e instanceof Error ? e.message : ''
        if (/not included in your/i.test(msg)) {
          setBlocked(msg)
          setGroups([])
          setLive(true)
          setLoading(false)
          return
        }
        /* otherwise fall through to local */
      }
    }
    const local = getMaterialsForTrack(track)
    const g: MatGroup[] = Object.keys(local).map((cid) => ({
      course: {
        id: cid,
        title: getCourses().find((c) => c.id === cid)?.title ?? cid,
      },
      progress: 0,
      materials: local[cid],
    }))
    setGroups(g)
    setProgress(trackProgress(studentKey, track))
    setLive(false)
    setLoading(false)
  }, [track, studentKey])

  useEffect(() => {
    void load()
  }, [load])

  const markComplete = async (id: string) => {
    if (live) {
      // Toggle against the server: POST to mark, DELETE to un-mark. The
      // reload re-reads the `completed` flags + progressPercent.
      try {
        if (done.has(id)) await dsaApi.courses.uncompleteMaterial(id)
        else await dsaApi.courses.completeMaterial(id)
        await load()
      } catch {
        /* ignore; the bar reflects the server on next load */
      }
    } else {
      toggleComplete(studentKey, id)
      await load()
    }
  }

  if (loading) {
    return (
      <div className='py-16 flex justify-center'>
        <Loader2 className='animate-spin text-[#002EFF]' />
      </div>
    )
  }

  // Download through the server, which counts it against the month's
  // allowance (one key per click, so a retried request is not counted twice).
  const download = async (m: CourseMaterial) => {
    setDownloading(m.id)
    setDownloadMsg(null)
    const key =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${m.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      const res = await dsaApi.materials.download(m.id, key)
      window.open(res.url, '_blank', 'noopener')
      if (res.allowance && res.allowance.remaining != null) {
        setDownloadMsg({ ok: true, text: `Downloading. ${res.allowance.remaining} download${res.allowance.remaining === 1 ? '' : 's'} left this month.` })
      }
    } catch (e) {
      setDownloadMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not download this file.' })
    } finally {
      setDownloading(null)
      void refreshEntitlements()
    }
  }

  const dl = entitlements && !entitlements.unrestricted ? entitlements.materials : undefined
  const canDownload = !dl || dl.download

  return (
    <div className='space-y-5'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
            Course Materials
          </h2>
          <p className='text-[11px] font-bold text-slate-400'>
            Your syllabus, notes, videos &amp; class recordings.
          </p>
        </div>
        <LiveBadge live={live} />
      </div>

      {/* Progress */}
      <Card className='p-4 rounded-3xl border-none shadow-sm bg-white'>
        <div className='flex items-center justify-between mb-2'>
          <span className='text-[10px] font-black uppercase text-gray-400'>
            Course Progress
          </span>
          <span className='text-xs font-black text-[#002EFF]'>{progress}%</span>
        </div>
        <div className='h-2.5 bg-slate-100 rounded-full overflow-hidden'>
          <div
            className='h-full bg-[#002EFF] rounded-full transition-all'
            style={{ width: `${progress}%` }}
          />
        </div>
      </Card>

      {dl && dl.download && dl.downloads.limit != null && (
        <div
          role='status'
          className={`rounded-2xl border px-4 py-3 text-[11px] font-bold ${
            (dl.downloads.remaining ?? 0) <= 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-100 bg-white text-slate-600'
          }`}
        >
          Downloads this month: <b>{dl.downloads.used}</b> of <b>{dl.downloads.limit}</b> used
          {(dl.downloads.remaining ?? 0) <= 0 ? ' — none left' : ` · ${dl.downloads.remaining} left`}. Resets on{' '}
          {resetDate(dl.downloads.resetsAt, entitlements?.timezone)}. Viewing a material does not count.
          {(dl.downloads.remaining ?? 0) <= 0 && entitlements?.canUpgrade && (
            <a href='/dashboard?tab=unlock' className='ml-2 underline'>Upgrade for more</a>
          )}
        </div>
      )}
      {downloadMsg && (
        <p
          role={downloadMsg.ok ? 'status' : 'alert'}
          className={`rounded-xl px-3 py-2 text-[11px] font-bold ${downloadMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
        >
          {downloadMsg.text}
        </p>
      )}

      {blocked ? (
        <div className='rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center' role='status'>
          <p className='text-xs font-black text-amber-800'>{blocked}</p>
          <a href='/dashboard?tab=unlock' className='mt-2 inline-block text-[11px] font-black uppercase text-[#002EFF] underline'>
            See plans
          </a>
        </div>
      ) : groups.length === 0 ? (
        <p className='text-xs font-bold text-slate-400 py-8 text-center'>
          No materials published for your courses yet.
        </p>
      ) : (
        <>
        {groups.map((g) => (
          <div key={g.course.id} className='space-y-2'>
            <h3 className='text-[11px] font-black uppercase tracking-widest text-slate-500'>
              {g.course.category
                ? `${g.course.title} — ${categoryLabel(g.course.category as CourseCategory)}`
                : g.course.title}
            </h3>
            {g.materials.map((m) => {
              const completed = done.has(m.id)
              return (
                <Card
                  key={m.id}
                  className='p-3 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3'
                >
                  <MaterialIcon type={m.type} />
                  <div className='min-w-0 flex-1'>
                    <p className='text-xs font-black text-gray-800 truncate'>
                      {m.title}
                    </p>
                    <p className='text-[10px] font-bold text-slate-400'>
                      {TYPE_META[m.type].label}
                      {m.durationLabel ? ` · ${m.durationLabel}` : ''}
                    </p>
                  </div>
                  <a
                    href={m.url}
                    target='_blank'
                    rel='noreferrer'
                    className='flex items-center gap-1 px-3 h-8 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase'
                  >
                    <Eye size={13} /> View
                  </a>
                  {m.isDownloadable && m.type !== 'link' && live && canDownload && (
                    <button
                      type='button'
                      onClick={() => download(m)}
                      disabled={downloading === m.id}
                      className='flex items-center gap-1 px-3 h-8 rounded-lg bg-blue-50 text-[#002EFF] text-[10px] font-black uppercase disabled:opacity-60'
                    >
                      {downloading === m.id ? <Loader2 size={13} className='animate-spin' /> : <Download size={13} />}
                      Download
                    </button>
                  )}
                  <button
                    onClick={() => markComplete(m.id)}
                    className={`p-1.5 ${completed ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-500'}`}
                    title={completed ? 'Completed — click to un-mark' : 'Mark complete'}
                  >
                    {completed ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Circle size={20} />
                    )}
                  </button>
                </Card>
              )
            })}
          </div>
        ))}
        </>
      )}

      {groups.length > 0 && (
        <div className='flex flex-wrap gap-2 pt-1'>
          <Badge className='bg-slate-100 text-slate-500 text-[9px] font-black'>
            Tip: mark items complete to grow your progress bar
          </Badge>
        </div>
      )}
    </div>
  )
}
