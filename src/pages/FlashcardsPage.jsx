import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Markdown from '../components/Markdown.jsx'
import { CATEGORIES } from '../data/categories.js'
import { problems } from '../data/problems.js'

// Every interview follow-up from every problem becomes a card.
const ALL = problems.flatMap((p) => (p.interview ?? []).map((it, i) => ({ ...it, key: `${p.id}-${i}`, p })))

const shuffle = (a) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export default function FlashcardsPage() {
  const [cat, setCat] = useState('')
  const [seed, setSeed] = useState(0)
  const deck = useMemo(() => shuffle(ALL.filter((c) => !cat || c.p.category === cat)).slice(0, 15), [cat, seed])
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [score, setScore] = useState({ knew: 0, again: 0 })
  const card = deck[i]

  function grade(knew) {
    setScore((s) => ({ ...s, [knew ? 'knew' : 'again']: s[knew ? 'knew' : 'again'] + 1 }))
    setFlipped(false)
    setI(i + 1)
  }
  function restart(nextCat = cat) {
    setCat(nextCat)
    setSeed(seed + 1)
    setI(0)
    setFlipped(false)
    setScore({ knew: 0, again: 0 })
  }

  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// 10-minute warm-up</p>
          <h1>Flashcards</h1>
          <p className="muted">Interview follow-up questions from every problem. Answer out loud, flip, and be honest with yourself.</p>
        </div>
      </section>
      <section className="filters">
        <select className="input" value={cat} onChange={(e) => restart(e.target.value)}>
          <option value="">All sections ({ALL.length} cards)</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => restart()}>
          Shuffle new deck
        </button>
        <span className="muted small">
          {Math.min(i + 1, deck.length)} / {deck.length} · knew {score.knew} · again {score.again}
        </span>
      </section>

      {!deck.length ? (
        <p className="muted">No cards yet for this section.</p>
      ) : card ? (
        <div className={`flashcard${flipped ? ' flipped' : ''}`}>
          <div className="flash-q">
            <span className="stat-label">Question</span>
            <p>{card.q}</p>
          </div>
          {flipped ? (
            <>
              <div className="flash-a">
                <span className="stat-label">Model answer</span>
                <Markdown>{card.a}</Markdown>
                <Link className="small" to={`/${card.p.category}/${card.p.id}`}>
                  From: {card.p.title} →
                </Link>
              </div>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={() => grade(true)}>
                  I knew it
                </button>
                <button className="btn" onClick={() => grade(false)}>
                  Need again
                </button>
              </div>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setFlipped(true)}>
              Flip card
            </button>
          )}
        </div>
      ) : (
        <div className="flashcard">
          <h3>Deck done</h3>
          <p className="muted">
            You knew {score.knew} of {deck.length}. {score.again > 0 ? 'Shuffle again to practise the rest.' : 'Excellent.'}
          </p>
          <button className="btn btn-primary" onClick={() => restart()}>
            New deck
          </button>
        </div>
      )}
    </div>
  )
}
