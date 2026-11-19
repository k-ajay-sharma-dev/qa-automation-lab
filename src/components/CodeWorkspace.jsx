import { useEffect, useRef, useState } from 'react'
import { runChecks } from '../grading/checks.js'
import { updateProblem } from '../store/progress.js'
import { editorFor } from './Badges.jsx'
import CodeEditor from './CodeEditor.jsx'

// Java / Gherkin answers: the learner writes code, "Check" runs the rule checks in the browser.
export default function CodeWorkspace({ p, entry, onResult }) {
  const [code, setCode] = useState(entry?.code ?? p.starterCode)
  const [results, setResults] = useState(null)
  const [compare, setCompare] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  function change(v) {
    setCode(v)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => updateProblem(p.id, { code: v }), 600)
  }

  function check() {
    const r = runChecks(p, code)
    setResults(r)
    onResult(r.every((x) => x.pass))
  }

  const passed = results?.filter((r) => r.pass).length ?? 0
  const all = results?.length ?? 0

  return (
    <section className="panel editor-panel">
      <div className="editor-toolbar">
        <span className="mono muted small">{editorFor(p).label}</span>
        <div className="toolbar-actions">
          <button className="btn btn-sm" onClick={() => setCompare(!compare)}>
            {compare ? 'Hide' : 'Show'} starter
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              if (confirm('Reset your code to the starter?')) change(p.starterCode)
            }}
          >
            Reset
          </button>
          <button className="btn btn-primary btn-sm" onClick={check}>
            ✓ Check
          </button>
        </div>
      </div>
      <div className="editor-wrap">
        <CodeEditor value={code} onChange={change} language={editorFor(p).monaco} />
      </div>
      {compare && (
        <div className="starter-peek">
          <pre className="code-block">{p.starterCode.trim()}</pre>
        </div>
      )}
      <div className="results-panel">
        {!results ? (
          <p className="muted small">
            Press <strong>Check</strong> to review your code against {p.checks.length} reviewer rules. This is a code review, not a
            compiler — run it in your IDE against the practice site to see it work for real.
          </p>
        ) : (
          <>
            <div className={`result-banner ${passed === all ? 'ok' : 'bad'}`}>
              {passed === all ? '✓ All checks passed — marked solved. Compare with the Solution tab.' : `${passed} of ${all} checks passed`}
            </div>
            <ul className="check-list">
              {results.map((r) => (
                <li key={r.label} className={r.pass ? 'pass' : 'fail'}>
                  <span className="mark">{r.pass ? '✓' : '✗'}</span>
                  <span>
                    {r.label}
                    {!r.pass && r.hint && <span className="check-hint muted small"> — {r.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
