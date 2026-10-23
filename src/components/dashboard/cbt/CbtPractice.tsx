'use client'

// Student dashboard → CBT Practice. JAMB/WAEC-style computer-based practice on
// the questions the admin manages in Admin → CBT Platform. Everything is live:
// sessions are drawn, timed and scored by the server (/api/cbt), so they
// resume on any device and count toward the student's plan limits.

import { useCallback, useEffect, useState } from 'react'
import { CbtError, dsaApi } from '@/lib/api'
import { useCachedUser } from '@/lib/useCachedUser'
import type { CbtMeta, CbtProgress, CbtResult, CbtSession, CbtSessionSummary, CbtStartBody } from '@/lib/cbt-types'
import Home, { type HomeView } from './Home'
import Runner from './Runner'
import Result from './Result'
import Setup, { type SetupPlan } from './Setup'
import { LockSheet, PlansSheet, btn, card } from './shared'

type Screen =
  | { kind: 'home' }
  | { kind: 'setup'; initial?: { kind?: 'mock' | 'custom' | 'topic'; subject?: string; topic?: string } }
  | { kind: 'run'; session: CbtSession }
  | { kind: 'result'; result: CbtResult }

export default function CbtPractice() {
  const user = useCachedUser()
  const name = user?.fullName || 'Student'

  const [meta, setMeta] = useState<CbtMeta | null>(null)
  const [open, setOpen] = useState<CbtSession | null>(null)
  const [sessions, setSessions] = useState<CbtSessionSummary[]>([])
  const [progress, setProgress] = useState<CbtProgress | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [homeView, setHomeView] = useState<HomeView>('home')
  const [sheet, setSheet] = useState<null | 'plans' | { lock: string }>(null)
  const [starting, setStarting] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const toast = useCallback((text: string) => {
    setToastMsg(text)
    window.setTimeout(() => setToastMsg((t) => (t === text ? '' : t)), 3000)
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const [m, o, s, p, sv, rp] = await Promise.all([
        dsaApi.cbt.meta(),
        dsaApi.cbt.open(),
        dsaApi.cbt.sessions(),
        dsaApi.cbt.progress(),
        dsaApi.cbt.savedIds(),
        dsaApi.cbt.myReports(),
      ])
      setMeta(m)
      setOpen(o)
      setSessions(s)
      setProgress(p)
      setSavedIds(new Set(sv))
      setReportedIds(new Set(rp))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load CBT Practice')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // A plan limit the server refused: show the matching unlock prompt.
  const handleError = (e: unknown) => {
    if (e instanceof CbtError && e.code && meta) {
      setSheet({ lock: e.code })
      void dsaApi.cbt.meta().then(setMeta).catch(() => {})
      return
    }
    toast(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
  }

  const start = async (body: CbtStartBody, note?: string) => {
    if (starting) return
    setStarting(true)
    try {
      const s = await dsaApi.cbt.start(body)
      setOpen(s)
      setScreen({ kind: 'run', session: s })
      const msg = s.note || note
      if (msg) toast(msg)
    } catch (e) {
      handleError(e)
    } finally {
      setStarting(false)
    }
  }

  const finished = (r: CbtResult) => {
    setOpen(null)
    setScreen({ kind: 'result', result: r })
    window.scrollTo({ top: 0 })
    // Refresh the numbers behind the home screen.
    void Promise.all([dsaApi.cbt.meta(), dsaApi.cbt.sessions(), dsaApi.cbt.progress()])
      .then(([m, s, p]) => {
        setMeta(m)
        setSessions(s)
        setProgress(p)
      })
      .catch(() => {})
  }

  const toggleSaved = async (id: string) => {
    const has = savedIds.has(id)
    try {
      if (has) await dsaApi.cbt.unsaveQuestion(id)
      else await dsaApi.cbt.saveQuestion(id)
      setSavedIds((p) => {
        const n = new Set(p)
        if (has) n.delete(id)
        else n.add(id)
        return n
      })
      toast(has ? 'Removed from saved questions.' : 'Saved. Find it under Saved questions.')
    } catch (e) {
      handleError(e)
    }
  }

  const openAttempt = async (id: string) => {
    try {
      const r = await dsaApi.cbt.session(id)
      if (r.status === 'submitted') setScreen({ kind: 'result', result: r as CbtResult })
      else setScreen({ kind: 'run', session: r as CbtSession })
      window.scrollTo({ top: 0 })
    } catch (e) {
      handleError(e)
    }
  }

  const backHome = () => {
    setScreen({ kind: 'home' })
    window.scrollTo({ top: 0 })
    void dsaApi.cbt.open().then(setOpen).catch(() => {})
  }

  if (error) {
    return (
      <div className={`${card} mx-auto max-w-xl text-center`}>
        <p className='text-[14px] font-bold text-rose-700'>{error}</p>
        <button type='button' className={`${btn} mt-3`} onClick={load}>
          Try again
        </button>
      </div>
    )
  }
  if (!meta) return <p className='p-10 text-center text-[13px] font-bold text-slate-400'>Loading CBT Practice…</p>

  return (
    <div className='min-w-0'>
      {screen.kind === 'home' && (
        <Home
          view={homeView}
          setView={setHomeView}
          meta={meta}
          name={name}
          open={open}
          sessions={sessions}
          progress={progress}
          savedCount={savedIds.size}
          onNew={() => setScreen({ kind: 'setup' })}
          onResume={() => open && setScreen({ kind: 'run', session: open })}
          onDrill={() => void start({ mode: 'drill' })}
          onSaved={() => void start({ mode: 'saved' })}
          onPractiseTopic={(subject, topic) => setScreen({ kind: 'setup', initial: { kind: 'topic', subject, topic } })}
          onPractiseSubject={(subject) => setScreen({ kind: 'setup', initial: { kind: 'topic', subject } })}
          onOpenAttempt={openAttempt}
          onFullMock={() => setScreen({ kind: 'setup', initial: { kind: 'mock' } })}
          onPlans={() => setSheet('plans')}
          onLock={(code) => setSheet({ lock: code })}
        />
      )}

      {screen.kind === 'setup' && (
        <Setup
          meta={meta}
          name={name}
          initial={screen.initial}
          onBack={backHome}
          onReady={(plan: SetupPlan) => void start(plan.body, plan.note)}
          onLock={(code) => setSheet({ lock: code })}
          onPlans={() => setSheet('plans')}
        />
      )}

      {screen.kind === 'run' && (
        <Runner
          key={screen.session.id}
          session={screen.session}
          name={name}
          savedIds={savedIds}
          reportedIds={reportedIds}
          onSaveToggle={toggleSaved}
          onReported={(id) => setReportedIds((p) => new Set(p).add(id))}
          onFinished={finished}
          onLeave={backHome}
          toast={toast}
        />
      )}

      {screen.kind === 'result' && (
        <Result
          key={screen.result.id}
          result={screen.result}
          name={name}
          savedIds={savedIds}
          reportedIds={reportedIds}
          onSaveToggle={toggleSaved}
          onReported={(id) => setReportedIds((p) => new Set(p).add(id))}
          onRetry={() => void start({ mode: 'retry', retryOf: screen.result.id })}
          onPractiseTopic={(subject, topic) => setScreen({ kind: 'setup', initial: { kind: 'topic', subject, topic } })}
          onClose={backHome}
          toast={toast}
        />
      )}

      {starting && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-zinc-950/70'>
          <p className='rounded-2xl bg-white px-5 py-3 text-[13px] font-black text-slate-700 shadow-lg dark:bg-zinc-900 dark:text-white'>
            Getting your questions ready…
          </p>
        </div>
      )}

      {sheet === 'plans' && <PlansSheet meta={meta} onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === 'object' && (
        <LockSheet meta={meta} lock={sheet.lock} onClose={() => setSheet(null)} onPlans={() => setSheet('plans')} />
      )}

      {toastMsg && (
        <div
          role='status'
          aria-live='polite'
          className='fixed bottom-28 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-2xl bg-slate-900 px-4 py-2.5 text-center text-[13px] font-bold text-white shadow-lg'
        >
          {toastMsg}
        </div>
      )}
    </div>
  )
}
