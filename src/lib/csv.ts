// CSV reading and writing (RFC 4180 quoting) for the CBT question bank.
// Excel saves CSV with a byte-order mark and CRLF line ends, and — depending on
// the computer's region — with semicolons or tabs instead of commas. All of
// that is handled here.

const BOM = /^﻿/

/**
 * The separator a file uses: whichever of comma, semicolon or tab appears most
 * (outside quotes) in the header line.
 */
export function detectDelimiter(text: string): string {
  const first = text.replace(BOM, '').split(/\r?\n/)[0] || ''
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const c of first) {
    if (c === '"') quoted = !quoted
    else if (!quoted && c in counts) counts[c] += 1
  }
  const [best, n] = Object.entries(counts).sort((x, y) => y[1] - x[1])[0]
  return n > 0 ? best : ','
}

/** Rows of cells. Blank lines are dropped. */
export function parseCSV(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(BOM, '')
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
    else if (c === delimiter) {
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

/** Header names people actually type, mapped to the importer's column names. */
const HEADER_ALIASES: Record<string, string> = {
  question_text: 'question',
  questions: 'question',
  a: 'option_a',
  b: 'option_b',
  c: 'option_c',
  d: 'option_d',
  optiona: 'option_a',
  optionb: 'option_b',
  optionc: 'option_c',
  optiond: 'option_d',
  correct_answer: 'answer',
  correct_option: 'answer',
  correct: 'answer',
  answer_key: 'answer',
  key: 'answer',
  exam_type: 'exam',
  examination: 'exam',
  exam_year: 'year',
  image_url: 'image',
  picture: 'image',
  imagealt: 'image_alt',
  picture_description: 'image_alt',
  level: 'difficulty',
}

/** "Option A" / " option-a " / "OPTION_A" → "option_a", then known aliases. */
export function normalizeHeader(h: string): string {
  const k = String(h ?? '')
    .replace(BOM, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return HEADER_ALIASES[k] || k
}

/**
 * Rows of cells → objects keyed by the (normalised) header row. The header row
 * is the one among the first five that names the most `required` columns, so a
 * title line above it does no harm.
 */
export function tableToObjects(
  table: unknown[][],
  required: string[] = [],
): { headers: string[]; rows: Record<string, string>[] } {
  const all = table.filter((r) => r.some((x) => String(x ?? '').trim()))
  if (!all.length) return { headers: [], rows: [] }
  const score = (r: unknown[]) =>
    r.map((x) => normalizeHeader(String(x ?? ''))).filter((h) => required.includes(h)).length
  let at = 0
  for (let i = 1; i < Math.min(5, all.length); i += 1) if (score(all[i]) > score(all[at])) at = i
  const headers = all[at].map((h) => normalizeHeader(String(h ?? '')))
  const rows = all.slice(at + 1).map((r) => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => {
      if (h) o[h] = String(r[i] ?? '').trim()
    })
    return o
  })
  return { headers: headers.filter(Boolean), rows }
}

export function csvToObjects(text: string, required: string[] = []) {
  return tableToObjects(parseCSV(text), required)
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
