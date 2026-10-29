'use client'

import { useMemo, useState } from 'react'
import { dsaApi } from '@/lib/api'
import type { CbtAdminQuestion, CbtFacets, CbtQuestionInput } from '@/lib/cbt-types'
import { Modal, btn, btnAlt, fieldLabel, input } from './ui'

/** Offered in the subject list even before the bank has questions for them. */
const COMMON_SUBJECTS = [
  'English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government',
  'Literature in English', 'Geography', 'Commerce', 'Accounting', 'Agricultural Science',
  'Christian Religious Studies', 'Islamic Religious Studies', 'History', 'Further Mathematics',
]
const EXAMS = ['JAMB', 'WAEC', 'NECO', 'Post-UTME', 'DSA Mock']
const LETTERS = ['A', 'B', 'C', 'D']

const blank = (subject: string, topic: string): CbtQuestionInput => ({
  subject: subject || 'English',
  topic,
  exam: 'JAMB',
  year: new Date().getFullYear(),
  difficulty: 'M',
  text: '',
  options: ['', '', '', ''],
  answer: -1,
  explanation: '',
  passage: '',
  image: '',
  imageAlt: '',
  checked: false,
})

/** The same checks the server makes, so mistakes show before saving. */
function problems(q: CbtQuestionInput): string[] {
  const e: string[] = []
  if (!q.text.trim()) e.push('Write the question.')
  if (!q.topic.trim()) e.push('Choose or type a topic.')
  if (q.options.some((o) => !o.trim())) e.push('Fill in all four options.')
  else if (new Set(q.options.map((o) => o.trim().toLowerCase())).size < q.options.length)
    e.push('Each option must be different.')
  if (q.answer < 0) e.push('Tick the correct option.')
  const y = Number(q.year)
  if (!Number.isInteger(y) || y < 1978 || y > new Date().getFullYear() + 1) e.push('Enter the exam year.')
  if (q.image.trim() && !/^(https?:\/\/|data:image\/svg\+xml[,;])/i.test(q.image.trim()))
    e.push('The picture must be a web link (https://…) or an SVG diagram.')
  if (q.image.trim() && !q.imageAlt.trim()) e.push('Describe the picture for students who cannot see it.')
  return e
}

export default function QuestionEditor({
  token,
  question,
  facets,
  defaults,
  onClose,
  onSaved,
  onDelete,
}: {
  token?: string
  question: CbtAdminQuestion | null
  facets: CbtFacets | null
  defaults: { subject: string; topic: string }
  onClose: () => void
  onSaved: (message: string) => void
  onDelete: (id: string) => void
}) {
  const [q, setQ] = useState<CbtQuestionInput>(() =>
    question
      ? {
          subject: question.subject,
          topic: question.topic,
          exam: question.exam,
          year: question.year ?? '',
          difficulty: question.difficulty || 'M',
          text: question.text,
          options: [...question.options, '', '', '', ''].slice(0, Math.max(4, question.options.length)),
          answer: question.answer,
          explanation: question.explanation,
          passage: question.passage,
          image: question.image,
          imageAlt: question.imageAlt,
          checked: question.checked,
        }
      : blank(defaults.subject, defaults.topic),
  )
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  const subjects = useMemo(
    () => [...new Set([...Object.keys(facets?.subjects || {}), ...COMMON_SUBJECTS])].sort(),
    [facets],
  )
  const topics = (facets?.subjects[q.subject] || []).map((t) => t.topic).filter(Boolean)
  const errs = problems(q)
  const set = <K extends keyof CbtQuestionInput>(k: K, v: CbtQuestionInput[K]) => setQ((p) => ({ ...p, [k]: v }))

  const save = async () => {
    setTried(true)
    setServerError('')
    if (errs.length) return
    setSaving(true)
    try {
      const body = { ...q, year: Number(q.year) }
      if (question) await dsaApi.cbt.admin.update(question.id, body, token)
      else await dsaApi.cbt.admin.create(body, token)
      onSaved(question ? 'Question saved.' : 'Question added. Students can practise it now.')
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={question ? 'Edit question' : 'Add a question'} onClose={onClose} wide>
      {question && (
        <p className='-mt-2 mb-3 text-[11px] font-medium text-slate-400'>
          {question.attempts
            ? `${question.attempts} answers so far, ${question.correctPct}% correct.`
            : 'Not answered yet.'}
          {question.reports ? ` ${question.reports} open report${question.reports === 1 ? '' : 's'}.` : ''}
        </p>
      )}
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <label className={fieldLabel}>
          Subject
          <select className={input} value={q.subject} onChange={(e) => set('subject', e.target.value)}>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Topic
          <input
            className={input}
            list='cbt-topic-list'
            value={q.topic}
            onChange={(e) => set('topic', e.target.value)}
            placeholder='e.g. Genetics'
          />
          <datalist id='cbt-topic-list'>
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className={fieldLabel}>
          Exam
          <select className={input} value={q.exam} onChange={(e) => set('exam', e.target.value)}>
            {EXAMS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <div className='grid grid-cols-2 gap-3'>
          <label className={fieldLabel}>
            Year
            <input
              className={input}
              type='number'
              inputMode='numeric'
              value={q.year}
              onChange={(e) => set('year', e.target.value)}
            />
          </label>
          <label className={fieldLabel}>
            Difficulty
            <select className={input} value={q.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
              <option value='E'>Easy</option>
              <option value='M'>Medium</option>
              <option value='H'>Hard</option>
            </select>
          </label>
        </div>
        <label className={`${fieldLabel} sm:col-span-2`}>
          Question
          <textarea
            className={`${input} h-auto min-h-[80px] py-2`}
            value={q.text}
            onChange={(e) => set('text', e.target.value)}
          />
        </label>
        <fieldset className='sm:col-span-2'>
          <legend className='text-[11px] font-bold text-slate-500'>Options. Tick the correct one.</legend>
          {q.options.map((o, k) => (
            <div key={k} className='mt-1.5 flex items-center gap-2'>
              <input
                type='radio'
                name='cbt-answer'
                className='h-4 w-4 accent-[#002EFF]'
                checked={q.answer === k}
                onChange={() => set('answer', k)}
                aria-label={`Option ${LETTERS[k]} is correct`}
              />
              <b className='w-4 text-[12px] font-black text-slate-600'>{LETTERS[k] ?? k + 1}</b>
              <input
                className={`${input} flex-1`}
                value={o}
                aria-label={`Option ${LETTERS[k]}`}
                onChange={(e) => set('options', q.options.map((x, i) => (i === k ? e.target.value : x)))}
              />
            </div>
          ))}
        </fieldset>
        <label className={`${fieldLabel} sm:col-span-2`}>
          Explanation (shown after the student answers)
          <textarea
            className={`${input} h-auto min-h-[64px] py-2`}
            value={q.explanation}
            onChange={(e) => set('explanation', e.target.value)}
          />
        </label>
        <label className={`${fieldLabel} sm:col-span-2`}>
          Reading passage (optional, English comprehension)
          <textarea
            className={`${input} h-auto min-h-[56px] py-2`}
            value={q.passage}
            onChange={(e) => set('passage', e.target.value)}
          />
        </label>
        <label className={fieldLabel}>
          Picture link (optional)
          <input
            className={input}
            value={q.image}
            placeholder='https://…'
            onChange={(e) => set('image', e.target.value)}
          />
        </label>
        <label className={fieldLabel}>
          Picture description (needed if there is a picture)
          <input className={input} value={q.imageAlt} onChange={(e) => set('imageAlt', e.target.value)} />
        </label>
        <label className='flex items-center gap-2 text-[12px] font-bold text-slate-700 sm:col-span-2 dark:text-slate-200'>
          <input
            type='checkbox'
            className='h-4 w-4 accent-[#002EFF]'
            checked={q.checked}
            onChange={(e) => set('checked', e.target.checked)}
          />
          A tutor has checked this question and its answer
        </label>
      </div>

      {(tried && errs.length > 0) || serverError ? (
        <div className='mt-3 rounded-xl bg-rose-50 p-3 text-[12px] font-bold text-rose-700'>
          {serverError || errs.join(' ')}
        </div>
      ) : null}

      <div className='mt-4 flex flex-wrap justify-between gap-2'>
        <div>
          {question && (
            <button type='button' className='text-[11px] font-black uppercase text-rose-600' onClick={() => onDelete(question.id)}>
              Delete question
            </button>
          )}
        </div>
        <div className='flex gap-2'>
          <button type='button' className={btnAlt} onClick={onClose}>
            Cancel
          </button>
          <button type='button' className={btn} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save question'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
