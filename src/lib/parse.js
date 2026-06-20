// Turns Fireflies meeting summaries into individual, swipeable action-item cards.

// Stable id so the same action item keeps its triage state across refetches.
function hashId(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

function normalizeDate(value) {
  if (value == null) return null
  // Fireflies has returned `date` both as epoch-ms numbers and ISO strings.
  const d = typeof value === 'number' ? new Date(value) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const HEADER_RE = /^\*\*(.+?)\*\*:?\s*$/ // **Assignee**
const BULLET_RE = /^\s*([-*••]|\d+[.)])\s+/ // leading bullet / number
const TIMESTAMP_RE = /\s*\(?\b\d{1,2}:\d{2}(?::\d{2})?\b\)?\s*$/ // trailing (12:34)

// Words/phrases that signal a time-sensitive follow-up.
const TIME_WORDS = [
  'today', 'tonight', 'tomorrow', 'asap', 'eod', 'eow', 'end of day',
  'end of week', 'this week', 'next week', 'this morning', 'this afternoon',
  'by ', 'before ', 'due ', 'deadline', 'follow up', 'follow-up', 'followup',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december'
]

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december']

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Best-effort: derive a concrete suggested due date from natural language.
// Returns an ISO yyyy-mm-dd string or null. Anchored to the meeting date.
function suggestDueDate(text, anchorDate) {
  const t = text.toLowerCase()
  const base = startOfDay(anchorDate || new Date())
  const addDays = (n) => {
    const d = new Date(base)
    d.setDate(d.getDate() + n)
    return d
  }
  const toISO = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  if (/\btoday\b|\btonight\b|\beod\b|\bend of day\b/.test(t)) return toISO(base)
  if (/\btomorrow\b/.test(t)) return toISO(addDays(1))
  if (/\bend of week\b|\beow\b|\bthis week\b/.test(t)) {
    const delta = (5 - base.getDay() + 7) % 7 || 5 // upcoming Friday
    return toISO(addDays(delta))
  }
  if (/\bnext week\b/.test(t)) return toISO(addDays(7))

  // "by Friday" / "on Monday" → next occurrence of that weekday.
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(t)) {
      const delta = (i - base.getDay() + 7) % 7 || 7
      return toISO(addDays(delta))
    }
  }

  // "June 25" / "25 June" → that calendar date (this year, or next if passed).
  for (let i = 0; i < MONTHS.length; i++) {
    const m = MONTHS[i]
    const re = new RegExp(`\\b${m}\\.?\\s+(\\d{1,2})\\b|\\b(\\d{1,2})\\s+${m}\\b`)
    const match = t.match(re)
    if (match) {
      const dayNum = parseInt(match[1] || match[2], 10)
      if (dayNum >= 1 && dayNum <= 31) {
        let d = new Date(base.getFullYear(), i, dayNum)
        if (d < base) d = new Date(base.getFullYear() + 1, i, dayNum)
        return toISO(d)
      }
    }
  }
  return null
}

function isTimely(text) {
  const t = text.toLowerCase()
  return TIME_WORDS.some((w) => t.includes(w))
}

// Parse one transcript's `summary.action_items` string into card objects.
// action_items is grouped by assignee using bold headers.
export function parseActionItems(transcript) {
  const raw = transcript?.summary?.action_items
  if (!raw || typeof raw !== 'string') return []

  const meetingDate = normalizeDate(transcript.date)
  const lines = raw.split('\n')
  const items = []
  let assignee = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const header = trimmed.match(HEADER_RE)
    if (header) {
      assignee = header[1].trim()
      continue
    }

    let text = trimmed.replace(BULLET_RE, '').replace(TIMESTAMP_RE, '').trim()
    // Some accounts inline the assignee: "Name: do the thing"
    if (!assignee && /^[A-Z][\w'’.\- ]{1,30}:\s/.test(text)) {
      const idx = text.indexOf(':')
      assignee = text.slice(0, idx).trim()
      text = text.slice(idx + 1).trim()
    }
    if (text.length < 3) continue

    const id = hashId(`${transcript.id}|${assignee || ''}|${text}`)
    items.push({
      id,
      text,
      assignee: assignee || null,
      timely: isTimely(text),
      suggestedDue: suggestDueDate(text, meetingDate),
      meeting: {
        id: transcript.id,
        title: transcript.title || 'Untitled meeting',
        date: meetingDate ? meetingDate.toISOString() : null,
        url: transcript.transcript_url || null
      }
    })
  }
  return items
}

// Belongs-to-me check for the optional "Only mine" filter.
export function matchesUser(item, user) {
  if (!user || !item.assignee) return false
  const a = item.assignee.toLowerCase()
  const name = (user.name || '').toLowerCase()
  const emailLocal = (user.email || '').split('@')[0].toLowerCase()
  if (name && (a.includes(name) || name.includes(a))) return true
  if (emailLocal && a.includes(emailLocal)) return true
  // first-name match
  const first = name.split(' ')[0]
  if (first && first.length > 1 && a.includes(first)) return true
  return false
}
