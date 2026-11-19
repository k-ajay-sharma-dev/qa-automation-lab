import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { KindChip, LevelBadge, StatusBadge, Tags } from '../components/Badges.jsx'
import { categoryBySlug, KIND_LABELS, LEVELS, STATUSES } from '../data/categories.js'
import { problemsFor } from '../data/problems.js'
import { statusOf, useProgress } from '../store/progress.js'

export default function CategoryPage() {
  const { category } = useParams()
  const cat = categoryBySlug.get(category)
  const progress = useProgress()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  if (!cat)
    return (
      <div className="empty-state">
        <p>Page not found.</p>
        <Link to="/">Back to the learning path</Link>
      </div>
    )

  const all = problemsFor(category)
  const q = params.get('q') || ''
  const level = params.get('level') || ''
  const status = params.get('status') || ''
  const tag = params.get('tag') || ''
  const kind = params.get('kind') || ''
  const allTags = [...new Set(all.flatMap((p) => p.tags))].sort()
  const kinds = [...new Set(all.map((p) => p.kind))]
  const filtered = all.filter(
    (p) =>
      (!level || p.level === level) &&
      (!status || statusOf(progress[p.id]) === status) &&
      (!tag || p.tags.includes(tag)) &&
      (!kind || p.kind === kind) &&
      (!q || `${p.title} ${p.id} ${p.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())),
  )
  const solvedCount = all.filter((p) => statusOf(progress[p.id]) === 'solved').length
  const hasFilters = q || level || status || tag || kind

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  function openRandomUnsolved() {
    const pool = all.filter((p) => statusOf(progress[p.id]) !== 'solved')
    if (pool.length) navigate(`/${category}/${pool[Math.floor(Math.random() * pool.length)].id}`)
  }

  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// {cat.eyebrow}</p>
          <h1>{cat.label}</h1>
          <p className="muted">{cat.blurb}</p>
        </div>
        <div className="progress-card">
          <div className="progress-num">
            {solvedCount}
            <span className="muted"> / {all.length}</span>
          </div>
          <div className="muted small">solved</div>
          <div className="progress-bar">
            <div style={{ width: `${all.length ? (solvedCount / all.length) * 100 : 0}%` }} />
          </div>
        </div>
      </section>

      <section className="filters">
        <input className="input search" type="search" placeholder="Search problems…" value={q} onChange={(e) => setParam('q', e.target.value)} />
        <select className="input" value={level} onChange={(e) => setParam('level', e.target.value)}>
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l[0] + l.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select className="input" value={tag} onChange={(e) => setParam('tag', e.target.value)}>
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        {kinds.length > 1 && (
          <select className="input" value={kind} onChange={(e) => setParam('kind', e.target.value)}>
            <option value="">All exercise types</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        )}
        <button className="btn" onClick={openRandomUnsolved} disabled={solvedCount === all.length}>
          Random unsolved
        </button>
        {hasFilters && (
          <button className="btn btn-ghost" onClick={() => setParams({}, { replace: true })}>
            Clear
          </button>
        )}
      </section>

      <div className="problem-table" role="table">
        <div className="problem-row head" role="row">
          <span>#</span>
          <span>Problem</span>
          <span>Level</span>
          <span>Time</span>
          <span>Status</span>
        </div>
        {filtered.map((p, i) => (
          <Link key={p.id} to={`/${category}/${p.id}`} className="problem-row" role="row">
            <span className="row-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="row-title">
              <span className="title">{p.title}</span>
              <span className="row-meta">
                <span className="mono muted">{p.id.toUpperCase()}</span>
                <KindChip kind={p.kind} />
                <Tags tags={p.tags} />
              </span>
            </span>
            <span>
              <LevelBadge level={p.level} />
            </span>
            <span className="mono muted">{p.estMinutes}m</span>
            <span>
              <StatusBadge status={statusOf(progress[p.id])} />
            </span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="empty-row muted">{all.length ? 'No problems match these filters.' : 'Problems for this section are being written.'}</div>
        )}
      </div>
    </div>
  )
}
