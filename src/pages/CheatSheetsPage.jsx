import { Link, useParams } from 'react-router-dom'
import Markdown from '../components/Markdown.jsx'
import { cheatsheets } from '../data/problems.js'

export default function CheatSheetsPage() {
  const { slug } = useParams()
  const sheet = cheatsheets.find((s) => s.slug === slug) ?? cheatsheets[0]
  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// quick reference</p>
          <h1>Cheat Sheets</h1>
          <p className="muted">One page per topic — keep it open next to your IDE.</p>
        </div>
      </section>
      <div className="sheet-tabs">
        {cheatsheets.map((s) => (
          <Link key={s.slug} to={`/cheatsheets/${s.slug}`} className={`chip${s === sheet ? ' active' : ''}`}>
            {s.title}
          </Link>
        ))}
      </div>
      {!sheet ? (
        <p className="muted">Cheat sheets are being written.</p>
      ) : (
        <div className="sheet">
          <h2>{sheet.title}</h2>
          {sheet.sections.map((sec) => (
            <section key={sec.heading} className="sheet-section">
              <h3>{sec.heading}</h3>
              <Markdown>{sec.body}</Markdown>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
