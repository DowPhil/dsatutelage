'use client'

import { useCallback, useEffect, useState } from 'react'
import { dsaApi } from '@/lib/api'
import type { CbtReportsResponse } from '@/lib/cbt-types'
import type { CbtNav } from './CbtPlatform'
import { Empty, ErrorNote, Loading, Tag, btn, btnAlt } from './ui'

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  return days <= 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`
}

export default function ReportsTab({
  token,
  toast,
  go,
}: {
  token?: string
  toast: (text: string, bad?: boolean) => void
  go: (n: CbtNav) => void
}) {
  const [status, setStatus] = useState<'open' | 'resolved'>('open')
  const [data, setData] = useState<CbtReportsResponse | null>(null)
  const [error, setError] = useState('')

  const [reload, setReload] = useState(0)
  const load = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    let off = false
    dsaApi.cbt.admin
      .reports(status, token)
      .then((d) => {
        if (off) return
        setData(d)
        setError('')
      })
      .catch((e) => !off && setError(e instanceof Error ? e.message : 'Could not load reports'))
    return () => {
      off = true
    }
  }, [status, token, reload])

  const act = async (questionId: string, action: 'resolve' | 'dismiss' | 'reopen') => {
    try {
      await dsaApi.cbt.admin.updateReports(questionId, action, token)
      toast(action === 'reopen' ? 'Reopened.' : action === 'resolve' ? 'Marked as fixed.' : 'Dismissed.')
      void load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That did not work', true)
    }
  }

  return (
    <div className='min-w-0 space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        {(['open', 'resolved'] as const).map((s) => (
          <button
            key={s}
            type='button'
            onClick={() => setStatus(s)}
            className={`h-9 rounded-xl px-3 text-[11px] font-black ${
              status === s ? 'bg-[#002EFF] text-white' : 'bg-white text-slate-500 dark:bg-slate-900'
            }`}
          >
            {s === 'open' ? 'Open' : 'Resolved'} ({data ? data[s] : '…'})
          </button>
        ))}
        <span className='text-[11px] font-medium text-slate-400'>
          Students report a problem from any question. Most reported first.
        </span>
      </div>

      {error ? (
        <ErrorNote message={error} onRetry={load} />
      ) : !data ? (
        <Loading />
      ) : !data.items.length ? (
        <Empty>Nothing here. Reported questions show up in this list.</Empty>
      ) : (
        data.items.map((r) => (
          <div
            key={r.questionId}
            className='rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'
          >
            <div className='flex flex-wrap items-start justify-between gap-2'>
              <p className='min-w-0 flex-1'>
                <b className='block text-[13px] font-black text-slate-800 dark:text-slate-100'>
                  {r.question?.text || 'This question has been deleted'}
                </b>
                {r.question && (
                  <small className='text-[11px] font-medium text-slate-500'>
                    {r.question.subject} · {r.question.topic} · {r.question.exam} {r.question.year} · answer{' '}
                    {['A', 'B', 'C', 'D', 'E'][r.question.answer]} · last report {ago(r.lastReportedAt)}
                    {r.reportedBy.length ? ` · reported by ${r.reportedBy.join(', ')}` : ''}
                  </small>
                )}
              </p>
              <Tag tone={r.count >= 3 ? 'bad' : 'warn'}>
                {r.count} report{r.count === 1 ? '' : 's'}
              </Tag>
            </div>
            <div className='my-2.5'>
              {Object.entries(r.reasons).map(([k, v]) => (
                <Tag key={k}>
                  {k} · {v}
                </Tag>
              ))}
            </div>
            {r.notes.map((n, i) => (
              <p key={i} className='mb-1.5 text-[11px] font-medium text-slate-500'>
                Student note: “{n}”
              </p>
            ))}
            <div className='mt-2 flex flex-wrap gap-2'>
              {r.question && (
                <button type='button' className={btn} onClick={() => go({ tab: 'bank', editQuestion: r.questionId })}>
                  Open and fix
                </button>
              )}
              {status === 'open' ? (
                <>
                  <button type='button' className={btnAlt} onClick={() => act(r.questionId, 'resolve')}>
                    Mark as fixed
                  </button>
                  <button type='button' className={btnAlt} onClick={() => act(r.questionId, 'dismiss')}>
                    Dismiss
                  </button>
                </>
              ) : (
                <button type='button' className={btnAlt} onClick={() => act(r.questionId, 'reopen')}>
                  Reopen
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
