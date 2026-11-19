import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { editorFor } from '../components/Badges.jsx'
import CodeEditor from '../components/CodeEditor.jsx'
import LocatorWorkspace from '../components/LocatorWorkspace.jsx'
import Markdown from '../components/Markdown.jsx'
import { CATEGORIES, categoryBySlug } from '../data/categories.js'
import { buildRound, gradeRound, LEVEL_SETS, MODES, problemOf, verdict } from '../data/mock.js'
import { addHistory, clearActive, loadActive, loadHistory, saveActive } from '../store/mocks.js'
import { statusOf, updateProblem, useProgress } from '../store/progress.js'
import { useSettings } from '../store/settings.js'

const TYPE_LABEL = { mcq: 'Multiple choice', code: 'Live coding', locator: 'Locator task', spoken: 'Spoken answer' }

export default function MockPage() {
  const [round, setRound] = useState(loadActive)
  const [result, setResult] = useState(null)

  function update(next) {
    setRound(next)
    saveActive(next)
  }

  function finish(r = round) {
    const graded = gradeRound(r)
    addHistory({
      id: r.id,
      at: Date.now(),
      mode: r.mode,
      length: r.length,
      pct: graded.pct,
      items: r.items.length,
      minutesUsed: Math.min(r.minutes, Math.round((Date.now() - r.startedAt) / 60000)),
      bySection: graded.bySection.map(({ key, pct }) => ({ key, pct })),
    })
    clearActive()
    setRound(null)
    setResult({ round: r, graded })
    window.scrollTo({ top: 0 })
  }

  if (result) return <Results result={result} onAgain={() => setResult(null)} />
  if (round) return <Running round={round} update={update} finish={finish} />
  return <Setup onStart={(cfg) => update(buildRound(cfg))} />
}

/* ---------- setup ---------- */

function Setup({ onStart }) {
  const [mode, setMode] = useState('mock')
  const { mockLength } = useSettings()
  const [length, setLength] = useState(mockLength)
  const [levelSet, setLevelSet] = useState('all')
  const [sections, setSections] = useState(CATEGORIES.map((c) => c.slug))
  const history = loadHistory()
  const toggle = (slug) => setSections((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]))

  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// against the clock</p>
          <h1>Mock Interview & Practice Exam</h1>
          <p className="muted">
            A timed round drawn from every section, scored at the end with your weak areas. Nothing counts towards your
            progress, so take as many rounds as you like.
          </p>
        </div>
      </section>

      <div className="mock-setup">
        <div className="mock-modes">
          {Object.entries(MODES).map(([key, m]) => (
            <button key={key} className={`mock-mode${mode === key ? ' active' : ''}`} onClick={() => setMode(key)}>
              <strong>{m.label}</strong>
              <span className="muted small">{m.blurb}</span>
            </button>
          ))}
        </div>

        <div className="mock-options">
          <label className="field">
            <span className="stat-label">Length</span>
            <select className="input" value={length} onChange={(e) => setLength(e.target.value)}>
              {Object.entries(MODES[mode].lengths).map(([k, l]) => (
                <option key={k} value={k}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="stat-label">Difficulty</span>
            <select className="input" value={levelSet} onChange={(e) => setLevelSet(e.target.value)}>
              {Object.entries(LEVEL_SETS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <span className="stat-label">Sections</span>
          <div className="sheet-tabs">
            {CATEGORIES.map((c) => (
              <button key={c.slug} className={`chip${sections.includes(c.slug) ? ' active' : ''}`} onClick={() => toggle(c.slug)}>
                {sections.includes(c.slug) ? '✓ ' : ''}
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'mock' && (
          <p className="muted small">
            {(() => {
              const s = MODES.mock.lengths[length]
              return `${s.mcq} multiple choice · ${s.code} live coding · ${s.locator} locator · ${s.spoken} spoken — about ${s.minutes} minutes.`
            })()}{' '}
            Coding and locator answers are only graded at the end, like in a real interview.
          </p>
        )}

        <div>
          <button className="btn btn-primary" disabled={!sections.length} onClick={() => onStart({ mode, length, sections, levelSet })}>
            Start the round →
          </button>
        </div>
      </div>

      {history.length > 0 && <History history={history} />}
    </div>
  )
}

function History({ history }) {
  return (
    <>
      <h2 className="section-heading">Past rounds</h2>
      <div className="level-table">
        <div className="level-row mock-hist head">
          <span>When</span>
          <span>Round</span>
          <span>Items</span>
          <span>Time</span>
          <span>Score</span>
        </div>
        {history.map((h) => (
          <div key={h.id} className="level-row mock-hist">
            <span className="small">{new Date(h.at).toLocaleString()}</span>
            <span className="small">
              {MODES[h.mode]?.label} · {h.length}
            </span>
            <span className="mono small">{h.items}</span>
            <span className="mono small">{h.minutesUsed}m</span>
            <span className={`mono score-${verdict(h.pct).tone}`}>
              <strong>{h.pct}%</strong>
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

/* ---------- running ---------- */

function useCountdown(endsAt) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return Math.max(0, Math.round((endsAt - now) / 1000))
}

function Running({ round, update, finish }) {
  const [i, setI] = useState(0)
  const left = useCountdown(round.endsAt)
  const item = round.items[i]
  const answered = (k) => round.answers[k] !== undefined && round.answers[k] !== null
  const answeredCount = round.items.filter((_, k) => answered(k)).length

  useEffect(() => {
    if (left === 0) finish(round)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  const setAnswer = (value) => update({ ...round, answers: { ...round.answers, [i]: value } })
  const toggleFlag = () => update({ ...round, flagged: { ...round.flagged, [i]: !round.flagged[i] } })

  function confirmFinish() {
    const open = round.items.length - answeredCount
    if (!open || confirm(`${open} item${open > 1 ? 's are' : ' is'} unanswered. Finish the round anyway?`)) finish(round)
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="mock-running">
      <section className="mock-bar">
        <div>
          <span className="eyebrow">// {MODES[round.mode].label}</span>
          <div className="small muted">
            Item {i + 1} of {round.items.length} · {answeredCount} answered
          </div>
        </div>
        <div className={`mock-timer mono${left < 300 ? ' low' : ''}`} title="Time left">
          {mm}:{ss}
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (confirm('Abandon this round? It will not be scored.')) {
                clearActive()
                location.reload()
              }
            }}
          >
            Abandon
          </button>
          <button className="btn btn-primary btn-sm" onClick={confirmFinish}>
            Finish & score
          </button>
        </div>
      </section>

      <nav className="mock-dots" aria-label="Items">
        {round.items.map((it, k) => (
          <button
            key={k}
            className={`mock-dot${k === i ? ' current' : ''}${answered(k) ? ' done' : ''}${round.flagged[k] ? ' flagged' : ''} type-${it.type}`}
            onClick={() => setI(k)}
            title={`${k + 1}: ${TYPE_LABEL[it.type]}${round.flagged[k] ? ' (flagged)' : ''}`}
          >
            {k + 1}
          </button>
        ))}
      </nav>

      <div className="mock-item-head">
        <span className="mode-chip">{TYPE_LABEL[item.type]}</span>
        <span className="muted small">{categoryBySlug.get(problemOf(item).category)?.label}</span>
        <button className={`btn btn-sm${round.flagged[i] ? ' btn-primary' : ''}`} onClick={toggleFlag}>
          ⚑ {round.flagged[i] ? 'Flagged' : 'Flag for later'}
        </button>
      </div>

      <Item key={i} item={item} answer={round.answers[i]} setAnswer={setAnswer} />

      <div className="mock-nav">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>
          ← Previous
        </button>
        {i < round.items.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setI(i + 1)}>
            Next →
          </button>
        ) : (
          <button className="btn btn-primary" onClick={confirmFinish}>
            Finish & score
          </button>
        )}
      </div>
    </div>
  )
}

function Item({ item, answer, setAnswer }) {
  const p = problemOf(item)
  if (item.type === 'mcq') {
    const q = p.questions[item.qi]
    return (
      <div className="question mock-question">
        <div className="question-prompt">
          <Markdown>{q.q}</Markdown>
        </div>
        <div className="options">
          {q.options.map((opt, k) => (
            <label key={k} className={`option${answer === k ? ' chosen' : ''}`}>
              <input type="radio" name="mcq" checked={answer === k} onChange={() => setAnswer(k)} />
              <span className="option-text">
                <Markdown>{opt}</Markdown>
              </span>
            </label>
          ))}
        </div>
      </div>
    )
  }
  if (item.type === 'spoken') return <Spoken p={p} it={p.interview[item.ii]} answer={answer} setAnswer={setAnswer} />

  return (
    <div className="workspace mock-workspace">
      <section className="panel">
        <div className="panel-body">
          <h3 className="mock-task-title">{p.title}</h3>
          <div className="scenario-box">
            <span className="scenario-label">On the project</span>
            <Markdown>{p.scenario}</Markdown>
          </div>
          <Markdown>{p.description}</Markdown>
        </div>
      </section>
      {item.type === 'code' ? (
        <section className="panel editor-panel">
          <div className="editor-toolbar">
            <span className="mono muted small">{editorFor(p).label}</span>
            <span className="muted small">Reviewed when you finish the round</span>
          </div>
          <div className="editor-wrap">
            <CodeEditor
              value={answer?.code ?? p.starterCode}
              onChange={(code) => setAnswer({ code })}
              language={editorFor(p).monaco}
            />
          </div>
        </section>
      ) : (
        <LocatorWorkspace p={p} entry={answer} exam onLive={(v) => setAnswer(v.code ? v : null)} />
      )}
    </div>
  )
}

function Spoken({ it, answer, setAnswer }) {
  const [shown, setShown] = useState(answer !== undefined)
  return (
    <div className="flashcard mock-spoken">
      <div className="flash-q">
        <span className="stat-label">The interviewer asks</span>
        <p>{it.q}</p>
      </div>
      {!shown ? (
        <>
          <p className="muted small">Answer out loud as if you were in the interview — aim for one or two minutes, with an example from a project.</p>
          <button className="btn btn-primary" onClick={() => setShown(true)}>
            I've answered — show the model answer
          </button>
        </>
      ) : (
        <>
          <div className="flash-a">
            <span className="stat-label">Model answer</span>
            <Markdown>{it.a}</Markdown>
          </div>
          <span className="stat-label">How close was yours?</span>
          <div className="hero-actions">
            {[
              ['yes', 'Covered the key points'],
              ['partly', 'Partly'],
              ['no', 'Missed it'],
            ].map(([v, label]) => (
              <button key={v} className={`btn${answer === v ? ' btn-primary' : ''}`} onClick={() => setAnswer(v)}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- results ---------- */

function Results({ result, onAgain }) {
  const { round, graded } = result
  const progress = useProgress()
  const v = verdict(graded.pct)
  const [flaggedAll, setFlaggedAll] = useState(false)

  function addMissedToRevisit() {
    for (const id of graded.missed) if (statusOf(progress[id]) !== 'solved') updateProblem(id, { status: 'revisit' })
    setFlaggedAll(true)
  }

  return (
    <div className="category-page">
      <section className="hero">
        <div className="hero-main">
          <p className="eyebrow">// round complete</p>
          <h1 className={`score-${v.tone}`}>{v.label}</h1>
          <p className="muted">{v.note}</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={onAgain}>
              New round
            </button>
            {graded.missed.length > 0 && (
              <button className="btn btn-ghost" onClick={addMissedToRevisit} disabled={flaggedAll}>
                {flaggedAll ? '✓ Added to Revisit' : `Add ${graded.missed.length} missed problems to Revisit`}
              </button>
            )}
          </div>
        </div>
        <div className="hero-ring">
          <div className="ring-label mock-big">
            <strong>{graded.pct}%</strong>
            <span className="muted small">
              {graded.total.toFixed(1)} / {round.items.length} points
            </span>
          </div>
        </div>
      </section>

      <div className="mock-results-grid">
        <section className="sheet-section">
          <h3>By section</h3>
          {graded.bySection.map((g) => (
            <div key={g.key} className="bar-row">
              <Link to={`/${g.key}`} className="small">
                {g.label}
              </Link>
              <div className="progress-bar">
                <div className={`fill-${verdict(g.pct).tone}`} style={{ width: `${g.pct}%` }} />
              </div>
              <span className="mono small">{g.pct}%</span>
            </div>
          ))}
        </section>
        <section className="sheet-section">
          <h3>By question type</h3>
          {graded.byType.map((g) => (
            <div key={g.key} className="bar-row">
              <span className="small">{TYPE_LABEL[g.key]}</span>
              <div className="progress-bar">
                <div className={`fill-${verdict(g.pct).tone}`} style={{ width: `${g.pct}%` }} />
              </div>
              <span className="mono small">{g.pct}%</span>
            </div>
          ))}
          <h3 className="weak-title">Weak areas</h3>
          {graded.weakTags.length ? (
            <div className="tags">
              {graded.weakTags.map((t) => (
                <Link key={t.key} to={`/search?q=${encodeURIComponent(t.key)}`} className="tag weak-tag" title={`${t.pct}% over ${t.n} items`}>
                  #{t.key} · {t.pct}%
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted small">No topic below 60% (with at least two items). Nice.</p>
          )}
        </section>
      </div>

      <h2 className="section-heading">Review every item</h2>
      <div className="stack mock-review">
        {graded.scored.map((s, k) => (
          <ReviewItem key={k} n={k + 1} s={s} answer={round.answers[k]} />
        ))}
      </div>
    </div>
  )
}

function ReviewItem({ n, s, answer }) {
  const p = problemOf(s)
  const tone = s.score >= 1 ? 'correct' : s.score > 0 ? 'partial' : 'wrong'
  const link = (
    <Link to={`/${p.category}/${p.id}`} className="small">
      Open “{p.title}” →
    </Link>
  )
  return (
    <div className={`question ${tone}`}>
      <div className="question-head">
        <span className="question-num">
          {n}. {TYPE_LABEL[s.type]}
        </span>
        <span className="muted small">{categoryBySlug.get(p.category)?.label}</span>
        <span className="question-mark">{s.type === 'code' ? `${Math.round(s.score * 100)}%` : s.score >= 1 ? '✓' : s.score > 0 ? '½' : '✗'}</span>
      </div>
      {s.type === 'mcq' &&
        (() => {
          const q = p.questions[s.qi]
          return (
            <>
              <div className="question-prompt">
                <Markdown>{q.q}</Markdown>
              </div>
              <p className="small">
                {answer === undefined ? <span className="err-text">Not answered.</span> : answer !== q.answer && <span className="err-text">You chose: {q.options[answer]} · </span>}
                <strong>Answer:</strong> {q.options[q.answer]}
              </p>
              {s.score < 1 && (
                <div className="question-explain">
                  <Markdown>{q.why}</Markdown>
                </div>
              )}
            </>
          )
        })()}
      {s.type === 'code' && (
        <p className="small">
          <strong>{p.title}</strong> — {answer?.code ? `${Math.round(s.score * 100)}% of the reviewer checks passed.` : 'Not attempted.'} {link}
        </p>
      )}
      {s.type === 'locator' && (
        <p className="small">
          <strong>{p.title}</strong> — {answer?.code ? <code className="mono">{answer.code}</code> : 'Not attempted.'}{' '}
          {s.score >= 1 ? 'matched exactly the right elements.' : answer?.code ? 'did not match exactly the right elements.' : ''} {link}
        </p>
      )}
      {s.type === 'spoken' && (
        <p className="small">
          “{p.interview[s.ii].q}” — you rated: {{ yes: 'covered it', partly: 'partly', no: 'missed it' }[answer] ?? 'not answered'}. {link}
        </p>
      )}
    </div>
  )
}
