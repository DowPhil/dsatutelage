// The student's own attendance on "My Performance": the server works the rate
// out from eligible sessions only (utils/studentReports on the API), and when a
// student has no eligible session yet it sends no rate — the tile must then
// show no percentage at all, not "0%".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import Analytics from '@/components/dashboard/Analytics'
import { fakeNetwork } from './fakeApi'

const analytics = (over: Record<string, unknown>) => ({
  success: true,
  data: { averageScore: null, progressPercent: 0, perSubject: [], ...over },
})

const attendanceTile = async () => {
  const label = await screen.findByText('Attendance')
  return label.closest('div')!.parentElement as HTMLElement
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('dsa_token', 'header.eyJpZCI6InN0dWRlbnQtMSJ9.sig')
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('My Performance — attendance', () => {
  it('shows the rate over eligible sessions', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/analytics\/me$/, { body: analytics({ attendanceRate: 75, present: 3, totalSessions: 4 }) })
    net.on('GET', /\/api\/grades\/me$/, { body: { success: true, data: [] } })
    render(<Analytics mode='student' />)
    const tile = await attendanceTile()
    expect(within(tile).getByText('75%')).toBeTruthy()
    expect(within(tile).getByText('3/4 sessions')).toBeTruthy()
  })

  it('no eligible sessions yet: no percentage, not 0%', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/analytics\/me$/, { body: analytics({ attendanceRate: null, present: 0, totalSessions: 0 }) })
    net.on('GET', /\/api\/grades\/me$/, { body: { success: true, data: [] } })
    render(<Analytics mode='student' />)
    const tile = await attendanceTile()
    expect(within(tile).getByText('—')).toBeTruthy()
    expect(within(tile).getByText('no sessions yet')).toBeTruthy()
    expect(within(tile).queryByText(/%/)).toBeNull()
  })

  it('every session missed is a real 0%, shown as such', async () => {
    const net = fakeNetwork()
    net.on('GET', /\/api\/analytics\/me$/, { body: analytics({ attendanceRate: 0, present: 0, totalSessions: 5 }) })
    net.on('GET', /\/api\/grades\/me$/, { body: { success: true, data: [] } })
    render(<Analytics mode='student' />)
    const tile = await attendanceTile()
    expect(within(tile).getByText('0%')).toBeTruthy()
    expect(within(tile).getByText('0/5 sessions')).toBeTruthy()
  })
})
