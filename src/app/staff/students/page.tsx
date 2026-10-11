'use client'

// The staff Students page now lives in the staff dashboard (the admin's
// student roster, limited to what the role allows): /staff?tab=students.
// This route stays so existing links and bookmarks still land there.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function StaffStudentsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/staff?tab=students')
  }, [router])
  return (
    <div className='flex min-h-[50vh] items-center justify-center'>
      <Loader2 className='animate-spin text-[#002EFF]' aria-label='Opening Students' />
    </div>
  )
}
