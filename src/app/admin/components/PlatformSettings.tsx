'use client'

// Platform Settings — what each kind of student may do: quizzes and tests,
// study materials, assignments, live classes, and the Community. Saved to the
// server (GET/PATCH /api/admin/settings/platform), which enforces every value;
// nothing here is a browser-only limit. Changes are kept as a draft until
// saved, and every save is recorded in the History tab.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Settings,
  UsersRound,
  ClipboardList,
  BookOpen,
  FileDown,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
  History,
  Search,
  Save,
  Undo2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Infinity as InfinityIcon,
  AlarmClock,
  X,
} from 'lucide-react'
import {
  dsaApi,
  type CategoryEntitlements,
  type CommunityAccessStatus,
  type EntitlementSettings,
  type SettingsHistoryEntry,
  type StudentCategory,
} from '@/lib/api'

type Section =
  | 'plans'
  | 'quizzes'
  | 'materials'
  | 'assignments'
  | 'community'
  | 'subscriptions'
  | 'restrictions'
  | 'history'

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'plans', label: 'Student Access & Plans', icon: UsersRound },
  { id: 'quizzes', label: 'Quizzes & Tests', icon: ClipboardList },
  { id: 'materials', label: 'Study Materials', icon: FileDown },
  { id: 'assignments', label: 'Assignments', icon: BookOpen },
  { id: 'community', label: 'Community', icon: MessageSquare },
  { id: 'subscriptions', label: 'Subscription Entitlements', icon: ShieldCheck },
  { id: 'restrictions', label: 'Existing Learning Restrictions', icon: SlidersHorizontal },
  { id: 'history', label: 'Settings History', icon: History },
]

const CATS: { id: StudentCategory; label: string; note: string }[] = [
  { id: 'free', label: 'Free', note: 'No current paid plan' },
  { id: 'portal', label: 'Portal', note: 'Paid Portal access' },
  { id: 'tutorial', label: 'Tutorial', note: 'Paid Tutorial plan' },
  { id: 'physical', label: 'Physical', note: 'Verified on-campus students' },
]

/** One editable setting: where it lives, how it is shown, how it is searched. */
interface Field {
  section: Section
  group: keyof CategoryEntitlements
  key: string
  kind: 'bool' | 'limit'
  label: string
  help: string
}

const FIELDS: Field[] = [
  { section: 'quizzes', group: 'quizzes', key: 'enabled', kind: 'bool', label: 'Quizzes and tests', help: 'Whether this plan may take quizzes and tests at all.' },
  { section: 'quizzes', group: 'quizzes', key: 'monthlyAttempts', kind: 'limit', label: 'Attempts per month', help: 'Quizzes and tests share it. Starting a new sitting uses one; resuming an open one does not. Resets on the 1st (Lagos time).' },
  { section: 'materials', group: 'materials', key: 'view', kind: 'bool', label: 'View study materials', help: 'Open and read materials in the portal. Viewing is never counted.' },
  { section: 'materials', group: 'materials', key: 'download', kind: 'bool', label: 'Download materials', help: 'Save files. Each download counts, including the same file again; a retried request does not.' },
  { section: 'materials', group: 'materials', key: 'monthlyDownloads', kind: 'limit', label: 'Downloads per month', help: 'Resets on the 1st (Lagos time).' },
  { section: 'assignments', group: 'assignments', key: 'access', kind: 'bool', label: 'Open assignments', help: 'See a course’s assignments. Past submissions and grades always stay visible.' },
  { section: 'assignments', group: 'assignments', key: 'submit', kind: 'bool', label: 'Submit assignments', help: 'Hand in work (needs “Open assignments”).' },
  { section: 'restrictions', group: 'liveClasses', key: 'limit', kind: 'limit', label: 'Live classes listed', help: 'How many live classes and recordings the plan lists. A class that is live right now is always shown.' },
]

const MAX = 100000

const fmtLimit = (v: unknown) => (v === null ? 'Unlimited' : typeof v === 'boolean' ? (v ? 'On' : 'Off') : String(v))

const get = (e: EntitlementSettings, cat: StudentCategory, f: Field) =>
  (e[cat][f.group] as Record<string, boolean | number | null>)[f.key]

/** A change worth a second look before saving. */
function isSensitive(cat: StudentCategory, f: Field, from: unknown, to: unknown) {
  if (f.kind === 'bool') {
    // Opening a feature to free/portal, or taking one from paying students.
    if (to === true && (cat === 'free' || cat === 'portal')) return true
    if (to === false && (cat === 'tutorial' || cat === 'physical')) return true
    return false
  }
  if (to === null && (cat === 'free' || cat === 'portal')) return true
  if (typeof from === 'number' && typeof to === 'number' && to < from) return true
  return false
}

export default function PlatformSettings({ token }: { token?: string }) {
  const [section, setSection] = useState<Section>('plans')
  const [saved, setSaved] = useState<EntitlementSettings | null>(null)
  const [draft, setDraft] = useState<EntitlementSettings | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirming, setConfirming] = useState<{ path: string; from: unknown; to: unknown }[] | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const d = await dsaApi.platformSettings.get(token)
      setSaved(d.entitlements)
      setDraft(d.entitlements)
      setCanEdit(d.canEdit)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the settings.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  // Every setting that differs from what is saved.
  const changes = useMemo(() => {
    if (!saved || !draft) return []
    const out: { cat: StudentCategory; field: Field; from: unknown; to: unknown }[] = []
    for (const c of CATS) {
      for (const f of FIELDS) {
        const from = get(saved, c.id, f)
        const to = get(draft, c.id, f)
        if (from !== to) out.push({ cat: c.id, field: f, from, to })
      }
    }
    return out
  }, [saved, draft])
  const dirty = changes.length > 0

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setValue = (cat: StudentCategory, f: Field, value: boolean | number | null) => {
    setNotice(null)
    setDraft((d) => {
      if (!d) return d
      const next = JSON.parse(JSON.stringify(d)) as EntitlementSettings
      ;(next[cat][f.group] as Record<string, boolean | number | null>)[f.key] = value
      return next
    })
  }

  // Limits must be whole numbers 0–100,000 (or unlimited) before anything is sent.
  const invalid = changes.find(
    (c) => c.field.kind === 'limit' && c.to !== null && !(Number.isInteger(c.to) && (c.to as number) >= 0 && (c.to as number) <= MAX),
  )

  const doSave = async () => {
    if (!draft || !dirty || invalid) return
    setSaving(true)
    setNotice(null)
    setConfirming(null)
    const patch: Record<string, Record<string, Record<string, unknown>>> = {}
    for (const c of changes) {
      patch[c.cat] ??= {}
      patch[c.cat][c.field.group] ??= {}
      patch[c.cat][c.field.group][c.field.key] = c.to
    }
    try {
      const next = await dsaApi.platformSettings.update(patch, token)
      setSaved(next)
      setDraft(next)
      setNotice({ ok: true, text: `Saved ${changes.length} change${changes.length === 1 ? '' : 's'}. Students see them straight away.` })
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Could not save the settings.' })
    } finally {
      setSaving(false)
    }
  }

  const requestSave = () => {
    const sensitive = changes.filter((c) => isSensitive(c.cat, c.field, c.from, c.to))
    if (sensitive.length) {
      setConfirming(
        sensitive.map((c) => ({
          path: `${CATS.find((x) => x.id === c.cat)!.label} · ${c.field.label}`,
          from: c.from,
          to: c.to,
        })),
      )
    } else {
      void doSave()
    }
  }

  const q = search.trim().toLowerCase()
  const matchingSections = new Set(
    q ? FIELDS.filter((f) => `${f.label} ${f.help}`.toLowerCase().includes(q)).map((f) => f.section) : [],
  )

  return (
    <div className='max-w-6xl mx-auto space-y-5'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h1 className='flex items-center gap-2 text-2xl font-black text-slate-900 tracking-tight dark:text-slate-100'>
            <Settings size={22} className='text-[#002EFF]' /> Platform Settings
          </h1>
          <p className='text-[11px] font-bold text-slate-400'>
            What each kind of student may do. The server applies these on every request.
          </p>
        </div>
        <div className='relative w-full sm:w-64'>
          <Search size={14} className='absolute left-3 top-3 text-slate-400' />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search settings'
            aria-label='Search settings'
            className='h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold outline-none focus:border-[#002EFF] dark:border-slate-700 dark:bg-slate-900'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-5'>
        <nav aria-label='Settings categories' className='flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible'>
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const on = section === s.id
            const hit = q && matchingSections.has(s.id)
            return (
              <button
                key={s.id}
                type='button'
                onClick={() => setSection(s.id)}
                aria-current={on ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-black uppercase tracking-wide transition-colors ${
                  on ? 'bg-[#002EFF] text-white' : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300'
                } ${q && !hit && s.id !== 'history' && s.id !== 'plans' && s.id !== 'subscriptions' ? 'opacity-40' : ''}`}
              >
                <Icon size={15} /> {s.label}
              </button>
            )
          })}
        </nav>

        <div className='min-w-0 space-y-4'>
          {loading ? (
            <div className='flex justify-center rounded-3xl bg-white py-16 dark:bg-slate-900' aria-busy='true'>
              <Loader2 className='animate-spin text-[#002EFF]' />
            </div>
          ) : loadError || !draft || !saved ? (
            <div className='rounded-3xl border border-rose-100 bg-white p-8 text-center' role='alert'>
              <p className='text-xs font-black text-rose-600'>The settings could not be loaded</p>
              <p className='mt-1 text-[11px] text-slate-500'>{loadError}</p>
              <button type='button' onClick={() => void load()} className='mt-3 h-9 rounded-lg bg-[#002EFF] px-4 text-[10px] font-black uppercase text-white'>
                Retry
              </button>
            </div>
          ) : (
            <>
              {!canEdit && (
                <p className='rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500'>
                  Read only — only an admin can change these settings.
                </p>
              )}
              {section === 'plans' && <PlanComparison draft={draft} />}
              {(['quizzes', 'materials', 'assignments', 'restrictions'] as Section[]).includes(section) && (
                <EditSection
                  fields={FIELDS.filter((f) => f.section === section && (!q || `${f.label} ${f.help}`.toLowerCase().includes(q)))}
                  draft={draft}
                  saved={saved}
                  canEdit={canEdit}
                  onChange={setValue}
                />
              )}
              {section === 'community' && <CommunitySection token={token} canEdit={canEdit} />}
              {section === 'subscriptions' && <SubscriptionRules />}
              {section === 'history' && <SettingsHistory token={token} />}
            </>
          )}

          {notice && (
            <p
              role={notice.ok ? 'status' : 'alert'}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold ${notice.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
            >
              {notice.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {notice.text}
            </p>
          )}

          {canEdit && dirty && (
            <div className='sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:bg-slate-900/95'>
              <p className='text-[11px] font-bold text-slate-600'>
                {changes.length} unsaved change{changes.length === 1 ? '' : 's'}
                {invalid && <span className='ml-2 text-rose-600'>— fix the highlighted value first</span>}
              </p>
              <div className='flex gap-2'>
                <button
                  type='button'
                  onClick={() => {
                    setDraft(saved)
                    setNotice(null)
                  }}
                  className='flex h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-[10px] font-black uppercase text-slate-600'
                >
                  <Undo2 size={13} /> Cancel
                </button>
                <button
                  type='button'
                  onClick={requestSave}
                  disabled={saving || !!invalid}
                  className='flex h-9 items-center gap-1.5 rounded-xl bg-[#002EFF] px-4 text-[10px] font-black uppercase text-white hover:bg-blue-700 disabled:opacity-50'
                >
                  {saving ? <Loader2 size={13} className='animate-spin' /> : <Save size={13} />} Save changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirming && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4' role='dialog' aria-modal='true' aria-label='Confirm changes'>
          <div className='w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900'>
            <div className='flex items-start justify-between gap-3'>
              <p className='text-sm font-black text-slate-900 dark:text-slate-100'>These changes affect what students can do</p>
              <button type='button' onClick={() => setConfirming(null)} aria-label='Close' className='text-slate-400'>
                <X size={16} />
              </button>
            </div>
            <ul className='mt-3 space-y-1.5'>
              {confirming.map((c) => (
                <li key={c.path} className='rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
                  {c.path}: {fmtLimit(c.from)} → <b>{fmtLimit(c.to)}</b>
                </li>
              ))}
            </ul>
            <div className='mt-4 flex justify-end gap-2'>
              <button type='button' onClick={() => setConfirming(null)} className='h-9 rounded-xl bg-slate-100 px-3 text-[10px] font-black uppercase text-slate-600'>
                Back
              </button>
              <button type='button' onClick={() => void doSave()} className='h-9 rounded-xl bg-[#002EFF] px-4 text-[10px] font-black uppercase text-white'>
                Save anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className='rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
      <h2 className='mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500'>
        <Icon size={14} className='text-[#002EFF]' /> {title}
      </h2>
      {children}
    </section>
  )
}

/** What each plan includes, side by side. */
function PlanComparison({ draft }: { draft: EntitlementSettings }) {
  const rows: { label: string; value: (c: CategoryEntitlements) => string }[] = [
    { label: 'Quizzes & tests', value: (c) => (!c.quizzes.enabled ? '—' : c.quizzes.monthlyAttempts === null ? 'Unlimited' : `${c.quizzes.monthlyAttempts} / month`) },
    { label: 'View materials', value: (c) => (c.materials.view ? 'Yes' : '—') },
    { label: 'Downloads', value: (c) => (!c.materials.view || !c.materials.download ? '—' : c.materials.monthlyDownloads === null ? 'Unlimited' : `${c.materials.monthlyDownloads} / month`) },
    { label: 'Assignments', value: (c) => (!c.assignments.access ? '—' : c.assignments.submit ? 'Open & submit' : 'Open only') },
    { label: 'Live classes listed', value: (c) => (c.liveClasses.limit === null ? 'All' : String(c.liveClasses.limit)) },
  ]
  return (
    <Panel title='What each plan includes' icon={UsersRound}>
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[560px] text-left'>
          <thead>
            <tr className='text-[9px] font-black uppercase text-slate-400'>
              <th className='py-2 pr-3'>Feature</th>
              {CATS.map((c) => (
                <th key={c.id} className='py-2 pr-3'>
                  {c.label}
                  <span className='block text-[8px] font-bold normal-case text-slate-300'>{c.note}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className='border-t border-slate-50 dark:border-slate-800'>
                <td className='py-2.5 pr-3 text-[11px] font-black text-slate-700 dark:text-slate-200'>{r.label}</td>
                {CATS.map((c) => (
                  <td key={c.id} className='py-2.5 pr-3 text-[11px] font-bold text-slate-600 dark:text-slate-300'>
                    {r.value(draft[c.id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className='mt-3 text-[10px] font-medium text-slate-400'>
        Community access and the free-student limit are under Community. Change any value in its own section.
      </p>
    </Panel>
  )
}

function EditSection({
  fields,
  draft,
  saved,
  canEdit,
  onChange,
}: {
  fields: Field[]
  draft: EntitlementSettings
  saved: EntitlementSettings
  canEdit: boolean
  onChange: (cat: StudentCategory, f: Field, v: boolean | number | null) => void
}) {
  if (!fields.length) return <p className='rounded-2xl bg-white p-6 text-center text-[11px] font-bold text-slate-400'>No settings match your search.</p>
  return (
    <>
      {fields.map((f) => (
        <Panel key={f.key + f.group} title={f.label} icon={f.kind === 'limit' ? AlarmClock : ShieldCheck}>
          <p className='-mt-1 mb-3 text-[11px] font-medium text-slate-500'>{f.help}</p>
          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
            {CATS.map((c) => {
              const value = get(draft, c.id, f)
              const changed = value !== get(saved, c.id, f)
              const id = `${c.id}-${f.group}-${f.key}`
              const bad = f.kind === 'limit' && value !== null && !(Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX)
              return (
                <div key={c.id} className={`rounded-2xl border p-3 ${changed ? 'border-blue-200 bg-blue-50/40' : 'border-slate-100'}`}>
                  <p className='text-[10px] font-black uppercase text-slate-500'>{c.label}</p>
                  {f.kind === 'bool' ? (
                    <label className='mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-600'>
                      <input
                        type='checkbox'
                        role='switch'
                        checked={!!value}
                        disabled={!canEdit}
                        onChange={(e) => onChange(c.id, f, e.target.checked)}
                        aria-label={`${f.label} — ${c.label}`}
                        className='h-4 w-4 accent-[#002EFF]'
                      />
                      {value ? 'On' : 'Off'}
                    </label>
                  ) : (
                    <div className='mt-2 space-y-1.5'>
                      <input
                        id={id}
                        type='number'
                        min={0}
                        max={MAX}
                        step={1}
                        inputMode='numeric'
                        value={value === null ? '' : String(value)}
                        disabled={!canEdit || value === null}
                        onChange={(e) => onChange(c.id, f, e.target.value === '' ? NaN : Number(e.target.value))}
                        aria-label={`${f.label} — ${c.label}`}
                        aria-invalid={bad}
                        className={`h-9 w-full rounded-lg border px-2 text-[12px] font-bold outline-none disabled:bg-slate-50 disabled:text-slate-400 ${bad ? 'border-rose-300' : 'border-slate-200 focus:border-[#002EFF]'}`}
                      />
                      <label className='flex items-center gap-1.5 text-[10px] font-bold text-slate-500'>
                        <input
                          type='checkbox'
                          checked={value === null}
                          disabled={!canEdit}
                          onChange={(e) => onChange(c.id, f, e.target.checked ? null : (get(saved, c.id, f) as number | null) ?? 0)}
                          aria-label={`Unlimited — ${c.label}`}
                        />
                        <InfinityIcon size={12} /> Unlimited
                      </label>
                      {bad && <p className='text-[10px] font-bold text-rose-600'>A whole number from 0 to 100,000.</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Panel>
      ))}
    </>
  )
}

/** The Community-wide access setting and free-student limit (also in the Community page). */
function CommunitySection({ token, canEdit }: { token?: string; canEdit: boolean }) {
  const [info, setInfo] = useState<CommunityAccessStatus | null>(null)
  const [cap, setCap] = useState('')
  const [unlimited, setUnlimited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const show = (a: CommunityAccessStatus) => {
    setInfo(a)
    setUnlimited(a.freeStudentCap == null)
    setCap(a.freeStudentCap == null ? '' : String(a.freeStudentCap))
  }

  useEffect(() => {
    let alive = true
    dsaApi.community
      .getAccess(token)
      .then((a) => alive && show(a))
      .catch((e) => alive && setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load Community settings.' }))
    return () => {
      alive = false
    }
  }, [token])

  const save = async (change: { access?: 'all' | 'paid'; freeStudentCap?: number | null }, label: string) => {
    if (change.access === 'paid' && !window.confirm('Make the Community Paid? Free students are removed from it straight away.')) return
    setBusy(true)
    setMsg(null)
    try {
      show(await dsaApi.community.setAccess(change, token))
      setMsg({ ok: true, text: label })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' })
    } finally {
      setBusy(false)
    }
  }

  const saveCap = () => {
    if (unlimited) return void save({ freeStudentCap: null }, 'No limit on free students.')
    const n = Number(cap)
    if (cap.trim() === '' || !Number.isInteger(n) || n < 0 || n > 1000000) {
      return setMsg({ ok: false, text: 'Enter a whole number from 0 to 1,000,000, or choose Unlimited.' })
    }
    void save({ freeStudentCap: n }, `Free-student limit set to ${n}.`)
  }

  return (
    <Panel title='Community (applies to every room)' icon={MessageSquare}>
      {!info ? (
        msg ? <p className='text-[11px] font-bold text-rose-600'>{msg.text}</p> : <Loader2 className='animate-spin text-[#002EFF]' />
      ) : (
        <div className='space-y-4'>
          <div>
            <p className='text-[10px] font-black uppercase text-slate-500'>Community Access: Free / Paid</p>
            <p className='mb-2 text-[11px] font-medium text-slate-500'>
              Paid: only students with a confirmed, current plan. Free: paid students plus free students up to the limit.
            </p>
            <div className='flex gap-2' role='group' aria-label='Community Access'>
              {(['all', 'paid'] as const).map((a) => (
                <button
                  key={a}
                  type='button'
                  disabled={!canEdit || busy}
                  aria-pressed={info.access === a}
                  onClick={() => info.access !== a && save({ access: a }, `Community Access is now ${a === 'all' ? 'Free' : 'Paid'}.`)}
                  className={`h-9 rounded-xl border px-4 text-[10px] font-black uppercase ${info.access === a ? 'border-[#002EFF] bg-blue-50 text-[#002EFF]' : 'border-slate-200 text-slate-500'}`}
                >
                  {a === 'all' ? 'Free' : 'Paid'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className='text-[10px] font-black uppercase text-slate-500'>Free-student limit</p>
            <p className='mb-2 text-[11px] font-bold text-slate-600' role='status'>
              {info.freeStudents ?? 0} free students in ·{' '}
              {info.freeStudentCap == null ? 'no limit' : `limit ${info.freeStudentCap} · ${info.capacityAvailable ? `${info.placesLeft} places left` : 'full'}`}
            </p>
            <div className='flex flex-wrap items-center gap-2'>
              <input
                type='number'
                min={0}
                value={cap}
                disabled={!canEdit || unlimited}
                onChange={(e) => setCap(e.target.value)}
                aria-label='Free-student limit'
                className='h-9 w-28 rounded-lg border border-slate-200 px-2 text-[12px] font-bold'
              />
              <label className='flex items-center gap-1.5 text-[10px] font-bold text-slate-500'>
                <input type='checkbox' checked={unlimited} disabled={!canEdit} onChange={(e) => setUnlimited(e.target.checked)} /> Unlimited
              </label>
              <button type='button' disabled={!canEdit || busy} onClick={saveCap} className='h-9 rounded-xl bg-[#002EFF] px-3 text-[10px] font-black uppercase text-white disabled:opacity-50'>
                Save limit
              </button>
            </div>
          </div>
          <p className='text-[10px] font-medium text-slate-400'>
            Rooms, members, moderation and announcements are managed on the Community page.
          </p>
          {msg && (
            <p role={msg.ok ? 'status' : 'alert'} className={`text-[11px] font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </Panel>
  )
}

/** How a student is placed in a plan category (read-only explanation). */
function SubscriptionRules() {
  const rules = [
    ['Staff, tutors and admins', 'Never limited.'],
    ['Inactive account', 'Suspended, deleted or unverified accounts get nothing.'],
    ['Physical', 'An on-campus enrollment confirmed by an admin (Students → details), not expired, and learning mode “physical”. Choosing “physical” on the profile alone grants nothing.'],
    ['Tutorial / Portal', 'The current paid plan, by the payment system’s own rules: access switched on, plan not expired, payment not disabled. A receipt under review keeps the provisional access the payment flow grants.'],
    ['Free', 'Everyone else. An expired or switched-off plan falls back to Free straight away.'],
  ]
  return (
    <Panel title='Who counts as which plan' icon={ShieldCheck}>
      <ol className='space-y-2'>
        {rules.map(([title, text], i) => (
          <li key={title} className='flex gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800'>
            <span className='grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#002EFF] text-[10px] font-black text-white'>{i + 1}</span>
            <span>
              <span className='block text-[11px] font-black text-slate-700 dark:text-slate-100'>{title}</span>
              <span className='text-[11px] font-medium text-slate-500 dark:text-slate-300'>{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className='mt-3 text-[10px] font-medium text-slate-400'>
        The first rule that applies wins: a verified physical student is “Physical” even if their portal plan is Free.
        Monthly allowances reset at 00:00 on the 1st, Lagos time.
      </p>
    </Panel>
  )
}

function SettingsHistory({ token }: { token?: string }) {
  const [rows, setRows] = useState<SettingsHistoryEntry[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    dsaApi.platformSettings
      .history(token)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load the history.'))
    return () => {
      alive = false
    }
  }, [token])
  const area = (a: string) =>
    a === 'COMMUNITY_SETTINGS' ? 'Community' : a === 'PHYSICAL_ENROLLMENT' ? 'Physical enrollment' : 'Student entitlements'
  return (
    <Panel title='Settings history' icon={History}>
      {error ? (
        <p className='text-[11px] font-bold text-rose-600'>{error}</p>
      ) : !rows ? (
        <Loader2 className='animate-spin text-[#002EFF]' />
      ) : rows.length === 0 ? (
        <p className='text-[11px] font-bold text-slate-400'>No changes yet.</p>
      ) : (
        <ul className='divide-y divide-slate-50 dark:divide-slate-800'>
          {rows.map((r) => (
            <li key={r.id} className='py-3'>
              <p className='text-[10px] font-black uppercase text-slate-400'>
                {area(r.area)} · {new Date(r.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {r.by ? r.by.name : 'Unknown'}
              </p>
              <ul className='mt-1 space-y-0.5'>
                {r.changes.map((c, i) => (
                  <li key={i} className='text-[11px] font-bold text-slate-600 dark:text-slate-300'>
                    {c.setting}: {fmtLimit(c.from)} → {fmtLimit(c.to)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
