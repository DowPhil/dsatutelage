// Platform Settings (admin), the student's download allowance, and Community
// management for staff and students — rendered, with only the network faked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { fakeNetwork } from './fakeApi'

vi.mock('@/lib/realtime', () => ({
  acquireRealtime: () => null,
  releaseRealtime: () => {},
}))

import PlatformSettings from '@/app/admin/components/PlatformSettings'
import CourseMaterials from '@/components/dashboard/CourseMaterials'
import Community from '@/components/dashboard/Community'

const unlimited = () => ({
  quizzes: { enabled: true, monthlyAttempts: null },
  materials: { view: true, download: true, monthlyDownloads: null },
  assignments: { access: true, submit: true },
  liveClasses: { limit: null },
})
const settings = () => ({
  free: {
    quizzes: { enabled: true, monthlyAttempts: 4 },
    materials: { view: true, download: true, monthlyDownloads: 10 },
    assignments: { access: false, submit: false },
    liveClasses: { limit: 5 },
  },
  portal: {
    quizzes: { enabled: true, monthlyAttempts: 10 },
    materials: { view: true, download: true, monthlyDownloads: 20 },
    assignments: { access: false, submit: false },
    liveClasses: { limit: 10 },
  },
  tutorial: unlimited(),
  physical: unlimited(),
})
const payload = (canEdit = true) => ({
  success: true,
  data: {
    categories: [],
    entitlements: settings(),
    timezone: 'Africa/Lagos',
    canEdit,
  },
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('token', 'header.eyJpZCI6InUxIn0.sig')
  localStorage.setItem('dsa_token', 'header.eyJpZCI6InUxIn0.sig')
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }))
  Element.prototype.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Platform Settings', () => {
  it('shows each plan’s entitlements side by side', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/admin\/settings\/platform$/, { body: payload() })
    render(<PlatformSettings token='admin' />)
    expect(await screen.findByText('What each plan includes')).toBeTruthy()
    expect(screen.getByText('4 / month')).toBeTruthy()
    expect(screen.getAllByText('10 / month')).toHaveLength(2) // Portal quizzes, Free downloads
  })

  it('saves only what changed, and shows the saved values', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/admin\/settings\/platform$/, { body: payload() })
    const after = settings()
    after.free.quizzes.monthlyAttempts = 6
    net.on('PATCH', /\/api\/admin\/settings\/platform$/, { body: { success: true, data: { entitlements: after, changes: [] } } })
    render(<PlatformSettings token='admin' />)
    await screen.findByText('What each plan includes')
    fireEvent.click(screen.getByRole('button', { name: /Quizzes & Tests/ }))
    fireEvent.change(screen.getByLabelText('Attempts per month — Free'), { target: { value: '6' } })
    expect(screen.getByText('1 unsaved change')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }))
    expect(await screen.findByText(/Saved 1 change/)).toBeTruthy()
    const patch = net.calls.find((c) => c.method === 'PATCH')!
    expect(patch.body).toEqual({ entitlements: { free: { quizzes: { monthlyAttempts: 6 } } } })
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('will not save an invalid limit', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/admin\/settings\/platform$/, { body: payload() })
    render(<PlatformSettings token='admin' />)
    await screen.findByText('What each plan includes')
    fireEvent.click(screen.getByRole('button', { name: /Study Materials/ }))
    fireEvent.change(screen.getByLabelText('Downloads per month — Free'), { target: { value: '-2' } })
    expect(screen.getByText('A whole number from 0 to 100,000.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Save changes/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(net.calls.some((c) => c.method === 'PATCH')).toBe(false)
  })

  it('asks before opening a feature to free students; Cancel restores the saved values', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/admin\/settings\/platform$/, { body: payload() })
    render(<PlatformSettings token='admin' />)
    await screen.findByText('What each plan includes')
    fireEvent.click(screen.getByRole('button', { name: /Assignments/ }))
    fireEvent.click(screen.getByLabelText('Open assignments — Free'))
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Confirm changes' })
    expect(within(dialog).getByText(/Free · Open assignments/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(net.calls.some((c) => c.method === 'PATCH')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect((screen.getByLabelText('Open assignments — Free') as HTMLInputElement).checked).toBe(false)
  })

  it('is read-only for staff who may only view it', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/admin\/settings\/platform$/, { body: payload(false) })
    render(<PlatformSettings />)
    expect(await screen.findByText(/Read only/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Quizzes & Tests/ }))
    expect((screen.getByLabelText('Attempts per month — Free') as HTMLInputElement).disabled).toBe(true)
  })

  it('shows who changed what in the history', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/admin\/settings\/platform$/, { body: payload() })
    net.on('GET', /\/api\/admin\/settings\/history$/, {
      body: { success: true, data: [{ id: 'h1', area: 'PLATFORM_SETTINGS', at: '2026-10-11T10:00:00Z', by: { id: 'a', name: 'Ada Admin', role: 'admin' }, changes: [{ setting: 'free.quizzes.monthlyAttempts', from: 4, to: 6 }] }] },
    })
    render(<PlatformSettings token='admin' />)
    await screen.findByText('What each plan includes')
    fireEvent.click(screen.getByRole('button', { name: /Settings History/ }))
    expect(await screen.findByText(/free.quizzes.monthlyAttempts: 4 → 6/)).toBeTruthy()
    expect(screen.getByText(/Ada Admin/)).toBeTruthy()
  })
})

describe('Student downloads', () => {
  const me = (used: number) => ({
    success: true,
    data: {
      category: 'free', label: 'Free', unrestricted: false, timezone: 'Africa/Lagos', canUpgrade: true,
      quizzes: { enabled: true, period: '2026-10', used: 0, limit: 4, remaining: 4, resetsAt: '2026-10-31T23:00:00Z' },
      materials: { view: true, download: true, downloads: { period: '2026-10', used, limit: 10, remaining: 10 - used, resetsAt: '2026-10-31T23:00:00Z' } },
      assignments: { access: false, submit: false },
    },
  })
  const course = { success: true, data: [{ id: 'c1', title: 'JAMB Physics', category: 'jamb' }] }
  const materials = {
    success: true,
    data: [{ id: 'm1', title: 'Week 1 notes', type: 'pdf', url: 'https://res.cloudinary.com/x/image/upload/n.pdf', isDownloadable: true }],
  }

  it('downloads through the server with a request key, and shows what is left', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/entitlements\/me$/, { body: me(3) })
    net.on('GET', /\/api\/courses\/mine/, { body: course })
    net.on('GET', /\/api\/courses\/c1\/materials/, { body: materials })
    net.on('POST', /\/api\/materials\/m1\/download$/, {
      body: { success: true, data: { url: 'https://res.cloudinary.com/x/image/upload/fl_attachment/n.pdf', title: 'Week 1 notes', allowance: { used: 4, limit: 10, remaining: 6 }, duplicate: false } },
    })
    const open = vi.fn()
    vi.stubGlobal('open', open)
    render(<CourseMaterials mode='student' />)
    expect(await screen.findByText(/Downloads this month:/)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /Download/ }))
    expect(await screen.findByText(/6 downloads left this month/)).toBeTruthy()
    const post = net.calls.find((c) => c.method === 'POST')!
    expect(post.url).toMatch(/materials\/m1\/download/)
    expect(open).toHaveBeenCalledWith(expect.stringContaining('fl_attachment'), '_blank', 'noopener')
    // "View" is a plain link and never calls the download endpoint.
    expect(screen.getByRole('link', { name: /View/ }).getAttribute('href')).toBe('https://res.cloudinary.com/x/image/upload/n.pdf')
  })

  it('a refused download says why', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/entitlements\/me$/, { body: me(10) })
    net.on('GET', /\/api\/courses\/mine/, { body: course })
    net.on('GET', /\/api\/courses\/c1\/materials/, { body: materials })
    net.on('POST', /\/api\/materials\/m1\/download$/, { status: 403, body: { success: false, message: 'You have used all 10 downloads for this month. They reset on 1 November. Upgrade your plan to unlock more.' } })
    render(<CourseMaterials mode='student' />)
    fireEvent.click(await screen.findByRole('button', { name: /Download/ }))
    expect(await screen.findByText(/used all 10 downloads/)).toBeTruthy()
  })

  it('materials not in the plan show a notice, never stored demo material', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/entitlements\/me$/, { body: me(0) })
    net.on('GET', /\/api\/courses\/mine/, { body: course })
    net.on('GET', /\/api\/courses\/c1\/materials/, { status: 403, body: { success: false, message: 'Study materials are not included in your Free plan. Upgrade your plan to unlock more.' } })
    render(<CourseMaterials mode='student' />)
    expect(await screen.findByText(/Study materials are not included in your Free plan/)).toBeTruthy()
  })
})

describe('Community management', () => {
  const rooms = (net: ReturnType<typeof fakeNetwork>) => {
    net.on('GET', /\/api\/community\/channels$/, { body: { success: true, data: [{ id: 'general', name: 'General', kind: 'general' }, { id: 'jamb-science', name: 'JAMB · Science', kind: 'programme', muted: false }] } })
    net.on('GET', /\/api\/community\/channels\/summary/, { body: { success: true, data: {} } })
    net.on('GET', /\/api\/community\/messages\?/, { body: { success: true, data: [] } })
    net.on('GET', /\/api\/community\/settings/, { body: { success: true, data: { locked: false } } })
    net.on('POST', /\/api\/community\/presence/, { body: { success: true, data: { online: [], typing: [] } } })
    net.on('GET', /\/api\/admin\/users\?/, { body: { success: true, data: [] } })
  }

  it('a Secretary with community.manage gets the Community-wide controls', async () => {
    const net = fakeNetwork()
    rooms(net)
    net.on('GET', /\/api\/community\/access/, { body: { success: true, data: { access: 'all', freeStudentCap: 100, freeStudents: 12, capacityAvailable: true, placesLeft: 88, canManage: true } } })
    render(<Community mode='staff' permissions={['community.manage']} />)
    expect((await screen.findAllByText('Community Access: Free / Paid')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/12 free students in · limit 100 · 88 places left/).length).toBeGreaterThan(0)
  })

  it('staff without it do not', async () => {
    const net = fakeNetwork()
    rooms(net)
    net.on('GET', /\/api\/community\/access/, { body: { success: true, data: { access: 'all' } } })
    render(<Community mode='staff' permissions={['students.view']} />)
    await screen.findAllByText('General')
    expect(screen.queryByText('Community Access: Free / Paid')).toBeNull()
  })

  it('a student has personal settings: membership and muting, no admin controls', async () => {
    const net = fakeNetwork()
    rooms(net)
    net.on('GET', /\/api\/community\/access/, { body: { success: true, data: { access: 'all', me: { allowed: true, tier: 'free', reason: null, message: null } } } })
    net.on('PATCH', /\/api\/community\/channels\/jamb-science\/mute$/, { body: { success: true, data: {} } })
    render(<Community mode='student' />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'My settings' }))[0])
    const panel = await screen.findByRole('region', { name: 'My Community settings' })
    expect(within(panel).getByText(/Free member/)).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: 'Mute JAMB · Science' }))
    await waitFor(() => expect(net.calls.some((c) => c.method === 'PATCH' && /jamb-science\/mute/.test(c.url))).toBe(true))
    expect(screen.queryByText('Community Access: Free / Paid')).toBeNull()
  })
})
