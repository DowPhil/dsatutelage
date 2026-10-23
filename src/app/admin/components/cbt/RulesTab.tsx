'use client'

import { useCallback, useEffect, useState } from 'react'
import { dsaApi } from '@/lib/api'
import type { CbtRules } from '@/lib/cbt-types'
import { ErrorNote, Loading, Panel, btn, btnAlt, fieldLabel, input } from './ui'

type NumKey = { [K in keyof CbtRules]: CbtRules[K] extends number ? K : never }[keyof CbtRules]

export default function RulesTab({ token, toast }: { token?: string; toast: (text: string, bad?: boolean) => void }) {
  const [saved, setSaved] = useState<CbtRules | null>(null)
  const [r, setR] = useState<CbtRules | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const s = await dsaApi.cbt.admin.settings(token)
      setSaved(s.rules)
      setR({ ...s.rules })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load settings')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!r || !saved) return <Loading />

  const set = <K extends keyof CbtRules>(k: K, v: CbtRules[K]) => setR((p) => (p ? { ...p, [k]: v } : p))
  const num = (k: NumKey, label: string) => (
    <label className={fieldLabel}>
      {label}
      <input
        type='number'
        min={0}
        inputMode='numeric'
        className={input}
        value={r[k]}
        onChange={(e) => set(k, Number(e.target.value) as CbtRules[typeof k])}
      />
    </label>
  )
  const changed = JSON.stringify(r) !== JSON.stringify(saved)

  const save = async () => {
    setSaving(true)
    try {
      const s = await dsaApi.cbt.admin.saveSettings({ rules: r }, token)
      setSaved(s.rules)
      setR({ ...s.rules })
      toast('Settings saved.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', true)
    } finally {
      setSaving(false)
    }
  }

  const totalQs = r.englishQuestions + (r.subjects - 1) * r.otherQuestions

  return (
    <div className='min-w-0 space-y-4'>
      <div className='grid gap-4 lg:grid-cols-2'>
        <Panel
          title='Full JAMB mock'
          hint={`Today: ${r.englishQuestions} + ${r.subjects - 1} × ${r.otherQuestions} = ${totalQs} questions, ${r.subjects * r.marksPerSubject} marks, ${r.mockMinutes} minutes. Other exams (WAEC and so on) are one subject at a time.`}
        >
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {num('englishQuestions', 'English questions')}
            {num('otherQuestions', 'Questions for each other subject')}
            {num('subjects', 'Number of subjects')}
            {num('mockMinutes', 'Time in minutes')}
            {num('marksPerSubject', 'Marks per subject')}
          </div>
        </Panel>

        <Panel
          title='Predicted score'
          hint={`A weighted average of the last ${r.predictionWindow} full mocks, newest counted most. Compare it with real JAMB results when you have them, then adjust.`}
        >
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {num('predictionWindow', 'Number of recent mocks used')}
            {num('predictionMinRange', 'Smallest range (± points)')}
          </div>
        </Panel>

        <Panel title='Leaderboard' hint='Daily, weekly and monthly boards rank everyone together. Ties go to the higher accuracy.'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {num('pointsPerCorrect', 'Points per correct answer')}
            <label className={fieldLabel}>
              Week starts on
              <select className={input} value={r.weekStartsOn} onChange={(e) => set('weekStartsOn', e.target.value)}>
                <option>Monday</option>
                <option>Sunday</option>
              </select>
            </label>
            <label className={fieldLabel}>
              Leaderboard
              <select
                className={input}
                value={r.leaderboard ? '1' : ''}
                onChange={(e) => set('leaderboard', !!e.target.value)}
              >
                <option value='1'>On for everyone</option>
                <option value=''>Off</option>
              </select>
            </label>
          </div>
        </Panel>

        <Panel title='Practice' hint='The three seconds fields give the “about N minutes” estimate students see before untimed practice.'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {num('drillQuestions', 'Daily drill size (questions)')}
            {num('secondsPerQuestion', 'Seconds per question in auto-timed sessions')}
            {num('weakMinAttempts', 'Answers before a topic counts as weak')}
            {num('secEasy', 'Seconds for an easy question')}
            {num('secMedium', 'Seconds for a medium question')}
            {num('secHard', 'Seconds for a hard question')}
            <label className={fieldLabel}>
              Default question order
              <select
                className={input}
                value={r.defaultOrder}
                onChange={(e) => set('defaultOrder', e.target.value as CbtRules['defaultOrder'])}
              >
                <option value='unseen'>Unseen first</option>
                <option value='random'>Random</option>
              </select>
            </label>
          </div>
        </Panel>
      </div>

      <Panel title='Announcements and maintenance'>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <label className={`${fieldLabel} sm:col-span-2`}>
            Message shown at the top of the student CBT Practice tab (leave empty for none)
            <input
              className={input}
              value={r.banner}
              placeholder='For example: Full mocks are open all weekend.'
              onChange={(e) => set('banner', e.target.value)}
            />
          </label>
          <label className={fieldLabel}>
            Maintenance mode
            <select className={input} value={r.maintenance ? '1' : ''} onChange={(e) => set('maintenance', !!e.target.value)}>
              <option value=''>Off</option>
              <option value='1'>On: students see a short pause message</option>
            </select>
          </label>
        </div>
      </Panel>

      <div className='flex flex-wrap gap-2'>
        <button type='button' className={btn} onClick={save} disabled={!changed || saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        <button type='button' className={btnAlt} disabled={!changed} onClick={() => setR({ ...saved })}>
          Undo changes
        </button>
      </div>
    </div>
  )
}
