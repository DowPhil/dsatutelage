'use client'

// Quiz builder → Code lock. When on, a quiz or public-link test shows its title
// but not its questions until the taker enters a code.
//  - One code for everyone: a public link test (or any quiz) gets its own code,
//    and anyone who has it can open the test.
//  - A personal code for each student (portal quizzes): every assigned student
//    gets their own code, shown on their dashboard; nobody else can use it.

import { useMemo, useState } from 'react'
import { Copy, Download, KeyRound, Loader2, Wand2 } from 'lucide-react'
import { dsaApi } from '@/lib/api'

export interface CodeLockUse {
  code: string
  email?: string | null
  name?: string | null
  at?: string
}

export interface CodeLockValue {
  enabled: boolean
  mode: 'shared' | 'personal'
  /** One code per line (shared mode). */
  codes: string
}

// No 0/O, 1/I/L: codes are read off WhatsApp messages and typed on phones.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const randomCode = () => {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return `DSA-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')}`
}

export const parseCodes = (text: string) =>
  [...new Set(text.split(/[\n,;]+/).map((c) => c.trim()).filter(Boolean))]

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

function saveCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function CodeLockSettings({
  value,
  onChange,
  uses,
  quizTitle,
  quizId,
  accessMode,
  assignedCount,
  token,
}: {
  value: CodeLockValue
  onChange: (v: CodeLockValue) => void
  uses: CodeLockUse[]
  quizTitle: string
  /** Set when editing a saved quiz (personal codes exist only after saving). */
  quizId: string | null
  accessMode: 'portal' | 'free'
  assignedCount: number
  token?: string
}) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState('')
  const codes = useMemo(() => parseCodes(value.codes), [value.codes])
  const set = (patch: Partial<CodeLockValue>) => onChange({ ...value, ...patch })
  const personal = value.mode === 'personal' && accessMode === 'portal'
  const fileBase = (quizTitle || 'quiz').replace(/[^\w-]+/g, '-').toLowerCase()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the code is still in the box to copy by hand */
    }
  }

  const downloadPersonal = async () => {
    if (!quizId) return
    setDownloading(true)
    setDlError('')
    try {
      const data = await dsaApi.quizzes.accessCodes(quizId, token)
      saveCsv(`${fileBase}-student-codes.csv`, [
        ['name', 'student_id', 'email', 'code', 'used_at'],
        ...data.personal.map((p) => [
          p.name,
          p.studentId,
          p.email,
          p.code,
          p.usedAt ? new Date(p.usedAt).toLocaleString('en-GB') : '',
        ]),
      ])
    } catch (e) {
      setDlError(e instanceof Error ? e.message : 'Could not load the codes')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className='rounded-2xl bg-slate-50/70 p-3 space-y-2.5'>
      <label className='flex items-start justify-between gap-3 cursor-pointer'>
        <span className='text-[11px] font-bold text-slate-600'>
          <span className='flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400'>
            <KeyRound size={12} /> Code lock
          </span>
          Lock with an access code
          <span className='block text-[10px] font-medium text-slate-400'>
            The link (or portal quiz) shows the title only. Takers must enter a code before the questions open.
          </span>
        </span>
        <input
          type='checkbox'
          checked={value.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          className='mt-0.5 h-4 w-4 accent-[#002EFF]'
        />
      </label>

      {value.enabled && (
        <>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            <button
              type='button'
              onClick={() => set({ mode: 'shared' })}
              className={`rounded-xl border-2 p-2.5 text-left ${!personal ? 'border-[#002EFF] bg-white' : 'border-transparent bg-white/60'}`}
            >
              <b className='block text-[11px] font-black text-slate-800'>One code for this test</b>
              <span className='text-[10px] font-medium text-slate-500'>
                Anyone you give the code to can open it. Best for a public link test.
              </span>
            </button>
            <button
              type='button'
              disabled={accessMode === 'free'}
              onClick={() => set({ mode: 'personal' })}
              className={`rounded-xl border-2 p-2.5 text-left disabled:opacity-50 ${personal ? 'border-[#002EFF] bg-white' : 'border-transparent bg-white/60'}`}
            >
              <b className='block text-[11px] font-black text-slate-800'>A personal code for each student</b>
              <span className='text-[10px] font-medium text-slate-500'>
                {accessMode === 'free'
                  ? 'Portal quizzes only (students with accounts).'
                  : 'Each assigned student sees their own code on their dashboard. Nobody else can use it.'}
              </span>
            </button>
          </div>

          {!personal ? (
            <>
              <div className='flex flex-wrap items-center gap-2'>
                <button
                  type='button'
                  onClick={() => set({ codes: randomCode() })}
                  className='flex h-9 items-center gap-1.5 rounded-lg bg-[#002EFF] px-3 text-[10px] font-black uppercase text-white'
                >
                  <Wand2 size={13} /> {codes.length ? 'New code' : 'Generate a code'}
                </button>
                {codes.length > 0 && (
                  <button
                    type='button'
                    onClick={copy}
                    className='flex h-9 items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 text-[10px] font-black uppercase text-slate-600'
                  >
                    <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <label className='block text-[11px] font-bold text-slate-600'>
                Access code <span className='text-slate-400'>(type your own or generate one)</span>
                <input
                  value={value.codes}
                  onChange={(e) => set({ codes: e.target.value })}
                  placeholder='e.g. MOCK-OCT31'
                  className='mt-1 block h-10 w-full rounded-lg bg-white border border-slate-200 px-2 font-mono text-[13px] font-bold outline-none focus:border-[#002EFF]'
                />
              </label>
              <p className='text-[10px] font-bold text-slate-500'>
                Send this code to the people who paid. Not case-sensitive; spaces and dashes are ignored.
                {uses.length ? ` Opened by ${uses.length} so far.` : ''}
                {!codes.length && <span className='text-rose-600'> Add a code before saving.</span>}
              </p>
            </>
          ) : (
            <>
              <p className='rounded-xl bg-white p-2.5 text-[10px] font-bold text-slate-600'>
                Codes are created for the students chosen under <b>Audience → specific students</b> when you save.
                Each student sees their code on the quiz in their dashboard. Students you add later get a code when you
                save again; existing codes never change.
                {assignedCount === 0 && (
                  <span className='mt-1 block text-rose-600'>
                    No students assigned yet — choose the students who paid, or nobody will get a code.
                  </span>
                )}
              </p>
              {quizId ? (
                <button
                  type='button'
                  onClick={() => void downloadPersonal()}
                  disabled={downloading}
                  className='flex h-9 items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 text-[10px] font-black uppercase text-slate-600 disabled:opacity-50'
                >
                  {downloading ? <Loader2 size={13} className='animate-spin' /> : <Download size={13} />} Download student codes
                </button>
              ) : (
                <p className='text-[10px] font-medium text-slate-400'>After saving, edit the quiz to download the list of codes.</p>
              )}
              {dlError && <p className='text-[10px] font-bold text-rose-600'>{dlError}</p>}
            </>
          )}

          {uses.length > 0 && (
            <details className='rounded-lg bg-white p-2'>
              <summary className='cursor-pointer text-[10px] font-black uppercase text-slate-500'>
                Who has opened it ({uses.length})
              </summary>
              <ul className='mt-1 max-h-40 overflow-y-auto text-[11px] text-slate-600'>
                {uses.map((u, i) => (
                  <li key={i} className='flex justify-between gap-2 border-t border-slate-50 py-1'>
                    <span className='truncate'>{u.name || u.email || 'Student'}</span>
                    <span className='shrink-0 text-slate-400'>{u.at ? new Date(u.at).toLocaleString('en-GB') : ''}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}
