import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CodeEditor from '../components/CodeEditor.jsx'

const modules = import.meta.glob('../data/frameworks/*.js', { eager: true })
const FRAMEWORKS = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.order - b.order)

const MONACO_LANG = { java: 'java', xml: 'xml', gherkin: 'gherkin', properties: 'ini', groovy: 'java', typescript: 'typescript', json: 'json', yaml: 'yaml', javascript: 'javascript' }

export default function FrameworkPage() {
  const [params, setParams] = useSearchParams()
  const fw = FRAMEWORKS.find((f) => f.id === params.get('fw')) ?? FRAMEWORKS[0]
  const [active, setActive] = useState(null)
  const file = fw.files.find((f) => f.path === active) ?? fw.files[0]

  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// what a real project looks like</p>
          <h1>Framework Blueprint</h1>
          <p className="muted">{fw.intro} Click a file to read it and why it exists.</p>
        </div>
      </section>

      {FRAMEWORKS.length > 1 && (
        <div className="sheet-tabs">
          {FRAMEWORKS.map((f) => (
            <button
              key={f.id}
              className={`chip${f === fw ? ' active' : ''}`}
              onClick={() => {
                setParams({ fw: f.id }, { replace: true })
                setActive(null)
              }}
              title={f.stack}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      <p className="muted small mono">{fw.stack}</p>

      <div className="blueprint">
        <div className="blueprint-side">
          <pre className="code-block tree">{fw.tree}</pre>
          <div className="file-list">
            {fw.files.map((f) => (
              <button key={f.path} className={`file-item mono small${f === file ? ' active' : ''}`} onClick={() => setActive(f.path)}>
                {f.path.split('/').pop()}
              </button>
            ))}
          </div>
          <h3 className="small">Run it</h3>
          {fw.commands.map(([label, cmd]) => (
            <div key={cmd} className="run-cmd">
              <span className="muted small">{label}</span>
              <code className="mono small">{cmd}</code>
            </div>
          ))}
        </div>
        <div className="panel blueprint-file">
          <div className="editor-toolbar">
            <span className="mono small">{file.path}</span>
          </div>
          <p className="file-why small">{file.why}</p>
          <div className="editor-wrap">
            <CodeEditor key={fw.id + file.path} value={file.code} language={MONACO_LANG[file.lang] ?? 'plaintext'} readOnly />
          </div>
        </div>
      </div>
    </div>
  )
}
