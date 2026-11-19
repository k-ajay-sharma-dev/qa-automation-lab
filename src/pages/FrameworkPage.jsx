import { useState } from 'react'
import CodeEditor from '../components/CodeEditor.jsx'
import { FRAMEWORK_FILES, FRAMEWORK_TREE, RUN_COMMANDS } from '../data/framework.js'

const MONACO_LANG = { java: 'java', xml: 'xml', gherkin: 'gherkin', properties: 'ini', groovy: 'java' }

export default function FrameworkPage() {
  const [active, setActive] = useState(FRAMEWORK_FILES[0].path)
  const file = FRAMEWORK_FILES.find((f) => f.path === active)
  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// what a real project looks like</p>
          <h1>Framework Blueprint</h1>
          <p className="muted">
            A complete Java + Selenium + Cucumber + TestNG + Page Object Model framework for the ShopEasy practice site — the
            structure interviewers expect when they say “explain your framework”. Click a file to read it and why it exists.
          </p>
        </div>
      </section>

      <div className="blueprint">
        <div className="blueprint-side">
          <pre className="code-block tree">{FRAMEWORK_TREE}</pre>
          <div className="file-list">
            {FRAMEWORK_FILES.map((f) => (
              <button key={f.path} className={`file-item mono small${f.path === active ? ' active' : ''}`} onClick={() => setActive(f.path)}>
                {f.path.split('/').pop()}
              </button>
            ))}
          </div>
          <h3 className="small">Run it</h3>
          {RUN_COMMANDS.map(([label, cmd]) => (
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
            <CodeEditor value={file.code} language={MONACO_LANG[file.lang]} readOnly />
          </div>
        </div>
      </div>
    </div>
  )
}
