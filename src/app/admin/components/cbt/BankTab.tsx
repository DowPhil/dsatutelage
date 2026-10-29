'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Plus, Upload } from 'lucide-react'
import { dsaApi } from '@/lib/api'
import { csvToObjects, downloadText, tableToObjects, toCSV } from '@/lib/csv'
import type { CbtAdminQuestion, CbtFacets, CbtImportResult, CbtPagination } from '@/lib/cbt-types'
import QuestionEditor from './QuestionEditor'
import {
  DIFF_LABEL,
  Empty,
  ErrorNote,
  Loading,
  Modal,
  Pager,
  Tag,
  btn,
  btnAlt,
  btnBad,
  fN,
  input,
} from './ui'

const STATUSES: [string, string][] = [
  ['', 'Any status'],
  ['unchecked', 'Not checked yet'],
  ['checked', 'Checked by a tutor'],
  ['noexp', 'No explanation'],
  ['reported', 'Has reports'],
  ['hard', 'Very low accuracy'],
]

const REQUIRED_COLUMNS = ['subject', 'topic', 'exam', 'year', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'answer']
const EXPORT_COLUMNS = [
  'subject', 'topic', 'exam', 'year', 'question', 'option_a', 'option_b', 'option_c', 'option_d',
  'answer', 'explanation', 'passage', 'image', 'image_alt', 'difficulty', 'checked',
]
const TEMPLATE_ROW = {
  subject: 'Biology', topic: 'Cell biology', exam: 'JAMB', year: 2022,
  question: 'The organelle responsible for protein synthesis is the',
  option_a: 'Ribosome', option_b: 'Lysosome', option_c: 'Golgi body', option_d: 'Vacuole',
  answer: 'A', explanation: 'Ribosomes read mRNA and join amino acids into proteins.',
  passage: '', image: '', image_alt: '', difficulty: 'Easy', checked: 'no',
}

const PER_PAGE = 15

export default function BankTab({
  token,
  toast,
  initialStatus = '',
  initialSubject = '',
  initialTopic = '',
  editQuestion,
}: {
  token?: string
  toast: (text: string, bad?: boolean) => void
  initialStatus?: string
  initialSubject?: string
  initialTopic?: string
  editQuestion?: string
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [subject, setSubject] = useState(initialSubject)
  const [topic, setTopic] = useState(initialTopic)
  const [exam, setExam] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<CbtAdminQuestion[] | null>(null)
  const [pagination, setPagination] = useState<CbtPagination | null>(null)
  const [facets, setFacets] = useState<CbtFacets | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<CbtAdminQuestion | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const loadFacets = useCallback(async () => {
    try {
      setFacets(await dsaApi.cbt.admin.facets(token))
    } catch {
      /* the filters fall back to typing */
    }
  }, [token])

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await dsaApi.cbt.admin.questions(
        { search: debounced, subject, topic, exam, status, page, limit: PER_PAGE },
        token,
      )
      setRows(res.data)
      setPagination(res.pagination)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load questions')
    }
  }, [debounced, subject, topic, exam, status, page, token])

  useEffect(() => {
    void loadFacets()
  }, [loadFacets])
  useEffect(() => {
    void load()
  }, [load])

  // Opened from Insights ("Check this question").
  useEffect(() => {
    if (!editQuestion) return
    dsaApi.cbt.admin
      .question(editQuestion, token)
      .then(setEditing)
      .catch(() => toast('That question could not be opened.', true))
  }, [editQuestion, token, toast])

  const subjects = useMemo(() => Object.keys(facets?.subjects || {}).sort(), [facets])
  const topics = useMemo(() => (subject ? (facets?.subjects[subject] || []).map((t) => t.topic) : []), [facets, subject])
  const totalInBank = useMemo(
    () => Object.values(facets?.subjects || {}).flat().reduce((s, t) => s + t.count, 0),
    [facets],
  )

  const refresh = () => {
    void load()
    void loadFacets()
  }

  const pageIds = (rows || []).map((r) => r.id)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const bulk = async (action: 'check' | 'uncheck' | 'delete', ids: string[]) => {
    try {
      const r = await dsaApi.cbt.admin.bulk(ids, action, token)
      toast(
        action === 'delete'
          ? `Deleted ${ids.length} question${ids.length === 1 ? '' : 's'}.`
          : `${r.updated} question${r.updated === 1 ? '' : 's'} marked as ${action === 'check' ? 'checked' : 'not checked'}.`,
      )
      setSelected(new Set())
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That did not work', true)
    }
  }

  const exportAll = async () => {
    setExporting(true)
    try {
      const data = await dsaApi.cbt.admin.exportRows(token)
      downloadText(`cbt-questions-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(EXPORT_COLUMNS, data))
      toast(`Exported ${fN(data.length)} questions.`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', true)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className='min-w-0 space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <button type='button' className={btn} onClick={() => setEditing('new')}>
          <Plus size={13} /> Add question
        </button>
        <button type='button' className={btnAlt} onClick={() => setImporting(true)}>
          <Upload size={13} /> Import CSV
        </button>
        <button type='button' className={btnAlt} onClick={exportAll} disabled={exporting}>
          <Download size={13} /> {exporting ? 'Exporting…' : 'Export'}
        </button>
        <span className='text-[11px] font-bold text-slate-400'>{fN(totalInBank)} questions in the bank</span>
      </div>

      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5'>
        <input
          type='search'
          className={`${input} lg:col-span-1`}
          placeholder='Search question text or ID'
          aria-label='Search questions'
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <select
          className={input}
          aria-label='Subject'
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value)
            setTopic('')
            setPage(1)
          }}
        >
          <option value=''>All subjects</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className={input}
          aria-label='Topic'
          value={topic}
          disabled={!subject}
          onChange={(e) => {
            setTopic(e.target.value)
            setPage(1)
          }}
        >
          <option value=''>All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t || 'No topic'}
            </option>
          ))}
        </select>
        <select
          className={input}
          aria-label='Exam'
          value={exam}
          onChange={(e) => {
            setExam(e.target.value)
            setPage(1)
          }}
        >
          <option value=''>All exams</option>
          {(facets?.exams || []).map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          className={input}
          aria-label='Status'
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className='flex flex-wrap items-center gap-2 rounded-2xl bg-blue-50 p-3 dark:bg-slate-800'>
          <b className='text-[12px] font-black text-slate-700 dark:text-slate-200'>{selected.size} selected</b>
          <button type='button' className={btnAlt} onClick={() => bulk('check', [...selected])}>
            Mark as checked
          </button>
          <button type='button' className={btnAlt} onClick={() => bulk('uncheck', [...selected])}>
            Mark as not checked
          </button>
          <button type='button' className={btnAlt} onClick={() => setConfirmDelete([...selected])}>
            Delete
          </button>
          <button type='button' className='text-[11px] font-bold text-[#002EFF]' onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {error ? (
        <ErrorNote message={error} onRetry={load} />
      ) : !rows ? (
        <Loading />
      ) : (
        <div className='min-w-0 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4 dark:border-slate-800 dark:bg-slate-900'>
          {/* Phones: cards. Wider screens: a table. */}
          <ul className='space-y-2 md:hidden'>
            {rows.map((q) => (
              <li key={q.id} className='rounded-2xl border border-slate-100 p-3 dark:border-slate-800'>
                <div className='flex items-start gap-2'>
                  <input
                    type='checkbox'
                    className='mt-1 h-4 w-4 accent-[#002EFF]'
                    aria-label='Select question'
                    checked={selected.has(q.id)}
                    onChange={() => toggle(q.id)}
                  />
                  <div className='min-w-0 flex-1'>
                    <p className='line-clamp-2 text-[12px] font-bold text-slate-800 dark:text-slate-100'>{q.text}</p>
                    <p className='mt-1 text-[11px] text-slate-500'>
                      {q.subject} · {q.topic} · {q.exam} {q.year} · {DIFF_LABEL[q.difficulty] || 'No level'}
                    </p>
                    <div className='mt-1.5'>
                      <StatusTags q={q} />
                    </div>
                  </div>
                  <button type='button' className={btnAlt} onClick={() => setEditing(q)}>
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className='hidden overflow-x-auto md:block'>
            <table className='w-full min-w-[860px] text-left'>
              <thead>
                <tr className='text-[9px] font-black uppercase text-slate-400'>
                  <th className='py-2 pr-2'>
                    <input
                      type='checkbox'
                      className='h-4 w-4 accent-[#002EFF]'
                      aria-label='Select this page'
                      checked={allOnPage}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s)
                          pageIds.forEach((id) => (allOnPage ? n.delete(id) : n.add(id)))
                          return n
                        })
                      }
                    />
                  </th>
                  <th className='py-2 pr-3'>Question</th>
                  <th className='py-2 pr-3'>Subject and topic</th>
                  <th className='py-2 pr-3'>Exam</th>
                  <th className='py-2 pr-3'>Level</th>
                  <th className='py-2 pr-3 text-right'>Answers</th>
                  <th className='py-2 pr-3'>Correct</th>
                  <th className='py-2 pr-3 text-right'>Reports</th>
                  <th className='py-2 pr-3'>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id} className='border-t border-slate-50 text-[12px] dark:border-slate-800'>
                    <td className='py-2 pr-2'>
                      <input
                        type='checkbox'
                        className='h-4 w-4 accent-[#002EFF]'
                        aria-label='Select question'
                        checked={selected.has(q.id)}
                        onChange={() => toggle(q.id)}
                      />
                    </td>
                    <td className='max-w-[260px] truncate py-2 pr-3 font-semibold text-slate-700 dark:text-slate-200' title={q.text}>
                      {q.text}
                    </td>
                    <td className='py-2 pr-3 text-slate-500'>
                      {q.subject} · {q.topic}
                    </td>
                    <td className='whitespace-nowrap py-2 pr-3 text-slate-500'>
                      {q.exam} {q.year}
                    </td>
                    <td className='py-2 pr-3 text-slate-500'>{DIFF_LABEL[q.difficulty] || '–'}</td>
                    <td className='py-2 pr-3 text-right font-bold'>{fN(q.attempts)}</td>
                    <td className='py-2 pr-3'>
                      {q.correctPct === null ? (
                        '–'
                      ) : (
                        <span className='flex items-center gap-1.5'>
                          <span className='h-1.5 w-12 overflow-hidden rounded-full bg-slate-100'>
                            <span className='block h-full bg-[#002EFF]' style={{ width: `${q.correctPct}%` }} />
                          </span>
                          {q.correctPct}%
                        </span>
                      )}
                    </td>
                    <td className='py-2 pr-3 text-right font-bold'>{q.reports || '–'}</td>
                    <td className='py-2 pr-3'>
                      <StatusTags q={q} />
                    </td>
                    <td className='py-2 text-right'>
                      <button type='button' className={btnAlt} onClick={() => setEditing(q)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <Empty>
              {totalInBank ? 'No questions match these filters.' : 'The bank is empty. Add a question or import a CSV file to start.'}
            </Empty>
          )}
          {pagination && pagination.total > 0 && (
            <Pager
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPage={setPage}
            />
          )}
        </div>
      )}

      {editing && (
        <QuestionEditor
          token={token}
          question={editing === 'new' ? null : editing}
          facets={facets}
          defaults={{ subject, topic }}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            toast(msg)
            setEditing(null)
            refresh()
          }}
          onDelete={(id) => {
            setEditing(null)
            setConfirmDelete([id])
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title={`Delete ${confirmDelete.length} question${confirmDelete.length === 1 ? '' : 's'}?`}
          onClose={() => setConfirmDelete(null)}
        >
          <p className='text-[12px] font-medium text-slate-600 dark:text-slate-300'>
            Students will no longer get {confirmDelete.length === 1 ? 'it' : 'them'} in practice. Past results that used{' '}
            {confirmDelete.length === 1 ? 'it' : 'them'} can still be reviewed.
          </p>
          <div className='mt-4 flex justify-end gap-2'>
            <button type='button' className={btnAlt} onClick={() => setConfirmDelete(null)}>
              Keep
            </button>
            <button
              type='button'
              className={btnBad}
              onClick={() => {
                const ids = confirmDelete
                setConfirmDelete(null)
                void bulk('delete', ids)
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {importing && (
        <ImportDialog
          token={token}
          onClose={() => setImporting(false)}
          onDone={(r) => {
            toast(`Added ${fN(r.created)} question${r.created === 1 ? '' : 's'}.`)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function StatusTags({ q }: { q: CbtAdminQuestion }) {
  return (
    <>
      <Tag tone={q.checked ? 'ok' : 'warn'}>{q.checked ? 'Checked' : 'Not checked'}</Tag>
      {!q.explanation && <Tag tone='bad'>No explanation</Tag>}
      {q.reports > 0 && <Tag tone={q.reports >= 3 ? 'bad' : 'warn'}>{q.reports} report{q.reports === 1 ? '' : 's'}</Tag>}
    </>
  )
}

function ImportDialog({
  token,
  onClose,
  onDone,
}: {
  token?: string
  onClose: () => void
  onDone: (r: CbtImportResult) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, string>[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CbtImportResult | null>(null)

  const [progress, setProgress] = useState('')
  const [damaged, setDamaged] = useState<number[]>([])

  const pick = async (file: File) => {
    setProblem('')
    setResult(null)
    setDamaged([])
    setFileName(file.name)
    let parsed: { headers: string[]; rows: Record<string, string>[] }
    try {
      if (/\.xlsx?$/i.test(file.name)) {
        // Excel workbook: the first sheet, every cell as the text Excel shows.
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
        parsed = tableToObjects(table, REQUIRED_COLUMNS)
      } else {
        // Excel's "CSV" and "Text" saves are often Windows-1252, not UTF-8;
        // read as UTF-8 they turn ×, ÷, ², ° and curly quotes into "�".
        const buf = await file.arrayBuffer()
        let text: string
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
        } catch {
          text = new TextDecoder('windows-1252').decode(buf)
        }
        parsed = csvToObjects(text, REQUIRED_COLUMNS)
      }
    } catch {
      setRows(null)
      setProblem('That file could not be read. Save it from Excel as .xlsx or CSV and try again.')
      return
    }
    const missing = REQUIRED_COLUMNS.filter((c) => !parsed.headers.includes(c))
    if (missing.length) {
      setRows(null)
      setProblem(
        `Missing columns: ${missing.join(', ')}. The first row of the file must be the column names. ` +
          `Found: ${parsed.headers.slice(0, 12).join(', ') || 'nothing'}. Download the template to see the layout.`,
      )
      return
    }
    const rowsWithQuestions = parsed.rows.filter((r) => Object.values(r).some(Boolean))
    if (!rowsWithQuestions.length) {
      setRows(null)
      setProblem('That file has no questions under the column names.')
      return
    }
    setRows(rowsWithQuestions)
    // Excel writes "?" for any symbol its save format cannot hold (−, ₦, Ω, π,
    // H₂O, x⁴…) and "#NAME?" for a cell it took for a formula. Those questions
    // would go live garbled, so name the rows before anything is added.
    const looksDamaged = (v: string) => /#NAME\?|#VALUE!|#REF!|\?\?|\S\?\S|\?\d|\s\?\s/.test(v)
    setDamaged(
      rowsWithQuestions
        .map((r, i) =>
          ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'explanation'].some((k) => looksDamaged(r[k] || ''))
            ? i + 2
            : 0,
        )
        .filter(Boolean),
    )
  }

  // Sent in small batches: one request per ~60 KB keeps each well under the
  // server's size limit and survives a weak connection better than one big one.
  const send = async () => {
    if (!rows) return
    setBusy(true)
    setProblem('')
    const total: CbtImportResult = { created: 0, skipped: [] }
    const batches: { start: number; rows: Record<string, string>[] }[] = []
    let cur: Record<string, string>[] = []
    let size = 0
    let start = 0
    rows.forEach((r, i) => {
      const n = JSON.stringify(r).length
      if (cur.length && (size + n > 60_000 || cur.length >= 200)) {
        batches.push({ start, rows: cur })
        cur = []
        size = 0
        start = i
      }
      cur.push(r)
      size += n
    })
    if (cur.length) batches.push({ start, rows: cur })
    try {
      for (const b of batches) {
        setProgress(`Adding ${fN(Math.min(b.start + b.rows.length, rows.length))} of ${fN(rows.length)}…`)
        const r = await dsaApi.cbt.admin.importRows(b.rows, token)
        total.created += r.created
        total.skipped.push(...r.skipped.map((x) => ({ ...x, row: x.row + b.start })))
      }
      setResult(total)
      onDone(total)
    } catch (e) {
      setProblem(
        `${e instanceof Error ? e.message : 'Import failed'}${
          total.created ? ` ${fN(total.created)} questions were added before it stopped; importing the file again skips them.` : ''
        }`,
      )
      if (total.created) onDone(total)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.json_to_sheet([TEMPLATE_ROW], { header: EXPORT_COLUMNS })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, 'Questions')
    XLSX.writeFile(wb, 'cbt-questions-template.xlsx')
  }

  return (
    <Modal title='Import questions' onClose={onClose} wide>
      {!result ? (
        <>
          <p className='text-[12px] font-medium text-slate-600 dark:text-slate-300'>
            Choose an Excel file (.xlsx) or a CSV file. The first row must be the column names:{' '}
            <b>
              Subject, Topic, Exam, Year, Question, Option A, Option B, Option C, Option D, Answer, Explanation,
              Passage, Image, Image alt, Difficulty
            </b>
            . Exam is JAMB, WAEC, NECO, Post-UTME or DSA Mock. Answer is A, B, C or D. Difficulty is Easy, Medium or
            Hard (Medium if left empty). Questions go live as soon as they are added.
          </p>
          <div className='mt-3 flex flex-wrap gap-2'>
            <button type='button' className={btn} onClick={() => fileRef.current?.click()}>
              <Upload size={13} /> Choose file
            </button>
            <button
              type='button'
              className={btnAlt}
              onClick={() => void downloadTemplate()}
            >
              <Download size={13} /> Template
            </button>
            <input
              ref={fileRef}
              type='file'
              accept='.xlsx,.xls,.csv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void pick(f)
                e.target.value = ''
              }}
            />
          </div>
          {fileName && <p className='mt-3 text-[11px] font-bold text-slate-500'>File: {fileName}</p>}
          {problem && <p className='mt-2 rounded-xl bg-rose-50 p-3 text-[12px] font-bold text-rose-700'>{problem}</p>}
          {damaged.length > 0 && (
            <div className='mt-2 rounded-xl bg-amber-50 p-3 text-[12px] font-bold text-amber-800'>
              {fN(damaged.length)} question{damaged.length === 1 ? '' : 's'} look damaged: symbols such as −, ₦, Ω, π or
              H₂O were saved as “?” (or a cell shows #NAME?). This happens when Excel saves as plain CSV or Text.
              Upload the original .xlsx file instead, or in Excel use <i>Save As → CSV UTF-8</i>. Rows:{' '}
              {damaged.slice(0, 30).join(', ')}
              {damaged.length > 30 ? ` and ${fN(damaged.length - 30)} more` : ''}.
            </div>
          )}
          {rows && (
            <p className='mt-2 text-[12px] font-bold text-slate-700 dark:text-slate-200'>
              {fN(rows.length)} rows found. Rows with missing or invalid fields, and questions already in the bank, are
              skipped and listed afterwards.
            </p>
          )}
          <div className='mt-4 flex justify-end gap-2'>
            <button type='button' className={btnAlt} onClick={onClose}>
              Cancel
            </button>
            <button type='button' className={btn} disabled={!rows || busy} onClick={send}>
              {busy ? progress || 'Adding…' : `Add ${rows ? fN(rows.length) : ''} questions`}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className='text-[13px] font-black text-slate-800 dark:text-slate-100'>
            Added {fN(result.created)} question{result.created === 1 ? '' : 's'}.{' '}
            {result.skipped.length ? `${fN(result.skipped.length)} skipped.` : ''}
          </p>
          {result.skipped.length > 0 && (
            <div className='mt-3 max-h-64 overflow-y-auto rounded-xl bg-rose-50 p-3 text-[11px] font-semibold text-rose-700'>
              {result.skipped.map((s) => (
                <p key={s.row}>
                  Row {s.row}: {s.errors.join(' ')}
                </p>
              ))}
            </div>
          )}
          <div className='mt-4 flex justify-end'>
            <button type='button' className={btn} onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
