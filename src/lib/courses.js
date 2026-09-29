import { supabase } from './supabase'

// Course colours are keys, not values: each maps to a CSS token pair defined
// for both themes in Courses.css, so a course never ends up unreadable in one.
export const COURSE_COLORS = ['green', 'blue', 'violet', 'amber', 'rose', 'cyan', 'slate']

/** The next colour not yet used, so new courses come out distinct. */
export const nextColor = (courses) =>
  COURSE_COLORS.find((color) => !courses.some((c) => c.color === color)) ??
  COURSE_COLORS[courses.length % COURSE_COLORS.length]

export const listCourses = async () =>
  supabase.from('courses').select('id, name, color, created_at').order('created_at', { ascending: true })

export const createCourse = async ({ userId, name, color }) =>
  supabase
    .from('courses')
    .insert({ user_id: userId, name: name.trim().slice(0, 80), color })
    .select('id, name, color, created_at')
    .single()

export const updateCourse = async (id, fields) =>
  supabase.from('courses').update(fields).eq('id', id).select('id, name, color, created_at').single()

/** Deleting a course unfiles its contents (course_id is set null); nothing else is lost. */
export const deleteCourse = async (id) => supabase.from('courses').delete().eq('id', id)

/** Files a document or conversation under a course, or unfiles it with null. */
export const fileUnder = async (table, id, courseId) =>
  supabase.from(table).update({ course_id: courseId }).eq('id', id)
