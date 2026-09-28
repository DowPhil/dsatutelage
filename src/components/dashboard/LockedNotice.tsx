'use client'

// Paywall UI — shown only when PAYWALL_ENABLED is on and the student isn't
// entitled. Two shapes: a full-feature lock, and an inline "cap reached" card
// for count-limited lists. Both route the student to the Unlock/Plans screen by
// dispatching a window event the dashboard listens for.

import { Lock, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'

/** Ask the dashboard to open the Unlock/Plans tab. */
export function goToUnlock() {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event('dsa:unlock'))
}

const NEED_LABEL: Record<string, string> = {
  portal: 'Portal Access',
  tutorial: 'the full tutorial',
}

/** Full-feature lock — replaces a gated feature the student can't access. */
export function LockedNotice({
  feature,
  need,
}: {
  feature: string
  need: 'portal' | 'tutorial'
}) {
  return (
    <div className='max-w-md mx-auto py-10 text-center'>
      <div className='h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4'>
        <Lock size={26} className='text-[#002EFF]' />
      </div>
      <h3 className='text-lg font-black text-slate-800'>{feature} is locked</h3>
      <p className='text-[12px] font-medium text-slate-500 mt-1 max-w-xs mx-auto'>
        {feature} unlocks with {NEED_LABEL[need]}. Unlock to join in.
      </p>
      <button
        onClick={goToUnlock}
        className='mt-5 inline-flex items-center gap-2 h-11 px-6 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700'
      >
        <Sparkles size={15} /> Upgrade Plans
      </button>
    </div>
  )
}

/** Inline card appended to a capped list once the free limit is reached. */
export function CapReachedCard({
  what,
  cap,
}: {
  what: string
  cap: number
}) {
  return (
    <Card className='p-4 rounded-2xl border-2 border-dashed border-blue-100 bg-blue-50/40 flex items-center gap-3'>
      <Lock size={18} className='text-[#002EFF] shrink-0' />
      <div className='min-w-0 flex-1'>
        <p className='text-[12px] font-black text-slate-800'>
          You&apos;ve reached your free limit
        </p>
        <p className='text-[11px] font-medium text-slate-500'>
          Free access includes {cap} {what}. Unlock a plan for more.
        </p>
      </div>
      <button
        onClick={goToUnlock}
        className='h-9 px-4 bg-[#002EFF] text-white rounded-lg font-black text-[10px] uppercase tracking-wide hover:bg-blue-700 shrink-0'
      >
        Unlock
      </button>
    </Card>
  )
}
