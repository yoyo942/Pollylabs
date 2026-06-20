import { useState } from 'react'
import { fetchTranscripts } from '../api/fireflies.js'

// First-run screen: collect and validate a Fireflies API key.
export default function ApiKeyGate({ onConnect }) {
  const [key, setKey] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) return
    setChecking(true)
    setError(null)
    try {
      await fetchTranscripts(trimmed, 1) // validates the key against a guaranteed query
      onConnect(trimmed)
    } catch (err) {
      setError(err.message || 'That key did not work. Double-check and try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <span className="brand-dot big" />
        <h1>Action Cards</h1>
        <p className="gate-lead">
          Swipe through the action items from your Fireflies meetings. Right to add to your
          to-do list, left to archive.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="key">Fireflies API key</label>
          <input
            id="key"
            type="password"
            placeholder="Paste your API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {error && <p className="gate-error">{error}</p>}
          <button className="primary-btn" type="submit" disabled={checking || !key.trim()}>
            {checking ? 'Connecting…' : 'Connect Fireflies'}
          </button>
        </form>
        <p className="gate-hint">
          Find your key in Fireflies under{' '}
          <strong>Settings → Developer Settings</strong>. It is stored only in this browser.
        </p>
      </div>
    </div>
  )
}
