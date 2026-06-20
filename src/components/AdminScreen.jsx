import { useState } from 'react'

function newId() {
  return (crypto?.randomUUID?.() || `r${Date.now()}${Math.random().toString(36).slice(2, 7)}`)
}

function Switch({ on, onToggle, disabled }) {
  return (
    <button
      type="button"
      className={`switch ${on ? 'on' : ''}`}
      onClick={() => !disabled && onToggle(!on)}
      disabled={disabled}
      aria-pressed={on}
    >
      <span className="knob" />
    </button>
  )
}

function fmtDateTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Admin / settings screen: control the daily auto-review and connection.
export default function AdminScreen({
  schedule,
  onChange,
  priority,
  onPriorityChange,
  lastRun,
  user,
  loading,
  onRunNow,
  onDisconnect,
  nextRunAt
}) {
  const [notifyError, setNotifyError] = useState(null)

  const rules = priority?.rules || []
  const setRules = (next) => onPriorityChange({ rules: next })
  const addRule = () => setRules([...rules, { id: newId(), text: '', level: 'high' }])
  const updateRule = (id, changes) =>
    setRules(rules.map((r) => (r.id === id ? { ...r, ...changes } : r)))
  const removeRule = (id) => setRules(rules.filter((r) => r.id !== id))

  const handleNotify = async (on) => {
    setNotifyError(null)
    if (on) {
      if (!('Notification' in window)) {
        setNotifyError('This browser does not support notifications.')
        return
      }
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          setNotifyError('Notifications are blocked in your browser settings.')
          onChange({ notify: false })
          return
        }
      }
    }
    onChange({ notify: on })
  }

  return (
    <div className="admin">
      <section className="admin-section">
        <h2 className="admin-title">Focus &amp; priorities</h2>
        <p className="admin-note">
          Add focus prompts — a keyword or phrase that matters to you. Any action item whose
          text, meeting, or assignee matches a prompt is flagged at that priority and floated to
          the top of the review deck and your to-do list.
        </p>

        <div className="rules">
          {rules.length === 0 && (
            <p className="rules-empty">
              No focus prompts yet. Add one like “invoice”, “client launch”, or a person’s name.
            </p>
          )}
          {rules.map((r) => (
            <div className="rule" key={r.id}>
              <input
                className="rule-text"
                placeholder="e.g. client launch, security, Bruna…"
                value={r.text}
                onChange={(e) => updateRule(r.id, { text: e.target.value })}
              />
              <select
                className="rule-level"
                value={r.level}
                onChange={(e) => updateRule(r.id, { level: e.target.value })}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
              <button className="rule-del" onClick={() => removeRule(r.id)} aria-label="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="add-rule-btn" onClick={addRule}>
          + Add focus prompt
        </button>

        <div className="setting-row">
          <div>
            <div className="setting-label">My items are high priority</div>
            <div className="setting-sub">Action items assigned to you jump to High</div>
          </div>
          <Switch
            on={!!priority?.mineHigh}
            onToggle={(v) => onPriorityChange({ mineHigh: v })}
            disabled={!user}
          />
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-title">Daily review</h2>
        <p className="admin-note">
          Automatically pull your latest Fireflies meetings and refresh the review deck once a
          day. Runs while this app is open in a browser tab.
        </p>

        <div className="setting-row">
          <div>
            <div className="setting-label">Scheduled review</div>
            <div className="setting-sub">
              {schedule.enabled
                ? nextRunAt
                  ? `Next run ${fmtDateTime(nextRunAt)}`
                  : 'On'
                : 'Off'}
            </div>
          </div>
          <Switch on={schedule.enabled} onToggle={(v) => onChange({ enabled: v })} />
        </div>

        <div className={`setting-row ${schedule.enabled ? '' : 'muted'}`}>
          <div>
            <div className="setting-label">Run at</div>
            <div className="setting-sub">Time of day to refresh</div>
          </div>
          <input
            type="time"
            className="time-input"
            value={schedule.time}
            disabled={!schedule.enabled}
            onChange={(e) => onChange({ time: e.target.value || '09:00' })}
          />
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">Notify me</div>
            <div className="setting-sub">Browser notification when new items are ready</div>
          </div>
          <Switch on={schedule.notify} onToggle={handleNotify} />
        </div>
        {notifyError && <p className="admin-error">{notifyError}</p>}

        <div className="setting-row">
          <div>
            <div className="setting-label">Meetings per run</div>
            <div className="setting-sub">How many recent meetings to scan</div>
          </div>
          <select
            className="num-input"
            value={schedule.fetchLimit}
            onChange={(e) => onChange({ fetchLimit: Number(e.target.value) })}
          >
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <button className="primary-btn run-now" onClick={onRunNow} disabled={loading}>
          {loading ? 'Running…' : 'Run now'}
        </button>
        <p className="admin-sub-line">
          {lastRun ? `Last run ${fmtDateTime(lastRun)}` : 'Has not run yet'}
        </p>
      </section>

      <section className="admin-section">
        <h2 className="admin-title">Connection</h2>
        <div className="setting-row">
          <div>
            <div className="setting-label">Fireflies account</div>
            <div className="setting-sub">{user ? user.email || user.name : 'Connected'}</div>
          </div>
        </div>
        <button className="danger-btn" onClick={onDisconnect}>
          Disconnect Fireflies
        </button>
        <p className="admin-sub-line">
          Removes your API key and clears the signed-in account from this browser. Your to-do
          list and archive are kept.
        </p>
      </section>
    </div>
  )
}
