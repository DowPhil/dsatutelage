// Guardian management, the staff student roster's permissions, the staff
// navigation, and the Community access panel / student gate — rendered, with
// only the network faked (tests/components/fakeApi.ts) and the socket off.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { fakeNetwork } from './fakeApi'

vi.mock('@/lib/realtime', () => ({
  acquireRealtime: () => null,
  releaseRealtime: () => {},
}))

const session = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }))
vi.mock('@/components/dashboard/useDashboardSession', () => ({
  useDashboardSession: () => ({ user: session.user, loading: false, logout: () => {} }),
}))

import GuardianManagement from '@/components/dashboard/GuardianManagement'
import StudentRoster from '@/app/admin/components/StudentRoster'
import StaffDashboard from '@/app/staff/page'
import Community from '@/components/dashboard/Community'

const guardian = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  fullname: 'Mrs Ada Obi',
  username: 'adaobi',
  email: 'ada@example.com',
  phoneNumber: '08011112222',
  status: 'active',
  role: 'parent',
  wardId: 'DSA/2026-0001',
  ward: { id: 's1', studentId: 'DSA/2026-0001', fullname: 'Chidi Obi', level: 'SS3', examTrack: 'jamb' },
  ...over,
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('token', 'header.eyJpZCI6InN0YWZmLTEifQ.sig')
  localStorage.setItem('dsa_token', 'header.eyJpZCI6InN0YWZmLTEifQ.sig')
  session.user = null
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {},
  }))
  Element.prototype.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Guardians', () => {
  const listRoute = /\/api\/admin\/users\?.*role=parent/

  it('lists guardians with their linked student', async () => {
    const net = fakeNetwork()
    net.on('GET', listRoute, { body: { success: true, count: 1, data: [guardian()] } })
    render(<GuardianManagement />)
    expect(await screen.findByText('Mrs Ada Obi')).toBeTruthy()
    expect(screen.getByText('Chidi Obi')).toBeTruthy()
    expect(screen.getByText(/DSA\/2026-0001 · SS3 · JAMB/)).toBeTruthy()
  })

  it('shows an honest empty state (no stored or demo guardians)', async () => {
    const net = fakeNetwork()
    net.on('GET', listRoute, { body: { success: true, count: 0, data: [] } })
    localStorage.setItem('dsa_guardians', JSON.stringify([{ key: 'fake', name: 'Fake Guardian' }]))
    render(<GuardianManagement />)
    expect(await screen.findByText('No guardians yet.')).toBeTruthy()
    expect(screen.queryByText('Fake Guardian')).toBeNull()
  })

  it('a failed load shows the error with a retry', async () => {
    const net = fakeNetwork()
    net.on('GET', listRoute, { status: 403, body: { success: false, message: 'Not allowed — your staff role needs guardians.view' } })
    render(<GuardianManagement />)
    expect(await screen.findByText('The guardian list could not be loaded')).toBeTruthy()
    net.on('GET', listRoute, { body: { success: true, count: 1, data: [guardian()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Mrs Ada Obi')).toBeTruthy()
  })

  it('creates a guardian linked to a searched student, and the list refreshes', async () => {
    const net = fakeNetwork()
    let created = false
    net.on('GET', listRoute, () =>
      Promise.resolve({ body: { success: true, count: created ? 1 : 0, data: created ? [guardian({ fullname: 'Mr Bayo Ade' })] : [] } }),
    )
    net.on('GET', /\/api\/admin\/users\?.*role=student/, {
      body: { success: true, data: [{ id: 's9', studentId: 'DSA/2026-0009', fullname: 'Tolu Ade', level: 'SS2' }] },
    })
    net.on('POST', /\/api\/admin\/staff$/, () => {
      created = true
      return Promise.resolve({ status: 201, body: { success: true, data: { id: 'g2' } } })
    })
    render(<GuardianManagement />)
    await screen.findByText('No guardians yet.')
    fireEvent.click(screen.getByRole('button', { name: /Add Guardian/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Full name'), { target: { value: 'Mr Bayo Ade' } })
    fireEvent.change(within(dialog).getByLabelText('Username'), { target: { value: 'bayoade' } })
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'bayo@example.com' } })
    fireEvent.change(within(dialog).getByLabelText('Phone'), { target: { value: '08033334444' } })
    fireEvent.change(within(dialog).getByLabelText('Temporary password'), { target: { value: 'secret12' } })
    fireEvent.change(within(dialog).getByLabelText('Search students to link'), { target: { value: 'Tolu' } })
    fireEvent.click(await within(dialog).findByText('Tolu Ade'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create guardian' }))
    expect(await screen.findByText(/Guardian Mr Bayo Ade created for Tolu Ade/)).toBeTruthy()
    const post = net.posts(/\/api\/admin\/staff$/)[0]
    expect(post.body).toMatchObject({ role: 'parent', wardId: 'DSA/2026-0009', email: 'bayo@example.com', phoneNumber: '08033334444' })
    expect(await screen.findByText('Mr Bayo Ade')).toBeTruthy()
  })

  it('validates before sending anything', async () => {
    const net = fakeNetwork()
    net.on('GET', listRoute, { body: { success: true, count: 0, data: [] } })
    render(<GuardianManagement />)
    await screen.findByText('No guardians yet.')
    fireEvent.click(screen.getByRole('button', { name: /Add Guardian/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Full name'), { target: { value: 'Mr Bayo Ade' } })
    fireEvent.change(within(dialog).getByLabelText('Username'), { target: { value: 'bayoade' } })
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'bayo@example.com' } })
    fireEvent.change(within(dialog).getByLabelText('Phone'), { target: { value: '123' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create guardian' }))
    expect(await within(dialog).findByText(/valid phone number/)).toBeTruthy()
    expect(net.posts(/\/api\/admin\/staff$/)).toHaveLength(0)
  })

  it('shows the server refusing a link the caller may not make', async () => {
    const net = fakeNetwork()
    net.on('GET', listRoute, { body: { success: true, count: 1, data: [guardian()] } })
    net.on('GET', /\/api\/admin\/users\?.*role=student/, {
      body: { success: true, data: [{ id: 's7', studentId: 'DSA/2026-0007', fullname: 'Emeka Nwosu', level: 'SS1' }] },
    })
    net.on('PATCH', /\/api\/admin\/users\/g1$/, {
      status: 403, body: { success: false, message: 'Not allowed — you can only link a guardian to a student on the staff roster' },
    })
    render(<GuardianManagement />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Mrs Ada Obi' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change' }))
    fireEvent.change(within(dialog).getByLabelText('Search students to link'), { target: { value: 'Emeka' } })
    fireEvent.click(await within(dialog).findByText('Emeka Nwosu'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByText(/only link a guardian to a student on the staff roster/)).toBeTruthy()
    const patch = net.calls.find((c) => c.method === 'PATCH')!
    expect(patch.body).toEqual({ wardId: 'DSA/2026-0007' })
  })

  it('hides what the role may not do', async () => {
    const net = fakeNetwork()
    net.on('GET', listRoute, { body: { success: true, count: 1, data: [guardian()] } })
    render(<GuardianManagement access={{ canCreate: false, canManage: false, canDelete: false }} />)
    await screen.findByText('Mrs Ada Obi')
    expect(screen.queryByRole('button', { name: /Add Guardian/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit Mrs Ada Obi' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Suspend Mrs Ada Obi' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete Mrs Ada Obi' })).toBeNull()
    expect(screen.getByRole('button', { name: 'View Mrs Ada Obi' })).toBeTruthy()
  })
})

describe('Student roster permissions', () => {
  const students = {
    success: true, count: 1,
    data: [{ id: 's1', studentId: 'DSA/2026-0001', fullname: 'Chidi Obi', email: 'c@x.com', role: 'student', status: 'active', accessLevel: 'portal' }],
  }

  it('the admin view offers every action', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/admin\/users\?.*role=student/, { body: students })
    net.on('GET', /\/api\/admin\/plans/, { body: { success: true, data: [] } })
    render(<StudentRoster />)
    expect((await screen.findAllByText('Chidi Obi')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Add Student/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Export Excel/ })).toBeTruthy()
    expect(screen.getAllByTitle('Soft Delete Student').length).toBeGreaterThan(0)
  })

  it('a view-only role sees the roster without create, export, status or delete', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/admin\/users\?.*role=student/, { body: students })
    net.on('GET', /\/api\/plans$/, { body: { success: true, data: [] } })
    const none = { canCreate: false, canEdit: false, canChangeStatus: false, canDelete: false, canExport: false, canSendActivation: false, canReviewChanges: false, canSeePlans: false }
    render(<StudentRoster access={none} />)
    expect((await screen.findAllByText('Chidi Obi')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Add Student/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Export Excel/ })).toBeNull()
    expect(screen.queryAllByTitle('Soft Delete Student')).toHaveLength(0)
    expect(screen.queryAllByTitle('Suspend Student')).toHaveLength(0)
    // The admin plan list is never requested without payments.manage.
    expect(net.calls.some((c) => /\/api\/admin\/plans/.test(c.url))).toBe(false)
  })

  it('a failed load is an error with a retry, not an empty roster', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/admin\/users\?.*role=student/, { status: 500, body: { message: 'Database unavailable' } })
    net.on('GET', /\/api\/admin\/plans/, { body: { success: true, data: [] } })
    render(<StudentRoster />)
    expect(await screen.findByText('The student list could not be loaded')).toBeTruthy()
  })
})

describe('Staff navigation', () => {
  const staff = (permissions: string[]) => {
    session.user = { id: 'me-1', role: 'staff', fullName: 'Grace Secretary', email: 'g@x.com', staffRole: 'Secretary', permissions }
  }
  const quiet = (net: ReturnType<typeof fakeNetwork>) => {
    net.on('GET', /\/api\/community\/channels$/, { body: { success: true, data: [] } })
    net.on('GET', /\/api\/community\/channels\/summary/, { body: { success: true, data: {} } })
  }
  const labels = () => screen.getAllByRole('button').map((b) => b.textContent?.trim() ?? '')

  it('a Secretary sees Students, Guardians and Attendance & Performance', async () => {
    const net = fakeNetwork()
    quiet(net)
    staff(['students.view', 'students.manage', 'guardians.view', 'guardians.create', 'guardians.manage', 'reports.view'])
    render(<StaffDashboard />)
    await screen.findAllByRole('button', { name: /Community/ })
    for (const l of ['Students', 'Guardians', 'Attendance & Performance']) {
      expect(labels().some((x) => x.startsWith(l))).toBe(true)
    }
    expect(labels().some((x) => x === 'Reports')).toBe(false)
  })

  it('without guardian permissions there is no Guardians item', async () => {
    const net = fakeNetwork()
    quiet(net)
    staff(['students.view'])
    render(<StaffDashboard />)
    await screen.findAllByRole('button', { name: /Community/ })
    expect(labels().some((x) => x.startsWith('Guardians'))).toBe(false)
  })
})

describe('Community access', () => {
  const rooms = (net: ReturnType<typeof fakeNetwork>) => {
    net.on('GET', /\/api\/community\/channels$/, { body: { success: true, data: [{ id: 'general', name: 'General', kind: 'general' }] } })
    net.on('GET', /\/api\/community\/channels\/summary/, { body: { success: true, data: {} } })
    net.on('GET', /\/api\/community\/messages\?/, { body: { success: true, data: [] } })
    net.on('GET', /\/api\/community\/settings/, { body: { success: true, data: { locked: false } } })
    net.on('POST', /\/api\/community\/presence/, { body: { success: true, data: { online: [], typing: [] } } })
    net.on('GET', /\/api\/admin\/users\?/, { body: { success: true, data: [] } })
  }

  it('a student kept out sees why, not a broken chat', async () => {
    const net = fakeNetwork()
    rooms(net)
    net.on('GET', /\/api\/community\/access/, {
      body: { success: true, data: { access: 'all', me: { allowed: false, tier: null, reason: 'cap_reached', message: 'The Community is full for free students right now.' } } },
    })
    render(<Community mode='student' />)
    expect(await screen.findByText('The Community is full right now')).toBeTruthy()
    expect(screen.getByText(/full for free students/)).toBeTruthy()
  })

  it('the admin sees Community Access (Free / Paid), the cap and occupancy, and can change the cap', async () => {
    const net = fakeNetwork()
    rooms(net)
    net.on('GET', /\/api\/community\/access/, {
      body: { success: true, data: { access: 'all', freeStudentCap: 100, freeStudents: 37, capacityAvailable: true, placesLeft: 63 } },
    })
    net.on('PATCH', /\/api\/community\/access/, {
      body: { success: true, data: { access: 'all', freeStudentCap: 50, freeStudents: 37, capacityAvailable: true, placesLeft: 13 } },
    })
    render(<Community mode='admin' token='admin-token' />)
    const heading = (await screen.findAllByText('Community Access: Free / Paid'))[0]
    const panel = heading.closest('div') as HTMLElement
    expect(within(panel).getByText(/37 free students in · limit 100 · 63 places left/)).toBeTruthy()
    fireEvent.change(within(panel).getByLabelText('Free-student limit'), { target: { value: '-3' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Save limit' }))
    expect(await within(panel).findByText(/whole number from 0 to 1,000,000/)).toBeTruthy()
    expect(net.calls.some((c) => c.method === 'PATCH')).toBe(false)
    fireEvent.change(within(panel).getByLabelText('Free-student limit'), { target: { value: '50' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Save limit' }))
    expect(await within(panel).findByText('Free students limited to 50.')).toBeTruthy()
    expect(net.calls.find((c) => c.method === 'PATCH')!.body).toEqual({ freeStudentCap: 50 })
    await waitFor(() => expect(within(panel).getByText(/limit 50 · 13 places left/)).toBeTruthy())
  })
})
