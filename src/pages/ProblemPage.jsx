import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { KindChip, LevelBadge, StatusBadge, Tags } from '../components/Badges.jsx'
import Markdown from '../components/Markdown.jsx'
import CodeWorkspace from '../components/CodeWorkspace.jsx'
import LocatorWorkspace from '../components/LocatorWorkspace.jsx'
import QuizWorkspace from '../components/QuizWorkspace.jsx'
import { categoryBySlug } from '../data/categories.js'
import { problemById, problemsFor } from '../data/problems.js'
import { statusOf, updateProblem, useProgress } from '../store/progress.js'

export default function ProblemPage() {
  const { category, problemId } = useParams()
  const p = problemById.get(problemId)
  if (!p || p.category !== category)
    return (
      <div className="empty-state">
        <p>Problem not found.</p>
        <Link to={`/${category}`}>Back to the list</Link>
      </div>
    )
  return <Problem key={p.id} p={p} />
}

function Problem({ p }) {
  const progress = useProgress()
  const entry = progress[p.id]
  const status = statusOf(entry)
  const cat = categoryBySlug.get(p.category)
  const list = problemsFor(p.category)
  const i = list.findIndex((x) => x.id === p.id)
  const prev = list[i - 1]
  const next = list[i + 1]
  const [tab, setTab] = useState('task')
  const [hintsShown, setHintsShown] = useState(0)
  const [revealed, setRevealed] = useState(status === 'solved')

  const onResult = (passed) => {
    updateProblem(p.id, { status: passed ? 'solved' : 'attempted', attempts: (entry?.attempts ?? 0) + 1 })
    if (passed) setRevealed(true)
  }

  const tabs = [
    ['task', 'Task'],
    ['hints', `Hints (${p.hints.length})`],
    ['solution', 'Solution'],
    ['explain', 'Explanation'],
    ['interview', `Interview (${p.interview?.length ?? 0})`],
  ]

  return (
    <div className="problem-page">
      <section className="problem-head">
        <div>
          <Link to={`/${p.category}`} className="back-link">
            ← {cat.label}
          </Link>
          <h1>{p.title}</h1>
          <div className="problem-meta">
            <span className="mono muted small">{p.id.toUpperCase()}</span>
            <LevelBadge level={p.level} />
            <KindChip kind={p.kind} />
            <span className="mono muted small">~{p.estMinutes}m</span>
            <Tags tags={p.tags} />
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="head-actions">
          <button
            className={`btn btn-sm${status === 'revisit' ? ' btn-primary' : ''}`}
            onClick={() => updateProblem(p.id, { status: status === 'revisit' ? 'attempted' : 'revisit' })}
            title="Put this on your Revisit list"
          >
            ↻ Revisit
          </button>
          <div className="prev-next">
            {prev ? (
              <Link className="btn btn-sm" to={`/${p.category}/${prev.id}`}>
                ← Prev
              </Link>
            ) : (
              <span className="btn btn-sm" aria-disabled="true">
                ← Prev
              </span>
            )}
            {next ? (
              <Link className="btn btn-sm" to={`/${p.category}/${next.id}`}>
                Next →
              </Link>
            ) : (
              <span className="btn btn-sm" aria-disabled="true">
                Next →
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="workspace">
        <section className="panel">
          <div className="panel-tabs" role="tablist">
            {tabs.map(([key, label]) => (
              <button key={key} role="tab" className={`panel-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="panel-body">
            {tab === 'task' && (
              <>
                <div className="scenario-box">
                  <span className="scenario-label">On the project</span>
                  <Markdown>{p.scenario}</Markdown>
                </div>
                <Markdown>{p.description}</Markdown>
                {p.kind === 'locator' && (
                  <p className="muted small">
                    Page under test:{' '}
                    <a href={`practice-site/${p.page}`} target="_blank" rel="noreferrer">
                      practice-site/{p.page}
                    </a>
                  </p>
                )}
              </>
            )}
            {tab === 'hints' && (
              <div className="stack">
                {p.hints.slice(0, hintsShown).map((h, n) => (
                  <div key={n} className="hint">
                    <div className="hint-num">Hint {n + 1}</div>
                    <Markdown>{h}</Markdown>
                  </div>
                ))}
                {hintsShown < p.hints.length ? (
                  <button className="btn" onClick={() => setHintsShown(hintsShown + 1)}>
                    Show hint {hintsShown + 1} of {p.hints.length}
                  </button>
                ) : (
                  <p className="muted small">That's every hint. Still stuck? Look at the Solution tab, then try again without it tomorrow.</p>
                )}
              </div>
            )}
            {tab === 'solution' &&
              (revealed ? (
                <Solution p={p} />
              ) : (
                <div className="reveal-gate">
                  <p>
                    <strong>Try it first.</strong>{' '}
                    <span className="muted">Struggling for 10 minutes teaches more than reading the answer straight away.</span>
                  </p>
                  <button
                    className="btn"
                    onClick={() => {
                      setRevealed(true)
                      if (status === 'not-started') updateProblem(p.id, { status: 'attempted' })
                    }}
                  >
                    Show the solution anyway
                  </button>
                </div>
              ))}
            {tab === 'explain' && (
              <>
                <Markdown>{p.explanation}</Markdown>
                {p.mistakes?.length > 0 && (
                  <div className="mistakes-box">
                    <h3>Common mistakes</h3>
                    <ul>
                      {p.mistakes.map((m) => (
                        <li key={m}>
                          <Markdown>{m}</Markdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {tab === 'interview' && <InterviewList items={p.interview ?? []} />}
          </div>
        </section>

        {(p.kind === 'code' || p.kind === 'gherkin') && <CodeWorkspace p={p} entry={entry} onResult={onResult} />}
        {p.kind === 'locator' && <LocatorWorkspace p={p} entry={entry} onResult={onResult} />}
        {p.kind === 'quiz' && <QuizWorkspace p={p} entry={entry} onResult={onResult} />}
      </div>
    </div>
  )
}

function Solution({ p }) {
  if (p.kind === 'quiz')
    return (
      <div className="stack">
        {p.questions.map((q, n) => (
          <div key={n} className="question correct">
            <div className="question-head">
              <span className="question-num">Question {n + 1}</span>
            </div>
            <Markdown>{q.q}</Markdown>
            <p>
              <strong>Answer:</strong> {q.options[q.answer]}
            </p>
            <div className="question-explain">
              <Markdown>{q.why}</Markdown>
            </div>
          </div>
        ))}
      </div>
    )
  if (p.kind === 'locator') return <Markdown>{p.solution}</Markdown>
  return (
    <>
      <pre className="code-block">{p.solution.trim()}</pre>
    </>
  )
}

function InterviewList({ items }) {
  const [open, setOpen] = useState({})
  return (
    <div className="stack">
      <p className="muted small">Say your answer out loud first, then compare with the model answer.</p>
      {items.map((it, n) => (
        <div key={n} className="followup-card">
          <div className="followup-q">
            <span className="question-num">Q{n + 1}</span> {it.q}
          </div>
          {open[n] ? (
            <div className="followup-a">
              <Markdown>{it.a}</Markdown>
            </div>
          ) : (
            <button className="btn btn-sm" onClick={() => setOpen({ ...open, [n]: true })}>
              Show model answer
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
