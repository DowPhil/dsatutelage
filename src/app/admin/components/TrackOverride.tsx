'use client'

// Admin control to override a student's exam track (e.g. a JAMB candidate whose
// programmes resolved to Post-UTME). Sets `examTrackOverride` on the user, which
// the student portal prefers over the programme-derived track. Frontend-first:
// it calls PATCH /admin/users/:id — see docs/backend-requests-2026-09-01.md (§5).

import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { dsaApi } from '@/lib/api'
import { EXAM_TRACKS, type ExamTrack } from '@/lib/studentProfile'

const TRACKS: ExamTrack[] = [
  'jamb',
  'waec',
  'postutme',
  'undergrad',
  'preclinical',
  'afterschool',
]

function adminToken(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    undefined
  )
}

// Map whatever the roster shows (e.g. "JAMB", "postutme") to a track id.
function toTrackId(raw?: string): ExamTrack | '' {
  const v = (raw ?? '').toString().trim().toLowerCase()
  if (!v) return ''
  if (v.includes('post')) return 'postutme'
  if (v.includes('waec') || v.includes('wassce')) return 'waec'
  if (v.includes('preclinic')) return 'preclinical'
  if (v.includes('undergrad') || v.includes('100') || v.includes('200'))
    return 'undergrad'
  if (v.includes('after') || v.includes('summer')) return 'afterschool'
  if (v.includes('jamb') || v.includes('utme')) return 'jamb'
  return ''
}

export default function TrackOverride({
  studentId,
  current,
  onChanged,
  disabled = false,
}: {
  studentId: string
  current?: string
  /** Show the value without letting it be changed. */
  disabled?: boolean
  onChanged?: (track: string) => void
}) {
  const [value, setValue] = useState<ExamTrack | ''>(toTrackId(current))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  const change = async (next: ExamTrack) => {
    setValue(next)
    setBusy(true)
    setSaved(false)
    setError(false)
    try {
      await dsaApi.admin.updateUser(
        studentId,
        { examTrack: next },
        adminToken(),
      )
      setSaved(true)
      onChanged?.(next)
      setTimeout(() => setSaved(false), 1800)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className='inline-flex items-center gap-1'>
      <select
        value={value}
        onChange={(e) => change(e.target.value as ExamTrack)}
        disabled={busy || disabled}
        title='Override exam track'
        onClick={(e) => e.stopPropagation()}
        className={`h-7 pl-2 pr-1 rounded-lg text-[10px] font-black bg-slate-50 border outline-none ${
          error ? 'border-rose-300' : 'border-transparent focus:border-[#002EFF]/30'
        } disabled:opacity-50`}
      >
        <option value=''>Set track…</option>
        {TRACKS.map((t) => (
          <option key={t} value={t}>
            {EXAM_TRACKS[t].label}
          </option>
        ))}
      </select>
      {busy ? (
        <Loader2 size={11} className='animate-spin text-[#002EFF]' />
      ) : saved ? (
        <Check size={11} className='text-emerald-600' />
      ) : null}
    </span>
  )
}
