// Student roster filters for the Secretary (staff) students page, as the
// backend takes them on GET /staff/students and GET /admin/users/export. The
// server applies every filter across all pages; nothing is filtered locally.

export interface RosterFilters {
  search: string
  /** 'all' or an exam track (jamb, waec, postutme, undergrad, preclinical, afterschool) */
  track: string
  /** 'all' | 'online' | 'physical' */
  mode: string
  /** 'all' | 'active' | 'suspended' | 'deleted' */
  status: string
  /** 'all' | 'science' | 'art' | 'commercial' */
  department: string
  /** 'all' or a course id */
  courseId: string
}

export function staffRosterParams(filters: RosterFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.search.trim()) params.search = filters.search.trim()
  if (filters.track !== 'all') params.examTrack = filters.track
  if (filters.mode !== 'all') params.learningMode = filters.mode
  if (filters.status !== 'all') params.status = filters.status
  if (filters.department !== 'all') params.department = filters.department
  if (filters.courseId !== 'all') params.courseId = filters.courseId
  return params
}
