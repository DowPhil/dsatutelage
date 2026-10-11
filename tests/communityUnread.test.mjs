// Community unread badges: the counting rules (lib/communityUnreadTracker).
// The server summary is the truth; socket activity moves it in between.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { UnreadTracker } = await import('../src/lib/communityUnreadTracker.ts')

const ME = 'me-1'
const T0 = Date.parse('2026-10-11T10:00:00Z')
const at = (s) => new Date(T0 + s * 1000).toISOString()

const fresh = () => {
  const t = new UnreadTracker(ME)
  t.setRooms(['general', 'jamb-science', 'waec-art'], ['waec-art'])
  t.applySummary({
    general: { unread: 2, mentions: 0, lastMessageAt: at(0), lastMessageText: 'hi' },
    'jamb-science': { unread: 1, mentions: 1, lastMessageAt: at(0) },
    'waec-art': { unread: 5, mentions: 0, lastMessageAt: at(0) },
  })
  return t
}

const msg = (id, over = {}) => ({
  kind: 'new', channelId: 'general', messageId: id, senderId: 'tutor-1', createdAt: at(10), ...over,
})

describe('Community unread badges', () => {
  it('the nav total adds every room except muted ones', () => {
    const t = fresh()
    assert.equal(t.get('general').unread, 2)
    assert.equal(t.get('waec-art').unread, 5)
    assert.equal(t.total(), 3, 'waec-art is muted')
  })

  it('a new message from someone else counts once, however often it is announced', () => {
    const t = fresh()
    t.applyActivity(msg('m1'))
    t.applyActivity(msg('m1'))
    t.applyActivity(msg('m1'))
    assert.equal(t.get('general').unread, 3)
  })

  it('your own messages never count', () => {
    const t = fresh()
    t.applyActivity(msg('m2', { senderId: ME }))
    assert.equal(t.get('general').unread, 2)
  })

  it('the room on screen does not count; leaving it lets new ones count again', () => {
    const t = fresh()
    t.setViewing('general')
    assert.equal(t.get('general').unread, 0, 'opening the room clears it')
    t.applyActivity(msg('m3'))
    assert.equal(t.get('general').unread, 0)
    t.setViewing(null)
    t.applyActivity(msg('m4', { createdAt: at(20) }))
    assert.equal(t.get('general').unread, 1)
  })

  it('mentions are counted for @everyone and for being named', () => {
    const t = fresh()
    t.applyActivity(msg('m5', { mentionsEveryone: true }))
    t.applyActivity(msg('m6', { mentions: [ME] }))
    t.applyActivity(msg('m7', { mentions: ['someone-else'] }))
    assert.equal(t.get('general').mentions, 2)
    assert.equal(t.get('general').unread, 5)
  })

  it('activity in a room you cannot see is ignored', () => {
    const t = fresh()
    t.applyActivity(msg('m8', { channelId: 'postutme-art' }))
    assert.equal(t.get('postutme-art').unread, 0)
    assert.equal(t.total(), 3)
  })

  it('a fresh summary does not double-count messages the server already had', () => {
    const t = fresh()
    t.applyActivity(msg('m9', { createdAt: at(10) }))
    assert.equal(t.get('general').unread, 3)
    // The server's figure includes m9 (its lastMessageAt is m9's time).
    t.applySummary({ general: { unread: 3, lastMessageAt: at(10) } }, ['general'])
    assert.equal(t.get('general').unread, 3)
  })

  it('a summary taken before a live message keeps that message counted', () => {
    const t = fresh()
    t.applyActivity(msg('m10', { createdAt: at(30) }))
    // The request started before m10 arrived: the server saw up to at(0).
    t.applySummary({ general: { unread: 2, lastMessageAt: at(0) } }, ['general'])
    assert.equal(t.get('general').unread, 3)
    // A later summary that does include it settles the count.
    t.applySummary({ general: { unread: 3, lastMessageAt: at(30) } }, ['general'])
    assert.equal(t.get('general').unread, 3)
  })

  it('reading a room (here or on another device) clears it', () => {
    const t = fresh()
    t.applyActivity(msg('m11'))
    t.markRead('general')
    assert.equal(t.get('general').unread, 0)
    assert.equal(t.get('general').mentions, 0)
    // A summary that raced the read and still has the old figure later is
    // replaced by the next one; a live message after the read counts again.
    t.applyActivity(msg('m12', { createdAt: at(40) }))
    assert.equal(t.get('general').unread, 1)
  })

  it('deleting a message counted here takes it off; otherwise the room is re-checked', () => {
    const t = fresh()
    t.applyActivity(msg('m13', { mentionsEveryone: true }))
    assert.equal(t.applyActivity({ kind: 'delete', channelId: 'general', messageId: 'm13', senderId: 'tutor-1' }), null)
    assert.equal(t.get('general').unread, 2)
    assert.equal(t.get('general').mentions, 0)
    // A message from before the last summary: only the server knows.
    assert.equal(t.applyActivity({ kind: 'delete', channelId: 'general', messageId: 'old', senderId: 'tutor-1' }), 'general')
    // Your own message never counted, so there is nothing to re-check.
    assert.equal(t.applyActivity({ kind: 'delete', channelId: 'general', messageId: 'mine', senderId: ME }), null)
  })

  it('a full summary clears rooms that no longer have unread messages', () => {
    const t = fresh()
    t.applySummary({ general: { unread: 0, lastMessageAt: at(50) } })
    assert.equal(t.get('jamb-science').unread, 0, 'missing from a full summary = nothing unread')
    assert.equal(t.total(), 0)
  })

  it('leaving a room (membership change) drops its count', () => {
    const t = fresh()
    t.setRooms(['general'], [])
    assert.equal(t.get('jamb-science').unread, 0)
    assert.equal(t.total(), 2)
  })

  it('counts are never negative and survive odd input', () => {
    const t = new UnreadTracker(null)
    t.applySummary({ general: { unread: -4, mentions: 'x', lastMessageAt: 'not a date' } })
    assert.equal(t.get('general').unread, 0)
    assert.equal(t.get('general').mentions, 0)
    assert.equal(t.applyActivity({ kind: 'new', channelId: 'general', messageId: '' }), null)
  })
})
