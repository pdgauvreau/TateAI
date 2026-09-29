/**
 * Date handling for the assignment planner. Kept free of imports so it can be
 * tested on its own.
 */

/**
 * A due time from a date and an optional time, both in the student's own
 * timezone. With no time, the end of that day: "due Friday" means by Friday
 * night, not at midnight Thursday.
 */
export const toDueAt = (date, time) => {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time ? time.split(':').map(Number) : [23, 59]
  return new Date(y, m - 1, d, hh, mm).toISOString()
}

/** The date and time inputs' values for a stored due time, in local time. */
export const fromDueAt = (iso) => {
  const at = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  }
}

export const todayISO = () => fromDueAt(new Date().toISOString()).date

const startOfDay = (at) => new Date(at.getFullYear(), at.getMonth(), at.getDate())

/**
 * Buckets for the planner, in the order a student cares about them. Done items
 * are kept out of the dated buckets; the most recent few are shown separately
 * so a checked-off item does not vanish the instant it is ticked.
 */
export const groupAssignments = (assignments, now = new Date()) => {
  const today = startOfDay(now)
  const tomorrow = new Date(today.getTime() + 86400000)
  const weekOut = new Date(today.getTime() + 7 * 86400000)

  const groups = { overdue: [], today: [], week: [], later: [], done: [] }
  for (const a of assignments) {
    if (a.done_at) {
      groups.done.push(a)
      continue
    }
    const due = new Date(a.due_at)
    if (due < now) groups.overdue.push(a)
    else if (due < tomorrow) groups.today.push(a)
    else if (due < weekOut) groups.week.push(a)
    else groups.later.push(a)
  }
  groups.done.sort((a, b) => new Date(b.done_at) - new Date(a.done_at))
  groups.done = groups.done.slice(0, 5)
  return groups
}

/** "Today 11:59 PM", "Tomorrow", "Fri, Oct 3", "Overdue by 2 days". */
export const describeDue = (iso, now = new Date()) => {
  const due = new Date(iso)
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86400000)
  const time = due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const endOfDay = due.getHours() === 23 && due.getMinutes() === 59

  if (due < now) {
    if (days === 0) return `Was due ${time}`
    const ago = -days
    return `Overdue by ${ago} day${ago === 1 ? '' : 's'}`
  }
  if (days === 0) return endOfDay ? 'Due today' : `Due today ${time}`
  if (days === 1) return endOfDay ? 'Due tomorrow' : `Due tomorrow ${time}`
  const date = due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return endOfDay ? date : `${date}, ${time}`
}
