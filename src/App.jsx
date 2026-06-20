import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCurrentUser, fetchTranscripts } from './api/fireflies.js'
import { matchesUser, parseActionItems } from './lib/parse.js'
import { LEVEL_RANK, computePriority } from './lib/priority.js'
import { useLocalStorage } from './lib/useLocalStorage.js'
import ApiKeyGate from './components/ApiKeyGate.jsx'
import CardDeck from './components/CardDeck.jsx'
import TodoList from './components/TodoList.jsx'
import ArchiveList from './components/ArchiveList.jsx'
import AdminScreen from './components/AdminScreen.jsx'

const TABS = [
  { id: 'review', label: 'Review' },
  { id: 'todo', label: 'To-do' },
  { id: 'archive', label: 'Archive' },
  { id: 'admin', label: 'Admin' }
]

const DEFAULT_SCHEDULE = { enabled: false, time: '09:00', notify: false, fetchLimit: 30 }

// Milliseconds until the next occurrence of HH:mm (today if still ahead, else tomorrow).
function msUntilNext(time) {
  const [h, m] = (time || '09:00').split(':').map(Number)
  const now = new Date()
  const next = new Date(now)
  next.setHours(h || 0, m || 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return { delay: next - now, at: next }
}

export default function App() {
  const [apiKey, setApiKey] = useLocalStorage('ff_api_key', '')
  const [user, setUser] = useLocalStorage('ff_user', null)
  const [triage, setTriage] = useLocalStorage('ff_triage', {})
  const [onlyMine, setOnlyMine] = useLocalStorage('ff_only_mine', false)
  const [schedule, setSchedule] = useLocalStorage('ff_schedule', DEFAULT_SCHEDULE)
  const [lastRun, setLastRun] = useLocalStorage('ff_last_run', null)
  const [priority, setPriorityCfg] = useLocalStorage('ff_priority', { rules: [], mineHigh: false })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('review')

  const load = useCallback(
    async (key, limit = 30) => {
      if (!key) return []
      setLoading(true)
      setError(null)
      try {
        const [me, transcripts] = await Promise.all([
          fetchCurrentUser(key).catch(() => null),
          fetchTranscripts(key, limit)
        ])
        if (me) setUser(me)
        const parsed = transcripts.flatMap(parseActionItems)
        setItems(parsed)
        return parsed
      } catch (e) {
        setError(e.message || 'Failed to load meetings from Fireflies.')
        return []
      } finally {
        setLoading(false)
      }
    },
    [setUser]
  )

  useEffect(() => {
    if (apiKey) load(apiKey, schedule.fetchLimit)
  }, [apiKey, load, schedule.fetchLimit])

  // Keep the latest triage map available to the scheduler without re-arming it.
  const triageRef = useRef(triage)
  useEffect(() => {
    triageRef.current = triage
  }, [triage])

  const runReview = useCallback(
    async (limit) => {
      const parsed = await load(apiKey, limit ?? schedule.fetchLimit)
      setLastRun(new Date().toISOString())
      const fresh = parsed.filter((it) => !triageRef.current[it.id]).length
      if (schedule.notify && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Fireflies Action Cards', {
          body:
            fresh > 0
              ? `${fresh} new action item${fresh === 1 ? '' : 's'} to review`
              : 'No new action items — all caught up'
        })
      }
      return fresh
    },
    [apiKey, load, schedule.fetchLimit, schedule.notify, setLastRun]
  )

  // Daily auto-run. Only active while the app is open in a tab.
  useEffect(() => {
    if (!schedule.enabled || !apiKey) return
    let timer
    const arm = () => {
      const { delay } = msUntilNext(schedule.time)
      timer = setTimeout(async () => {
        await runReview()
        arm() // schedule the following day
      }, delay)
    }
    arm()
    return () => clearTimeout(timer)
  }, [schedule.enabled, schedule.time, apiKey, runReview])

  const handleConnect = (key) => setApiKey(key.trim())
  const handleDisconnect = () => {
    setApiKey('')
    setUser(null)
    setItems([])
  }

  // Cards still awaiting a decision (skip anything already triaged).
  const queue = useMemo(() => {
    let q = items.filter((it) => !triage[it.id])
    if (onlyMine && user) q = q.filter((it) => matchesUser(it, user))
    // Tag each card with its computed priority from the focus rules.
    q = q.map((it) => ({
      ...it,
      priority: computePriority(it, priority.rules, {
        mineHigh: priority.mineHigh,
        isMine: matchesUser(it, user)
      })
    }))
    // Highest priority first, then time-sensitive, then most recent meetings.
    return q.sort((a, b) => {
      if (LEVEL_RANK[a.priority] !== LEVEL_RANK[b.priority]) {
        return LEVEL_RANK[b.priority] - LEVEL_RANK[a.priority]
      }
      if (a.timely !== b.timely) return a.timely ? -1 : 1
      const da = a.meeting.date ? Date.parse(a.meeting.date) : 0
      const db = b.meeting.date ? Date.parse(b.meeting.date) : 0
      return db - da
    })
  }, [items, triage, onlyMine, user, priority])

  const todoEntries = useMemo(
    () =>
      Object.values(triage)
        .filter((e) => e.status === 'todo' || e.status === 'done')
        // Effective priority: a manual override wins, else recompute from rules.
        .map((e) => ({
          ...e,
          priority:
            e.priority ||
            computePriority(e.item, priority.rules, {
              mineHigh: priority.mineHigh,
              isMine: matchesUser(e.item, user)
            })
        }))
        .sort((a, b) => {
          if ((a.status === 'done') !== (b.status === 'done')) {
            return a.status === 'done' ? 1 : -1
          }
          if (LEVEL_RANK[a.priority] !== LEVEL_RANK[b.priority]) {
            return LEVEL_RANK[b.priority] - LEVEL_RANK[a.priority]
          }
          const da = a.dueDate ? Date.parse(a.dueDate) : Infinity
          const db = b.dueDate ? Date.parse(b.dueDate) : Infinity
          if (da !== db) return da - db
          return Date.parse(b.addedAt) - Date.parse(a.addedAt)
        }),
    [triage, priority, user]
  )

  const archiveEntries = useMemo(
    () =>
      Object.values(triage)
        .filter((e) => e.status === 'archived')
        .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt)),
    [triage]
  )

  // --- triage actions ---
  const decide = useCallback(
    (item, status) => {
      const level = computePriority(item, priority.rules, {
        mineHigh: priority.mineHigh,
        isMine: matchesUser(item, user)
      })
      setTriage((prev) => ({
        ...prev,
        [item.id]: {
          status,
          item,
          priority: level,
          addedAt: new Date().toISOString(),
          dueDate: status === 'todo' ? item.suggestedDue || null : null,
          completedAt: null
        }
      }))
    },
    [setTriage, priority, user]
  )

  const patch = useCallback(
    (id, changes) => setTriage((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...changes } } : prev)),
    [setTriage]
  )

  const toggleDone = useCallback(
    (id) =>
      setTriage((prev) => {
        const e = prev[id]
        if (!e) return prev
        const done = e.status !== 'done'
        return {
          ...prev,
          [id]: { ...e, status: done ? 'done' : 'todo', completedAt: done ? new Date().toISOString() : null }
        }
      }),
    [setTriage]
  )

  const setDue = useCallback((id, dueDate) => patch(id, { dueDate: dueDate || null }), [patch])

  const setItemPriority = useCallback((id, level) => patch(id, { priority: level }), [patch])

  const moveToTodo = useCallback((id) => patch(id, { status: 'todo' }), [patch])

  const removeEntry = useCallback(
    (id) =>
      setTriage((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      }),
    [setTriage]
  )

  if (!apiKey) {
    return <ApiKeyGate onConnect={handleConnect} />
  }

  const todoCount = todoEntries.filter((e) => e.status === 'todo').length

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <div>
            <h1>Action Cards</h1>
            <p className="brand-sub">{user ? user.name || user.email : 'Fireflies'}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost-btn" onClick={() => load(apiKey)} disabled={loading} title="Refresh meetings">
            {loading ? '…' : '↻'}
          </button>
          <button className="ghost-btn" onClick={handleDisconnect} title="Disconnect Fireflies">
            ⏻
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => {
          const count =
            t.id === 'review'
              ? queue.length
              : t.id === 'todo'
                ? todoCount
                : t.id === 'archive'
                  ? archiveEntries.length
                  : 0
          return (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {count > 0 && <span className="tab-count">{count}</span>}
            </button>
          )
        })}
      </nav>

      <main className="content">
        {error && (
          <div className="banner error">
            <span>{error}</span>
            <button className="ghost-btn" onClick={() => load(apiKey)}>Retry</button>
          </div>
        )}

        {tab === 'review' && (
          <CardDeck
            queue={queue}
            loading={loading}
            onlyMine={onlyMine}
            canFilter={!!user}
            onToggleOnlyMine={() => setOnlyMine((v) => !v)}
            onArchive={(item) => decide(item, 'archived')}
            onAdd={(item) => decide(item, 'todo')}
          />
        )}

        {tab === 'todo' && (
          <TodoList
            entries={todoEntries}
            onToggleDone={toggleDone}
            onSetDue={setDue}
            onSetPriority={setItemPriority}
            onArchive={(id) => patch(id, { status: 'archived' })}
            onDelete={removeEntry}
          />
        )}

        {tab === 'archive' && (
          <ArchiveList entries={archiveEntries} onRestore={moveToTodo} onDelete={removeEntry} />
        )}

        {tab === 'admin' && (
          <AdminScreen
            schedule={schedule}
            onChange={(changes) => setSchedule((prev) => ({ ...prev, ...changes }))}
            priority={priority}
            onPriorityChange={(changes) => setPriorityCfg((prev) => ({ ...prev, ...changes }))}
            lastRun={lastRun}
            user={user}
            loading={loading}
            onRunNow={() => runReview()}
            onDisconnect={handleDisconnect}
            nextRunAt={schedule.enabled ? msUntilNext(schedule.time).at.toISOString() : null}
          />
        )}
      </main>
    </div>
  )
}
