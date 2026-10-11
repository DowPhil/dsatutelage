// A student removed from a Community room: the room stays in their list,
// marked, nothing in it is fetched, and "Rejoin" asks the server — which
// re-checks the room's requirements. Only the network is faked; the socket
// is switched off (the REST path).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { fakeNetwork } from './fakeApi'

vi.mock('@/lib/realtime', () => ({
  acquireRealtime: () => null,
  releaseRealtime: () => {},
}))

import Community from '@/components/dashboard/Community'

const rooms = (removed: boolean) => ({
  success: true,
  data: [
    { id: 'general', name: 'General', kind: 'general', removed: false },
    { id: 'jamb-science', name: 'JAMB · Science', kind: 'programme', track: 'jamb', removed },
  ],
})

const setup = (joinReply: { status?: number; body?: unknown }) => {
  const net = fakeNetwork()
  let removed = true
  net.on('GET', /\/api\/community\/channels$/, () => Promise.resolve({ body: rooms(removed) }))
  net.on('GET', /\/api\/community\/channels\/summary/, { body: { success: true, data: {} } })
  net.on('GET', /\/api\/community\/messages\?/, { body: { success: true, data: [] } })
  net.on('GET', /\/api\/community\/settings/, { body: { success: true, data: { locked: false } } })
  net.on('GET', /\/api\/community\/access/, { body: { success: true, data: { access: 'all' } } })
  net.on('POST', /\/api\/community\/presence/, { body: { success: true, data: { online: [], typing: [] } } })
  net.on('POST', /\/api\/community\/messages\/read/, { body: { success: true, data: { updated: 0 } } })
  net.on('POST', /\/api\/community\/channels\/jamb-science\/join$/, () => {
    if ((joinReply.status ?? 200) < 400) removed = false
    return Promise.resolve(joinReply)
  })
  return net
}

const openRoom = async () => {
  const row = await screen.findByText('You were removed · tap to rejoin')
  fireEvent.click(row.closest('button')!)
  return screen.findByText('You were removed from this room')
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('dsa_token', 'header.eyJpZCI6InN0dWRlbnQtMSJ9.sig')
  // jsdom has no matchMedia; the chat asks it whether the layout is wide.
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

describe('Community — rejoining a room', () => {
  it('a removed room is marked, and nothing in it is fetched', async () => {
    const net = setup({ body: { success: true, data: { channelId: 'jamb-science', rejoined: true } } })
    render(<Community mode='student' />)
    await openRoom()
    expect(screen.getByRole('button', { name: 'Rejoin' })).toBeTruthy()
    // No composer for the removed room.
    expect(screen.queryByPlaceholderText(/message/i)).toBeNull()
    expect(net.calls.some((c) => /messages\?.*channelId=jamb-science/.test(c.url))).toBe(false)
    expect(net.calls.some((c) => /settings\?.*channelId=jamb-science/.test(c.url))).toBe(false)
  })

  it('an eligible student rejoins and the room opens', async () => {
    const net = setup({ body: { success: true, data: { channelId: 'jamb-science', rejoined: true } } })
    render(<Community mode='student' />)
    await openRoom()
    fireEvent.click(screen.getByRole('button', { name: 'Rejoin' }))
    await waitFor(() => expect(screen.queryByText('You were removed from this room')).toBeNull())
    expect(net.posts(/channels\/jamb-science\/join$/)).toHaveLength(1)
    await waitFor(() =>
      expect(net.calls.some((c) => /messages\?.*channelId=jamb-science/.test(c.url))).toBe(true),
    )
  })

  it('a student who no longer qualifies is told so and stays out', async () => {
    const net = setup({ status: 403, body: { success: false, message: "You do not meet this room's requirements" } })
    render(<Community mode='student' />)
    await openRoom()
    fireEvent.click(screen.getByRole('button', { name: 'Rejoin' }))
    expect(await screen.findByText("You do not meet this room's requirements")).toBeTruthy()
    expect(screen.getByText('You were removed from this room')).toBeTruthy()
    expect(net.calls.some((c) => /messages\?.*channelId=jamb-science/.test(c.url))).toBe(false)
  })
})
