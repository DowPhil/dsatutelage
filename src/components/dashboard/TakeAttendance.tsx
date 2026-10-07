// //src/components/dashboard/TakeAttendance.tsx

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CalendarCheck,
  Power,
  CheckCircle2,
  Clock,
  RefreshCw,
  Users,
  PowerOff,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { adminApi } from '@/lib/admin-api'
import { dsaApi } from '@/lib/api'
import { categoryLabel } from '@/lib/coursesStore'
import type { CourseCategory } from '@/lib/types'

interface AttendanceSession {
  active: boolean
  date: string | null
  activatedAt: string | null
}

interface CheckInUser {
  studentId: string
  fullname: string
  email: string
  studentCode: string
  status: string
  at: string
}

export default function TakeAttendance() {
  const [session, setSession] = useState<AttendanceSession>({
    active: false,
    date: null,
    activatedAt: null,
  })
  const [checkIns, setCheckIns] = useState<CheckInUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The ids of students this tutor is in charge of. null = show everyone
  // (admin, or roster unavailable). Used to scope the monitor so a tutor only
  // sees their own students' check-ins even though the session is shared.
  const [rosterIds, setRosterIds] = useState<Set<string> | null>(null)
  // Attendance is per course, so the tutor/admin picks which course to open.
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [courseId, setCourseId] = useState('')

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const roster = (await dsaApi.analytics.tutorStudents()) as Record<
          string,
          unknown
        >[]
        if (cancelled) return
        // Admin gets all students back here, so this is a no-op filter for them.
        setRosterIds(new Set(roster.map((s) => String(s.id ?? s._id ?? ''))))
      } catch {
        setRosterIds(null) // no scoping if the roster can't be read
      }
      // Load the tutor's own courses (fall back to all for admin).
      try {
        let list = (await dsaApi.courses.list({ tutorId: 'me' })) as Record<
          string,
          unknown
        >[]
        if (!list.length)
          list = (await dsaApi.courses.list({})) as Record<string, unknown>[]
        if (cancelled) return
        const mapped = list.map((c) => {
          const title = String(c.title ?? 'Course')
          // Distinguish same-named subjects across classes/tracks (e.g. three
          // "Biology" → "Biology · SS1", "Biology · JAMB") by appending the
          // course category. classLevel is added when it adds more than the
          // category already shows.
          const cat = c.category ? categoryLabel(c.category as CourseCategory) : ''
          const lvl = String(c.classLevel ?? '').trim()
          const suffix = [cat, lvl && lvl !== cat ? lvl : ''].filter(Boolean).join(' · ')
          return {
            id: String(c.id ?? c._id ?? ''),
            title: suffix ? `${title} · ${suffix}` : title,
          }
        })
        setCourses(mapped)
        setCourseId((p) => p || mapped[0]?.id || '')
      } catch {
        /* leave empty */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getTodayISO = () => new Date().toISOString().split('T')[0]

  const refresh = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true)
      setError(null)
      if (!courseId) {
        setSession({ active: false, date: null, activatedAt: null })
        setCheckIns([])
        setLoading(false)
        setRefreshing(false)
        return
      }
      try {
        const sessionRes = await adminApi.getCurrentAttendanceSession(courseId)

        if (sessionRes?.success && sessionRes.data) {
          setSession(sessionRes.data)

          if (sessionRes.data.active) {
            const targetDate = sessionRes.data.date || getTodayISO()
            const checkInsRes = await adminApi.getAttendanceCheckIns(
              targetDate,
              courseId,
            )

            if (checkInsRes?.success) {
              setCheckIns(checkInsRes.data || [])
            }
          } else {
            setCheckIns([])
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch attendance state:', err)
        setError(err?.message || 'Failed to update attendance records.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [courseId],
  )

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  // Setup auto-refresh polling every 10s while session is active
  useEffect(() => {
    if (session.active) {
      pollTimerRef.current = setInterval(() => {
        refresh(false)
      }, 10000)
    } else if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [session.active, refresh])

  const dateLabel = new Date().toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const activate = async () => {
    if (!courseId) {
      setError('Pick a course to open attendance for.')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await adminApi.activateAttendanceSession({ courseId })
      if (res?.success) {
        await refresh()
      } else {
        throw new Error('Could not activate attendance session')
      }
    } catch (err: any) {
      console.error('Failed to activate session:', err)
      setError(err?.message || 'Failed to activate attendance session.')
    } finally {
      setActionLoading(false)
    }
  }

  const close = async () => {
    const currentDate = session.date || getTodayISO()
    setActionLoading(true)
    setError(null)
    try {
      const res = await adminApi.closeAttendanceSession(currentDate, courseId)
      if (res?.success) {
        await refresh()
      } else {
        throw new Error('Could not close session')
      }
    } catch (err: any) {
      console.error('Failed to close session:', err)
      setError(err?.message || 'Failed to close attendance session.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-[350px] gap-3'>
        <Loader2 className='w-8 h-8 animate-spin text-[#002EFF]' />
        <p className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
          Loading attendance state...
        </p>
      </div>
    )
  }

  // Scope the monitor to this tutor's own students (no-op for admin).
  const visibleCheckIns = rosterIds
    ? checkIns.filter((c) => rosterIds.has(String(c.studentId)))
    : checkIns

  return (
    <div className='space-y-6 max-w-3xl mx-auto'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase flex items-center gap-2'>
            <CalendarCheck size={24} /> Attendance
          </h2>
          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
            {dateLabel}
          </p>
        </div>
        <Badge
          className={`text-[9px] font-black ${
            session.active
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {session.active ? 'ACTIVE TODAY' : 'NOT ACTIVATED'}
        </Badge>
      </div>

      {/* Course picker — attendance is opened per course */}
      <div className='flex items-center gap-2 flex-wrap'>
        <CalendarCheck size={15} className='text-slate-400' />
        <span className='text-[10px] font-black uppercase text-slate-400'>Class</span>
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value)
            setLoading(true)
          }}
          className='h-10 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
        >
          {courses.length === 0 && <option value=''>No courses assigned</option>}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2'>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!session.active ? (
        <Card className='rounded-3xl border-none shadow-sm bg-white p-8 text-center'>
          <div className='h-14 w-14 mx-auto rounded-2xl bg-blue-50 text-[#002EFF] flex items-center justify-center mb-4'>
            <Power size={26} />
          </div>
          <h3 className='text-sm font-black text-gray-800 uppercase'>
            Activate today&apos;s attendance
          </h3>
          <p className='text-[11px] font-medium text-gray-500 mt-1 max-w-sm mx-auto'>
            Once you activate, students can mark themselves present from their
            own dashboard. Do this once each day.
          </p>
          <button
            onClick={activate}
            disabled={actionLoading}
            className='mt-5 inline-flex items-center gap-2 px-6 h-11 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {actionLoading ? (
              <Loader2 size={15} className='animate-spin' />
            ) : (
              <Power size={15} />
            )}
            Activate Attendance
          </button>
        </Card>
      ) : (
        <>
          <Card className='rounded-3xl border-none shadow-sm bg-[#002EFF] text-white p-5'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center'>
                  <CheckCircle2 size={20} className='text-[#FCB900]' />
                </div>
                <div>
                  <p className='text-[10px] font-black uppercase tracking-widest text-blue-200'>
                    Attendance is open
                  </p>
                  <p className='text-xs font-bold'>
                    Students can now mark themselves present
                    {session.activatedAt
                      ? ` · opened ${formatTime(session.activatedAt)}`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                disabled={actionLoading}
                className='flex items-center gap-1 px-3 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase transition-all disabled:opacity-50'
              >
                {actionLoading ? (
                  <Loader2 size={13} className='animate-spin' />
                ) : (
                  <PowerOff size={13} />
                )}
                Close
              </button>
            </div>
          </Card>

          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2 text-gray-500'>
              <Users size={15} />
              <span className='text-[11px] font-black uppercase'>
                {visibleCheckIns.length} checked in
              </span>
            </div>
            <button
              onClick={() => refresh(true)}
              disabled={refreshing}
              className='flex items-center gap-1 text-[10px] font-black uppercase text-[#002EFF] hover:underline disabled:opacity-50'
            >
              <RefreshCw
                size={12}
                className={refreshing ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          </div>

          <Card className='rounded-3xl border-none shadow-sm bg-white overflow-hidden'>
            {visibleCheckIns.length === 0 ? (
              <div className='p-8 text-center'>
                <Clock size={26} className='text-slate-300 mx-auto mb-2' />
                <p className='text-[11px] font-bold text-slate-400'>
                  No check-ins yet. Students will appear here as they mark
                  themselves present.
                </p>
              </div>
            ) : (
              visibleCheckIns.map((c) => (
                <div
                  key={c.studentId || c.studentCode || c.email}
                  className='flex items-center justify-between px-5 py-3.5 border-t border-slate-50 first:border-t-0'
                >
                  <div className='flex items-center gap-3'>
                    <div className='h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black uppercase'>
                      {c.fullname?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <p className='text-xs font-black text-gray-800'>
                        {c.fullname}
                      </p>
                      <p className='text-[10px] font-medium text-gray-400'>
                        {c.studentCode || c.email}
                      </p>
                    </div>
                  </div>
                  <Badge className='bg-emerald-50 text-emerald-600 text-[10px] font-black flex items-center gap-1'>
                    <CheckCircle2 size={13} /> {formatTime(c.at)}
                  </Badge>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  )
}