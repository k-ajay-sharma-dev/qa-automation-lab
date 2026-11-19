import { Link, useParams } from 'react-router-dom'
import LessonView from '../components/LessonView.jsx'
import { CATEGORIES, categoryBySlug } from '../data/categories.js'
import { lessonBySlug, lessons, lessonsInCategory } from '../data/lessons.js'
import { useLessonsRead } from '../store/lessons.js'

export default function LessonsPage() {
  const { slug } = useParams()
  return slug ? <OneLesson slug={slug} /> : <AllLessons />
}

function AllLessons() {
  const read = useLessonsRead()
  const done = lessons.filter((l) => read[l.slug]).length
  const minutes = lessons.reduce((s, l) => s + (l.minutes ?? 0), 0)
  const next = lessons.find((l) => !read[l.slug])
  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// learn before you solve</p>
          <h1>Lessons</h1>
          <p className="muted">
            Short topic lessons written for manual testers moving to automation. Each one starts from what you already do
            by hand, explains the idea and the code, and links to the problems that practise it.
          </p>
          {next && (
            <div className="hero-actions">
              <Link className="btn btn-primary" to={`/lessons/${next.slug}`}>
                {done ? 'Continue' : 'Start'}: {next.title} →
              </Link>
            </div>
          )}
        </div>
        <div className="progress-card">
          <div className="progress-num">
            {done}
            <span className="muted"> / {lessons.length}</span>
          </div>
          <div className="muted small">read · about {Math.round(minutes / 60)} h in total</div>
          <div className="progress-bar">
            <div style={{ width: `${lessons.length ? (done / lessons.length) * 100 : 0}%` }} />
          </div>
        </div>
      </section>

      {CATEGORIES.map((c) => {
        const list = lessonsInCategory(c.slug)
        if (!list.length) return null
        return (
          <section key={c.slug} className="lesson-group">
            <h2 className="section-heading">
              {c.label}{' '}
              <span className="muted small">
                {list.filter((l) => read[l.slug]).length}/{list.length}
              </span>
            </h2>
            <div className="problem-table">
              {list.map((l, i) => (
                <Link key={l.slug} to={`/lessons/${l.slug}`} className="problem-row lesson-row">
                  <span className="row-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="row-title">
                    <span className="title">{l.title}</span>
                    <span className="row-meta muted small">{l.summary}</span>
                  </span>
                  <span className="mono muted small">{l.minutes} min</span>
                  <span className={`status ${read[l.slug] ? 'status-solved' : ''}`}>{read[l.slug] ? '● Read' : '○ Not read'}</span>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
      {!lessons.length && <p className="muted">Lessons are being written.</p>}
    </div>
  )
}

function OneLesson({ slug }) {
  const lesson = lessonBySlug.get(slug)
  if (!lesson)
    return (
      <div className="empty-state">
        <p>Lesson not found.</p>
        <Link to="/lessons">All lessons</Link>
      </div>
    )
  const i = lessons.indexOf(lesson)
  const prev = lessons[i - 1]
  const next = lessons[i + 1]
  return (
    <div className="lesson-page">
      <Link to="/lessons" className="back-link">
        ← Lessons · {categoryBySlug.get(lesson.category)?.label}
      </Link>
      <LessonView lesson={lesson} />
      <nav className="lesson-nav">
        {prev ? (
          <Link className="btn" to={`/lessons/${prev.slug}`}>
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link className="btn btn-primary" to={`/lessons/${next.slug}`}>
            Next: {next.title} →
          </Link>
        )}
      </nav>
    </div>
  )
}
