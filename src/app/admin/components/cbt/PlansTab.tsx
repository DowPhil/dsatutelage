'use client'

import { useCallback, useEffect, useState } from 'react'
import { dsaApi } from '@/lib/api'
import { CBT_TIERS, type CbtLimits, type CbtSettingsData, type CbtTier, type CbtWhatIf } from '@/lib/cbt-types'
import { ErrorNote, Loading, Panel, btn, btnAlt, input, pct } from './ui'

const NUMBERS: [keyof CbtLimits, string][] = [
  ['day', 'Questions per day'],
  ['mocks', 'Full JAMB mocks per month'],
  ['sess', 'Longest practice session'],
  ['ps', 'Questions per subject (custom mode)'],
  ['saved', 'Saved questions'],
]
const TOGGLES: [keyof CbtLimits, string][] = [
  ['pred', 'Predicted score and monthly trend'],
  ['year', 'Exam-year filter'],
  ['missed', '“Ones I got wrong first”'],
]

const TIER_NOTE: Record<CbtTier, string> = {
  Free: 'No paid plan',
  Silver: 'Silver plans, and paid plans with no tier in the name',
  Gold: 'Gold plans',
  Elite: 'Elite plans',
}

type Plans = Record<CbtTier, CbtLimits>

export default function PlansTab({ token, toast }: { token?: string; toast: (text: string, bad?: boolean) => void }) {
  const [saved, setSaved] = useState<Plans | null>(null)
  const [draft, setDraft] = useState<Plans | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const s: CbtSettingsData = await dsaApi.cbt.admin.settings(token)
      setSaved(s.plans)
      setDraft(JSON.parse(JSON.stringify(s.plans)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load plans')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!draft || !saved) return <Loading />

  const setVal = (t: CbtTier, k: keyof CbtLimits, v: number | boolean | null) =>
    setDraft((d) => (d ? { ...d, [t]: { ...d[t], [k]: v } } : d))
  const changed = JSON.stringify(draft) !== JSON.stringify(saved)
  const invalid = CBT_TIERS.some((t) =>
    NUMBERS.some(([k]) => {
      const v = draft[t][k]
      return v !== null && !(Number.isInteger(v) && (v as number) >= 0)
    }),
  )

  const save = async () => {
    setSaving(true)
    try {
      const s = await dsaApi.cbt.admin.saveSettings({ plans: draft }, token)
      setSaved(s.plans)
      setDraft(JSON.parse(JSON.stringify(s.plans)))
      toast('Plans saved. Students see the new limits straight away.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='min-w-0 space-y-4'>
      <Panel
        title='What each plan includes'
        hint='Students see these limits straight away. Locked features stay visible to them, with an upgrade message. A student’s plan comes from the name of the plan they paid for (for example “JAMB Gold — 3 Months”).'
      >
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[720px] text-left'>
            <thead>
              <tr className='text-[9px] font-black uppercase text-slate-400'>
                <th className='py-2 pr-3' />
                {CBT_TIERS.map((t) => (
                  <th key={t} className='py-2 pr-3'>
                    {t}
                    <span className='block text-[8px] font-bold normal-case text-slate-300'>{TIER_NOTE[t]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NUMBERS.map(([k, label]) => (
                <tr key={k} className='border-t border-slate-50 dark:border-slate-800'>
                  <td className='py-2.5 pr-3 text-[11px] font-black text-slate-700 dark:text-slate-200'>{label}</td>
                  {CBT_TIERS.map((t) => {
                    const v = draft[t][k] as number | null
                    const unlimited = v === null
                    return (
                      <td key={t} className='py-2.5 pr-3 align-top'>
                        <input
                          type='number'
                          min={0}
                          inputMode='numeric'
                          className={`${input} w-24 ${v !== saved[t][k] ? 'border-blue-300 bg-blue-50/50' : ''}`}
                          aria-label={`${label}, ${t}`}
                          value={unlimited ? '' : v}
                          disabled={unlimited}
                          onChange={(e) => setVal(t, k, e.target.value === '' ? 0 : Number(e.target.value))}
                        />
                        <label className='mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-500'>
                          <input
                            type='checkbox'
                            className='h-3.5 w-3.5 accent-[#002EFF]'
                            checked={unlimited}
                            onChange={(e) => setVal(t, k, e.target.checked ? null : 0)}
                          />
                          Unlimited
                        </label>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {TOGGLES.map(([k, label]) => (
                <tr key={k} className='border-t border-slate-50 dark:border-slate-800'>
                  <td className='py-2.5 pr-3 text-[11px] font-black text-slate-700 dark:text-slate-200'>{label}</td>
                  {CBT_TIERS.map((t) => (
                    <td key={t} className='py-2.5 pr-3'>
                      <label className='flex items-center gap-1.5 text-[11px] font-bold text-slate-600'>
                        <input
                          type='checkbox'
                          className='h-4 w-4 accent-[#002EFF]'
                          checked={!!draft[t][k]}
                          onChange={(e) => setVal(t, k, e.target.checked)}
                          aria-label={`${label}, ${t}`}
                        />
                        Included
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className='mt-4 flex flex-wrap gap-2'>
          <button type='button' className={btn} onClick={save} disabled={!changed || invalid || saving}>
            {saving ? 'Saving…' : 'Save plans'}
          </button>
          <button
            type='button'
            className={btnAlt}
            disabled={!changed}
            onClick={() => setDraft(JSON.parse(JSON.stringify(saved)))}
          >
            Undo changes
          </button>
        </div>
      </Panel>

      <WhatIf token={token} current={saved.Silver.day} />
    </div>
  )
}

/** How many active Silver students would hit a different daily limit, from last week's busiest days. */
function WhatIf({ token, current }: { token?: string; current: number | null }) {
  const [day, setDay] = useState(current ?? 100)
  const [data, setData] = useState<CbtWhatIf | null>(null)

  useEffect(() => {
    const id = setTimeout(() => {
      dsaApi.cbt.admin.whatIf('Silver', day, token).then(setData).catch(() => setData(null))
    }, 250)
    return () => clearTimeout(id)
  }, [day, token])

  return (
    <Panel
      title='What if: Silver daily limit'
      hint="Uses last week's busiest day for each Silver student active in the last 7 days."
    >
      <div className='flex flex-wrap items-center gap-3'>
        <input
          type='range'
          min={10}
          max={400}
          step={10}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className='w-full max-w-xs accent-[#002EFF]'
          aria-label='Hypothetical Silver daily limit'
        />
        <b className='text-[13px] font-black text-slate-800 dark:text-slate-100'>{day} questions a day</b>
      </div>
      {data && (
        <div className='mt-3 text-[12px]'>
          <p className='font-bold text-slate-700 dark:text-slate-200'>
            {data.wouldHit} of {data.active} active Silver students ({pct(data.wouldHit, data.active)}%) would reach the
            limit in a typical week at {day} a day.
          </p>
          <p className='mt-1 font-medium text-slate-500'>
            At the current setting ({data.currentLimit ?? 'unlimited'}), {data.hitNow} students (
            {pct(data.hitNow, data.active)}%) reach it. A lower limit pushes more students toward upgrading, but too low
            may put students off practising.
          </p>
        </div>
      )}
    </Panel>
  )
}
