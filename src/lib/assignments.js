import { supabase } from './supabase'
import { authedFetch } from './api'
import { todayISO } from './due'

export { describeDue, fromDueAt, groupAssignments, toDueAt, todayISO } from './due'

export const ASSIGNMENT_KINDS = [
  { id: 'homework', label: 'Homework' },
  { id: 'reading', label: 'Reading' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'exam', label: 'Exam' },
  { id: 'project', label: 'Project' },
  { id: 'essay', label: 'Essay' },
  { id: 'other', label: 'Other' },
]

export const kindLabel = (id) => ASSIGNMENT_KINDS.find((k) => k.id === id)?.label ?? 'Other'

const COLUMNS = 'id, title, kind, due_at, notes, done_at, course_id, source_document_id, created_at'

export const listAssignments = async () =>
  supabase.from('assignments').select(COLUMNS).order('due_at', { ascending: true })

export const createAssignments = async ({ userId, rows }) =>
  supabase
    .from('assignments')
    .insert(rows.map((row) => ({ ...row, user_id: userId })))
    .select(COLUMNS)

export const updateAssignment = async (id, fields) =>
  supabase.from('assignments').update(fields).eq('id', id).select(COLUMNS).single()

export const deleteAssignment = async (id) => supabase.from('assignments').delete().eq('id', id)

/** Asks the model for the dated deliverables in a syllabus. Nothing is saved. */
export const importFromSyllabus = async ({ documentId, courseId }) =>
  authedFetch('/api/generate', {
    kind: 'syllabus',
    documentIds: [documentId],
    courseId: courseId ?? null,
    today: todayISO(),
  })
