// A fake network for the upload component tests: the DSA API and Cloudinary's
// upload endpoint, routed by URL. Nothing leaves the test process.
import { vi } from 'vitest'

export const SECURE_URL =
  'https://res.cloudinary.com/demo/raw/upload/v1700000000/materials/week1.pdf'

export interface Call {
  method: string
  url: string
  path: string
  body: unknown
}

type Reply = { status?: number; body?: unknown } | (() => Promise<{ status?: number; body?: unknown }>)

export function fakeNetwork() {
  const calls: Call[] = []
  const routes: { method: string; match: RegExp; reply: Reply }[] = []

  const on = (method: string, match: RegExp, reply: Reply) => {
    routes.unshift({ method, match, reply })
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    const method = (init.method || 'GET').toUpperCase()
    const path = url.startsWith('http') ? new URL(url).pathname + new URL(url).search : url
    let body: unknown = init.body
    if (typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body)
      } catch {
        /* leave as text */
      }
    }
    calls.push({ method, url, path, body })
    const route = routes.find((r) => r.method === method && r.match.test(url))
    const reply = route
      ? typeof route.reply === 'function'
        ? await route.reply()
        : route.reply
      : { status: 404, body: { message: `No fake route for ${method} ${url}` } }
    const status = reply.status ?? 200
    return new Response(JSON.stringify(reply.body ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  vi.stubGlobal('fetch', fetchMock)
  return {
    calls,
    on,
    posts: (match: RegExp) => calls.filter((c) => c.method === 'POST' && match.test(c.url)),
  }
}

export const cloudinaryOk = {
  status: 200,
  body: {
    secure_url: SECURE_URL,
    public_id: 'materials/week1',
    resource_type: 'raw',
    format: 'pdf',
    bytes: 2048,
  },
}

export const pdf = () =>
  new File(['%PDF-1.4 test'], 'Week 1 notes.pdf', { type: 'application/pdf' })

export const CLOUDINARY = /api\.cloudinary\.com\/v1_1\/.+\/auto\/upload$/
