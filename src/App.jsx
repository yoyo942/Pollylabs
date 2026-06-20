import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCurrentUser, fetchTranscripts } from './api/fireflies.js'
import { matchesUser, parseActionItems } from './lib/parse.js'
import { useLocalStorage } from './lib/useLocalStorage.js'
import ApiKeyGate from './components/ApiKeyGate.jsx'
import CardDeck from './components/CardDeck.jsx'
import TodoList from './components/TodoList.jsx'
import ArchiveList from './components/ArchiveList.jsx'

const TABS = [
  { id: 'review', label: 'Review' },
  { id: 'todo', label: 'To-do' },
  { id: 'archive', label: 'Archive' }
]

export default function App() {
  const [apiKey, setApiKey] = useLocalStorage('ff_api_key', '')
  const [user, setUser] = useLocalStorage('ff_user', null)
  const [triage, setTriage] = useLocalStorage('ff_triage', {})
  const [onlyMine, setOnlyMine] = useLocalStorage('ff_only_mine', false)

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('review')

  const load = useCallback(async (key) => {
    if (!key) return
    setLoading(true)
    setError(null)
    try {
      const [me, transcripts] = await Promise.all([
        fetchCurrentUser(key).catch(() => null),
        fetchTranscripts(key, 30)
      ])
      if (me) setUser(me)
      const parsed = transcripts.flatMap(parseActionItems)
      setItems(parsed)
    } catch (e) {
      setError(e.message || 'Failed to load meetings from Fireflies.')
    } finally {
      setLoading(false)
    }
  }, [setUser])

  useEffect(() => {
    if (apiKey) load(apiKey)
  }, [apiKey, load])

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
    // Time-sensitive items first, then most recent meetings.
    return q.sort((a, b) => {
      if (a.timely !== b.timely) return a.timely ? -1 : 1
      const da = a.meeting.date ? Date.parse(a.meeting.date) : 0
      const db = b.meeting.date ? Date.parse(b.meeting.date) : 0
      return db - da
    })
  }, [items, triage, onlyMine, user])

  const todoEntries = useMemo(
    () =>
      Object.values(triage)
        .filter((e) => e.status === 'todo' || e.status === 'done')
        .sort((a, b) => {
          if ((a.status === 'done') !== (b.status === 'done')) {
            return a.status === 'done' ? 1 : -1
          }
          const da = a.dueDate ? Date.parse(a.dueDate) : Infinity
          const db = b.dueDate ? Date.parse(b.dueDate) : Infinity
          if (da !== db) return da - db
          return Date.parse(b.addedAt) - Date.parse(a.addedAt)
        }),
    [triage]
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
      setTriage((prev) => ({
        ...prev,
        [item.id]: {
          status,
          item,
          addedAt: new Date().toISOString(),
          dueDate: status === 'todo' ? item.suggestedDue || null : null,
          completedAt: null
        }
      }))
    },
    [setTriage]
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
            t.id === 'review' ? queue.length : t.id === 'todo' ? todoCount : archiveEntries.length
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
            onArchive={(id) => patch(id, { status: 'archived' })}
            onDelete={removeEntry}
          />
        )}

        {tab === 'archive' && (
          <ArchiveList entries={archiveEntries} onRestore={moveToTodo} onDelete={removeEntry} />
        )}
      </main>
    </div>
  )
}
