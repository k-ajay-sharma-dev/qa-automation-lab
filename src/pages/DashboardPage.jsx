import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LevelBadge, StatusBadge } from '../components/Badges.jsx'
import { categoryBySlug } from '../data/categories.js'
import { problemById, problems } from '../data/problems.js'
import { currentStage, PHASES, phaseProblems } from '../data/roadmap.js'
import { statusOf, useProgress } from '../store/progress.js'

function ContinueCard({ progress }) {
  let last = null
  let lastAt = ''
  for (const [id, e] of Object.entries(progress)) {
    if (e?.updatedAt > lastAt && problemById.has(id)) {
      last = id
      lastAt = e.updatedAt
    }
  }
  if (!last) return null
  const p = problemById.get(last)
  const solved = statusOf(progress[last]) === 'solved'
  const list = problems.filter((x) => x.category === p.category)
  const i = list.findIndex((x) => x.id === p.id)
  const next = solved ? list.slice(i + 1).concat(list.slice(0, i)).find((x) => statusOf(progress[x.id]) !== 'solved') : null
  const target = next ?? p
  return (
    <section className="continue-card">
      <div>
        <span className="stat-label">{solved ? (next ? 'Next up' : 'Last solved') : 'Continue where you left off'}</span>
        <Link to={`/${target.category}/${target.id}`} className="continue-title">
          {target.title}
        </Link>
        <span className="muted small">
          {categoryBySlug.get(target.category)?.label}
          {solved && next && ` · after ${p.title}`}
        </span>
      </div>
      <Link to={`/${target.category}/${target.id}`} className="btn btn-primary">
        {solved ? 'Start' : 'Continue'} →
      </Link>
    </section>
  )
}

export default function DashboardPage() {
  const progress = useProgress()
  const [openPhase, setOpenPhase] = useState(null)
  const isSolved = (p) => statusOf(progress[p.id]) === 'solved'
  const solved = problems.filter(isSolved).length
  const pct = problems.length ? Math.round((solved / problems.length) * 100) : 0

  const phases = PHASES.map((ph) => {
    const list = phaseProblems(ph, problems)
    return { ...ph, list, done: list.filter(isSolved).length }
  })
  const active = currentStage(phases)
  const nextUp = active?.list.find((p) => !isSolved(p))

  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero-main">
          <p className="eyebrow">// learning path</p>
          <h1>From manual QA to automation engineer</h1>
          <p className="muted">
            You already know how to test. This path teaches you to automate it — Java, Selenium, Page Object Model and
            Cucumber — through real project situations, a practice web shop you can automate for real, and the
            debugging you only learn on the job.
          </p>
          <div className="hero-actions">
            {nextUp && (
              <Link className="btn btn-primary" to={`/${nextUp.category}/${nextUp.id}`}>
                {solved ? 'Continue' : 'Start'}: {nextUp.title} →
              </Link>
            )}
            <Link className="btn btn-ghost" to="/practice-site">
              Open the practice site
            </Link>
            <Link className="btn btn-ghost" to="/framework">
              See the framework blueprint
            </Link>
          </div>
        </div>
        <div className="hero-ring" aria-label={`${pct}% complete`}>
          <Ring pct={pct} />
          <div className="ring-label">
            <strong>{pct}%</strong>
            <span className="muted small">
              {solved} / {problems.length} solved
            </span>
          </div>
        </div>
      </section>

      <ContinueCard progress={progress} />

      <section className="practice-row">
        <Link to="/locators" className="practice-card practice-link">
          <span className="stat-label">Locator Lab</span>
          <strong>Live CSS & XPath</strong>
          <span className="muted small">Type a locator, see exactly what it matches on a real page.</span>
        </Link>
        <Link to="/debugging" className="practice-card practice-link">
          <span className="stat-label">Real-time experience</span>
          <strong>Debugging Clinic</strong>
          <span className="muted small">Failing tests, stack traces and Jenkins logs — diagnose and fix.</span>
        </Link>
        <Link to="/flashcards" className="practice-card practice-link">
          <span className="stat-label">Flashcards</span>
          <strong>10-minute warm-up</strong>
          <span className="muted small">Interview follow-ups from every problem. Flip and self-grade.</span>
        </Link>
        <Link to="/interview" className="practice-card practice-link">
          <span className="stat-label">Interview ready</span>
          <strong>Explain your framework</strong>
          <span className="muted small">Model answers phrased from a real project.</span>
        </Link>
      </section>

      <h2 className="section-heading">Roadmap · 12 weeks</h2>
      <section className="phase-grid">
        {phases.map((ph) => {
          const state = ph.list.length && ph.done === ph.list.length ? 'done' : ph === active ? 'current' : 'upcoming'
          const open = openPhase === ph.stage
          return (
            <article key={ph.stage} className={`phase-card phase-${state}`}>
              <header>
                <span className="phase-stage">Stage {ph.stage}</span>
                <span className={`phase-tag tag-${state}`}>{{ done: 'Complete', current: 'Current', upcoming: 'Upcoming' }[state]}</span>
              </header>
              <span className="phase-weeks mono small">{ph.weeks}</span>
              <h3>{ph.title}</h3>
              <p className="muted small">{ph.goal}</p>
              <ul className="phase-focus">
                {ph.focus.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="phase-progress">
                <div className="progress-bar">
                  <div style={{ width: `${ph.list.length ? (ph.done / ph.list.length) * 100 : 0}%` }} />
                </div>
                <span className="mono small muted">
                  {ph.done}/{ph.list.length}
                </span>
              </div>
              <button className="btn btn-ghost phase-toggle" onClick={() => setOpenPhase(open ? null : ph.stage)}>
                {open ? 'Hide problems' : `Show ${ph.list.length} problems`}
              </button>
              {open && (
                <ul className="phase-list">
                  {ph.list.map((p) => (
                    <li key={p.id}>
                      <Link to={`/${p.category}/${p.id}`}>
                        <span className="phase-list-title">{p.title}</span>
                        <span className="phase-list-meta">
                          <span className="muted small">{categoryBySlug.get(p.category).label}</span>
                          <LevelBadge level={p.level} />
                          <StatusBadge status={statusOf(progress[p.id])} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}

function Ring({ pct }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg width="132" height="132" viewBox="0 0 132 132">
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
      <circle
        cx="66"
        cy="66"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        transform="rotate(-90 66 66)"
      />
    </svg>
  )
}
