import { Link } from 'react-router-dom'
import { LevelBadge, StatusBadge } from '../components/Badges.jsx'
import { categoryBySlug } from '../data/categories.js'
import { problems } from '../data/problems.js'
import { statusOf, useProgress } from '../store/progress.js'

export default function ReviewPage() {
  const progress = useProgress()
  const revisit = problems.filter((p) => statusOf(progress[p.id]) === 'revisit')
  const attempted = problems.filter((p) => statusOf(progress[p.id]) === 'attempted')
  const Section = ({ title, list, empty }) => (
    <>
      <h2 className="section-heading">
        {title} <span className="muted small">({list.length})</span>
      </h2>
      <div className="problem-table">
        {list.map((p) => (
          <Link key={p.id} to={`/${p.category}/${p.id}`} className="problem-row simple-row">
            <span className="row-title">
              <span className="title">{p.title}</span>
              <span className="row-meta muted small">{categoryBySlug.get(p.category).label}</span>
            </span>
            <LevelBadge level={p.level} />
            <StatusBadge status={statusOf(progress[p.id])} />
          </Link>
        ))}
        {list.length === 0 && <div className="empty-row muted">{empty}</div>}
      </div>
    </>
  )
  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// come back to these</p>
          <h1>Revisit</h1>
          <p className="muted">Problems you flagged with ↻ Revisit, and ones you started but haven't passed yet.</p>
        </div>
      </section>
      <Section title="Flagged for revisit" list={revisit} empty="Nothing flagged. Use the ↻ Revisit button on any problem you want to redo." />
      <Section title="Attempted, not solved yet" list={attempted} empty="No unfinished problems." />
    </div>
  )
}
