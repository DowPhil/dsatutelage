// CBT Platform — shapes returned by /api/cbt (student CBT Practice tab) and
// /api/cbt/admin (admin CBT Platform section). The server draws, times and
// scores every session; answers only arrive when a student is entitled to them.

export type CbtTier = 'Free' | 'Silver' | 'Gold' | 'Elite'
export const CBT_TIERS: CbtTier[] = ['Free', 'Silver', 'Gold', 'Elite']

/** E / M / H, or '' when not set. */
export type CbtDifficulty = 'E' | 'M' | 'H' | ''

/** null = unlimited. */
export interface CbtLimits {
  day: number | null
  mocks: number | null
  sess: number | null
  ps: number | null
  saved: number | null
  pred: boolean
  year: boolean
  missed: boolean
}

export interface CbtRules {
  secEasy: number
  secMedium: number
  secHard: number
  englishQuestions: number
  otherQuestions: number
  subjects: number
  mockMinutes: number
  marksPerSubject: number
  predictionWindow: number
  predictionMinRange: number
  pointsPerCorrect: number
  weekStartsOn: string
  leaderboard: boolean
  drillQuestions: number
  defaultOrder: 'unseen' | 'random' | 'missed'
  weakMinAttempts: number
  secondsPerQuestion: number
  banner: string
  maintenance: boolean
}

export interface CbtCatalogueRow {
  subject: string
  topic: string
  exam: string
  year: number | null
  difficulty: CbtDifficulty
  count: number
}

export interface CbtMeta {
  tier: CbtTier
  limits: CbtLimits
  plans: Record<CbtTier, CbtLimits>
  usage: {
    answeredToday: number
    mocksThisMonth: number
    saved: number
    remainingToday: number | null
    mocksLeft: number | null
  }
  rules: Pick<
    CbtRules,
    | 'secEasy'
    | 'secMedium'
    | 'secHard'
    | 'englishQuestions'
    | 'otherQuestions'
    | 'subjects'
    | 'mockMinutes'
    | 'marksPerSubject'
    | 'secondsPerQuestion'
    | 'drillQuestions'
    | 'defaultOrder'
    | 'weekStartsOn'
    | 'leaderboard'
  >
  banner: string
  maintenance: boolean
  catalogue: CbtCatalogueRow[]
  seenBySubject: Record<string, number>
}

export interface CbtQuestion {
  id: string
  subject: string
  topic: string
  exam: string
  year: number | null
  difficulty: CbtDifficulty
  text: string
  options: string[]
  image: string | null
  imageAlt: string
  passage: string
  /** Only once revealed. */
  answer?: number
  explanation?: string
}

export type CbtMode = 'mock' | 'custom' | 'topic' | 'drill' | 'saved' | 'retry'

export interface CbtSession {
  id: string
  status: 'open' | 'submitted' | 'abandoned'
  mode: CbtMode
  full: boolean
  label: string
  exam: string
  subjects: string[]
  reveal: boolean
  durationSecs: number
  startedAt: string
  endsAt: string | null
  serverNow: string
  position: number
  answers: (number | null)[]
  flagged: boolean[]
  questions: CbtQuestion[]
  note?: string
}

export interface CbtTally {
  subject: string
  topic: string
  correct: number
  total: number
  marks: number | null
}

export interface CbtResult {
  id: string
  status: 'submitted'
  mode: CbtMode
  full: boolean
  label: string
  exam: string
  subjects: string[]
  reveal: boolean
  timed: boolean
  durationSecs: number
  timeUsedSecs: number | null
  auto: boolean
  startedAt: string
  submittedAt: string
  correct: number
  answered: number
  total: number
  percent: number
  jambScore: number | null
  bySubject: CbtTally[]
  byTopic: CbtTally[]
  answers: (number | null)[]
  questions: CbtQuestion[]
}

export interface CbtSessionSummary {
  id: string
  mode: CbtMode
  full: boolean
  label: string
  subjects: string[]
  timed: boolean
  correct: number
  total: number
  percent: number
  jambScore: number | null
  submittedAt: string
}

export interface CbtStartBody {
  mode: CbtMode
  full?: boolean
  exam?: string
  subject?: string
  subjects?: string[]
  topic?: string
  year?: number | 'All'
  difficulty?: CbtDifficulty | 'All'
  count?: number
  perSubject?: Record<string, number>
  minutes?: number
  order?: 'unseen' | 'random' | 'missed'
  style?: 'practice' | 'exam'
  retryOf?: string
}

export interface CbtAnswerResult {
  index: number
  choice: number
  answer: number
  correct: boolean
  explanation: string
}

export interface CbtProgress {
  subjects: { subject: string; correct: number; total: number }[]
  topics: { subject: string; topic: string; correct: number; total: number }[]
  weakMinAttempts: number
  mocks: { score: number; at: string; bySubject: CbtTally[] }[]
  maxScore: number
  prediction: { score: number; low: number; high: number; basedOn: number } | null
  trend: { month: string; average: number; count: number }[] | null
  locked: { prediction: boolean; trend: boolean }
}

export interface CbtLeaderboardRow {
  rank: number
  name: string
  points: number
  accuracy: number
  me: boolean
}

export interface CbtLeaderboard {
  enabled: boolean
  period?: 'day' | 'week' | 'month'
  resetsAt?: string
  total?: number
  rows: CbtLeaderboardRow[]
  mine?: CbtLeaderboardRow | null
}

export const CBT_REPORT_REASONS = [
  'The answer looks wrong',
  'The question is unclear',
  'There is a typing error',
  'Something else',
] as const

// ── Admin ──

export interface CbtAdminQuestion {
  id: string
  subject: string
  topic: string
  exam: string
  year: number | null
  difficulty: CbtDifficulty
  text: string
  options: string[]
  answer: number
  explanation: string
  passage: string
  image: string
  imageAlt: string
  checked: boolean
  status: string
  attempts: number
  correctPct: number | null
  reports: number
  updatedAt?: string
}

/** What the editor and the CSV importer send. */
export interface CbtQuestionInput {
  subject: string
  topic: string
  exam: string
  year: number | string
  difficulty: CbtDifficulty | string
  text: string
  options: string[]
  answer: number
  explanation: string
  passage: string
  image: string
  imageAlt: string
  checked: boolean
}

export interface CbtPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface CbtFacets {
  subjects: Record<string, { topic: string; count: number }[]>
  exams: string[]
}

export interface CbtImportResult {
  created: number
  skipped: { row: number; errors: string[] }[]
}

export interface CbtReportItem {
  questionId: string
  question: CbtAdminQuestion | null
  count: number
  reasons: Record<string, number>
  notes: string[]
  reportedBy: string[]
  lastReportedAt: string
}

export interface CbtReportsResponse {
  open: number
  resolved: number
  items: CbtReportItem[]
}

export interface CbtStudentRow {
  id: string
  name: string
  studentId: string
  tier: CbtTier
  lastActive: string | null
  daysSinceActive: number | null
  sessions: number
  questions: number
  accuracy: number | null
  mocksThisMonth: number
  mockAverage: number | null
  limitHits: number
  peakDay: number
}

export interface CbtInsights {
  totals: {
    students: number
    active7: number
    answered7: number
    mocks30: number
    mockTakers30: number
    active30: number
    mockAverage: number | null
    limitHitStudents: number
    limitHit3: number
    silverActive7: number
    silverHit3: number
    quietPaying: number
  }
  daily: { date: string; answered: number }[]
  hourly: number[]
  subjects: { subject: string; answers: number; correct: number }[]
  topics: { subject: string; topic: string; answers: number; correct: number; questions: number }[]
  topicSizes: { subject: string; topic: string; questions: number }[]
  mockAverages: number[]
  tiers: { tier: CbtTier; students: number; active7: number }[]
  hardest: CbtAdminQuestion[]
  bank: { total: number; unchecked: number; noExplanation: number; heavilyReported: number }
}

export interface CbtSettingsData {
  plans: Record<CbtTier, CbtLimits>
  rules: CbtRules
  updatedAt?: string
}

export interface CbtWhatIf {
  tier: CbtTier
  active: number
  wouldHit: number
  currentLimit: number | null
  hitNow: number
}
