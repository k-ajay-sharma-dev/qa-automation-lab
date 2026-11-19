import { Link } from 'react-router-dom'
import { problemById } from '../data/problems.js'
import { setLessonRead, useLessonsRead } from '../store/lessons.js'
import { statusOf, useProgress } from '../store/progress.js'
import { LevelBadge, StatusBadge } from './Badges.jsx'
import Markdown from './Markdown.jsx'

// One topic lesson. `compact` is the version inside a problem's Learn tab (no related-problem list).
export default function LessonView({ lesson, compact = false, onDone }) {
  const read = useLessonsRead()
  const progress = useProgress()
  const done = Boolean(read[lesson.slug])

  return (
    <article className={`lesson${compact ? ' compact' : ''}`}>
      <header className="lesson-head">
        <span className="lesson-kicker">📖 Lesson · {lesson.minutes} min read</span>
        <h2>{lesson.title}</h2>
        <p className="muted">{lesson.summary}</p>
      </header>

      <div className="lesson-analogy">
        <span className="scenario-label">You already know this as a manual tester</span>
        <Markdown>{lesson.manualAnalogy}</Markdown>
      </div>

      <div className="lesson-body">
        <Markdown>{lesson.body}</Markdown>
      </div>

      <section className="lesson-box key">
        <h3>Key points</h3>
        <ul>
          {lesson.keyPoints.map((k) => (
            <li key={k}>
              <Markdown>{k}</Markdown>
            </li>
          ))}
        </ul>
      </section>

      <section className="lesson-box mistakes">
        <h3>Beginner mistakes</h3>
        <ul>
          {lesson.mistakes.map((m) => (
            <li key={m}>
              <Markdown>{m}</Markdown>
            </li>
          ))}
        </ul>
      </section>

      {lesson.tryIt && (
        <section className="lesson-box try">
          <h3>Try it (2 minutes)</h3>
          <Markdown>{lesson.tryIt}</Markdown>
        </section>
      )}

      {!compact && lesson.problems?.length > 0 && (
        <section className="lesson-practice">
          <h3>Practise it</h3>
          <ul className="phase-list">
            {lesson.problems
              .map((id) => problemById.get(id))
              .filter(Boolean)
              .map((p) => (
                <li key={p.id}>
                  <Link to={`/${p.category}/${p.id}`}>
                    <span className="phase-list-title">{p.title}</span>
                    <span className="phase-list-meta">
                      <LevelBadge level={p.level} />
                      <StatusBadge status={statusOf(progress[p.id])} />
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      <div className="lesson-actions">
        {onDone ? (
          <button
            className="btn btn-primary"
            onClick={() => {
              setLessonRead(lesson.slug)
              onDone()
            }}
          >
            ✓ Got it — go to the task →
          </button>
        ) : (
          <button className={`btn${done ? '' : ' btn-primary'}`} onClick={() => setLessonRead(lesson.slug, !done)}>
            {done ? '✓ Read — mark as unread' : 'Mark as read'}
          </button>
        )}
      </div>
    </article>
  )
}
