// Minimal CSV reading and writing (RFC 4180 quoting) for the CBT question bank.
// Excel saves CSV with a byte-order mark and CRLF line ends; both are handled.

/** Rows of cells. Blank lines are dropped. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i]
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i += 1
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    if (row.some((x) => x.trim())) rows.push(row)
  }
  return rows
}

/**
 * The first row as headers (lower-cased, spaces → underscores), the rest as
 * objects keyed by those headers.
 */
export function csvToObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const all = parseCSV(text)
  if (!all.length) return { headers: [], rows: [] }
  const headers = all[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = all.slice(1).map((r) => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => {
      o[h] = (r[i] ?? '').trim()
    })
    return o
  })
  return { headers, rows }
}

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  return [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\r\n')
}

/** Save text as a file in the browser. */
export function downloadText(filename: string, text: string, type = 'text/csv') {
  const blob = new Blob(['﻿' + text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
