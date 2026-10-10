'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Plus,
  Trash2,
  GraduationCap,
  Loader2,
  X,
  UserPlus,
  Pencil,
  Check,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { COURSE_CATEGORIES, categoryLabel } from '@/lib/coursesStore'
import { dsaApi } from '@/lib/api'
import { adminApi } from '@/lib/admin-api'
import { classLevelLabel, courseClassChoices } from '@/lib/materialUpload'
import type { CourseCategory } from '@/lib/types'

// Department scopes a course to Science / Art / Commercial students. Empty ⇒
// shared with every department in the category.
const COURSE_DEPARTMENTS = [
  { value: 'science', label: 'Science' },
  { value: 'art', label: 'Art' },
  { value: 'commercial', label: 'Commercial' },
] as const

// Categories whose students are split by department (Science/Art/Commercial).
// A course in one of these MUST be tagged with at least one department,
// otherwise it's treated as shared and leaks across every department. The
// programme categories (undergrad/preclinical) have no department split.
const DEPT_SPLIT_CATEGORIES = [
  'ss1',
  'ss2',
  'ss3',
  'waec',
  'jamb',
  'postutme',
  'afterschool',
]
const isDeptSplitCategory = (c: string) =>
  DEPT_SPLIT_CATEGORIES.includes(String(c).toLowerCase())

type UITutor = { id: string; name: string; subject?: string }
type UICourse = {
  id: string
  title: string
  subject?: string
  category: string
  /** Science / Art / Commercial the course serves; [] ⇒ shared with all. */
  departments: string[]
  /** The one class it is for (After-School: SS1 / SS2); '' ⇒ every class. */
  classLevel: string
  /** Ids of every tutor assigned to this course (one or more). */
  tutorIds: string[]
}

/**
 * Read the assigned tutor ids from a course row, tolerating whatever shape the
 * backend returns: a `tutorIds` array, a populated `tutors` array, or the older
 * single `tutorId` / populated `tutor`.
 */
function tutorIdsFromCourse(c: Record<string, unknown>): string[] {
  const ids = new Set<string>()
  const push = (v: unknown) => {
    const s = String(v ?? '').trim()
    if (s) ids.add(s)
  }
  if (Array.isArray(c.tutorIds)) c.tutorIds.forEach(push)
  if (Array.isArray(c.tutors))
    (c.tutors as unknown[]).forEach((t) =>
      push(
        typeof t === 'object' && t
          ? ((t as Record<string, unknown>).id ??
              (t as Record<string, unknown>)._id)
          : t,
      ),
    )
  if (c.tutor && typeof c.tutor === 'object')
    push(
      (c.tutor as Record<string, unknown>).id ??
        (c.tutor as Record<string, unknown>)._id,
    )
  push(c.tutorId)
  return [...ids]
}

// The admin signs in via /adminLogin, which stores the JWT under 'admin_token' /
// 'token' (not 'dsa_token'), so read it directly for the dsaApi reads below.
function adminToken(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    undefined
  )
}

export default function CourseManager() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tutors, setTutors] = useState<UITutor[]>([])
  const [courses, setCourses] = useState<UICourse[]>([])

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<CourseCategory>('jamb')
  const [departments, setDepartments] = useState<string[]>([])
  // After-School courses are for SS1 or SS2 (two separate courses); other
  // categories may optionally target one class.
  const [classLevel, setClassLevel] = useState('')
  const classChoices = courseClassChoices(category)
  const toggleDept = (v: string) =>
    setDepartments((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    )
  const [tutorId, setTutorId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const token = adminToken()
    try {
      const [tutorRows, courseRows] = await Promise.all([
        dsaApi.admin.listUsers('tutor', token) as Promise<
          Record<string, unknown>[]
        >,
        dsaApi.courses.list({}, token) as Promise<Record<string, unknown>[]>,
      ])
      setTutors(
        tutorRows.map((t) => ({
          id: String(t.id ?? t._id ?? ''),
          name: String(t.fullname ?? t.fullName ?? 'Tutor'),
          subject: Array.isArray(t.subjects)
            ? String((t.subjects as unknown[])[0] ?? '')
            : (t.subject as string) || '',
        })),
      )
      setCourses(
        courseRows.map((c) => ({
          id: String(c.id ?? c._id ?? ''),
          title: String(c.title ?? 'Course'),
          subject: c.subject ? String(c.subject) : undefined,
          category: String(c.category ?? ''),
          departments: Array.isArray(c.departments)
            ? (c.departments as unknown[]).map(String)
            : c.department
              ? [String(c.department)]
              : [],
          classLevel: c.classLevel ? String(c.classLevel) : '',
          tutorIds: tutorIdsFromCourse(c),
        })),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load courses. Are you signed in as admin?',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    void load()
  }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cleanTitle = title.trim()
    if (cleanTitle.length < 2) return setError('Enter a course title')
    if (classChoices.required && !classLevel) {
      return setError(
        `Choose the class: ${classChoices.options.map((o) => o.label).join(' or ')}.`,
      )
    }
    // Block duplicates: same title in the same category and class. (Same name
    // in a different category — SS1 vs WAEC Biology — or for After-School SS1
    // vs SS2 is allowed; one course can serve several departments, so
    // department isn't part of the key.)
    const exists = courses.some(
      (c) =>
        c.category === category &&
        (c.classLevel || '') === classLevel &&
        c.title.trim().toLowerCase() === cleanTitle.toLowerCase(),
    )
    if (exists) {
      const where = classLevelLabel(category, classLevel) || categoryLabel(category)
      return setError(
        `“${cleanTitle}” already exists in ${where}. Edit that course (you can assign it to more departments) instead of creating a new one.`,
      )
    }
    // For department-split classes, force a department choice so the course
    // doesn't silently become "shared with everyone" (the cause of subject
    // overlap). A subject everyone takes (English, Maths) → tick all three.
    if (isDeptSplitCategory(category) && departments.length === 0) {
      return setError(
        'Pick at least one department (Science / Art / Commercial). For a subject every department takes (e.g. English, Maths), tick all three.',
      )
    }
    setBusy(true)
    try {
      await adminApi.createCourse({
        title: title.trim(),
        subject: subject.trim() || title.trim(),
        category,
        departments,
        classLevel,
        // Send both: `tutorId` for the current backend and `tutorIds` for the
        // multi-tutor backend (see docs/backend-request-course-tutors.md).
        tutorId: tutorId || undefined,
        tutorIds: tutorId ? [tutorId] : [],
        isPublished: true,
      })
      setTitle('')
      setSubject('')
      setTutorId('')
      setClassLevel('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Assign the given set of tutors to an existing course (PUT /courses/:id) —
   * this is how a second tutor is added without recreating the course. Sends
   * `tutorIds` (the full set) plus `tutorId` (the first) for backward compat.
   */
  const setCourseTutors = useCallback(
    async (courseId: string, ids: string[]) => {
      setError('')
      await adminApi.updateCourse(courseId, {
        tutorIds: ids,
        tutorId: ids[0] ?? null,
      })
      await load()
    },
    [load],
  )

  /** Rename an existing course (PUT /courses/:id). */
  const renameCourse = useCallback(
    async (courseId: string, newTitle: string) => {
      setError('')
      await adminApi.updateCourse(courseId, { title: newTitle })
      await load()
    },
    [load],
  )

  /** Change the class an existing course is for (PUT /courses/:id). */
  const setCourseClassLevel = useCallback(
    async (courseId: string, level: string) => {
      setError('')
      try {
        await adminApi.updateCourse(courseId, { classLevel: level })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not change the class')
      }
      await load()
    },
    [load],
  )

  /** Change which departments an existing course serves (PUT /courses/:id). */
  const setCourseDepartments = useCallback(
    async (courseId: string, newDepts: string[]) => {
      setError('')
      await adminApi.updateCourse(courseId, { departments: newDepts })
      await load()
    },
    [load],
  )

  const remove = async (id: string) => {
    try {
      await adminApi.deleteCourse(id)
      await load()
    } catch {
      void load()
    }
  }

  if (!mounted) {
    return (
      <div className='py-20 flex justify-center'>
        <Loader2 className='animate-spin text-[#002EFF]' />
      </div>
    )
  }

  return (
    <div className='max-w-5xl mx-auto space-y-6 px-4'>
      <div>
        <h1 className='text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2'>
          <BookOpen size={20} className='text-[#002EFF]' /> Courses
        </h1>
        <p className='text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1'>
          Add courses per category &amp; assign a tutor
        </p>
      </div>

      {/* Add course */}
      <Card className='p-5 rounded-3xl border-none shadow-sm bg-white'>
        <form onSubmit={create} className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          {error && (
            <p className='sm:col-span-2 text-[11px] font-bold text-rose-600'>
              {error}
            </p>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Course title (e.g. Chemistry)'
            className='h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium'
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder='Subject (optional)'
            className='h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium'
          />
          <label className='space-y-1'>
            <span className='text-[9px] font-black uppercase text-slate-400'>
              Category
            </span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as CourseCategory)
                setClassLevel('')
              }}
              className='w-full h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
            >
              {COURSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} — {c.note}
                </option>
              ))}
            </select>
          </label>
          <div className='space-y-1'>
            <span className='text-[9px] font-black uppercase text-slate-400'>
              Departments{' '}
              {isDeptSplitCategory(category) ? (
                <span className='text-rose-500'>*required</span>
              ) : (
                departments.length === 0 && '(all)'
              )}
              <span className='ml-1 lowercase text-slate-300'>
                — select one or more
              </span>
            </span>
            <div className='flex gap-1.5'>
              {COURSE_DEPARTMENTS.map((d) => {
                const on = departments.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type='button'
                    onClick={() => toggleDept(d.value)}
                    aria-pressed={on}
                    className={`flex-1 h-11 rounded-lg text-[11px] font-black uppercase tracking-wide border transition-all flex items-center justify-center gap-1 ${
                      on
                        ? 'bg-[#002EFF] text-white border-[#002EFF]'
                        : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-300'
                    }`}
                  >
                    {on && <Check size={12} />}
                    {d.label}
                  </button>
                )
              })}
            </div>
            <p className='text-[9px] font-bold text-slate-400'>
              {departments.length === 0
                ? 'A subject taken by every department (e.g. English, Maths) → tick all three.'
                : `Assigned to: ${departments
                    .map(
                      (v) =>
                        COURSE_DEPARTMENTS.find((d) => d.value === v)?.label ??
                        v,
                    )
                    .join(', ')}`}
            </p>
          </div>
          <label className='space-y-1'>
            <span className='text-[9px] font-black uppercase text-slate-400'>
              Class{' '}
              {classChoices.required ? (
                <span className='text-rose-500'>*required</span>
              ) : (
                '(optional)'
              )}
            </span>
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              aria-label='Class'
              className='w-full h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
            >
              <option value=''>
                {classChoices.required ? 'Choose the class…' : 'All classes'}
              </option>
              {classChoices.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className='space-y-1'>
            <span className='text-[9px] font-black uppercase text-slate-400'>
              Assign tutor
            </span>
            <select
              value={tutorId}
              onChange={(e) => setTutorId(e.target.value)}
              className='w-full h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
            >
              <option value=''>Unassigned</option>
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.subject ? ` — ${t.subject}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type='submit'
            disabled={busy}
            className='sm:col-span-2 flex items-center justify-center gap-2 h-11 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50'
          >
            <Plus size={15} /> {busy ? 'Adding…' : 'Add Course'}
          </button>
        </form>
        {tutors.length === 0 && !loading && (
          <p className='text-[10px] font-bold text-amber-600 mt-3'>
            No tutors found — create tutors first (People → Create Tutor) to
            assign them.
          </p>
        )}
      </Card>

      {/* Courses by category */}
      {loading ? (
        <div className='py-10 flex justify-center'>
          <Loader2 className='animate-spin text-[#002EFF]' />
        </div>
      ) : (
        COURSE_CATEGORIES.map((cat) => {
          const list = courses.filter((c) => c.category === cat.id)
          return (
            <div key={cat.id} className='space-y-2'>
              <div className='flex items-center gap-2'>
                <h3 className='text-[11px] font-black uppercase tracking-widest text-slate-600'>
                  {cat.label}
                </h3>
                <span className='text-[9px] font-bold text-slate-400'>
                  · {cat.note}
                </span>
                <span className='ml-auto text-[9px] font-black uppercase text-slate-400'>
                  {list.length}
                </span>
              </div>
              {list.length === 0 ? (
                <p className='text-[11px] font-bold text-slate-400 px-1'>
                  No courses in this category yet.
                </p>
              ) : (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                  {list.map((c) => (
                    <CourseCard
                      key={c.id}
                      course={c}
                      tutors={tutors}
                      onSetTutors={setCourseTutors}
                      onRename={renameCourse}
                      onSetDepartments={setCourseDepartments}
                      onSetClassLevel={setCourseClassLevel}
                      onRemove={remove}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

/**
 * A single course row with inline tutor management. The admin can assign more
 * than one tutor to the same course here — adding a tutor updates the existing
 * course (no need to recreate it).
 */
function CourseCard({
  course,
  tutors,
  onSetTutors,
  onRename,
  onSetDepartments,
  onSetClassLevel,
  onRemove,
}: {
  course: UICourse
  tutors: UITutor[]
  onSetTutors: (courseId: string, ids: string[]) => Promise<void>
  onRename: (courseId: string, title: string) => Promise<void>
  onSetDepartments: (courseId: string, departments: string[]) => Promise<void>
  onSetClassLevel: (courseId: string, classLevel: string) => Promise<void>
  onRemove: (id: string) => void
}) {
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(course.title)

  const saveTitle = async () => {
    const t = titleDraft.trim()
    setEditing(false)
    if (t && t !== course.title) {
      setBusy(true)
      try {
        await onRename(course.id, t)
      } finally {
        setBusy(false)
      }
    }
  }

  const nameFor = (id: string) =>
    tutors.find((t) => t.id === id)?.name ?? 'Tutor'
  const unassigned = tutors.filter((t) => !course.tutorIds.includes(t.id))

  const apply = async (ids: string[]) => {
    setBusy(true)
    try {
      await onSetTutors(course.id, ids)
    } finally {
      setBusy(false)
      setAdding('')
    }
  }

  const addTutor = (id: string) => {
    if (!id || course.tutorIds.includes(id)) return
    void apply([...course.tutorIds, id])
  }
  const removeTutor = (id: string) =>
    void apply(course.tutorIds.filter((t) => t !== id))

  return (
    <Card className='p-3 rounded-2xl border-none shadow-sm bg-white flex flex-col gap-2'>
      <div className='flex items-center gap-3'>
        <div className='h-9 w-9 rounded-xl bg-blue-50 text-[#002EFF] flex items-center justify-center shrink-0'>
          <BookOpen size={16} />
        </div>
        <div className='min-w-0 flex-1'>
          {editing ? (
            <div className='flex items-center gap-1'>
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle()
                  if (e.key === 'Escape') setEditing(false)
                }}
                autoFocus
                className='min-w-0 flex-1 h-7 px-2 rounded-lg bg-slate-50 border border-[#002EFF]/30 focus:bg-white outline-none text-xs font-black text-gray-800'
              />
              <button
                onClick={saveTitle}
                disabled={busy}
                className='p-1 text-[#002EFF] hover:text-blue-700 disabled:opacity-40'
                title='Save name'
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <p className='text-xs font-black text-gray-800 truncate flex items-center gap-1.5'>
              {course.title}
              <button
                onClick={() => {
                  setTitleDraft(course.title)
                  setEditing(true)
                }}
                className='text-slate-300 hover:text-[#002EFF] shrink-0'
                title='Edit name'
              >
                <Pencil size={11} />
              </button>
            </p>
          )}
          <div className='flex items-center gap-1.5 mt-1 flex-wrap'>
            <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
              {course.tutorIds.length} tutor
              {course.tutorIds.length === 1 ? '' : 's'}
            </p>
            <span className='text-slate-300'>·</span>
            {COURSE_DEPARTMENTS.map((d) => {
              const on = course.departments.includes(d.value)
              return (
                <button
                  key={d.value}
                  type='button'
                  disabled={busy}
                  onClick={() => {
                    const next = on
                      ? course.departments.filter((x) => x !== d.value)
                      : [...course.departments, d.value]
                    setBusy(true)
                    onSetDepartments(course.id, next).finally(() => setBusy(false))
                  }}
                  title='Toggle this department for the course'
                  className={`px-1.5 h-5 rounded text-[9px] font-black uppercase tracking-wide disabled:opacity-50 ${
                    on
                      ? 'bg-blue-50 text-[#002EFF]'
                      : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
            {course.departments.length === 0 &&
              (isDeptSplitCategory(course.category) ? (
                <span
                  className='px-1.5 h-5 rounded text-[9px] font-black uppercase tracking-wide bg-amber-50 text-amber-600'
                  title='Untagged — NOT shown to any student until you tag a department. For a subject everyone takes, tick all three.'
                >
                  ⚠ hidden — tag a dept
                </span>
              ) : (
                <span className='text-[9px] font-black uppercase text-slate-400'>
                  all depts
                </span>
              ))}
            <span className='text-slate-300'>·</span>
            <select
              value={course.classLevel}
              disabled={busy}
              aria-label='Class'
              title='Which class this course is for'
              onChange={(e) => {
                setBusy(true)
                onSetClassLevel(course.id, e.target.value).finally(() =>
                  setBusy(false),
                )
              }}
              className={`h-5 rounded text-[9px] font-black uppercase tracking-wide outline-none disabled:opacity-50 ${
                course.category === 'afterschool' && !course.classLevel
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-blue-50 text-[#002EFF]'
              }`}
            >
              {(!courseClassChoices(course.category).required ||
                !course.classLevel) && (
                <option value='' disabled={courseClassChoices(course.category).required}>
                  {courseClassChoices(course.category).required
                    ? '⚠ set SS1 / SS2'
                    : 'All classes'}
                </option>
              )}
              {courseClassChoices(course.category).options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => onRemove(course.id)}
          className='p-1.5 text-slate-400 hover:text-rose-600'
          title='Remove course'
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Assigned tutors */}
      <div className='flex flex-wrap items-center gap-1.5 pl-1'>
        {course.tutorIds.length === 0 && (
          <span className='text-[10px] font-bold text-amber-600 flex items-center gap-1'>
            <GraduationCap size={10} /> Unassigned
          </span>
        )}
        {course.tutorIds.map((id) => (
          <span
            key={id}
            className='inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-blue-50 text-[#002EFF] text-[10px] font-bold'
          >
            {nameFor(id)}
            <button
              onClick={() => removeTutor(id)}
              disabled={busy}
              className='hover:text-rose-600 disabled:opacity-40'
              title='Remove tutor'
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      {/* Add another tutor */}
      {unassigned.length > 0 && (
        <div className='flex items-center gap-2 pl-1'>
          <UserPlus size={12} className='text-slate-400 shrink-0' />
          <select
            value={adding}
            disabled={busy}
            onChange={(e) => addTutor(e.target.value)}
            className='flex-1 h-8 px-2 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-[11px] font-bold disabled:opacity-50'
          >
            <option value=''>
              {busy ? 'Saving…' : 'Add a tutor to this course…'}
            </option>
            {unassigned.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.subject ? ` — ${t.subject}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </Card>
  )
}
