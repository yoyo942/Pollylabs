function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function TodoList({ entries, onToggleDone, onSetDue, onArchive, onDelete }) {
  if (entries.length === 0) {
    return (
      <div className="empty">
        <div className="empty-emoji">📝</div>
        <h2>Your to-do list is empty</h2>
        <p>Swipe action items right in the Review tab to add them here.</p>
      </div>
    )
  }

  const today = todayISO()

  return (
    <ul className="todo-list">
      {entries.map((e) => {
        const done = e.status === 'done'
        const overdue = !done && e.dueDate && e.dueDate < today
        const item = e.item
        return (
          <li key={item.id} className={`todo ${done ? 'done' : ''} ${overdue ? 'overdue' : ''}`}>
            <button
              className={`check ${done ? 'on' : ''}`}
              onClick={() => onToggleDone(item.id)}
              aria-label={done ? 'Mark not done' : 'Mark done'}
            >
              {done ? '✓' : ''}
            </button>

            <div className="todo-body">
              <p className="todo-text">{item.text}</p>
              <div className="todo-meta">
                <span className="todo-meeting">{item.meeting.title}</span>
                {item.assignee && <span className="dot-sep">·</span>}
                {item.assignee && <span>@{item.assignee}</span>}
                {item.timely && <span className="chip warn sm">⏱</span>}
              </div>

              <div className="todo-actions">
                <label className={`date-field ${overdue ? 'overdue' : ''}`}>
                  <span className="date-label">{e.dueDate ? `Due ${fmt(e.dueDate)}` : 'Set date'}</span>
                  <input
                    type="date"
                    value={e.dueDate || ''}
                    onChange={(ev) => onSetDue(item.id, ev.target.value)}
                  />
                </label>
                {e.dueDate && (
                  <button className="link-btn" onClick={() => onSetDue(item.id, '')}>
                    clear
                  </button>
                )}
                <button className="link-btn" onClick={() => onArchive(item.id)}>
                  archive
                </button>
                <button className="link-btn danger" onClick={() => onDelete(item.id)}>
                  delete
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
