// The attendance & performance screen and the staff dashboard, rendered.
// The real components and API clients run; only the network is faked
// (tests/components/fakeApi.ts) and the socket is switched off, so unread
// badges come from the REST summary — the fallback path.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { fakeNetwork } from './fakeApi'

vi.mock('@/lib/realtime', () => ({
  acquireRealtime: () => null,
  releaseRealtime: () => {},
}))

const session = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
}))
vi.mock('@/components/dashboard/useDashboardSession', () => ({
  useDashboardSession: () => ({ user: session.user, loading: false, logout: () => {} }),
}))

import StudentReports from '@/components/dashboard/StudentReports'
import StaffDashboard from '@/app/staff/page'

const filters = {
  tracks: ['jamb', 'afterschool'],
  departments: ['science', 'art', 'commercial'],
  classLevels: ['SS1', 'SS2', 'SS3'],
  courses: [{ id: 'c1', title: 'JAMB Physics', category: 'jamb', classLevel: null }],
}

const attendance = (over: Record<string, unknown> = {}) => ({
  range: { from: '2026-09-01', to: '2026-09-30', bucket: 'day' },
  settings: { lowThreshold: 75, highThreshold: 90, minSessions: 3 },
  overall: {
    key: 'all', students: 5, trackedStudents: 4, studentsWithAttendance: 3,
    studentsWithNoRecordedAttendance: 1, studentsNotTracked: 1, sessionsRecorded: 6,
    eligibleSessions: 14, present: 8, notCheckedIn: 6, attendanceRate: 57.1,
    averageStudentRate: 56.3, followUp: 1,
    statuses: { present: 8, notCheckedIn: 6, late: null, excused: null },
  },
  trend: [{ period: '2026-09-01', sessions: 2, eligible: 4, present: 3, attendanceRate: 75 }],
  lowAttendance: { total: 1, students: [{ id: 's2', fullname: 'Ada Obi', studentId: 'DSA/2', track: 'jamb', department: 'art', classLevel: 'SS3', eligibleSessions: 4, present: 0, attendanceRate: 0 }] },
  excellentAttendance: { total: 0, students: [] },
  noRecordedAttendance: { total: 0, students: [] },
  byTrack: [{ key: 'jamb', students: 4, trackedStudents: 3, sessionsRecorded: 4, eligibleSessions: 12, present: 7, attendanceRate: 58.3, averageStudentRate: 58.3, followUp: 1, studentsWithNoRecordedAttendance: 1, trend: [], byDepartment: [], byClass: [] }],
  byCourse: [],
  definitions: { attendanceRate: 'Present sessions ÷ eligible sessions × 100.', byCourse: 'Per course.' },
  ...over,
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('dsa_token', 'header.eyJpZCI6Im1lLTEifQ.sig')
  session.user = null
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Attendance & Performance screen', () => {
  it('shows the server\'s figures, and says late / excused are not recorded', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/reports\/filters/, { body: { success: true, data: filters } })
    net.on('GET', /\/api\/reports\/attendance/, { body: { success: true, data: attendance() } })
    render(<StudentReports />)
    expect(await screen.findByText('57.1%')).toBeTruthy()
    expect(screen.getByText('8 of 14 sessions')).toBeTruthy()
    expect(screen.getAllByText('Not recorded')).toHaveLength(2)
    expect(screen.getByText('Ada Obi')).toBeTruthy()
  })

  it('no sessions: an empty state and no percentage', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/reports\/filters/, { body: { success: true, data: filters } })
    const empty = attendance()
    empty.overall = { ...empty.overall, sessionsRecorded: 0, eligibleSessions: 0, present: 0, attendanceRate: null, averageStudentRate: null, trackedStudents: 0 }
    net.on('GET', /\/api\/reports\/attendance/, { body: { success: true, data: empty } })
    render(<StudentReports />)
    expect(await screen.findByText(/No attendance sessions were recorded/)).toBeTruthy()
    expect(screen.queryByText('0%')).toBeNull()
    expect(screen.getByText('No sessions recorded')).toBeTruthy()
  })

  it('filters are sent to the server', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/reports\/filters/, { body: { success: true, data: filters } })
    net.on('GET', /\/api\/reports\/attendance/, { body: { success: true, data: attendance() } })
    render(<StudentReports />)
    await screen.findByText('57.1%')
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'art' } })
    await waitFor(() =>
      expect(net.calls.some((c) => /\/reports\/attendance\?.*department=art/.test(c.url))).toBe(true),
    )
  })

  it('attendance-only staff get no performance tabs and never ask for them', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/reports\/filters/, { body: { success: true, data: filters } })
    net.on('GET', /\/api\/reports\/attendance/, { body: { success: true, data: attendance() } })
    render(<StudentReports canSeePerformance={false} />)
    await screen.findByText('57.1%')
    expect(screen.queryByRole('tab', { name: 'Performance' })).toBeNull()
    expect(net.calls.some((c) => /\/reports\/performance/.test(c.url))).toBe(false)
  })

  it('a failed load can be retried', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/reports\/filters/, { body: { success: true, data: filters } })
    net.on('GET', /\/api\/reports\/attendance/, { status: 500, body: { success: false, message: 'Database unavailable' } })
    render(<StudentReports />)
    expect(await screen.findByText('The report could not be loaded')).toBeTruthy()
    net.on('GET', /\/api\/reports\/attendance/, { body: { success: true, data: attendance() } })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('57.1%')).toBeTruthy()
  })
})

describe('Staff dashboard', () => {
  const staff = (permissions: string[]) => {
    session.user = {
      id: 'me-1', role: 'staff', fullName: 'Grace Secretary', email: 'grace@test.com',
      staffRole: 'Secretary', permissions,
    }
  }
  const community = (net: ReturnType<typeof fakeNetwork>, unread: number) => {
    net.on('GET', /\/api\/community\/channels$/, {
      body: { success: true, data: [{ id: 'general', name: 'General', kind: 'general' }] },
    })
    net.on('GET', /\/api\/community\/channels\/summary/, {
      body: { success: true, data: { general: { unread, mentions: 0, lastMessageAt: '2026-10-11T10:00:00Z' } } },
    })
  }
  const nav = () => {
    const labels = screen.getAllByRole('button').map((b) => b.textContent?.trim() ?? '')
    return (label: string) => labels.some((l) => l.startsWith(label))
  }

  it('every staff member gets the Community, with the unread count before opening it', async () => {
    const net = fakeNetwork()
    community(net, 3)
    staff(['timetable.view'])
    render(<StaffDashboard />)
    // The shell re-creates its nav buttons on render: look the item up afresh.
    await waitFor(() => {
      const item = screen.getAllByRole('button', { name: /Community/ })[0]
      expect(within(item).getByText('3')).toBeTruthy()
    })
  })

  it('shows only what the role permits', async () => {
    const net = fakeNetwork()
    community(net, 0)
    staff(['timetable.view'])
    render(<StaffDashboard />)
    await screen.findAllByRole('button', { name: /Community/ })
    const has = nav()
    expect(has('Timetable')).toBe(true)
    expect(has('Reports')).toBe(false)
    expect(has('Payments')).toBe(false)
    expect(has('Tutors')).toBe(false)
    expect(has('Students')).toBe(false)
  })

  it('a Secretary gets reports, students, announcements and the tutor list', async () => {
    const net = fakeNetwork()
    community(net, 0)
    staff(['students.view', 'reports.view', 'announcements.send', 'tutors.view'])
    render(<StaffDashboard />)
    await screen.findAllByRole('button', { name: /Community/ })
    const has = nav()
    for (const label of ['Reports', 'Students', 'Announcements', 'Tutors']) expect(has(label)).toBe(true)
    expect(has('Guardians')).toBe(false)
  })

  it('attendance.manage alone opens the attendance report', async () => {
    const net = fakeNetwork()
    community(net, 0)
    staff(['attendance.manage'])
    render(<StaffDashboard />)
    await screen.findAllByRole('button', { name: /Community/ })
    expect(nav()('Reports')).toBe(true)
  })
})
