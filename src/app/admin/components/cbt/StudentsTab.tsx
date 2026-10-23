'use client'

import { useCallback, useEffect, useState } from 'react'
import { dsaApi } from '@/lib/api'
import type { CbtPagination, CbtStudentRow } from '@/lib/cbt-types'
import { Empty, ErrorNote, Loading, Pager, Tag, fN, input } from './ui'

const SORTS: [string, string][] = [
  ['last', 'Last active'],
  ['questions', 'Most questions'],
  ['accuracy', 'Highest accuracy'],
  ['hits', 'Most limit hits'],
  ['mock', 'Mock average'],
]

const lastActive = (r: CbtStudentRow) =>
  r.daysSinceActive === null ? 'Never' : r.daysSinceActive === 0 ? 'Today' : `${r.daysSinceActive} d ago`

export default function StudentsTab({ token, initialTier = '' }: { token?: string; initialTier?: string }) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [tier, setTier] = useState(initialTier)
  const [sort, setSort] = useState('last')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<CbtStudentRow[] | null>(null)
  const [pagination, setPagination] = useState<CbtPagination | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const [reload, setReload] = useState(0)
  const load = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    let off = false
    dsaApi.cbt.admin
      .students({ search: debounced, tier, sort, page, limit: 15 }, token)
      .then((res) => {
        if (off) return
        setRows(res.data)
        setPagination(res.pagination)
        setError('')
      })
      .catch((e) => !off && setError(e instanceof Error ? e.message : 'Could not load students'))
    return () => {
      off = true
    }
  }, [debounced, tier, sort, page, token, reload])

  return (
    <div className='min-w-0 space-y-3'>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
        <input
          type='search'
          className={input}
          placeholder='Search by name or student ID'
          aria-label='Search students'
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <select
          className={input}
          aria-label='Plan'
          value={tier}
          onChange={(e) => {
            setTier(e.target.value)
            setPage(1)
          }}
        >
          <option value=''>All plans</option>
          {['Free', 'Silver', 'Gold', 'Elite'].map((t) => (
            <option key={t}>{t}</option>
          ))}
          <option value='candidates'>Upgrade candidates</option>
        </select>
        <select className={input} aria-label='Sort by' value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <p className='text-[11px] font-medium text-slate-400'>
        A student&apos;s plan comes from what they paid for (Payments). Limit hits count the last 7 days. Upgrade
        candidates are Silver students who hit their daily limit on 3 or more days.
      </p>

      {error ? (
        <ErrorNote message={error} onRetry={load} />
      ) : !rows ? (
        <Loading />
      ) : (
        <div className='min-w-0 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4 dark:border-slate-800 dark:bg-slate-900'>
          <ul className='space-y-2 md:hidden'>
            {rows.map((r) => (
              <li key={r.id} className='rounded-2xl border border-slate-100 p-3 dark:border-slate-800'>
                <div className='flex items-start justify-between gap-2'>
                  <p className='min-w-0'>
                    <b className='block truncate text-[13px] font-black text-slate-800 dark:text-slate-100'>{r.name}</b>
                    <span className='text-[11px] text-slate-400'>{r.studentId}</span>
                  </p>
                  <Tag tone={r.tier === 'Free' ? 'plain' : 'ok'}>{r.tier}</Tag>
                </div>
                <p className='mt-1.5 text-[11px] font-medium text-slate-500'>
                  {lastActive(r)} · {fN(r.questions)} questions · {r.accuracy ?? '–'}% accuracy · mock avg{' '}
                  {r.mockAverage ?? '–'}
                  {r.limitHits ? ` · ${r.limitHits} limit hits` : ''}
                </p>
              </li>
            ))}
          </ul>
          <div className='hidden overflow-x-auto md:block'>
            <table className='w-full min-w-[760px] text-left'>
              <thead>
                <tr className='text-[9px] font-black uppercase text-slate-400'>
                  <th className='py-2 pr-3'>Student</th>
                  <th className='py-2 pr-3'>Plan</th>
                  <th className='py-2 pr-3'>Last active</th>
                  <th className='py-2 pr-3 text-right'>Sessions</th>
                  <th className='py-2 pr-3 text-right'>Questions</th>
                  <th className='py-2 pr-3 text-right'>Accuracy</th>
                  <th className='py-2 pr-3 text-right'>Mocks this month</th>
                  <th className='py-2 pr-3 text-right'>Mock avg</th>
                  <th className='py-2 pr-3 text-right'>Limit hits</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className='border-t border-slate-50 text-[12px] dark:border-slate-800'>
                    <td className='py-2 pr-3'>
                      <b className='font-black text-slate-800 dark:text-slate-100'>{r.name}</b>
                      <br />
                      <span className='text-[11px] text-slate-400'>{r.studentId}</span>
                    </td>
                    <td className='py-2 pr-3'>
                      <Tag tone={r.tier === 'Free' ? 'plain' : 'ok'}>{r.tier}</Tag>
                      {r.tier === 'Silver' && r.limitHits >= 3 && <Tag tone='warn'>Upgrade candidate</Tag>}
                    </td>
                    <td className='py-2 pr-3 text-slate-500'>{lastActive(r)}</td>
                    <td className='py-2 pr-3 text-right font-bold'>{fN(r.sessions)}</td>
                    <td className='py-2 pr-3 text-right font-bold'>{fN(r.questions)}</td>
                    <td className='py-2 pr-3 text-right font-bold'>{r.accuracy === null ? '–' : `${r.accuracy}%`}</td>
                    <td className='py-2 pr-3 text-right font-bold'>{r.mocksThisMonth || '–'}</td>
                    <td className='py-2 pr-3 text-right font-bold'>{r.mockAverage ?? '–'}</td>
                    <td className='py-2 pr-3 text-right'>
                      {r.limitHits ? <Tag tone={r.limitHits >= 3 ? 'bad' : 'warn'}>{r.limitHits}</Tag> : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <Empty>No students match.</Empty>}
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
    </div>
  )
}
