import { Link, useSearchParams } from 'react-router-dom'
import { KindChip, LevelBadge, StatusBadge } from '../components/Badges.jsx'
import { categoryBySlug } from '../data/categories.js'
import { problems } from '../data/problems.js'
import { statusOf, useProgress } from '../store/progress.js'

const text = (p) =>
  [p.title, p.id, p.tags.join(' '), p.scenario, p.description, ...(p.interview ?? []).map((x) => x.q)].join(' ').toLowerCase()

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const progress = useProgress()
  const q = params.get('q') ?? ''
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const hits = words.length ? problems.filter((p) => words.every((w) => text(p).includes(w))) : []
  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// search</p>
          <h1>Search</h1>
          <p className="muted">Searches titles, tags, scenarios and interview questions.</p>
        </div>
      </section>
      <section className="filters">
        <input
          className="input search"
          autoFocus
          type="search"
          placeholder="e.g. StaleElement, DataTable, ThreadLocal…"
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
        />
        {words.length > 0 && <span className="muted small">{hits.length} results</span>}
      </section>
      <div className="problem-table">
        {hits.map((p) => (
          <Link key={p.id} to={`/${p.category}/${p.id}`} className="problem-row simple-row">
            <span className="row-title">
              <span className="title">{p.title}</span>
              <span className="row-meta">
                <span className="mono muted">{p.id.toUpperCase()}</span>
                <KindChip kind={p.kind} />
                <span className="muted small">{categoryBySlug.get(p.category).label}</span>
              </span>
            </span>
            <LevelBadge level={p.level} />
            <StatusBadge status={statusOf(progress[p.id])} />
          </Link>
        ))}
      </div>
    </div>
  )
}
