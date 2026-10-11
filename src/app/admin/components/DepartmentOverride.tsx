'use client'

// Admin control to change a student's department (Science / Art / Commercial).
// Sets `department` on the user via PATCH /admin/users/:id — the backend already
// accepts it (adminController.updateUser). The student's courses, quizzes and
// timetable are department-scoped, so this re-homes them to the right stream.
// Sibling to TrackOverride.tsx.

import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { dsaApi } from '@/lib/api'
import { DEPARTMENT_LABELS, type Department } from '@/lib/studentProfile'

const DEPARTMENTS: Department[] = ['science', 'art', 'commercial']

function adminToken(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    undefined
  )
}

function toDeptId(raw?: string): Department | '' {
  const v = (raw ?? '').toString().trim().toLowerCase()
  if (v === 'science' || v === 'art' || v === 'commercial') return v
  return ''
}

export default function DepartmentOverride({
  studentId,
  current,
  onChanged,
  disabled = false,
}: {
  studentId: string
  current?: string
  /** Show the value without letting it be changed. */
  disabled?: boolean
  onChanged?: (department: string) => void
}) {
  const [value, setValue] = useState<Department | ''>(toDeptId(current))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  const change = async (next: Department) => {
    setValue(next)
    setBusy(true)
    setSaved(false)
    setError(false)
    try {
      await dsaApi.admin.updateUser(studentId, { department: next }, adminToken())
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
        onChange={(e) => change(e.target.value as Department)}
        disabled={busy || disabled}
        title='Set department'
        onClick={(e) => e.stopPropagation()}
        className={`h-7 pl-2 pr-1 rounded-lg text-[10px] font-black bg-slate-50 border outline-none ${
          error ? 'border-rose-300' : 'border-transparent focus:border-[#002EFF]/30'
        } disabled:opacity-50`}
      >
        <option value=''>Set dept…</option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {DEPARTMENT_LABELS[d]}
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
