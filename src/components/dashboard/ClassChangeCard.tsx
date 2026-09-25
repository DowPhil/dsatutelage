'use client'

// A student's class and programmes, and the way to change them. Moving class
// (promotion, a new exam year) is a request, not an edit: the student
// confirms with their password, an admin approves, and only then does the
// account change. On approval the portal's courses, assignments, timetable
// and tutors follow the new class, and courses the new class cannot see are
// dropped.

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Clock, GraduationCap, Loader2, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { dsaApi, type ChangeRequest } from '@/lib/api'
import { getToken, getUser, setUser } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import {
  CLASS_LEVELS,
  CLASS_LEVELS_CLOSED,
  SIGNUP_PROGRAMMES,
  SIGNUP_PROGRAMMES_CLOSED,
  deriveTrackFromProgrammes,
  programmeHintForClass,
  programmesForClass,
} from '@/lib/registration'
import { cn } from '@/lib/utils'

const DEPARTMENTS = [
  { value: 'science', label: 'Science' },
  { value: 'art', label: 'Art' },
  { value: 'commercial', label: 'Commercial' },
]

function needsDepartment(classLevel: string, programmes: string[]): boolean {
  const cl = classLevel.toLowerCase()
  if (cl.includes('100') || cl.includes('200')) return false
  if (cl.includes('ss1') || cl.includes('ss2') || cl.includes('ss3')) return true
  return ['waec', 'jamb', 'postutme'].includes(deriveTrackFromProgrammes(programmes))
}

const str = (v: unknown) => (v == null ? '' : String(v))

export default function ClassChangeCard() {
  const cached = getUser() as Record<string, unknown> | null
  const [level, setLevel] = useState(str(cached?.currentLevel ?? cached?.level))
  const [programmes, setProgrammes] = useState<string[]>(
    Array.isArray(cached?.programmes) ? (cached!.programmes as string[]) : [],
  )
  const [department, setDepartment] = useState(str(cached?.department))

  const [latest, setLatest] = useState<ChangeRequest | null>(null)
  const [open, setOpen] = useState(false)
  const [newLevel, setNewLevel] = useState('')
  const [newProgrammes, setNewProgrammes] = useState<string[]>([])
  const [newDepartment, setNewDepartment] = useState('')
  const [note, setNote] = useState('')
  const [password, setPassword] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  // The latest request; and if it was approved since the profile was cached,
  // refresh the cached profile so the whole dashboard follows the new class.
  const load = useCallback(async () => {
    const token = getToken()
    if (!token || isDemoToken(token)) return
    try {
      const req = await dsaApi.auth.changeRequest.get()
      setLatest(req)
      if (req?.status === 'approved') {
        const fresh = (await dsaApi.auth.getProfile(token)) as unknown as Record<string, unknown> | null
        if (fresh) {
          setUser(fresh as never)
          setLevel(str(fresh.currentLevel ?? fresh.level))
          setProgrammes(Array.isArray(fresh.programmes) ? (fresh.programmes as string[]) : [])
          setDepartment(str(fresh.department))
        }
      }
    } catch {
      /* the card still shows the cached profile */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const start = () => {
    setNewLevel(level)
    setNewProgrammes(programmes)
    setNewDepartment(department)
    setNote('')
    setPassword('')
    setUnderstood(false)
    setError('')
    setDone('')
    setOpen(true)
  }

  const pickLevel = (l: string) => {
    setNewLevel(l)
    const allowed = programmesForClass(l)
    if (allowed) setNewProgrammes((ps) => ps.filter((p) => allowed.includes(p)))
  }

  // One programme per student: picking another replaces it.
  const toggle = (p: string) => {
    setNewProgrammes((ps) => (ps.includes(p) ? [] : [p]))
  }

  const submit = async () => {
    setError('')
    if (!newLevel) return setError('Choose your class.')
    if (newProgrammes.length !== 1) return setError('Choose your programme.')
    if (needsDepartment(newLevel, newProgrammes) && !newDepartment) return setError('Choose your department.')
    if (!understood) return setError('Tick the box to confirm you understand what changes.')
    if (!password) return setError('Enter your password to confirm.')
    setBusy(true)
    try {
      const req = await dsaApi.auth.changeRequest.submit({
        currentLevel: newLevel,
        programmes: newProgrammes,
        department: needsDepartment(newLevel, newProgrammes) ? newDepartment : undefined,
        password,
        note: note.trim() || undefined,
      })
      setLatest(req)
      setOpen(false)
      setPassword('')
      setDone('Your request has been sent. An admin will confirm it, and your portal updates the moment they do.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request.')
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    setBusy(true)
    setError('')
    try {
      await dsaApi.auth.changeRequest.withdraw()
      setLatest((l) => (l ? { ...l, status: 'withdrawn' } : l))
      setDone('Request withdrawn.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not withdraw the request.')
    } finally {
      setBusy(false)
    }
  }

  const pending = latest?.status === 'pending'
  const hint = programmeHintForClass(newLevel)
  const closed = (p: string) => SIGNUP_PROGRAMMES_CLOSED.includes(p)
  const notForClass = (p: string) => {
    const allowed = programmesForClass(newLevel)
    return !!allowed && !allowed.includes(p)
  }

  return (
    <Card className='mt-4 rounded-3xl border-none bg-white p-5 shadow-sm'>
      <h3 className='mb-1 flex items-center gap-2 text-[11px] font-black uppercase text-[#002EFF]'>
        <GraduationCap size={14} /> Class &amp; programmes
      </h3>
      <p className='mb-4 text-[10px] font-medium text-slate-400'>
        Promoted, or starting a new exam year? Ask to move. An admin confirms it, and your courses,
        timetable, tutors and assignments follow the new class.
      </p>

      <div className='flex flex-wrap gap-2'>
        <span className='rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700'>
          {level || 'Class not set'}
        </span>
        {programmes.map((p) => (
          <span key={p} className='rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-black text-[#002EFF]'>
            {p}
          </span>
        ))}
        {department && (
          <span className='rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-black capitalize text-slate-700'>
            {department}
          </span>
        )}
      </div>

      {done && (
        <div className='mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-[10px] font-bold text-emerald-700'>
          <Check size={13} className='shrink-0' /> {done}
        </div>
      )}
      {error && !open && (
        <div className='mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-[10px] font-bold text-rose-600'>
          <AlertCircle size={13} className='shrink-0' /> {error}
        </div>
      )}

      {pending && latest && (
        <div className='mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3'>
          <p className='flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-800'>
            <Clock size={12} /> Waiting for an admin
          </p>
          <p className='mt-1 text-[11px] font-bold text-slate-700'>
            {latest.requested.currentLevel} · {latest.requested.programmes.join(' + ')}
            {latest.requested.department ? ` · ${latest.requested.department}` : ''}
          </p>
          <button
            type='button'
            disabled={busy}
            onClick={() => void withdraw()}
            className='mt-2 text-[10px] font-black uppercase text-amber-800 underline disabled:opacity-50'
          >
            Withdraw request
          </button>
        </div>
      )}
      {latest?.status === 'rejected' && !open && (
        <div className='mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] font-bold text-rose-700'>
          Your last request was not approved{latest.decisionNote ? `: ${latest.decisionNote}` : '.'}
        </div>
      )}

      {!open && !pending && (
        <Button
          onClick={start}
          className='mt-4 h-9 rounded-lg bg-[#002EFF] px-6 text-[9px] font-black text-white hover:bg-blue-700'
        >
          REQUEST A CHANGE
        </Button>
      )}

      {open && (
        <div className='mt-4 space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-3'>
          <div className='space-y-1.5'>
            <p className='text-[9px] font-black uppercase text-slate-500'>New class</p>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
              {CLASS_LEVELS.map((c) => {
                const closedClass = CLASS_LEVELS_CLOSED.includes(c)
                return (
                  <button
                    type='button'
                    key={c}
                    disabled={closedClass}
                    onClick={() => pickLevel(c)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-xs font-bold transition-all',
                      newLevel === c
                        ? 'border-[#002EFF] bg-blue-50 text-[#002EFF]'
                        : closedClass
                          ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 opacity-60'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {c}
                    {closedClass && <span className='ml-1 font-medium text-slate-400'>· not open</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className='space-y-1.5'>
            <p className='text-[9px] font-black uppercase text-slate-500'>
              Programme <span className='font-medium normal-case text-slate-400'>— choose one</span>
            </p>
            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
              {SIGNUP_PROGRAMMES.map((p) => {
                const active = newProgrammes.includes(p)
                const blocked = closed(p) || notForClass(p)
                return (
                  <button
                    type='button'
                    key={p}
                    aria-pressed={active}
                    disabled={blocked}
                    onClick={() => toggle(p)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border p-3 text-left transition-all',
                      active
                        ? 'border-[#002EFF] bg-blue-50'
                        : blocked
                          ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50'
                          : 'border-slate-100 bg-white hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded',
                        active ? 'bg-[#002EFF] text-white' : 'border border-slate-300',
                      )}
                    >
                      {active && <Check size={12} />}
                    </span>
                    <span className={cn('text-[11px] font-bold', active ? 'text-[#002EFF]' : 'text-slate-600')}>
                      {p}
                      {closed(p) && <span className='ml-1 font-medium text-slate-400'>· not open yet</span>}
                      {!closed(p) && notForClass(p) && (
                        <span className='ml-1 font-medium text-slate-400'>· not for your class</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className='text-[10px] font-bold text-slate-400'>
              {hint ?? (newProgrammes.length ? `${newProgrammes[0]} selected` : 'Pick one programme')}
            </p>
          </div>

          {needsDepartment(newLevel, newProgrammes) && (
            <div className='space-y-1.5'>
              <p className='text-[9px] font-black uppercase text-slate-500'>Department</p>
              <div className='grid grid-cols-3 gap-2'>
                {DEPARTMENTS.map((d) => (
                  <button
                    type='button'
                    key={d.value}
                    onClick={() => setNewDepartment(d.value)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-xs font-bold transition-all',
                      newDepartment === d.value
                        ? 'border-[#002EFF] bg-blue-50 text-[#002EFF]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className='space-y-1'>
            <label className='ml-1 text-[9px] font-black uppercase text-slate-500'>
              Reason <span className='font-medium normal-case text-slate-400'>(optional)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder='e.g. Promoted to SS3'
              className='h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium outline-none focus:border-[#002EFF]'
            />
          </div>

          <label className='flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-bold text-amber-800'>
            <input
              type='checkbox'
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className='mt-0.5'
            />
            <span>
              I understand that once approved, my courses, assignments, tutors and timetable will be
              reset to match my new class and programme.
            </span>
          </label>

          <div className='space-y-1'>
            <label className='ml-1 text-[9px] font-black uppercase text-slate-500'>Your password</label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete='current-password'
              placeholder='Confirm it is you'
              className='h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium outline-none focus:border-[#002EFF]'
            />
          </div>

          {error && (
            <div className='flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-[10px] font-bold text-rose-600'>
              <AlertCircle size={13} className='shrink-0' /> {error}
            </div>
          )}

          <div className='flex flex-col gap-2 sm:flex-row'>
            <Button
              onClick={() => void submit()}
              disabled={busy}
              className='h-9 rounded-lg bg-[#002EFF] px-6 text-[9px] font-black text-white hover:bg-blue-700'
            >
              {busy ? <Loader2 size={14} className='animate-spin' /> : 'SEND REQUEST TO ADMIN'}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
              disabled={busy}
              className='h-9 rounded-lg px-6 text-[9px] font-black'
            >
              <X size={12} className='mr-1' /> CANCEL
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
