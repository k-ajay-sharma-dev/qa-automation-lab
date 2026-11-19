import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, LEVELS } from '../data/categories.js'
import { problems } from '../data/problems.js'
import { exportProgress, importProgress, resetProgress, statusOf, useProgress } from '../store/progress.js'

export default function ProgressPage() {
  const progress = useProgress()
  const file = useRef(null)
  const solvedOf = (list) => list.filter((p) => statusOf(progress[p.id]) === 'solved').length
  const solved = solvedOf(problems)
  const attempted = problems.filter((p) => statusOf(progress[p.id]) === 'attempted').length
  const revisit = problems.filter((p) => statusOf(progress[p.id]) === 'revisit').length
  const minutes = problems.filter((p) => statusOf(progress[p.id]) === 'solved').reduce((s, p) => s + (p.estMinutes ?? 0), 0)

  // the last 14 days of solves
  const days = [...Array(14)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = d.toISOString().slice(0, 10)
    return { key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), n: Object.values(progress).filter((e) => e.solvedAt?.slice(0, 10) === key).length }
  })
  const maxDay = Math.max(1, ...days.map((d) => d.n))

  function download() {
    const blob = new Blob([exportProgress()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'qa-lab-progress.json'
    a.click()
  }

  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// progress</p>
          <h1>Your progress</h1>
          <p className="muted">Saved in this browser. Export it to move to another machine.</p>
        </div>
      </section>

      <section className="stat-row">
        <div className="stat">
          <span className="stat-label">Solved</span>
          <span className="stat-value">
            {solved}
            <span className="muted small"> / {problems.length}</span>
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">In progress</span>
          <span className="stat-value">{attempted}</span>
        </div>
        <div className="stat">
          <span className="stat-label">To revisit</span>
          <span className="stat-value">{revisit}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Practice time</span>
          <span className="stat-value">
            {Math.round(minutes / 60)}
            <span className="muted small"> h</span>
          </span>
        </div>
      </section>

      <h2 className="section-heading">Last 14 days</h2>
      <div className="day-bars">
        {days.map((d) => (
          <div key={d.key} className="day-bar" title={`${d.key}: ${d.n} solved`}>
            <div className="day-fill" style={{ height: `${(d.n / maxDay) * 100}%` }} />
            <span className="muted small">{d.label}</span>
          </div>
        ))}
      </div>

      <h2 className="section-heading">By section</h2>
      <div className="level-table">
        <div className="level-row head">
          <span>Section</span>
          {LEVELS.map((l) => (
            <span key={l}>{l[0] + l.slice(1).toLowerCase()}</span>
          ))}
          <span>Total</span>
        </div>
        {CATEGORIES.map((c) => {
          const list = problems.filter((p) => p.category === c.slug)
          return (
            <div key={c.slug} className="level-row">
              <Link to={`/${c.slug}`}>{c.label}</Link>
              {LEVELS.map((l) => {
                const sub = list.filter((p) => p.level === l)
                return (
                  <span key={l} className="mono small">
                    {sub.length ? `${solvedOf(sub)}/${sub.length}` : '—'}
                  </span>
                )
              })}
              <span className="mono small">
                <strong>{solvedOf(list)}</strong>/{list.length}
              </span>
            </div>
          )
        })}
      </div>

      <h2 className="section-heading">Backup</h2>
      <div className="hero-actions">
        <button className="btn" onClick={download}>
          Export progress
        </button>
        <button className="btn" onClick={() => file.current?.click()}>
          Import progress
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              importProgress(await f.text())
            } catch {
              alert('That file is not a valid progress export.')
            }
          }}
        />
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (confirm('Clear all progress in this browser? This cannot be undone.')) resetProgress()
          }}
        >
          Reset progress
        </button>
      </div>
    </div>
  )
}
