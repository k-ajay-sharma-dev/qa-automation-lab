import { KIND_LABELS, STATUSES } from '../data/categories.js'

export function LevelBadge({ level }) {
  return <span className={`level level-${level.toLowerCase()}`}>{level}</span>
}

const STATUS_ICON = { 'not-started': '○', attempted: '◐', solved: '●', revisit: '↻' }

export function StatusBadge({ status }) {
  const label = STATUSES.find((s) => s.value === status)?.label ?? status
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true">{STATUS_ICON[status]}</span> {label}
    </span>
  )
}

export function KindChip({ kind, language }) {
  const label = kind === 'code' && language === 'typescript' ? 'TypeScript' : (KIND_LABELS[kind] ?? kind)
  return <span className={`mode-chip kind-${kind}${language === 'typescript' ? ' kind-ts' : ''}`}>{label}</span>
}

// Editor label and Monaco language for a code problem.
export const EDITOR = {
  java: { label: 'Java 17 · Selenium 4', monaco: 'java' },
  typescript: { label: 'TypeScript · Playwright', monaco: 'typescript' },
  gherkin: { label: 'Gherkin · .feature', monaco: 'gherkin' },
}
export const editorFor = (p) => {
  const e = EDITOR[p.language] ?? EDITOR.java
  return p.category === 'restassured' && p.language === 'java' ? { ...e, label: 'Java 17 · RestAssured 5' } : e
}

export function Tags({ tags }) {
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t} className="tag">
          #{t}
        </span>
      ))}
    </span>
  )
}
