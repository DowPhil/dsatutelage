'use client'

// Admin → CBT Platform. Manages what students practise in the CBT Practice
// tab: the question bank, reports students send about questions, plan limits
// and rules, plus insights into how students practise. Everything is read from
// and saved to /api/cbt/admin.

import { useState } from 'react'
import { BarChart3, Database, Flag, Users, SlidersHorizontal, Settings2, MonitorCheck } from 'lucide-react'
import InsightsTab from './InsightsTab'
import BankTab from './BankTab'
import ReportsTab from './ReportsTab'
import StudentsTab from './StudentsTab'
import PlansTab from './PlansTab'
import RulesTab from './RulesTab'
import { useToast } from './ui'

export type CbtAdminTab = 'insights' | 'bank' | 'reports' | 'students' | 'plans' | 'rules'

const TABS: { id: CbtAdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'bank', label: 'Question bank', icon: Database },
  { id: 'reports', label: 'Reports', icon: Flag },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'plans', label: 'Plans and limits', icon: SlidersHorizontal },
  { id: 'rules', label: 'Rules and settings', icon: Settings2 },
]

/** Where a link inside one tab wants to go, with an optional filter or question to open. */
export interface CbtNav {
  tab: CbtAdminTab
  bankStatus?: string
  bankSubject?: string
  bankTopic?: string
  editQuestion?: string
  studentTier?: string
}

export default function CbtPlatform({ token }: { token?: string }) {
  const [nav, setNav] = useState<CbtNav>({ tab: 'insights' })
  const toast = useToast()
  const go = (n: CbtNav) => setNav(n)

  return (
    <div className='min-w-0 space-y-5'>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='rounded-2xl bg-[#002EFF] p-2.5 text-white'>
          <MonitorCheck size={20} />
        </div>
        <div className='min-w-0'>
          <h1 className='text-xl font-black text-slate-900 dark:text-white'>CBT Platform</h1>
          <p className='text-[12px] font-medium text-slate-500'>
            The question bank, limits and rules behind the student CBT Practice tab.
          </p>
        </div>
      </div>

      <nav className='-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1' aria-label='CBT Platform sections'>
        {TABS.map((t) => {
          const on = nav.tab === t.id
          return (
            <button
              key={t.id}
              type='button'
              onClick={() => go({ tab: t.id })}
              aria-current={on ? 'page' : undefined}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[11px] font-black ${
                on
                  ? 'bg-[#002EFF] text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          )
        })}
      </nav>

      {nav.tab === 'insights' && <InsightsTab token={token} go={go} />}
      {nav.tab === 'bank' && (
        <BankTab
          key={`${nav.bankStatus}-${nav.bankSubject}-${nav.bankTopic}-${nav.editQuestion}`}
          token={token}
          toast={toast.show}
          initialStatus={nav.bankStatus}
          initialSubject={nav.bankSubject}
          initialTopic={nav.bankTopic}
          editQuestion={nav.editQuestion}
        />
      )}
      {nav.tab === 'reports' && <ReportsTab token={token} toast={toast.show} go={go} />}
      {nav.tab === 'students' && <StudentsTab key={nav.studentTier} token={token} initialTier={nav.studentTier} />}
      {nav.tab === 'plans' && <PlansTab token={token} toast={toast.show} />}
      {nav.tab === 'rules' && <RulesTab token={token} toast={toast.show} />}
      {toast.node}
    </div>
  )
}
