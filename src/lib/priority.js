// Priority model. Focus rules are user-defined keywords/phrases, each tagged
// with a target level; an action item inherits the level of any rule it matches.

export const LEVELS = ['high', 'medium', 'normal']
export const LEVEL_RANK = { high: 3, medium: 2, normal: 1 }
export const LEVEL_LABEL = { high: 'High', medium: 'Medium', normal: 'Normal' }

// Cycle through levels (used by the per-item priority toggle).
export function nextLevel(level) {
  const i = LEVELS.indexOf(level)
  return LEVELS[(i + 1) % LEVELS.length]
}

// Decide an item's priority from the focus rules and options.
// Order of precedence: a matching High rule, then "my items", then a matching
// Medium rule, then time-sensitive follow-ups, otherwise Normal.
export function computePriority(item, rules = [], opts = {}) {
  const haystack = `${item.text || ''} ${item.meeting?.title || ''} ${item.assignee || ''}`.toLowerCase()

  let matchedMedium = false
  for (const rule of rules) {
    const term = (rule.text || '').trim().toLowerCase()
    if (!term) continue
    if (haystack.includes(term)) {
      if (rule.level === 'high') return 'high'
      if (rule.level === 'medium') matchedMedium = true
    }
  }

  if (opts.mineHigh && opts.isMine) return 'high'
  if (matchedMedium) return 'medium'
  if (item.timely) return 'medium'
  return 'normal'
}
