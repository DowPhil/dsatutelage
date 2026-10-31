'use client'

// Admin quiz builder — assemble a quiz from the tutor question bank. A quiz has
// one or more subject blocks, each with its own time limit and its chosen
// questions. See docs/quiz-feature.md.

import CodeLockSettings, { parseCodes, type CodeLockUse, type CodeLockValue } from './CodeLockSettings'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  HelpCircle,
  Check,
  Power,
  Copy,
  ListPlus,
  Clock,
  Users,
  Link as LinkIcon,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Search,
  FileQuestion,
  ClipboardList,
  Circle,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import QuizLeaderboard, {
  type LeaderboardRow,
} from '@/components/dashboard/QuizLeaderboard'
import QuizCorrections, {
  type CorrectionsData,
} from '@/components/dashboard/QuizCorrections'
import { dsaApi } from '@/lib/api'
import { canCreateQuiz, canDeleteQuiz } from '@/lib/quizPermissions'
import { JAMB_SUBJECTS } from '../constants/quiz'
import {
  EXAM_TRACKS,
  DEPARTMENT_LABELS,
  type ExamTrack,
  type Department,
} from '@/lib/studentProfile'
import {
  QUIZ_TRACKS,
  QUIZ_DEPARTMENTS,
  isDeptSplitTrack,
  audienceLabel,
} from '@/lib/quizAudience'

function adminToken(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    undefined
  )
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const
const str = (v: unknown) => (v == null ? '' : String(v))

interface BankQ {
  id: string
  body: string
  topic?: string
  options: string[]
  correctOption: string
  imageUrl?: string
  mark: number
  batchName?: string
  /** Shown to the student in corrections. Lost here means lost for good. */
  explanation?: string
}
interface SubjectBlock {
  name: string
  timeLimit: number
  picked: BankQ[]
}

function normalizeQ(raw: Record<string, unknown>): BankQ {
  const labeled = (raw.optionsLabeled ?? {}) as Record<string, string>
  const options = Array.isArray(raw.options)
    ? (raw.options as string[])
    : LETTERS.map((l) => labeled[l]).filter(Boolean)
  return {
    id: str(raw.id ?? raw._id),
    body: str(raw.body ?? raw.questionText),
    topic: raw.topic ? str(raw.topic) : undefined,
    options,
    correctOption: str(raw.correctOption || LETTERS[Number(raw.correctAnswer) || 0]),
    imageUrl: raw.imageUrl ? str(raw.imageUrl) : undefined,
    mark: typeof raw.mark === 'number' ? raw.mark : Number(raw.marks) || 1,
    batchName: raw.batchName ? str(raw.batchName) : undefined,
    explanation: raw.explanation ? str(raw.explanation) : undefined,
  }
}

function toEmbed(q: BankQ) {
  const [A, B, C, D, E] = q.options
  return {
    body: q.body,
    topic: q.topic,
    A,
    B,
    C,
    D,
    E: E || undefined,
    Answer: q.correctOption,
    mark: q.mark,
    imageUrl: q.imageUrl,
    explanation: q.explanation,
  }
}

export default function QuizBuilder() {
  const token = adminToken()
  const canCreate = canCreateQuiz()
  const canDelete = canDeleteQuiz()
  const [quizzes, setQuizzes] = useState<Record<string, unknown>[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [openAttempts, setOpenAttempts] = useState<string | null>(null)
  // The list is the default view; the builder form opens on "Create New Quiz".
  const [showBuilder, setShowBuilder] = useState(false)
  // List dashboard controls.
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'draft'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az'>('newest')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 8
  // When set, the builder is editing an existing quiz's details (not creating).
  const [editingId, setEditingId] = useState<string | null>(null)
  // The builder runs as steps so one long form doesn't face you all at once.
  const [step, setStep] = useState(0)
  // The list area shows either the quizzes or every submission across them.
  const [listView, setListView] = useState<'quizzes' | 'attempts'>('quizzes')
  const [askConfirm, confirmDialog] = useConfirm()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // Audience: which programme (+ department) the quiz targets. 'all' = everyone.
  const [track, setTrack] = useState<ExamTrack | 'all'>('all')
  const [department, setDepartment] = useState<Department | 'all' | ''>('')
  // Portal audience mode: by programme, or assigned to specific students.
  const [audienceMode, setAudienceMode] = useState<'programme' | 'students'>('programme')
  const [assignedStudents, setAssignedStudents] = useState<string[]>([])
  const [studentList, setStudentList] = useState<
    { id: string; name: string; email?: string }[]
  >([])
  const [studentSearch, setStudentSearch] = useState('')
  // Access mode: 'portal' (enrolled students, audience-filtered) or 'free'
  // (public link, anyone with name + age). Free quizzes are always 'all'.
  const [accessMode, setAccessMode] = useState<'portal' | 'free'>('portal')
  // Attempts & result controls. maxAttempts 0 = unlimited.
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [showResults, setShowResults] = useState(true)
  // Code lock: questions stay hidden until the taker enters a code.
  const [codeLockValue, setCodeLockValue] = useState<CodeLockValue>({ enabled: false, mode: 'shared', codes: '' })
  const [codeLockUses, setCodeLockUses] = useState<CodeLockUse[]>([])
  const [showCorrections, setShowCorrections] = useState(true)
  // Portal quizzes only: locked to paid-plan students when true.
  const [paid, setPaid] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(true)
  const [blocks, setBlocks] = useState<SubjectBlock[]>([])
  // Subjects that actually have uploaded questions (any label a tutor used),
  // merged with the standard list so nothing is invisible to the admin.
  const [bankSubjects, setBankSubjects] = useState<string[]>([])
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Shareable public link shown after a free quiz is published.
  const [publicLink, setPublicLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      const rows = (await dsaApi.quizzes.list(token)) as Record<
        string,
        unknown
      >[]
      setQuizzes(rows)
    } catch {
      /* ignore */
    } finally {
      setLoadingList(false)
    }
  }, [token])

  useEffect(() => {
    loadList()
  }, [loadList])

  // Load the student roster once, for the "assign to selected students" picker.
  // Uses the staff/students endpoint (admin passes the gate too), so this panel
  // works for both admins and quiz-permitted staff without needing admin-only
  // /admin/users access.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = (await dsaApi.staff.students(token)) as Record<
          string,
          unknown
        >[]
        if (cancelled) return
        setStudentList(
          rows.map((u) => ({
            id: str(u.id ?? u._id),
            name: str(u.fullname ?? u.fullName ?? u.username ?? 'Student'),
            email: u.email ? str(u.email) : undefined,
          })),
        )
      } catch {
        /* roster unavailable — the picker just shows nothing */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  // Load the subjects that actually have questions so the picker isn't limited
  // to the fixed list (which hid questions uploaded under other labels).
  // Prefer the dedicated /questions/subjects endpoint; if it isn't deployed
  // yet (or returns nothing) fall back to deriving the labels from a full
  // question list, which the admin's plain GET /questions already returns.
  // This keeps the picker correct without waiting on the backend deploy.
  useEffect(() => {
    let cancelled = false
    const deriveFromAll = async () => {
      const rows = (await dsaApi.questions.list({}, token)) as Record<
        string,
        unknown
      >[]
      const seen = new Set<string>()
      const subs: string[] = []
      rows.forEach((r) => {
        const s = String(r.subject ?? '').trim()
        if (s && !seen.has(s.toLowerCase())) {
          seen.add(s.toLowerCase())
          subs.push(s)
        }
      })
      return subs.sort((a, b) => a.localeCompare(b))
    }
    ;(async () => {
      try {
        const subs = (await dsaApi.questions.subjects(token)) as string[]
        if (cancelled) return
        if (Array.isArray(subs) && subs.length) {
          setBankSubjects(subs)
          return
        }
        // Endpoint present but empty — still derive, in case of a stale deploy.
        const derived = await deriveFromAll()
        if (!cancelled) setBankSubjects(derived)
      } catch {
        // Endpoint not deployed — derive the real labels from all questions.
        try {
          const derived = await deriveFromAll()
          if (!cancelled) setBankSubjects(derived)
        } catch {
          /* fall back to the fixed list */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  // Fixed list first (familiar order), then any extra uploaded subjects,
  // de-duplicated case-insensitively.
  const subjectOptions = (() => {
    const seen = new Set(JAMB_SUBJECTS.map((s) => s.toLowerCase()))
    const extras = bankSubjects.filter((s) => !seen.has(s.toLowerCase()))
    return [...JAMB_SUBJECTS, ...extras]
  })()

  const flash = (m: string) => {
    setNotice(m)
    setTimeout(() => setNotice(null), 2500)
  }

  const addBlock = () =>
    setBlocks((b) => [
      ...b,
      { name: JAMB_SUBJECTS[0], timeLimit: 15, picked: [] },
    ])
  const dropBlock = (i: number) =>
    setBlocks((b) => b.filter((_, idx) => idx !== i))

  // Picked questions are easy to lose and slow to pick again.
  const removeBlock = (i: number) => {
    const block = blocks[i]
    if (!block?.picked.length) return dropBlock(i)
    askConfirm({
      title: `Remove ${block.name}?`,
      body: `The ${block.picked.length} question${
        block.picked.length === 1 ? '' : 's'
      } you picked for it go with it, and you would have to pick them again.`,
      confirmLabel: 'Remove subject',
      onConfirm: () => dropBlock(i),
    })
  }
  const patchBlock = (i: number, patch: Partial<SubjectBlock>) =>
    setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, ...patch } : blk)))

  const totalQuestions = blocks.reduce((n, b) => n + b.picked.length, 0)
  const totalMinutes = blocks.reduce((n, b) => n + (Number(b.timeLimit) || 0), 0)

  // Editing only changes details, so that run skips the Questions step.
  const steps = (
    editingId
      ? (['basics', 'settings', 'review'] as const)
      : (['basics', 'questions', 'settings', 'review'] as const)
  ).slice() as ('basics' | 'questions' | 'settings' | 'review')[]
  const stepLabels: Record<(typeof steps)[number], string> = {
    basics: 'Basic info',
    questions: 'Questions',
    settings: 'Settings',
    review: editingId ? 'Review & save' : 'Review & publish',
  }
  const current = steps[Math.min(step, steps.length - 1)]

  /** What still has to be filled in before this step can be left. */
  const stepError = (key: (typeof steps)[number]): string | null => {
    if (key === 'basics') {
      if (title.trim().length < 3) return 'Enter a quiz title.'
      if (
        accessMode === 'portal' &&
        audienceMode === 'students' &&
        assignedStudents.length === 0
      )
        return 'Select at least one student to assign this quiz to.'
      if (
        accessMode === 'portal' &&
        audienceMode === 'programme' &&
        track !== 'all' &&
        isDeptSplitTrack(track) &&
        !department
      )
        return 'Pick a department (Science, Art or Commercial) for this programme.'
    }
    if (key === 'questions' && totalQuestions === 0)
      return 'Add at least one question.'
    return null
  }

  const goToStep = (target: number) => {
    // Going back is always allowed; going forward checks the steps in between.
    if (target > step) {
      for (let i = step; i < target; i += 1) {
        const problem = stepError(steps[i])
        if (problem) {
          setStep(i)
          return setError(problem)
        }
      }
    }
    setError(null)
    setStep(Math.max(0, Math.min(target, steps.length - 1)))
  }

  const publish = async (asDraft = false) => {
    setError(null)
    if (title.trim().length < 3) return setError('Enter a quiz title.')
    // When editing, we update details only — questions aren't re-picked here.
    if (!editingId && totalQuestions === 0)
      return setError('Add at least one question.')
    if (
      accessMode === 'portal' &&
      audienceMode === 'students' &&
      assignedStudents.length === 0
    )
      return setError('Select at least one student to assign this quiz to.')
    // Dept-split programmes (WAEC / JAMB / Post-UTME) must carry a department so
    // Science / Art / Commercial students each see only their own quizzes.
    if (
      accessMode === 'portal' &&
      audienceMode === 'programme' &&
      track !== 'all' &&
      isDeptSplitTrack(track) &&
      !department
    )
      return setError(
        'Pick a department (Science, Art or Commercial) for this programme.',
      )
    setPublishing(true)
    setPublicLink(null)
    setCopied(false)
    // Free quizzes are always open to everyone — force the audience to 'all'.
    const isFree = accessMode === 'free'
    const effectiveTrack = isFree ? 'all' : track
    const dept =
      !isFree && effectiveTrack !== 'all' && isDeptSplitTrack(effectiveTrack)
        ? department || undefined
        : undefined
    // Shared detail fields (title, audience, access, attempts, result controls).
    const details: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || title.trim(),
      accessMode,
      // Paid only applies to portal quizzes; public-link quizzes are open to all.
      paid: isFree ? false : paid,
      maxAttempts: Math.max(0, parseInt(maxAttempts, 10) || 0),
      showResults,
      showCorrections,
      showLeaderboard,
      codeLock: {
        enabled: codeLockValue.enabled,
        // Personal codes are for portal quizzes; a public link test uses one code.
        mode: accessMode === 'free' ? 'shared' : codeLockValue.mode,
        codes: parseCodes(codeLockValue.codes),
      },
      track: effectiveTrack === 'all' ? 'all' : effectiveTrack,
      department: dept,
      audience: audienceLabel(
        effectiveTrack === 'all' ? null : effectiveTrack,
        dept,
      ),
    }
    // Assign to specific students (portal only). Assignment overrides the
    // programme audience, so the quiz only reaches the named students.
    if (!isFree && audienceMode === 'students') {
      details.assignedStudents = assignedStudents
      details.track = 'all'
      details.department = null
      details.audience = `${assignedStudents.length} selected student${assignedStudents.length === 1 ? '' : 's'}`
    } else {
      details.assignedStudents = []
    }
    try {
      if (editingId) {
        // Update details only — omitting `subjects` keeps the questions intact.
        const updated = (await dsaApi.quizzes.update(editingId, details, token)) as
          | { link?: string; publicLink?: string; data?: { publicLink?: string; link?: string } }
          | undefined
        if (isFree) {
          // The backend now mints a publicLink when a quiz is edited to free —
          // read it (across response shapes) and show the shareable link.
          const slug =
            updated?.data?.publicLink ??
            updated?.data?.link ??
            updated?.publicLink ??
            updated?.link
          setPublicLink(
            slug ? `${window.location.origin}/q/${slug}` : 'link-pending',
          )
        }
      } else {
        const created = (await dsaApi.quizzes.create(
          {
            ...details,
            // A draft is saved but stays out of students' quiz lists until it
            // is published from the list view.
            isActive: !asDraft,
            type: 'general',
            subjects: blocks
              .filter((b) => b.picked.length)
              .map((b) => ({
                name: b.name,
                timeLimit: Number(b.timeLimit) || 0,
                questions: b.picked.map(toEmbed),
              })),
          } as Record<string, unknown>,
          token,
        )) as
          | { link?: string; publicLink?: string; data?: { publicLink?: string; link?: string } }
          | undefined
        if (isFree) {
          // The backend returns the slug as `publicLink` (inside the response
          // envelope's `data`). Read it robustly across shapes.
          const slug =
            created?.data?.publicLink ??
            created?.data?.link ??
            created?.publicLink ??
            created?.link
          setPublicLink(
            slug ? `${window.location.origin}/q/${slug}` : 'link-pending',
          )
        }
      }
      const wasEditing = !!editingId
      setTitle('')
      setDescription('')
      setTrack('all')
      setDepartment('')
      setAudienceMode('programme')
      setAssignedStudents([])
      setStudentSearch('')
      setAccessMode('portal')
      setMaxAttempts('1')
      setShowResults(true)
      setShowCorrections(true)
      setCodeLockValue({ enabled: false, mode: 'shared', codes: '' })
      setCodeLockUses([])
      setPaid(false)
      setBlocks([])
      setEditingId(null)
      setStep(0)
      // A free quiz (created or edited) keeps the builder open so the shareable
      // link shows; a portal publish/edit returns to the list.
      if (!isFree || asDraft) setShowBuilder(false)
      flash(
        wasEditing
          ? 'Quiz updated'
          : asDraft
            ? 'Saved as draft'
            : isFree
              ? 'Free quiz published'
              : 'Quiz published',
      )
      loadList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the quiz.')
    } finally {
      setPublishing(false)
    }
  }

  // Open the builder pre-filled to edit a quiz's details.
  const startEdit = (q: Record<string, unknown>) => {
    const id = str(q.id ?? q._id)
    setEditingId(id)
    setStep(0)
    setError(null)
    setTitle(str(q.title))
    setDescription(str(q.description))
    const mode = q.accessMode === 'free' ? 'free' : 'portal'
    setAccessMode(mode)
    const t = str(q.track || 'all')
    setTrack((t === 'all' ? 'all' : t) as ExamTrack | 'all')
    setDepartment((q.department as Department | 'all') || '')
    // Prefill the assignment picker from the quiz's assigned students.
    const assigned = Array.isArray(q.assignedStudents)
      ? (q.assignedStudents as unknown[]).map((s) =>
          s && typeof s === 'object'
            ? str((s as Record<string, unknown>).id ?? (s as Record<string, unknown>)._id)
            : str(s),
        )
      : []
    setAssignedStudents(assigned)
    setAudienceMode(assigned.length ? 'students' : 'programme')
    setStudentSearch('')
    setMaxAttempts(String(q.maxAttempts ?? 1))
    setShowResults(q.showResults !== false)
    setShowCorrections(q.showCorrections !== false)
    setShowLeaderboard(q.showLeaderboard !== false)
    const cl = (q.codeLock ?? {}) as { enabled?: boolean; mode?: string; codes?: string[]; uses?: CodeLockUse[] }
    setCodeLockValue({
      enabled: cl.enabled === true,
      mode: cl.mode === 'personal' ? 'personal' : 'shared',
      codes: Array.isArray(cl.codes) ? cl.codes.join('\n') : '',
    })
    setCodeLockUses(Array.isArray(cl.uses) ? cl.uses : [])
    setPaid(q.paid === true)
    setBlocks([])
    // Show the existing shareable link when re-editing a free quiz.
    const existingSlug = str(q.publicLink ?? q.link ?? '')
    setPublicLink(
      mode === 'free' && existingSlug
        ? `${window.location.origin}/q/${existingSlug}`
        : null,
    )
    setError(null)
    setShowBuilder(true)
  }

  /** How many people have already sat it, when the list tells us. */
  const takenCount = (q: Record<string, unknown>) =>
    Number(q.attemptsCount ?? q.attempts ?? q.takenCount) || 0

  const sat = (q: Record<string, unknown>) => {
    const n = takenCount(q)
    if (!n) return ''
    return ` ${n} student${n === 1 ? ' has' : 's have'} already submitted — their results are not affected.`
  }

  const setStatus = async (q: Record<string, unknown>, next: boolean) => {
    const id = str(q.id ?? q._id)
    setQuizzes((qs) =>
      qs.map((x) => (str(x.id ?? x._id) === id ? { ...x, isActive: next } : x)),
    )
    try {
      await dsaApi.quizzes.setStatus(id, next, token)
    } catch {
      loadList()
    }
  }

  // Publishing is safe; taking a live quiz away from students is not.
  const toggleStatus = (q: Record<string, unknown>) => {
    if (!q.isActive) return setStatus(q, true)
    askConfirm({
      title: `Unpublish “${str(q.title)}”?`,
      body: `Students will no longer see this quiz or be able to start it. You can publish it again at any time.${sat(q)}`,
      confirmLabel: 'Unpublish',
      onConfirm: () => setStatus(q, false),
    })
  }

  const removeQuiz = (id: string, q: Record<string, unknown>) => {
    askConfirm({
      title: `Delete “${str(q.title)}”?`,
      body: `The quiz and its questions go for good, and this cannot be undone.${
        takenCount(q)
          ? ` ${takenCount(q)} submitted result${takenCount(q) === 1 ? '' : 's'} may go with it.`
          : ' Unpublish it instead if you only want to hide it from students.'
      }`,
      confirmLabel: 'Delete quiz',
      onConfirm: async () => {
        setQuizzes((qs) => qs.filter((x) => str(x.id ?? x._id) !== id))
        try {
          await dsaApi.quizzes.remove(id, token)
        } catch {
          loadList()
        }
      },
    })
  }

  return (
    <div className='max-w-4xl mx-auto space-y-6 px-1 [font-variant-numeric:tabular-nums]'>
      <header className='relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#002EFF] to-[#0a1cc4] text-white p-5 sm:p-6 shadow-lg shadow-blue-200/60'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 opacity-[0.12]'
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className='relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3'>
          <div className='flex items-start gap-3 min-w-0'>
            <div className='h-11 w-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 ring-1 ring-white/20'>
              <HelpCircle size={22} />
            </div>
            <div className='min-w-0'>
              <h1 className='text-2xl sm:text-3xl font-black tracking-tight leading-none'>
                Quizzes
              </h1>
              <p className='text-[11px] font-semibold text-blue-100/90 mt-2'>
                {editingId
                  ? 'Edit quiz details'
                  : showBuilder
                    ? 'Build a quiz from the tutor question bank'
                    : 'Create and manage student assessments'}
              </p>
            </div>
          </div>
          {(canCreate || showBuilder) && (
            <button
              onClick={() => {
                // Either way the next visit starts at step one.
                setEditingId(null)
                setError(null)
                setStep(0)
                setShowBuilder((open) => !open)
              }}
              className='flex items-center justify-center gap-2 h-11 sm:h-10 px-4 rounded-xl bg-white text-[#002EFF] font-black text-[11px] uppercase tracking-wide hover:bg-blue-50 active:scale-[0.98] transition-all shrink-0 shadow-sm w-full sm:w-auto'
            >
              {showBuilder ? (
                <>
                  <ArrowLeft size={15} /> Back to list
                </>
              ) : (
                <>
                  <Plus size={15} /> Create quiz
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className='flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5'>
          <Check size={15} className='text-emerald-600' />
          <p className='text-[11px] font-bold text-emerald-700'>{notice}</p>
        </div>
      )}

      {publicLink && (
        <div className='rounded-2xl border border-[#FCB900]/50 bg-amber-50 px-4 py-3 space-y-2'>
          <p className='text-[10px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-1.5'>
            <LinkIcon size={13} /> Shareable quiz link
          </p>
          {publicLink === 'link-pending' ? (
            <p className='text-[11px] font-bold text-amber-700'>
              The quiz is published as free. The public link will appear here once
              the backend returns its slug.
            </p>
          ) : (
            <div className='flex items-center gap-2'>
              <input
                readOnly
                value={publicLink}
                onFocus={(e) => e.currentTarget.select()}
                className='flex-1 h-9 px-2 rounded-lg bg-white border border-amber-200 text-[11px] font-bold text-slate-700 outline-none'
              />
              <button
                type='button'
                onClick={() => {
                  navigator.clipboard?.writeText(publicLink)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1800)
                }}
                className='h-9 px-3 rounded-lg bg-[#002EFF] text-white text-[10px] font-black uppercase flex items-center gap-1.5'
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
          <p className='text-[9px] font-bold text-amber-600'>
            Anyone with this link can take the quiz — no account needed.
          </p>
        </div>
      )}

      {/* Builder — only when creating a new quiz */}
      {showBuilder && (
      <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
        {/* Step rail — click a done step to go back and change something */}
        <ol className='flex items-center gap-1 overflow-x-auto pb-1'>
          {steps.map((s, i) => {
            const state = i === step ? 'now' : i < step ? 'done' : 'todo'
            return (
              <li key={s} className='flex items-center gap-1 shrink-0'>
                <button
                  type='button'
                  onClick={() => goToStep(i)}
                  className={`flex items-center gap-1.5 h-8 pl-1.5 rounded-full transition-colors sm:pr-3 ${
                    state === 'now' ? 'pr-3' : 'pr-1.5'
                  } ${
                    state === 'now'
                      ? 'bg-[#002EFF] text-white'
                      : state === 'done'
                        ? 'bg-blue-50 text-[#002EFF] hover:bg-blue-100'
                        : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full grid place-items-center text-[9px] font-black ${
                      state === 'now'
                        ? 'bg-white/20'
                        : state === 'done'
                          ? 'bg-[#002EFF] text-white'
                          : 'bg-slate-100'
                    }`}
                  >
                    {state === 'done' ? <Check size={11} /> : i + 1}
                  </span>
                  {/* On a phone only the step you are on spells itself out */}
                  <span
                    className={`text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${
                      state === 'now' ? '' : 'hidden sm:inline'
                    }`}
                  >
                    {stepLabels[s]}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <span className='h-px w-3 bg-slate-200 shrink-0' />
                )}
              </li>
            )
          })}
        </ol>

        {error && <p className='text-[11px] font-bold text-rose-600'>{error}</p>}

        {current === 'basics' && (
        <>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='Quiz title (e.g. JAMB Mock — Week 3)'
          className='w-full h-11 px-3 rounded-lg bg-slate-50 outline-none text-sm font-bold'
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='Description (optional)'
          className='w-full h-10 px-3 rounded-lg bg-slate-50 outline-none text-sm font-medium'
        />

        {/* Access mode: portal (enrolled students) vs free (public link) */}
        <div className='rounded-2xl bg-slate-50/70 p-3 space-y-2'>
          <p className='text-[9px] font-black uppercase text-slate-400'>
            Access
          </p>
          <div className='grid grid-cols-2 gap-2'>
            <button
              type='button'
              onClick={() => setAccessMode('portal')}
              className={`flex flex-col items-start gap-0.5 rounded-xl px-3 py-2 border text-left transition-all ${
                accessMode === 'portal'
                  ? 'bg-[#002EFF] text-white border-[#002EFF] shadow'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#002EFF]/40'
              }`}
            >
              <span className='flex items-center gap-1.5 text-[11px] font-black'>
                <Users size={13} /> Portal
              </span>
              <span
                className={`text-[9px] font-bold ${accessMode === 'portal' ? 'text-blue-100' : 'text-slate-400'}`}
              >
                Enrolled students, by programme
              </span>
            </button>
            <button
              type='button'
              onClick={() => setAccessMode('free')}
              className={`flex flex-col items-start gap-0.5 rounded-xl px-3 py-2 border text-left transition-all ${
                accessMode === 'free'
                  ? 'bg-[#FCB900] text-[#002EFF] border-[#FCB900] shadow'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#FCB900]/60'
              }`}
            >
              <span className='flex items-center gap-1.5 text-[11px] font-black'>
                <LinkIcon size={13} /> Free (public link)
              </span>
              <span
                className={`text-[9px] font-bold ${accessMode === 'free' ? 'text-[#002EFF]/70' : 'text-slate-400'}`}
              >
                Anyone — just name &amp; age
              </span>
            </button>
          </div>
        </div>

        {/* Audience: which programme (+ department) sees this quiz (portal only) */}
        {accessMode === 'portal' ? (
          <div className='rounded-2xl bg-slate-50/70 p-3 space-y-2.5'>
            <p className='text-[9px] font-black uppercase text-slate-400'>
              Who sees this quiz
            </p>
            {/* By programme, or assigned to specific students */}
            <div className='inline-flex rounded-lg bg-white border border-slate-200 p-0.5'>
              <button
                type='button'
                onClick={() => setAudienceMode('programme')}
                className={`px-3 h-7 rounded-md text-[10px] font-black uppercase tracking-wide ${
                  audienceMode === 'programme'
                    ? 'bg-[#002EFF] text-white'
                    : 'text-slate-500'
                }`}
              >
                By programme
              </button>
              <button
                type='button'
                onClick={() => setAudienceMode('students')}
                className={`px-3 h-7 rounded-md text-[10px] font-black uppercase tracking-wide ${
                  audienceMode === 'students'
                    ? 'bg-[#002EFF] text-white'
                    : 'text-slate-500'
                }`}
              >
                Selected students
              </button>
            </div>

            {audienceMode === 'programme' ? (
              <div className='flex flex-wrap items-center gap-2'>
                <select
                  value={track}
                  onChange={(e) => setTrack(e.target.value as ExamTrack | 'all')}
                  className='h-9 px-2 rounded-lg bg-white border border-slate-200 outline-none text-[12px] font-black'
                >
                  <option value='all'>All students</option>
                  {QUIZ_TRACKS.map((t) => (
                    <option key={t} value={t}>
                      {EXAM_TRACKS[t].label}
                    </option>
                  ))}
                </select>
                {track !== 'all' && isDeptSplitTrack(track) && (
                  <select
                    value={department}
                    onChange={(e) =>
                      setDepartment(e.target.value as Department | 'all' | '')
                    }
                    className={`h-9 px-2 rounded-lg bg-white border outline-none text-[12px] font-black ${
                      department ? 'border-slate-200' : 'border-rose-300'
                    }`}
                  >
                    <option value=''>Select department…</option>
                    <option value='all'>All departments</option>
                    {QUIZ_DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {DEPARTMENT_LABELS[d]}
                      </option>
                    ))}
                  </select>
                )}
                <span className='text-[10px] font-bold text-slate-400'>
                  →{' '}
                  {audienceLabel(
                    track === 'all' ? null : track,
                    track !== 'all' && isDeptSplitTrack(track) ? department : null,
                  )}
                </span>
              </div>
            ) : (
              <StudentPicker
                all={studentList}
                selected={assignedStudents}
                onToggle={(id) =>
                  setAssignedStudents((prev) =>
                    prev.includes(id)
                      ? prev.filter((x) => x !== id)
                      : [...prev, id],
                  )
                }
                onClear={() => setAssignedStudents([])}
                search={studentSearch}
                setSearch={setStudentSearch}
              />
            )}
          </div>
        ) : (
          <p className='text-[10px] font-bold text-slate-400 px-1'>
            Open to <span className='text-[#002EFF]'>everyone</span> via a shareable
            link — no account needed. Takers enter their name and age, take the
            quiz, then see their result.
          </p>
        )}
        </>
        )}

        {/* Attempts & result controls */}
        {current === 'settings' && (
        <div className='rounded-2xl bg-slate-50/70 p-3 space-y-2.5'>
          <p className='text-[9px] font-black uppercase text-slate-400'>
            Attempts &amp; results
          </p>
          <label className='flex items-center justify-between gap-3'>
            <span className='text-[11px] font-bold text-slate-600'>
              Attempts allowed{' '}
              <span className='text-slate-400'>(0 = unlimited)</span>
            </span>
            <input
              type='number'
              min={0}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              className='w-20 h-9 px-2 rounded-lg bg-white border border-slate-200 outline-none text-[12px] font-black text-center'
            />
          </label>
          <label className='flex items-center justify-between gap-3 cursor-pointer'>
            <span className='text-[11px] font-bold text-slate-600'>
              Show results to students
            </span>
            <input
              type='checkbox'
              checked={showResults}
              onChange={(e) => setShowResults(e.target.checked)}
              className='h-4 w-4 accent-[#002EFF]'
            />
          </label>
          <label
            className={`flex items-center justify-between gap-3 cursor-pointer ${!showResults ? 'opacity-50' : ''}`}
          >
            <span className='text-[11px] font-bold text-slate-600'>
              Allow viewing corrections
            </span>
            <input
              type='checkbox'
              checked={showCorrections && showResults}
              disabled={!showResults}
              onChange={(e) => setShowCorrections(e.target.checked)}
              className='h-4 w-4 accent-[#002EFF]'
            />
          </label>
          <label className='flex items-center justify-between gap-3 cursor-pointer'>
            <span className='text-[11px] font-bold text-slate-600'>
              Show leaderboard
            </span>
            <input
              type='checkbox'
              checked={showLeaderboard}
              onChange={(e) => setShowLeaderboard(e.target.checked)}
              className='h-4 w-4 accent-[#002EFF]'
            />
          </label>
          {accessMode === 'portal' && (
            <label className='flex items-start justify-between gap-3 cursor-pointer rounded-xl bg-amber-50 px-3 py-2.5'>
              <span className='text-[11px] font-bold text-amber-800'>
                Paid quiz
                <span className='block text-[10px] font-medium text-amber-600'>
                  Everyone sees it, but only paid-plan students can take it. Off =
                  free for all students.
                </span>
              </span>
              <input
                type='checkbox'
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className='mt-0.5 h-4 w-4 accent-[#002EFF]'
              />
            </label>
          )}
        </div>

        )}

        {current === 'settings' && (
          <CodeLockSettings
            value={codeLockValue}
            onChange={setCodeLockValue}
            uses={codeLockUses}
            quizTitle={title}
            quizId={editingId}
            accessMode={accessMode}
            assignedCount={audienceMode === 'students' ? assignedStudents.length : 0}
            token={token}
          />
        )}

        {current === 'settings' && editingId && (
          <p className='text-[10px] font-bold text-slate-400 rounded-xl bg-slate-50 px-3 py-2.5'>
            Editing this quiz&apos;s details (title, audience, access, attempts,
            result settings). The questions stay as they are — to change questions,
            create a new quiz.
          </p>
        )}

        {current === 'questions' && (
          <>
            {blocks.length === 0 && (
              <p className='text-[10px] font-bold text-slate-400 rounded-xl bg-slate-50 px-3 py-2.5'>
                Add a subject, then pick its questions from the tutor question
                bank. A mock can hold several subjects, each with its own timer.
              </p>
            )}
            {blocks.map((b, i) => (
              <SubjectBlockEditor
                key={i}
                block={b}
                token={token}
                subjectOptions={subjectOptions}
                onChange={(patch) => patchBlock(i, patch)}
                onRemove={() => removeBlock(i)}
              />
            ))}

            <button
              onClick={addBlock}
              className='w-full flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-wide hover:border-[#002EFF]/40 hover:text-[#002EFF]'
            >
              <Plus size={14} /> Add subject
            </button>
          </>
        )}

        {/* Last look before it goes out to students */}
        {current === 'review' && (
          <div className='space-y-2'>
            <div className='rounded-2xl bg-slate-50/70 p-3.5 space-y-2.5'>
              <div>
                <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
                  {accessMode === 'free' ? 'Free quiz · public link' : 'Portal quiz'}
                </p>
                <p className='text-base font-black text-slate-800 leading-tight mt-0.5'>
                  {title.trim() || 'Untitled quiz'}
                </p>
                {description.trim() && (
                  <p className='text-[11px] font-medium text-slate-500 mt-0.5'>
                    {description.trim()}
                  </p>
                )}
              </div>
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
                {[
                  {
                    label: 'Who sees it',
                    value:
                      accessMode === 'free'
                        ? 'Anyone with the link'
                        : audienceMode === 'students'
                          ? `${assignedStudents.length} student${assignedStudents.length === 1 ? '' : 's'}`
                          : audienceLabel(
                              track === 'all' ? null : track,
                              track !== 'all' && isDeptSplitTrack(track)
                                ? department
                                : null,
                            ),
                  },
                  {
                    label: 'Questions',
                    value: editingId ? 'Unchanged' : String(totalQuestions),
                  },
                  {
                    label: 'Duration',
                    value: editingId
                      ? 'Unchanged'
                      : totalMinutes > 0
                        ? `${totalMinutes} min`
                        : 'No limit',
                  },
                  {
                    label: 'Attempts',
                    value:
                      Math.max(0, parseInt(maxAttempts, 10) || 0) === 0
                        ? 'Unlimited'
                        : maxAttempts,
                  },
                ].map((s) => (
                  <div key={s.label} className='rounded-xl bg-white px-2.5 py-2'>
                    <p className='text-[8px] font-black uppercase tracking-widest text-slate-400'>
                      {s.label}
                    </p>
                    <p className='text-[11px] font-black text-slate-700 truncate'>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              {!editingId && blocks.some((b) => b.picked.length) && (
                <div className='flex flex-wrap gap-1.5'>
                  {blocks
                    .filter((b) => b.picked.length)
                    .map((b, i) => (
                      <span
                        key={i}
                        className='text-[10px] font-black text-[#002EFF] bg-blue-50 rounded-lg px-2 py-1'
                      >
                        {b.name} · {b.picked.length}q
                        {b.timeLimit ? ` · ${b.timeLimit}m` : ''}
                      </span>
                    ))}
                </div>
              )}
              <p className='text-[10px] font-bold text-slate-500 flex flex-wrap gap-x-2'>
                <span>
                  Results {showResults ? 'shown' : 'hidden'}
                </span>
                <span className='text-slate-300'>·</span>
                <span>
                  Corrections{' '}
                  {showResults && showCorrections ? 'allowed' : 'off'}
                </span>
                <span className='text-slate-300'>·</span>
                <span>Leaderboard {showLeaderboard ? 'on' : 'off'}</span>
              </p>
            </div>
          </div>
        )}

        {/* Step navigation */}
        <div className='flex items-center justify-between gap-3 pt-1'>
          <span className='text-[11px] font-black text-slate-400 flex items-center gap-1 min-w-0'>
            {editingId ? (
              'Editing details'
            ) : (
              <>
                {totalQuestions} question{totalQuestions === 1 ? '' : 's'} ·{' '}
                {blocks.length} subject{blocks.length === 1 ? '' : 's'}
                {totalMinutes > 0 && (
                  <>
                    {' '}
                    · <Clock size={11} /> {totalMinutes} min total
                  </>
                )}
              </>
            )}
          </span>
          <div className='flex items-center gap-2 shrink-0'>
            {step > 0 && (
              <button
                onClick={() => goToStep(step - 1)}
                className='flex items-center gap-1.5 h-10 px-3 rounded-xl bg-slate-100 text-slate-500 font-black text-[11px] uppercase tracking-wide hover:text-[#002EFF]'
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            {current !== 'review' ? (
              <button
                onClick={() => goToStep(step + 1)}
                className='flex items-center gap-2 h-10 px-5 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98]'
              >
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <>
                {!editingId && (
                  <button
                    onClick={() => publish(true)}
                    disabled={publishing}
                    title='Save without showing it to students yet'
                    className='h-10 px-3 rounded-xl bg-slate-100 text-slate-500 font-black text-[11px] uppercase tracking-wide hover:text-[#002EFF] disabled:opacity-50'
                  >
                    Save as draft
                  </button>
                )}
                <button
                  onClick={() => publish(false)}
                  disabled={publishing}
                  className='flex items-center gap-2 h-10 px-5 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50'
                >
                  {publishing ? (
                    <Loader2 size={15} className='animate-spin' />
                  ) : (
                    <Check size={15} />
                  )}
                  {editingId ? 'Save changes' : 'Publish quiz'}
                </button>
              </>
            )}
          </div>
        </div>
      </Card>
      )}

      {/* Existing quizzes — the default list view */}
      {!showBuilder && (() => {
        const total = quizzes.length
        const live = quizzes.filter((q) => q.isActive).length
        const draft = total - live
        const knowAttempts = quizzes.some(
          (q) => q.attemptsCount != null || q.attempts != null || q.takenCount != null,
        )
        const totalAttempts = quizzes.reduce(
          (n, q) => n + (Number(q.attemptsCount ?? q.attempts ?? q.takenCount) || 0),
          0,
        )

        const term = search.trim().toLowerCase()
        const list = quizzes
          .filter((q) => {
            if (statusFilter === 'live' && !q.isActive) return false
            if (statusFilter === 'draft' && q.isActive) return false
            if (!term) return true
            return `${str(q.title)} ${str(q.accessCode)}`
              .toLowerCase()
              .includes(term)
          })
          .sort((a, b) => {
            if (sortBy === 'az') return str(a.title).localeCompare(str(b.title))
            const ta = new Date(str(a.createdAt)).getTime() || 0
            const tb = new Date(str(b.createdAt)).getTime() || 0
            return sortBy === 'oldest' ? ta - tb : tb - ta
          })

        const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
        const safePage = Math.min(page, pageCount)
        const paged = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

        return (
          <div className='space-y-4'>
            {/* Summary */}
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
              <StatCard label='Total quizzes' value={total} icon={ClipboardList} tint='text-[#002EFF] bg-blue-50' />
              <StatCard label='Live' value={live} icon={Circle} tint='text-emerald-600 bg-emerald-50' />
              <StatCard label='Draft' value={draft} icon={Circle} tint='text-amber-600 bg-amber-50' />
              <StatCard label='Attempts' value={knowAttempts ? totalAttempts : '—'} icon={Users} tint='text-violet-600 bg-violet-50' />
            </div>

            {/* One quiz at a time, or every submission side by side */}
            <div className='flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-100 w-fit'>
              {(['quizzes', 'attempts'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setListView(v)}
                  className={`px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors ${
                    listView === v
                      ? 'bg-[#002EFF] text-white'
                      : 'text-slate-400 hover:text-[#002EFF]'
                  }`}
                >
                  {v === 'quizzes' ? 'Quizzes' : 'All attempts'}
                </button>
              ))}
            </div>

            {listView === 'attempts' ? (
              <AllAttempts
                quizzes={quizzes}
                token={token}
                onOpenQuiz={(id) => {
                  setListView('quizzes')
                  setSearch('')
                  setStatusFilter('all')
                  setPage(1)
                  setOpenAttempts(id)
                }}
              />
            ) : (
            <>
            {/* Search + filters */}
            <div className='flex flex-col sm:flex-row gap-2'>
              <div className='relative flex-1'>
                <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder='Search by quiz name or code…'
                  className='w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-slate-200 focus:border-[#002EFF]/40 outline-none text-sm font-medium'
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'live' | 'draft'); setPage(1) }}
                className='h-10 px-3 rounded-xl bg-white border border-slate-200 outline-none text-[12px] font-bold'
              >
                <option value='all'>All status</option>
                <option value='live'>Live</option>
                <option value='draft'>Draft</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'az')}
                className='h-10 px-3 rounded-xl bg-white border border-slate-200 outline-none text-[12px] font-bold'
              >
                <option value='newest'>Newest</option>
                <option value='oldest'>Oldest</option>
                <option value='az'>A–Z</option>
              </select>
            </div>

            {/* List */}
            {loadingList ? (
              <div className='py-10 flex justify-center'>
                <Loader2 className='animate-spin text-[#002EFF]' />
              </div>
            ) : total === 0 ? (
              <div className='py-14 flex flex-col items-center gap-2 text-center'>
                <FileQuestion size={30} className='text-slate-300' />
                <p className='text-sm font-black text-slate-600'>No quizzes yet</p>
                <p className='text-[11px] font-bold text-slate-400 max-w-[220px]'>
                  Create your first quiz to start assessing your students.
                </p>
                {canCreate && (
                  <button
                    onClick={() => setShowBuilder(true)}
                    className='mt-2 flex items-center gap-1.5 h-9 px-4 bg-[#002EFF] text-white rounded-xl font-black text-[10px] uppercase tracking-wide hover:bg-blue-700'
                  >
                    <Plus size={14} /> Create New Quiz
                  </button>
                )}
              </div>
            ) : list.length === 0 ? (
              <div className='py-14 flex flex-col items-center gap-2 text-center'>
                <Search size={26} className='text-slate-300' />
                <p className='text-sm font-black text-slate-600'>No quizzes found</p>
                <p className='text-[11px] font-bold text-slate-400'>
                  Nothing matches your search or filter.
                </p>
                <button
                  onClick={() => { setSearch(''); setStatusFilter('all'); setPage(1) }}
                  className='mt-1 text-[10px] font-black uppercase text-[#002EFF] hover:underline'
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className='space-y-2'>
                {paged.map((q) => {
                  const id = str(q.id ?? q._id)
                  const code = str(q.accessCode)
                  const subjects = Array.isArray(q.subjects) ? q.subjects.length : 0
                  const open = openAttempts === id
                  return (
                    <div key={id} className='space-y-2'>
                      <Card className='p-3.5 rounded-2xl border border-slate-100/80 shadow-sm bg-white transition-all hover:shadow-md hover:border-[#002EFF]/20'>
                        <div className='flex flex-wrap items-center gap-3'>
                          {/* Quiz info */}
                          <div className='min-w-0 flex-1'>
                            <div className='flex items-center gap-2'>
                              <p className='text-sm font-black text-gray-800 truncate'>
                                {str(q.title)}
                              </p>
                              <StatusBadge live={Boolean(q.isActive)} />
                            </div>
                            <p className='text-[10px] font-bold text-slate-400 mt-0.5 flex items-center flex-wrap gap-x-1.5'>
                              <span className='text-[#002EFF]'>
                                {audienceLabel(
                                  (q.track as string) ?? null,
                                  (q.department as string) ?? null,
                                )}
                              </span>
                              · {subjects} subject{subjects === 1 ? '' : 's'}
                              · {str(q.totalMarks) || 0} marks
                              {code && (
                                <button
                                  onClick={() => navigator.clipboard?.writeText(code)}
                                  className='inline-flex items-center gap-1 text-[#002EFF] hover:underline'
                                  title='Copy access code'
                                >
                                  <Copy size={9} /> {code}
                                </button>
                              )}
                            </p>
                          </div>
                          {/* Actions */}
                          <div className='flex items-center gap-1.5 shrink-0'>
                            <button
                              onClick={() => setOpenAttempts((cur) => (cur === id ? null : id))}
                              className={`flex items-center gap-1 px-2.5 h-8 rounded-lg text-[10px] font-black uppercase ${
                                open ? 'bg-[#002EFF] text-white' : 'bg-blue-50 text-[#002EFF] hover:bg-blue-100'
                              }`}
                              title='View attempts, leaderboard & manage results'
                            >
                              <Users size={11} /> Attempts
                            </button>
                            <button
                              onClick={() => startEdit(q)}
                              className='flex items-center gap-1 px-2.5 h-8 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-500 hover:text-[#002EFF]'
                              title='Edit quiz details'
                            >
                              <Pencil size={11} /> Edit
                            </button>
                            <button
                              onClick={() => toggleStatus(q)}
                              className='flex items-center gap-1 px-2.5 h-8 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-500 hover:text-[#002EFF]'
                              title={q.isActive ? 'Unpublish (make draft)' : 'Publish (go live)'}
                            >
                              <Power size={11} /> {q.isActive ? 'Unpublish' : 'Publish'}
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => removeQuiz(id, q)}
                                className='p-1.5 text-slate-300 hover:text-rose-500'
                                title='Delete quiz'
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </Card>
                      {open && (
                        <AttemptsPanel
                          quizId={id}
                          quizTitle={str(q.title)}
                          token={token}
                        />
                      )}
                    </div>
                  )
                })}

                {/* Pagination */}
                {pageCount > 1 && (
                  <div className='flex items-center justify-between pt-2'>
                    <span className='text-[10px] font-bold text-slate-400'>
                      Showing {(safePage - 1) * PAGE_SIZE + 1}–
                      {Math.min(safePage * PAGE_SIZE, list.length)} of {list.length}
                    </span>
                    <div className='flex items-center gap-1'>
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className='h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-40 hover:border-[#002EFF]/40'
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span className='text-[11px] font-black text-slate-600 px-2 tabular-nums'>
                        {safePage} / {pageCount}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        disabled={safePage >= pageCount}
                        className='h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-40 hover:border-[#002EFF]/40'
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </>
            )}
          </div>
        )
      })()}

      {confirmDialog}
    </div>
  )
}

/** Compact summary tile for the quizzes dashboard. */
function StatCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string
  value: number | string
  icon: ComponentType<{ size?: number; className?: string }>
  tint: string
}) {
  return (
    <Card className='p-3 rounded-2xl border-none shadow-sm bg-white flex items-center gap-2.5 transition-shadow hover:shadow-md'>
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
        <Icon size={16} />
      </div>
      <div className='min-w-0'>
        <p className='text-xl font-black text-slate-900 leading-none tabular-nums'>{value}</p>
        <p className='text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1 truncate'>
          {label}
        </p>
      </div>
    </Card>
  )
}

/** Search + multi-select roster for assigning a quiz to specific students. */
function StudentPicker({
  all,
  selected,
  onToggle,
  onClear,
  search,
  setSearch,
}: {
  all: { id: string; name: string; email?: string }[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
  search: string
  setSearch: (v: string) => void
}) {
  const term = search.trim().toLowerCase()
  const filtered = term
    ? all.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          (s.email ?? '').toLowerCase().includes(term),
      )
    : all
  const nameFor = (id: string) => all.find((s) => s.id === id)?.name ?? 'Student'

  return (
    <div className='space-y-2'>
      <div className='relative'>
        <Search size={13} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400' />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search students by name or email…'
          className='w-full h-9 pl-8 pr-3 rounded-lg bg-white border border-slate-200 outline-none text-[12px] font-medium'
        />
      </div>

      {selected.length > 0 && (
        <div className='flex flex-wrap items-center gap-1.5'>
          {selected.map((id) => (
            <span
              key={id}
              className='inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-blue-50 text-[#002EFF] text-[10px] font-bold'
            >
              {nameFor(id)}
              <button
                type='button'
                onClick={() => onToggle(id)}
                className='hover:text-rose-600'
                title='Remove'
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            type='button'
            onClick={onClear}
            className='text-[9px] font-black uppercase text-slate-400 hover:text-rose-500 ml-1'
          >
            Clear
          </button>
        </div>
      )}

      <div className='max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-50'>
        {all.length === 0 ? (
          <p className='text-[11px] font-bold text-slate-400 px-3 py-3'>
            No students found.
          </p>
        ) : filtered.length === 0 ? (
          <p className='text-[11px] font-bold text-slate-400 px-3 py-3'>
            No match for “{search}”.
          </p>
        ) : (
          filtered.map((s) => {
            const on = selected.includes(s.id)
            return (
              <button
                type='button'
                key={s.id}
                onClick={() => onToggle(s.id)}
                className='w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50'
              >
                <span
                  className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border ${
                    on
                      ? 'bg-[#002EFF] border-[#002EFF] text-white'
                      : 'border-slate-300'
                  }`}
                >
                  {on && <Check size={11} />}
                </span>
                <span className='min-w-0'>
                  <span className='block text-[12px] font-black text-slate-700 truncate'>
                    {s.name}
                  </span>
                  {s.email && (
                    <span className='block text-[9px] font-bold text-slate-400 truncate'>
                      {s.email}
                    </span>
                  )}
                </span>
              </button>
            )
          })
        )}
      </div>
      <p className='text-[10px] font-bold text-slate-400'>
        {selected.length} student{selected.length === 1 ? '' : 's'} assigned — only
        they will see this quiz.
      </p>
    </div>
  )
}

/** Live / Draft status badge — information, not an action. */
function StatusBadge({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide shrink-0 ${
        live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
      }`}
    >
      <Circle size={7} className='fill-current' /> {live ? 'Live' : 'Draft'}
    </span>
  )
}

/** Admin panel: who took a quiz, the leaderboard, and per-attempt controls.
 *  Live-first — degrades to an empty/"not available" state until the backend
 *  ships the attempts routes (docs/backend-requests-2026-09-02.md §6). */
interface ConfirmRequest {
  title: string
  /** What actually happens, in plain words — including who it affects. */
  body: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

/**
 * A confirm step for anything that can't be undone. Returns the asker and the
 * dialog to drop into the tree; nothing renders until something is asked.
 */
function useConfirm(): [(req: ConfirmRequest) => void, React.ReactNode] {
  const [req, setReq] = useState<ConfirmRequest | null>(null)
  const [busy, setBusy] = useState(false)

  const close = useCallback(() => {
    setReq(null)
    setBusy(false)
  }, [])

  useEffect(() => {
    if (!req) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [req, close])

  const node = req ? (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <button
        aria-label='Cancel'
        onClick={close}
        className='absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] cursor-default'
      />
      <Card
        role='alertdialog'
        aria-modal='true'
        className='relative w-full max-w-sm p-5 rounded-3xl border-none shadow-xl bg-white space-y-3'
      >
        <div className='flex items-start gap-3'>
          <span className='h-10 w-10 shrink-0 rounded-2xl bg-rose-50 text-rose-500 grid place-items-center'>
            <AlertTriangle size={18} />
          </span>
          <div className='min-w-0'>
            <p className='text-sm font-black text-slate-800'>{req.title}</p>
            <p className='text-[11px] font-medium text-slate-500 mt-1 leading-relaxed'>
              {req.body}
            </p>
          </div>
        </div>
        <div className='flex items-center justify-end gap-2 pt-1'>
          <button
            autoFocus
            onClick={close}
            disabled={busy}
            className='h-9 px-3 rounded-xl bg-slate-100 text-slate-500 font-black text-[11px] uppercase tracking-wide hover:text-slate-700 disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setBusy(true)
              try {
                await req.onConfirm()
              } finally {
                close()
              }
            }}
            disabled={busy}
            className='flex items-center gap-2 h-9 px-4 rounded-xl bg-rose-500 text-white font-black text-[11px] uppercase tracking-wide hover:bg-rose-600 active:scale-[0.98] disabled:opacity-50'
          >
            {busy && <Loader2 size={13} className='animate-spin' />}
            {req.confirmLabel}
          </button>
        </div>
      </Card>
    </div>
  ) : null

  return [setReq, node]
}

/**
 * Every submission across every quiz, in one place — so "who sat anything this
 * week" doesn't mean opening each quiz in turn.
 */
function AllAttempts({
  quizzes,
  token,
  onOpenQuiz,
}: {
  quizzes: Record<string, unknown>[]
  token?: string
  onOpenQuiz: (quizId: string) => void
}) {
  interface Row {
    key: string
    quizId: string
    quizTitle: string
    name: string
    contact: string
    pct: number
    score: string
    at: number
    free: boolean
    withdrawn: boolean
  }
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [quizFilter, setQuizFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [band, setBand] = useState<'all' | 'low' | 'mid' | 'high'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'best' | 'worst'>('recent')

  const pct = (r: Record<string, unknown>) => {
    const p = Number(r.percentage)
    if (!isNaN(p) && r.percentage != null)
      return p <= 1 ? Math.round(p * 100) : Math.round(p)
    const s = Number(r.score ?? r.totalScore)
    const t = Number(r.totalMarks ?? r.total)
    return t > 0 ? Math.round((s / t) * 100) : 0
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const collected: Row[] = []
      await Promise.all(
        quizzes.map(async (q) => {
          const quizId = str(q.id ?? q._id)
          const quizTitle = str(q.title)
          const [portal, free] = await Promise.allSettled([
            dsaApi.quizzes.attempts(quizId, token) as Promise<
              Record<string, unknown>[]
            >,
            dsaApi.quizzes.publicResults(quizId, token) as Promise<
              Record<string, unknown>[]
            >,
          ])
          if (portal.status === 'fulfilled' && Array.isArray(portal.value))
            portal.value.forEach((r, i) =>
              collected.push({
                key: `${quizId}-p-${str(r.attemptId ?? r.id ?? r._id) || i}`,
                quizId,
                quizTitle,
                name: str(
                  r.studentName ?? r.fullname ?? r.username ?? 'Student',
                ),
                contact: str(r.email ?? ''),
                pct: pct(r),
                score: `${str(r.score ?? r.totalScore)}/${str(r.totalMarks ?? r.total)}`,
                at: new Date(str(r.submittedAt ?? r.createdAt)).getTime() || 0,
                free: false,
                withdrawn: !!r.withdrawn,
              }),
            )
          if (free.status === 'fulfilled' && Array.isArray(free.value))
            free.value.forEach((r, i) =>
              collected.push({
                key: `${quizId}-f-${str(r.id ?? r._id ?? r.email) || i}`,
                quizId,
                quizTitle,
                name: str(r.name ?? 'Anonymous'),
                contact: str(r.email ?? r.phone ?? ''),
                pct: pct(r),
                score: `${str(r.score ?? r.totalScore)}/${str(r.totalMarks ?? r.total)}`,
                at: new Date(str(r.submittedAt ?? r.createdAt)).getTime() || 0,
                free: true,
                withdrawn: false,
              }),
            )
        }),
      )
      if (!cancelled) {
        setRows(collected)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [quizzes, token])

  const term = search.trim().toLowerCase()
  const shown = rows
    .filter((r) => {
      if (quizFilter !== 'all' && r.quizId !== quizFilter) return false
      if (band === 'low' && r.pct >= 40) return false
      if (band === 'mid' && (r.pct < 40 || r.pct >= 60)) return false
      if (band === 'high' && r.pct < 60) return false
      if (!term) return true
      return `${r.name} ${r.contact} ${r.quizTitle}`.toLowerCase().includes(term)
    })
    .sort((a, b) =>
      sortBy === 'best'
        ? b.pct - a.pct
        : sortBy === 'worst'
          ? a.pct - b.pct
          : b.at - a.at,
    )

  if (loading)
    return (
      <div className='py-10 flex justify-center'>
        <Loader2 className='animate-spin text-[#002EFF]' size={20} />
      </div>
    )

  return (
    <div className='space-y-3'>
      <div className='flex flex-col sm:flex-row gap-2'>
        <div className='relative flex-1'>
          <Search
            size={14}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search student, email or quiz…'
            className='w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-slate-200 focus:border-[#002EFF]/40 outline-none text-sm font-medium'
          />
        </div>
        <select
          value={quizFilter}
          onChange={(e) => setQuizFilter(e.target.value)}
          className='h-10 px-3 rounded-xl bg-white border border-slate-200 outline-none text-[12px] font-bold max-w-[190px]'
        >
          <option value='all'>Every quiz</option>
          {quizzes.map((q) => (
            <option key={str(q.id ?? q._id)} value={str(q.id ?? q._id)}>
              {str(q.title)}
            </option>
          ))}
        </select>
        <select
          value={band}
          onChange={(e) =>
            setBand(e.target.value as 'all' | 'low' | 'mid' | 'high')
          }
          className='h-10 px-3 rounded-xl bg-white border border-slate-200 outline-none text-[12px] font-bold'
        >
          <option value='all'>Any score</option>
          <option value='low'>Below 40%</option>
          <option value='mid'>40–59%</option>
          <option value='high'>60% and up</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as 'recent' | 'best' | 'worst')
          }
          className='h-10 px-3 rounded-xl bg-white border border-slate-200 outline-none text-[12px] font-bold'
        >
          <option value='recent'>Most recent</option>
          <option value='best'>Highest score</option>
          <option value='worst'>Lowest score</option>
        </select>
      </div>

      <p className='text-[10px] font-black uppercase tracking-widest text-slate-400'>
        {shown.length} submission{shown.length === 1 ? '' : 's'}
        {shown.length !== rows.length ? ` of ${rows.length}` : ''}
      </p>

      {shown.length === 0 ? (
        <Card className='p-8 rounded-2xl border-none shadow-sm bg-white text-center'>
          <p className='text-sm font-bold text-slate-500'>
            {rows.length
              ? 'Nothing matches those filters.'
              : 'No one has submitted a quiz yet.'}
          </p>
        </Card>
      ) : (
        <div className='space-y-1.5'>
          {shown.map((r) => (
            <Card
              key={r.key}
              className={`p-3 rounded-2xl border border-slate-100/80 shadow-sm bg-white flex items-center gap-3 ${
                r.withdrawn ? 'opacity-50' : ''
              }`}
            >
              <span
                className={`h-9 w-11 shrink-0 rounded-xl grid place-items-center text-[12px] font-black tabular-nums ${
                  r.pct >= 60
                    ? 'bg-emerald-50 text-emerald-600'
                    : r.pct >= 40
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-rose-50 text-rose-500'
                }`}
              >
                {r.pct}%
              </span>
              <div className='min-w-0 flex-1'>
                <p className='text-[12px] font-black text-slate-800 truncate'>
                  {r.name}
                  {r.free && (
                    <span className='ml-1.5 text-[8px] font-black uppercase bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded'>
                      Link
                    </span>
                  )}
                  {r.withdrawn && (
                    <span className='ml-1.5 text-[8px] font-black uppercase text-rose-500'>
                      withdrawn
                    </span>
                  )}
                </p>
                <p className='text-[10px] font-bold text-slate-400 truncate'>
                  {r.quizTitle} · {r.score}
                  {r.at ? ` · ${new Date(r.at).toLocaleDateString()}` : ''}
                  {r.contact ? ` · ${r.contact}` : ''}
                </p>
              </div>
              <button
                onClick={() => onOpenQuiz(r.quizId)}
                className='shrink-0 px-2.5 h-8 rounded-lg bg-blue-50 text-[#002EFF] text-[9px] font-black uppercase hover:bg-blue-100'
                title='Open this quiz to read the paper or manage the result'
              >
                Open quiz
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/** Everything about one question that a marked paper needs to show. */
interface QMapEntry {
  subject: string
  body: string
  options: string[]
  correctIndex: number | null
  explanation?: string
  imageUrl?: string | null
  marks: number
}

function AttemptsPanel({
  quizId,
  quizTitle,
  token,
}: {
  quizId: string
  quizTitle?: string
  token?: string
}) {
  const [attempts, setAttempts] = useState<Record<string, unknown>[]>([])
  // Attempts on a FREE/public quiz — anonymous takers via the shareable link.
  const [publicAttempts, setPublicAttempts] = useState<Record<string, unknown>[]>([])
  const [board, setBoard] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(true)
  // Per-student score breakdown (View button).
  const [openDetail, setOpenDetail] = useState<string | null>(null)
  const [resultsById, setResultsById] = useState<
    Record<string, Record<string, unknown>>
  >({})
  const [questionMap, setQuestionMap] = useState<Record<string, QMapEntry>>({})
  // The attempt whose paper is open, answer by answer.
  const [paperOf, setPaperOf] = useState<{ id: string; name: string } | null>(
    null,
  )
  // 'attempts' lists who took it; 'analytics' is the cohort view.
  const [tab, setTab] = useState<'attempts' | 'analytics'>('attempts')
  const [askConfirm, confirmDialog] = useConfirm()
  const [detailLoading, setDetailLoading] = useState(false)
  // Which public (free-quiz) taker's breakdown is expanded.
  const [openPublic, setOpenPublic] = useState<string | null>(null)
  const [rescoring, setRescoring] = useState(false)
  const [rescoreMsg, setRescoreMsg] = useState<string | null>(null)
  // Why a delete / withdraw did not happen. These used to fail in silence: the
  // dialog closed, the row stayed, and the admin was left to wonder.
  const [actionError, setActionError] = useState<string | null>(null)
  const failed = (what: string, e: unknown) => {
    const why = e instanceof Error ? e.message : ''
    setActionError(
      /not found|404|cannot (delete|patch|post)/i.test(why)
        ? `${what} The server does not have this feature yet — the backend update is still waiting to be merged.`
        : `${what} ${why || 'Check your connection and try again.'}`,
    )
  }

  // Load the per-question results + the quiz's question→subject map, once.
  const loadDetailData = useCallback(async () => {
    if (Object.keys(resultsById).length) return
    setDetailLoading(true)
    try {
      const [results, quiz] = await Promise.all([
        dsaApi.quizzes.results(quizId, token) as Promise<
          Record<string, unknown>[]
        >,
        dsaApi.quizzes.get(quizId, token) as Promise<Record<string, unknown>>,
      ])
      const byId: Record<string, Record<string, unknown>> = {}
      results.forEach((r) => {
        byId[str(r.id ?? r._id)] = r
      })
      setResultsById(byId)
      const qmap: Record<string, QMapEntry> = {}
      const subjects = Array.isArray(quiz?.subjects) ? quiz.subjects : []
      subjects.forEach((s: Record<string, unknown>) => {
        const qs = Array.isArray(s.questions) ? s.questions : []
        qs.forEach((q: Record<string, unknown>) => {
          const correct = Number(q.correctAnswer)
          qmap[str(q._id ?? q.id)] = {
            subject: str(s.name || 'General'),
            body: str(q.body ?? q.questionText ?? q.question),
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            correctIndex: isNaN(correct) ? null : correct,
            explanation: q.explanation ? str(q.explanation) : undefined,
            imageUrl: q.imageUrl ? str(q.imageUrl) : null,
            marks: Number(q.marks ?? q.mark) || 1,
          }
        })
      })
      setQuestionMap(qmap)
    } catch {
      /* results endpoint unavailable — the detail just won't populate */
    } finally {
      setDetailLoading(false)
    }
  }, [quizId, token, resultsById])

  const openStudent = (aid: string) => {
    if (openDetail === aid) {
      setOpenDetail(null)
      return
    }
    setOpenDetail(aid)
    loadDetailData()
  }

  // Compute a student's per-subject correct/total from their stored answers.
  const breakdownFor = (aid: string) => {
    const result = resultsById[aid]
    const answers = Array.isArray(result?.answers)
      ? (result!.answers as Record<string, unknown>[])
      : []
    if (!answers.length) return null
    const bySubject: Record<string, { correct: number; total: number }> = {}
    answers.forEach((a) => {
      const subj = questionMap[str(a.questionId)]?.subject || 'General'
      if (!bySubject[subj]) bySubject[subj] = { correct: 0, total: 0 }
      bySubject[subj].total += 1
      if (a.isCorrect) bySubject[subj].correct += 1
    })
    const correct = answers.filter((a) => a.isCorrect).length
    return { bySubject, correct, total: answers.length, answers }
  }

  // Per-subject breakdown for a public (free-quiz) taker, from their stored
  // answers joined onto the quiz's question→subject map.
  const publicBreakdownFor = (r: Record<string, unknown>) => {
    const answers = Array.isArray(r.answers)
      ? (r.answers as Record<string, unknown>[])
      : []
    if (!answers.length) return null
    const bySubject: Record<string, { correct: number; total: number }> = {}
    answers.forEach((a) => {
      const subj = questionMap[str(a.questionId)]?.subject || 'General'
      if (!bySubject[subj]) bySubject[subj] = { correct: 0, total: 0 }
      bySubject[subj].total += 1
      if (a.isCorrect) bySubject[subj].correct += 1
    })
    const correct = answers.filter((a) => a.isCorrect).length
    return { bySubject, correct, total: answers.length }
  }

  /**
   * Shape one attempt into the same structure the student corrections screen
   * takes, so an admin reads the paper exactly as the student would.
   */
  const paperFor = (row: Record<string, unknown>): CorrectionsData | null => {
    const answers = Array.isArray(row.answers)
      ? (row.answers as Record<string, unknown>[])
      : []
    if (!answers.length) return null
    const perSubject: Record<
      string,
      { earned: number; total: number; correct: number; count: number }
    > = {}
    const questions = answers.map((a) => {
      const q = questionMap[str(a.questionId)]
      const subject = q?.subject || 'General'
      const marks = q?.marks ?? 1
      const earned = Number(a.marksEarned) || (a.isCorrect ? marks : 0)
      if (!perSubject[subject])
        perSubject[subject] = { earned: 0, total: 0, correct: 0, count: 0 }
      perSubject[subject].earned += earned
      perSubject[subject].total += marks
      perSubject[subject].count += 1
      if (a.isCorrect) perSubject[subject].correct += 1
      return {
        questionId: str(a.questionId),
        subject,
        questionText: q?.body || 'Question no longer in this quiz',
        imageUrl: q?.imageUrl ?? null,
        options: q?.options ?? [],
        correctIndex: q?.correctIndex ?? null,
        selectedIndex:
          typeof a.selectedOption === 'number' ? a.selectedOption : null,
        isCorrect: !!a.isCorrect,
        marks,
        marksEarned: earned,
        explanation: q?.explanation,
      }
    })
    return {
      quizTitle,
      totalScore: Number(row.totalScore ?? row.score) || 0,
      totalMarks: Number(row.totalMarks ?? row.total) || 0,
      percentage: pctOf(row),
      perSubject: Object.entries(perSubject).map(([subject, v]) => ({
        subject,
        ...v,
        percentage: v.count ? (v.correct / v.count) * 100 : 0,
      })),
      questions,
    }
  }

  const openPaper = (id: string, name: string) => {
    setPaperOf({ id, name })
    loadDetailData()
  }

  const openPublicTaker = (id: string) => {
    if (openPublic === id) {
      setOpenPublic(null)
      return
    }
    setOpenPublic(id)
    loadDetailData() // ensures the question→subject map is loaded
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [a, b, p] = await Promise.allSettled([
      dsaApi.quizzes.attempts(quizId, token) as Promise<Record<string, unknown>[]>,
      dsaApi.quizzes.getLeaderboard(quizId, token) as unknown as Promise<
        Record<string, unknown>[]
      >,
      dsaApi.quizzes.publicResults(quizId, token) as Promise<
        Record<string, unknown>[]
      >,
    ])
    setAttempts(a.status === 'fulfilled' && Array.isArray(a.value) ? a.value : [])
    setBoard(b.status === 'fulfilled' && Array.isArray(b.value) ? b.value : [])
    setPublicAttempts(
      p.status === 'fulfilled' && Array.isArray(p.value) ? p.value : [],
    )
    // If the attempts route isn't live yet, flag it so we show a hint.
    setReady(a.status === 'fulfilled')
    setLoading(false)
  }, [quizId, token])

  useEffect(() => {
    load()
  }, [load])

  const rowId = (r: Record<string, unknown>) =>
    str(r.attemptId ?? r.id ?? r._id)

  const del = (aid: string, name: string) =>
    askConfirm({
      title: `Delete ${name}’s attempt?`,
      body: 'The score and every answer they gave are removed for good. Withdraw it instead to void the score but keep the record.',
      confirmLabel: 'Delete attempt',
      onConfirm: async () => {
        try {
          setActionError(null)
          await dsaApi.quizzes.deleteAttempt(quizId, aid, token)
          setAttempts((prev) => prev.filter((r) => rowId(r) !== aid))
        } catch (e) {
          failed(`${name}’s attempt was not deleted.`, e)
        }
      },
    })

  const withdraw = (aid: string, name: string) =>
    askConfirm({
      title: `Withdraw ${name}’s result?`,
      body: 'The score stops counting and leaves the leaderboard, and they get an attempt back. The record itself is kept.',
      confirmLabel: 'Withdraw',
      onConfirm: async () => {
        try {
          await dsaApi.quizzes.withdrawAttempt(quizId, aid, token)
          setAttempts((prev) =>
            prev.map((r) => (rowId(r) === aid ? { ...r, withdrawn: true } : r)),
          )
        } catch (e) {
          failed(`${name}’s result was not withdrawn.`, e)
        }
      },
    })

  const pctOf = (r: Record<string, unknown>) => {
    const p = Number(r.percentage)
    if (!isNaN(p) && r.percentage != null) return p <= 1 ? Math.round(p * 100) : Math.round(p)
    const s = Number(r.score ?? r.totalScore)
    const t = Number(r.totalMarks ?? r.total)
    return t > 0 ? Math.round((s / t) * 100) : 0
  }

  // Cohort analytics — how the whole group did, not one student. Scores come
  // from the attempt rows; the subject and question detail needs the stored
  // answers, which only load once the Analytics tab is opened.
  const analytics = useMemo(() => {
    const scored = [
      ...attempts.filter((r) => !r.withdrawn),
      ...publicAttempts,
    ].map(pctOf)
    const answered: Record<string, unknown>[][] = [
      ...Object.values(resultsById),
      ...publicAttempts,
    ]
      .map((r) =>
        Array.isArray(r.answers) ? (r.answers as Record<string, unknown>[]) : [],
      )
      .filter((a) => a.length > 0)

    const bySubject: Record<string, { correct: number; total: number }> = {}
    const byQuestion: Record<string, { wrong: number; asked: number }> = {}
    answered.forEach((answers) => {
      answers.forEach((a) => {
        const qid = str(a.questionId)
        const subj = questionMap[qid]?.subject || 'General'
        if (!bySubject[subj]) bySubject[subj] = { correct: 0, total: 0 }
        bySubject[subj].total += 1
        if (a.isCorrect) bySubject[subj].correct += 1
        if (!byQuestion[qid]) byQuestion[qid] = { wrong: 0, asked: 0 }
        byQuestion[qid].asked += 1
        if (!a.isCorrect) byQuestion[qid].wrong += 1
      })
    })

    const bucket = (from: number, to: number) =>
      scored.filter((p) => p >= from && p <= to).length

    return {
      takers: scored.length,
      graded: answered.length,
      avg: scored.length
        ? Math.round(scored.reduce((s, p) => s + p, 0) / scored.length)
        : 0,
      best: scored.length ? Math.max(...scored) : 0,
      worst: scored.length ? Math.min(...scored) : 0,
      below40: scored.filter((p) => p < 40).length,
      buckets: [
        { label: '0–39%', count: bucket(0, 39), tone: 'bg-rose-400' },
        { label: '40–59%', count: bucket(40, 59), tone: 'bg-amber-400' },
        { label: '60–79%', count: bucket(60, 79), tone: 'bg-sky-400' },
        { label: '80–100%', count: bucket(80, 100), tone: 'bg-emerald-500' },
      ],
      subjects: Object.entries(bySubject)
        .map(([name, v]) => ({
          name,
          ...v,
          pct: v.total ? Math.round((v.correct / v.total) * 100) : 0,
        }))
        .sort((a, b) => a.pct - b.pct),
      missed: Object.entries(byQuestion)
        .map(([id, v]) => ({
          id,
          ...v,
          rate: v.asked ? Math.round((v.wrong / v.asked) * 100) : 0,
          body: questionMap[id]?.body || 'Question',
          subject: questionMap[id]?.subject || 'General',
        }))
        .filter((q) => q.wrong > 0)
        .sort((a, b) => b.rate - a.rate || b.wrong - a.wrong)
        .slice(0, 6),
    }
  }, [attempts, publicAttempts, resultsById, questionMap])

  const confirmRescore = () =>
    askConfirm({
      title: 'Re-grade every submission?',
      body: `All ${attempts.length + publicAttempts.length} result${
        attempts.length + publicAttempts.length === 1 ? '' : 's'
      } are marked again against the current correct answers. Scores can go up or down, and students see the new ones.`,
      confirmLabel: 'Rescore',
      onConfirm: doRescore,
    })

  const doRescore = async () => {
    setRescoring(true)
    setRescoreMsg(null)
    try {
      const res = (await dsaApi.quizzes.rescore(quizId, token)) as {
        updated?: number
        synced?: { answers?: number; images?: number; explanations?: number }
      }
      const pulled = [
        [res?.synced?.answers, 'corrected answer'],
        [res?.synced?.images, 'image'],
        [res?.synced?.explanations, 'explanation'],
      ]
        .filter(([n]) => Number(n) > 0)
        .map(([n, label]) => `${n} ${label}${Number(n) === 1 ? '' : 's'}`)
      setRescoreMsg(
        `Re-graded ${res?.updated ?? 0} result${res?.updated === 1 ? '' : 's'}` +
          (pulled.length
            ? `, after bringing in ${pulled.join(', ')} from the question bank.`
            : ' against the current answers. Nothing new was found in the question bank.'),
      )
      await load()
    } catch (e) {
      setRescoreMsg(
        e instanceof Error ? e.message : 'Could not rescore right now.',
      )
    } finally {
      setRescoring(false)
    }
  }

  // One student's marked paper takes over the panel until it's closed.
  if (paperOf) {
    const row =
      resultsById[paperOf.id] ??
      publicAttempts.find((r) => str(r.id ?? r._id ?? r.email) === paperOf.id)
    const paper = row ? paperFor(row) : null
    return (
      <Card className='p-4 rounded-2xl border-none shadow-sm bg-slate-50/70'>
        {detailLoading && !paper ? (
          <div className='py-6 flex justify-center'>
            <Loader2 className='animate-spin text-[#002EFF]' size={18} />
          </div>
        ) : paper ? (
          <QuizCorrections
            data={paper}
            who={paperOf.name}
            onBack={() => setPaperOf(null)}
          />
        ) : (
          <div className='py-4 text-center space-y-2'>
            <p className='text-[11px] font-bold text-slate-400'>
              This attempt has no stored answers, so there is no paper to read.
            </p>
            <button
              onClick={() => setPaperOf(null)}
              className='text-[10px] font-black uppercase text-[#002EFF] hover:underline'
            >
              Back to attempts
            </button>
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card className='p-4 rounded-2xl border-none shadow-sm bg-slate-50/70 space-y-3'>
      {loading ? (
        <div className='py-4 flex justify-center'>
          <Loader2 className='animate-spin text-[#002EFF]' size={16} />
        </div>
      ) : (
        <>
          <div className='flex items-center justify-between gap-2'>
            <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
              {attempts.length + publicAttempts.length}{' '}
              {attempts.length + publicAttempts.length === 1 ? 'person' : 'people'}{' '}
              took this quiz
            </p>
            {attempts.length + publicAttempts.length > 0 && (
              <button
                onClick={confirmRescore}
                disabled={rescoring}
                title='Re-grade all submissions against the current correct answers (use after fixing an answer)'
                className='shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white text-[#002EFF] font-black text-[9px] uppercase tracking-wide hover:bg-blue-50 disabled:opacity-50'
              >
                {rescoring ? (
                  <Loader2 size={11} className='animate-spin' />
                ) : (
                  <RotateCcw size={11} />
                )}
                Rescore
              </button>
            )}
          </div>
          {rescoreMsg && (
            <p className='text-[10px] font-bold text-emerald-600'>{rescoreMsg}</p>
          )}
          {actionError && (
            <p
              role='alert'
              className='rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-[11px] font-bold text-rose-600'
            >
              {actionError}
            </p>
          )}

          {/* Attempts vs the cohort view */}
          <div className='flex items-center gap-1 p-1 rounded-xl bg-white w-fit'>
            {(['attempts', 'analytics'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t)
                  if (t === 'analytics') loadDetailData()
                }}
                className={`px-3 h-7 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors ${
                  tab === t
                    ? 'bg-[#002EFF] text-white'
                    : 'text-slate-400 hover:text-[#002EFF]'
                }`}
              >
                {t === 'attempts' ? 'Attempts' : 'Analytics'}
              </button>
            ))}
          </div>

          {tab === 'analytics' ? (
            <AnalyticsView data={analytics} loading={detailLoading} />
          ) : (
          <>
          {board.length > 0 && (
            <QuizLeaderboard
              entries={board as unknown as LeaderboardRow[]}
              subtitle='Top scores on this quiz'
            />
          )}

          {publicAttempts.length > 0 && (
            <div>
              <p className='text-[9px] font-black uppercase text-slate-400 mb-1'>
                Public quiz takers ({publicAttempts.length})
              </p>
              <div className='space-y-1.5'>
                {publicAttempts.map((r) => {
                  const id = str(r.id ?? r._id ?? r.email)
                  const isOpen = openPublic === id
                  const hasAnswers =
                    Array.isArray(r.answers) && (r.answers as unknown[]).length > 0
                  const bd = isOpen ? publicBreakdownFor(r) : null
                  return (
                    <div
                      key={id}
                      className='rounded-xl bg-white overflow-hidden'
                    >
                      <div className='px-3 py-2 flex items-center gap-2'>
                        <div className='min-w-0 flex-1'>
                          <p className='text-[12px] font-black text-slate-800 truncate'>
                            {str(r.name ?? 'Anonymous')}
                          </p>
                          <p className='text-[10px] font-medium text-slate-400 truncate'>
                            {str(r.email ?? '')}
                            {r.phone ? ` · ${str(r.phone)}` : ''}
                          </p>
                        </div>
                        <span className='text-[11px] font-black text-[#002EFF] shrink-0'>
                          {pctOf(r)}%
                        </span>
                        {hasAnswers && (
                          <>
                            <button
                              onClick={() => openPublicTaker(id)}
                              className='shrink-0 text-[9px] font-black uppercase text-[#002EFF] hover:underline'
                            >
                              {isOpen ? 'Hide' : 'View'}
                            </button>
                            <button
                              onClick={() =>
                                openPaper(id, str(r.name ?? 'Anonymous'))
                              }
                              className='shrink-0 text-[9px] font-black uppercase text-slate-400 hover:text-[#002EFF] hover:underline'
                              title='Read the marked paper'
                            >
                              Paper
                            </button>
                          </>
                        )}
                        <button
                          onClick={() =>
                            askConfirm({
                              title: `Delete ${str(r.name ?? 'this')}’s attempt?`,
                              body: 'Their score and every answer they gave are removed for good. This was a public-link attempt, so there is no account to withdraw it from.',
                              confirmLabel: 'Delete attempt',
                              onConfirm: async () => {
                                try {
                                  setActionError(null)
                                  await dsaApi.quizzes.deletePublicAttempt(quizId, id, token)
                                  setPublicAttempts((prev) =>
                                    prev.filter((x) => str(x.id ?? x._id ?? x.email) !== id),
                                  )
                                } catch (e) {
                                  failed('That attempt was not deleted.', e)
                                }
                              },
                            })
                          }
                          className='shrink-0 p-1 text-slate-300 hover:text-rose-500'
                          title='Delete this attempt'
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {isOpen && (
                        <div className='px-3 pb-3 pt-1 bg-slate-50 space-y-2'>
                          {detailLoading && !bd ? (
                            <div className='py-2 flex justify-center'>
                              <Loader2
                                className='animate-spin text-[#002EFF]'
                                size={14}
                              />
                            </div>
                          ) : bd ? (
                            <>
                              <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
                                {bd.correct}/{bd.total} correct
                              </p>
                              {Object.entries(bd.bySubject).map(([subj, v]) => {
                                const sp = v.total
                                  ? Math.round((v.correct / v.total) * 100)
                                  : 0
                                return (
                                  <div key={subj}>
                                    <div className='flex items-center justify-between text-[10px] font-bold'>
                                      <span className='text-slate-600'>{subj}</span>
                                      <span className='text-slate-400'>
                                        {v.correct}/{v.total} · {sp}%
                                      </span>
                                    </div>
                                    <div className='h-1.5 bg-slate-200 rounded-full overflow-hidden'>
                                      <div
                                        className={`h-full rounded-full ${sp >= 50 ? 'bg-emerald-500' : 'bg-rose-400'}`}
                                        style={{ width: `${sp}%` }}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </>
                          ) : (
                            <p className='text-[10px] font-bold text-slate-400'>
                              No per-question detail for this attempt.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {attempts.length === 0 && publicAttempts.length === 0 ? (
            <p className='text-[11px] font-bold text-slate-400'>
              {ready
                ? 'No attempts yet.'
                : 'Attempt list will appear here once the backend endpoint is live.'}
            </p>
          ) : attempts.length === 0 ? null : (
            <div className='space-y-1.5'>
              {attempts.map((r) => {
                const aid = rowId(r)
                const withdrawn = !!r.withdrawn
                const isOpen = openDetail === aid
                const detail = isOpen ? breakdownFor(aid) : null
                const who = str(
                  r.studentName ?? r.fullname ?? r.username ?? 'Student',
                )
                return (
                  <div key={aid} className='rounded-xl bg-white overflow-hidden'>
                    <div
                      className={`flex items-center gap-2 px-3 py-2 ${withdrawn ? 'opacity-50' : ''}`}
                    >
                      <div className='min-w-0 flex-1'>
                        <p className='text-[11px] font-black text-slate-700 truncate'>
                          {str(r.studentName ?? r.fullname ?? r.username ?? 'Student')}
                          {withdrawn && (
                            <span className='ml-1 text-[9px] font-black uppercase text-rose-500'>
                              · withdrawn
                            </span>
                          )}
                        </p>
                        <p className='text-[9px] font-bold text-slate-400'>
                          {pctOf(r)}% · {str(r.score ?? r.totalScore)}/
                          {str(r.totalMarks ?? r.total)}
                          {r.submittedAt
                            ? ` · ${new Date(str(r.submittedAt)).toLocaleDateString()}`
                            : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => openStudent(aid)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                          isOpen
                            ? 'bg-[#002EFF] text-white'
                            : 'bg-blue-50 text-[#002EFF]'
                        }`}
                        title='View this student’s score breakdown'
                      >
                        View
                      </button>
                      <button
                        onClick={() => openPaper(aid, who)}
                        className='px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-black uppercase hover:text-[#002EFF]'
                        title='Read the marked paper, answer by answer'
                      >
                        Paper
                      </button>
                      {!withdrawn && (
                        <button
                          onClick={() => withdraw(aid, who)}
                          className='px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[9px] font-black uppercase'
                          title='Withdraw result (keeps the record, voids the score)'
                        >
                          Withdraw
                        </button>
                      )}
                      <button
                        onClick={() => del(aid, who)}
                        className='p-1 text-slate-300 hover:text-rose-500'
                        title='Delete attempt'
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {isOpen && (
                      <div className='px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/60'>
                        {detailLoading && !detail ? (
                          <div className='py-3 flex justify-center'>
                            <Loader2 size={14} className='animate-spin text-[#002EFF]' />
                          </div>
                        ) : !detail ? (
                          <p className='text-[10px] font-bold text-slate-400 py-2'>
                            No per-question breakdown available for this result.
                          </p>
                        ) : (
                          <div className='space-y-2 pt-1'>
                            <p className='text-[10px] font-black text-slate-600'>
                              {detail.correct}/{detail.total} correct ·{' '}
                              {str(r.score ?? r.totalScore)}/{str(r.totalMarks ?? r.total)} marks
                            </p>
                            <div className='space-y-1'>
                              {Object.entries(detail.bySubject).map(([subj, v]) => {
                                const pct = v.total ? Math.round((v.correct / v.total) * 100) : 0
                                return (
                                  <div key={subj} className='flex items-center gap-2'>
                                    <span className='text-[10px] font-bold text-slate-500 w-24 truncate'>
                                      {subj}
                                    </span>
                                    <div className='flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden'>
                                      <div
                                        className={`h-full rounded-full ${pct >= 50 ? 'bg-emerald-500' : 'bg-rose-400'}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className='text-[10px] font-black text-slate-600 w-12 text-right tabular-nums'>
                                      {v.correct}/{v.total}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          </>
          )}
        </>
      )}
      {confirmDialog}
    </Card>
  )
}

/**
 * The cohort view of one quiz: how the group scored, which subjects are weak
 * and which questions most people got wrong.
 */
function AnalyticsView({
  data,
  loading,
}: {
  data: {
    takers: number
    graded: number
    avg: number
    best: number
    worst: number
    below40: number
    buckets: { label: string; count: number; tone: string }[]
    subjects: { name: string; correct: number; total: number; pct: number }[]
    missed: {
      id: string
      body: string
      subject: string
      wrong: number
      asked: number
      rate: number
    }[]
  }
  loading: boolean
}) {
  if (!data.takers)
    return (
      <p className='text-[11px] font-bold text-slate-400'>
        Nobody has taken this quiz yet, so there is nothing to analyse.
      </p>
    )

  const peak = Math.max(...data.buckets.map((b) => b.count), 1)

  return (
    <div className='space-y-3'>
      {/* Headline numbers */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
        {[
          { label: 'Average', value: `${data.avg}%`, tint: 'text-[#002EFF]' },
          { label: 'Highest', value: `${data.best}%`, tint: 'text-emerald-600' },
          { label: 'Lowest', value: `${data.worst}%`, tint: 'text-rose-500' },
          {
            label: 'Below 40%',
            value: `${data.below40}`,
            tint: data.below40 ? 'text-amber-600' : 'text-slate-400',
          },
        ].map((s) => (
          <div key={s.label} className='rounded-xl bg-white p-3'>
            <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
              {s.label}
            </p>
            <p className={`text-lg font-black tabular-nums ${s.tint}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* How the scores spread out */}
      <div className='rounded-xl bg-white p-3'>
        <p className='text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2'>
          Score spread · {data.takers} {data.takers === 1 ? 'person' : 'people'}
        </p>
        <div className='flex items-end gap-2 h-20'>
          {data.buckets.map((b) => (
            <div key={b.label} className='flex-1 flex flex-col items-center gap-1'>
              <span className='text-[10px] font-black text-slate-600 tabular-nums'>
                {b.count}
              </span>
              <div
                className={`w-full max-w-[56px] rounded-t-md ${b.tone}`}
                style={{ height: `${Math.max((b.count / peak) * 56, 3)}px` }}
              />
              <span className='text-[8px] font-bold text-slate-400'>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {loading && !data.subjects.length ? (
        <div className='py-4 flex justify-center'>
          <Loader2 className='animate-spin text-[#002EFF]' size={16} />
        </div>
      ) : !data.graded ? (
        <p className='text-[10px] font-bold text-slate-400'>
          Per-question detail is not stored for these attempts, so subject and
          question analysis is unavailable.
        </p>
      ) : (
        <>
          {/* Weakest subject first — that is what a tutor needs to revise */}
          <div className='rounded-xl bg-white p-3 space-y-2'>
            <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
              Subject averages · weakest first
            </p>
            {data.subjects.map((s) => (
              <div key={s.name} className='flex items-center gap-2'>
                <span className='text-[10px] font-bold text-slate-600 w-28 truncate'>
                  {s.name}
                </span>
                <div className='flex-1 h-2 rounded-full bg-slate-100 overflow-hidden'>
                  <div
                    className={`h-full rounded-full ${
                      s.pct >= 60
                        ? 'bg-emerald-500'
                        : s.pct >= 40
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                    }`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <span className='text-[10px] font-black text-slate-600 w-9 text-right tabular-nums'>
                  {s.pct}%
                </span>
              </div>
            ))}
          </div>

          {/* Questions most people failed */}
          {data.missed.length > 0 && (
            <div className='rounded-xl bg-white p-3 space-y-1.5'>
              <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
                Most-missed questions
              </p>
              {data.missed.map((q) => (
                <div
                  key={q.id}
                  className='flex items-start gap-2 py-1 border-b border-slate-50 last:border-0'
                >
                  <span className='shrink-0 mt-0.5 text-[9px] font-black text-rose-500 tabular-nums w-9 text-right'>
                    {q.rate}%
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block text-[11px] font-bold text-slate-700 line-clamp-2'>
                      {q.body}
                    </span>
                    <span className='block text-[9px] font-bold text-slate-400'>
                      {q.subject} · {q.wrong} of {q.asked} got it wrong
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** One subject block with its time limit and picked questions from the bank. */
function SubjectBlockEditor({
  block,
  token,
  subjectOptions,
  onChange,
  onRemove,
}: {
  block: SubjectBlock
  token?: string
  subjectOptions: string[]
  onChange: (patch: Partial<SubjectBlock>) => void
  onRemove: () => void
}) {
  const [bank, setBank] = useState<BankQ[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [batchFilter, setBatchFilter] = useState('')

  const loadBank = useCallback(
    async (subject: string) => {
      setLoading(true)
      try {
        const rows = (await dsaApi.questions.list(
          { subject },
          token,
        )) as Record<string, unknown>[]
        setBank(rows.map(normalizeQ))
      } catch {
        setBank([])
      } finally {
        setLoading(false)
      }
    },
    [token],
  )

  const pickedIds = new Set(block.picked.map((q) => q.id))
  // Distinct import batches in the loaded bank, for the filter dropdown.
  const batches = [
    ...new Set(bank.map((q) => q.batchName).filter(Boolean) as string[]),
  ]
  const shown = batchFilter
    ? bank.filter((q) => q.batchName === batchFilter)
    : bank
  const toggle = (q: BankQ) => {
    if (pickedIds.has(q.id))
      onChange({ picked: block.picked.filter((x) => x.id !== q.id) })
    else onChange({ picked: [...block.picked, q] })
  }
  // Select all / clear across the currently shown questions (honours the batch
  // filter). When every shown question is already picked, the button clears them.
  const allShownPicked =
    shown.length > 0 && shown.every((q) => pickedIds.has(q.id))
  const toggleAllShown = () => {
    if (allShownPicked) {
      const shownIds = new Set(shown.map((q) => q.id))
      onChange({ picked: block.picked.filter((x) => !shownIds.has(x.id)) })
    } else {
      const have = new Set(block.picked.map((x) => x.id))
      const additions = shown.filter((q) => !have.has(q.id))
      onChange({ picked: [...block.picked, ...additions] })
    }
  }

  return (
    <div className='rounded-2xl border border-slate-100 p-3 space-y-2'>
      <div className='flex items-center gap-2'>
        <select
          value={block.name}
          onChange={(e) => {
            onChange({ name: e.target.value, picked: [] })
            setBank([])
            setOpen(false)
          }}
          className='h-9 px-2 rounded-lg bg-slate-50 outline-none text-[12px] font-black flex-1'
        >
          {/* Include the block's current subject even if it's not in the list */}
          {(subjectOptions.includes(block.name)
            ? subjectOptions
            : [block.name, ...subjectOptions]
          ).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className='flex items-center gap-1' title='Time limit (minutes)'>
          <Clock size={13} className='text-[#002EFF]' />
          <input
            type='number'
            min={0}
            value={block.timeLimit}
            onChange={(e) => onChange({ timeLimit: Number(e.target.value) })}
            className='w-14 h-9 px-2 rounded-lg bg-slate-50 outline-none text-[12px] font-bold text-center'
          />
          <span className='text-[9px] font-black text-slate-400'>MIN</span>
        </div>
        <button
          onClick={onRemove}
          className='p-1.5 text-slate-300 hover:text-rose-500'
          title='Remove subject'
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className='flex items-center justify-between'>
        <span className='text-[10px] font-black text-slate-500'>
          {block.picked.length} question{block.picked.length === 1 ? '' : 's'} picked
        </span>
        <button
          onClick={() => {
            const next = !open
            setOpen(next)
            if (next && bank.length === 0) loadBank(block.name)
          }}
          className='flex items-center gap-1.5 text-[10px] font-black uppercase text-[#002EFF] hover:underline'
        >
          <ListPlus size={12} /> {open ? 'Hide bank' : 'Pick from bank'}
        </button>
      </div>

      {open && (
        <div className='rounded-xl bg-slate-50 p-2 space-y-2'>
          {/* Filter by import batch */}
          {batches.length > 0 && (
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              title='Filter by the Excel upload (batch) the questions came from'
              className='h-8 w-full px-2 rounded-lg bg-white border border-slate-200 outline-none text-[11px] font-bold'
            >
              <option value=''>All batches ({bank.length})</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b} ({bank.filter((q) => q.batchName === b).length})
                </option>
              ))}
            </select>
          )}
          {!loading && shown.length > 0 && (
            <div className='flex items-center justify-between px-1'>
              <span className='text-[10px] font-black text-slate-500'>
                {shown.filter((q) => pickedIds.has(q.id)).length}/{shown.length}{' '}
                selected
              </span>
              <button
                type='button'
                onClick={toggleAllShown}
                className='text-[10px] font-black uppercase text-[#002EFF] hover:underline'
              >
                {allShownPicked ? 'Clear all' : 'Select all'}
              </button>
            </div>
          )}
          <div className='max-h-56 overflow-y-auto space-y-1'>
            {loading ? (
              <div className='py-4 flex justify-center'>
                <Loader2 size={16} className='animate-spin text-[#002EFF]' />
              </div>
            ) : bank.length === 0 ? (
              <p className='text-[10px] font-bold text-slate-400 py-3 text-center'>
                No questions in the bank for {block.name} yet. Tutors add them in
                the Question Bank.
              </p>
            ) : (
              shown.map((q) => (
                <label
                  key={q.id}
                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer ${
                    pickedIds.has(q.id) ? 'bg-white shadow-sm' : 'hover:bg-white/60'
                  }`}
                >
                  <input
                    type='checkbox'
                    checked={pickedIds.has(q.id)}
                    onChange={() => toggle(q)}
                    className='mt-0.5 accent-[#002EFF]'
                  />
                  <span className='text-[11px] font-medium text-slate-700'>
                    {q.body}
                    <span className='text-emerald-600 font-black'>
                      {' '}
                      ({q.correctOption})
                    </span>
                    {q.batchName && (
                      <span className='ml-1.5 inline-block align-middle text-[8px] font-black uppercase tracking-wide text-[#002EFF] bg-blue-50 px-1.5 py-0.5 rounded'>
                        {q.batchName}
                      </span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
