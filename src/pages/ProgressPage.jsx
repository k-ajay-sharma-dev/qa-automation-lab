import { Link } from 'react-router-dom'
import { CATEGORIES, LEVELS } from '../data/categories.js'
import { problems } from '../data/problems.js'
import { statusOf, useProgress } from '../store/progress.js'
import { inTime } from '../study/timer.js'

export default function ProgressPage() {
  const progress = useProgress()
  const solvedOf = (list) => list.filter((p) => statusOf(progress[p.id]) === 'solved').length
  const solved = solvedOf(problems)
  const attempted = problems.filter((p) => statusOf(progress[p.id]) === 'attempted').length
  const revisit = problems.filter((p) => statusOf(progress[p.id]) === 'revisit').length
  // real time from the problem timer where there is one
  const logs = Object.values(progress).flatMap((e) => (Array.isArray(e?.timeLog) ? e.timeLog : []))
  const minutes = Math.round(logs.reduce((s, r) => s + (r.totalSeconds ?? 0), 0) / 60)
  const timedSolves = Object.values(progress).filter((e) => e?.timeLog?.length)
  const onTime = timedSolves.filter((e) => inTime(e.timeLog.at(-1))).length

  // the last 14 days of solves
  const days = [...Array(14)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = d.toISOString().slice(0, 10)
    return { key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), n: Object.values(progress).filter((e) => e.solvedAt?.slice(0, 10) === key).length }
  })
  const maxDay = Math.max(1, ...days.map((d) => d.n))

  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// progress</p>
          <h1>Your progress</h1>
          <p className="muted">Saved in this browser, and to your Google account when you sign in (Settings).</p>
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
          <span className="stat-label">Timed practice</span>
          <span className="stat-value">
            {minutes >= 60 ? Math.floor(minutes / 60) : minutes}
            <span className="muted small">{minutes >= 60 ? ` h ${minutes % 60} m` : ' min'}</span>
          </span>
          {timedSolves.length > 0 && (
            <span className="muted small">
              {onTime}/{timedSolves.length} solved within the target time
            </span>
          )}
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

      <p className="muted small">
        Backup, sign-in and reset are in <Link to="/settings">Settings</Link>.
      </p>
    </div>
  )
}
