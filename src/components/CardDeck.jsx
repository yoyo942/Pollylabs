import { useCallback, useEffect, useRef, useState } from 'react'

const SWIPE_THRESHOLD = 90 // px before a drag commits to a decision

function formatMeetingDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function SwipeCard({ item, onDecide, depth }) {
  const ref = useRef(null)
  const drag = useRef({ active: false, startX: 0, startY: 0 })
  const decided = useRef(false)
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const [leaving, setLeaving] = useState(null) // 'right' | 'left' | null
  const [animate, setAnimate] = useState(false)

  const isTop = depth === 0

  // Fly the card off-screen, then report the decision to the parent.
  const commit = useCallback(
    (direction) => {
      if (decided.current) return
      decided.current = true
      setAnimate(true)
      setLeaving(direction)
    },
    []
  )

  const finishExit = () => {
    if (!leaving) return
    onDecide(item, leaving === 'right' ? 'add' : 'archive')
  }

  // Keyboard shortcuts for the top card.
  useEffect(() => {
    if (!isTop) return
    const onKey = (e) => {
      if (e.key === 'ArrowRight') commit('right')
      else if (e.key === 'ArrowLeft') commit('left')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isTop, commit])

  const onPointerDown = (e) => {
    if (!isTop || leaving) return
    drag.current = { active: true, startX: e.clientX, startY: e.clientY }
    setAnimate(false)
    ref.current?.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!drag.current.active) return
    setDx(e.clientX - drag.current.startX)
    setDy((e.clientY - drag.current.startY) * 0.4)
  }

  const onPointerUp = () => {
    if (!drag.current.active) return
    drag.current.active = false
    setAnimate(true)
    if (dx > SWIPE_THRESHOLD) commit('right')
    else if (dx < -SWIPE_THRESHOLD) commit('left')
    else {
      setDx(0)
      setDy(0)
    }
  }

  let transform
  if (leaving) {
    const dir = leaving === 'right' ? 1 : -1
    transform = `translate(${dir * 140}%, ${dy}px) rotate(${dir * 18}deg)`
  } else if (isTop) {
    transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.04}deg)`
  } else {
    const scale = 1 - depth * 0.04
    transform = `translateY(${depth * 14}px) scale(${scale})`
  }

  const intent = dx > 30 ? 'add' : dx < -30 ? 'archive' : null

  return (
    <article
      ref={ref}
      className={`card ${isTop ? 'top' : 'stacked'} ${animate ? 'animate' : ''}`}
      style={{ transform, zIndex: 100 - depth, opacity: depth > 2 ? 0 : 1 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTransitionEnd={finishExit}
    >
      <div className={`stamp add ${intent === 'add' ? 'show' : ''}`}>TO-DO</div>
      <div className={`stamp archive ${intent === 'archive' ? 'show' : ''}`}>ARCHIVE</div>

      <div className="card-head">
        <span className="card-meeting" title={item.meeting.title}>
          {item.meeting.title}
        </span>
        <span className="card-date">{formatMeetingDate(item.meeting.date)}</span>
      </div>

      <p className="card-text">{item.text}</p>

      <div className="card-foot">
        {item.assignee && <span className="chip">@ {item.assignee}</span>}
        {item.timely && <span className="chip warn">⏱ follow-up</span>}
        {item.suggestedDue && (
          <span className="chip due">due {formatMeetingDate(item.suggestedDue)}</span>
        )}
      </div>
    </article>
  )
}

export default function CardDeck({
  queue,
  loading,
  onlyMine,
  canFilter,
  onToggleOnlyMine,
  onArchive,
  onAdd
}) {
  const handleDecide = (item, action) => {
    if (action === 'add') onAdd(item)
    else onArchive(item)
  }

  const visible = queue.slice(0, 3)

  return (
    <div className="deck-wrap">
      {canFilter && (
        <div className="deck-toolbar">
          <button className={`pill ${onlyMine ? 'on' : ''}`} onClick={onToggleOnlyMine}>
            {onlyMine ? '✓ Only mine' : 'Only mine'}
          </button>
        </div>
      )}

      <div className="deck">
        {loading && queue.length === 0 ? (
          <div className="empty">
            <div className="spinner" />
            <p>Pulling your meetings from Fireflies…</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">🎉</div>
            <h2>All caught up</h2>
            <p>No action items left to review. Refresh after your next meeting.</p>
          </div>
        ) : (
          visible
            .map((item, i) => (
              <SwipeCard key={item.id} item={item} depth={i} onDecide={handleDecide} />
            ))
            .reverse()
        )}
      </div>

      {queue.length > 0 && !loading && (
        <div className="deck-controls">
          <button
            className="round-btn archive"
            onClick={() => onArchive(queue[0])}
            title="Archive (←)"
          >
            ✕
          </button>
          <span className="deck-remaining">{queue.length} left</span>
          <button className="round-btn add" onClick={() => onAdd(queue[0])} title="Add to to-do (→)">
            ✓
          </button>
        </div>
      )}
    </div>
  )
}
