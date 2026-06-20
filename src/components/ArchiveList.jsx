function fmt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ArchiveList({ entries, onRestore, onDelete }) {
  if (entries.length === 0) {
    return (
      <div className="empty">
        <div className="empty-emoji">🗂️</div>
        <h2>Nothing archived</h2>
        <p>Swipe action items left in the Review tab to archive them here.</p>
      </div>
    )
  }

  return (
    <ul className="archive-list">
      {entries.map((e) => {
        const item = e.item
        return (
          <li key={item.id} className="archived">
            <div className="todo-body">
              <p className="todo-text">{item.text}</p>
              <div className="todo-meta">
                <span className="todo-meeting">{item.meeting.title}</span>
                {item.meeting.date && <span className="dot-sep">·</span>}
                {item.meeting.date && <span>{fmt(item.meeting.date)}</span>}
              </div>
              <div className="todo-actions">
                <button className="link-btn" onClick={() => onRestore(item.id)}>
                  → move to to-do
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
