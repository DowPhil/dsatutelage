'use client'

import { Sparkles } from 'lucide-react'
import { useCachedUser } from '@/lib/useCachedUser'
import { planSummary, type PlanStatus } from '@/lib/subscription'

const TONE: Record<PlanStatus, string> = {
  active: 'bg-emerald-400/20 text-emerald-100',
  pending: 'bg-amber-300/20 text-amber-100',
  expired: 'bg-rose-400/20 text-rose-100',
  disabled: 'bg-rose-400/20 text-rose-100',
  free: 'bg-white/15 text-white',
}

/**
 * The student's current plan, in the dashboard sidebar. Reads the cached
 * profile, which the dashboard refreshes from /auth/me (on load, every minute,
 * on focus, and after a payment), so it follows approvals and renewals.
 */
export default function PlanBadge() {
  const user = useCachedUser()
  const plan = planSummary(user)

  return (
    <div
      className='mt-2 rounded-lg bg-white/10 px-2 py-1.5'
      title={plan.detail}
      data-plan-status={plan.status}
    >
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${TONE[plan.status]}`}
      >
        {plan.status === 'active'
          ? 'Active plan'
          : plan.status === 'free'
            ? 'Current plan'
            : plan.title}
      </span>
      {plan.status !== 'pending' && plan.status !== 'disabled' && (
        <p className='mt-1 text-[10px] font-black text-white leading-tight truncate'>
          {plan.title}
        </p>
      )}
      <p className='text-[9px] font-medium text-blue-100/80 leading-snug'>
        {plan.detail}
      </p>
      {plan.showUpgrade && (
        <button
          type='button'
          onClick={() => window.dispatchEvent(new Event('dsa:unlock'))}
          className='mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase text-yellow-300 hover:text-yellow-200'
        >
          <Sparkles size={10} /> Upgrade Plan
        </button>
      )}
    </div>
  )
}
