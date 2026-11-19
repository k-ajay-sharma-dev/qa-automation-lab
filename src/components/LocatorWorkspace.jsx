import { useCallback, useEffect, useRef, useState } from 'react'
import { updateProblem } from '../store/progress.js'

const HIT = '__qa-hit'
const STYLE = `.${HIT}{outline:3px solid #f59e0b !important;outline-offset:2px !important;background-color:rgba(245,158,11,.18) !important;}`

// Runs the learner's locator inside the practice page (same-origin iframe) and compares the matched
// elements with the problem's expected elements.
function evaluate(doc, strategy, text) {
  const t = text.trim()
  if (!t) return { nodes: [], error: null }
  try {
    if (strategy === 'xpath') {
      const snap = doc.evaluate(t, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
      const nodes = []
      for (let i = 0; i < snap.snapshotLength; i++) nodes.push(snap.snapshotItem(i))
      return { nodes: nodes.filter((n) => n.nodeType === 1), error: null }
    }
    return { nodes: [...doc.querySelectorAll(t)], error: null }
  } catch {
    return { nodes: [], error: strategy === 'xpath' ? 'That is not a valid XPath expression.' : 'That is not a valid CSS selector.' }
  }
}

function warningsFor(strategy, text) {
  const t = text.trim()
  const w = []
  if (strategy === 'xpath' && /^\/(?!\/)/.test(t)) w.push('Absolute XPath (starts with a single "/") breaks as soon as the layout changes. Start with // and anchor on an attribute or text.')
  if (strategy === 'xpath' && /^\/\/(html|body)\b/.test(t)) w.push('Starting from html/body makes the locator depend on the whole page structure.')
  if (/\[\d+\]\s*$/.test(t) && !/@|text\(|contains/.test(t)) w.push('A locator that relies only on a position index breaks when items are added or re-ordered.')
  if (strategy === 'css' && /(:nth-child\(\d+\).*){2,}/.test(t)) w.push('Several nth-child steps make this brittle — prefer an id, data-testid or attribute.')
  if (/(id|class)=['"][^'"]*\d{4,}/.test(t) || /#[a-z-]*[0-9a-f]{5,}\b/i.test(t)) w.push('This looks like an auto-generated value that may change on every build or page load.')
  return w
}

const javaLine = (strategy, text) => {
  const s = text.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return strategy === 'xpath' ? `driver.findElement(By.xpath("${s}"));` : `driver.findElement(By.cssSelector("${s}"));`
}

// exam mode: no Check button and no pass/fail; the answer is graded silently and reported through onLive.
export default function LocatorWorkspace({ p, entry, onResult, exam = false, onLive }) {
  const allowed = p.strategy === 'either' ? ['css', 'xpath'] : [p.strategy]
  const [strategy, setStrategy] = useState(entry?.strategy ?? allowed[0])
  const [text, setText] = useState(entry?.code ?? '')
  const liveRef = useRef(onLive)
  liveRef.current = onLive
  const [live, setLive] = useState({ nodes: [], error: null })
  const [graded, setGraded] = useState(null)
  const [ready, setReady] = useState(false)
  const frame = useRef(null)

  const doc = () => frame.current?.contentDocument

  const highlight = useCallback((nodes) => {
    const d = doc()
    if (!d) return
    if (!d.getElementById('__qa-style')) {
      const st = d.createElement('style')
      st.id = '__qa-style'
      st.textContent = STYLE
      d.head.appendChild(st)
    }
    d.querySelectorAll(`.${HIT}`).forEach((n) => n.classList.remove(HIT))
    nodes.forEach((n) => n.classList?.add(HIT))
    nodes[0]?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => {
      const d = doc()
      const r = evaluate(d, strategy, text)
      setLive(r)
      highlight(r.nodes)
      if (exam && liveRef.current) {
        const expected = [...d.querySelectorAll(p.expected)]
        const pass = !r.error && expected.length > 0 && r.nodes.length === expected.length && expected.every((e) => r.nodes.includes(e))
        liveRef.current({ code: text, strategy, pass })
      }
    }, 200)
    return () => clearTimeout(t)
  }, [text, strategy, ready, highlight, exam, p.expected])

  function check() {
    const d = doc()
    if (!d) return
    const expected = [...d.querySelectorAll(p.expected)]
    const r = evaluate(d, strategy, text)
    const same = r.nodes.length === expected.length && expected.every((e) => r.nodes.includes(e)) && expected.length > 0
    const extra = r.nodes.filter((n) => !expected.includes(n)).length
    const missing = expected.filter((e) => !r.nodes.includes(e)).length
    setGraded({ pass: same && !r.error, extra, missing, count: r.nodes.length, error: r.error })
    updateProblem(p.id, { code: text, strategy })
    onResult(same && !r.error)
  }

  const warnings = warningsFor(strategy, text)

  return (
    <section className="panel locator-panel">
      <div className="editor-toolbar">
        <div className="seg">
          {allowed.map((s) => (
            <button key={s} className={`seg-btn${strategy === s ? ' active' : ''}`} onClick={() => setStrategy(s)}>
              {s === 'css' ? 'CSS selector' : 'XPath'}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-sm"
            onClick={() => {
              frame.current?.contentWindow?.location.reload()
              setReady(false)
              setGraded(null)
            }}
          >
            Reload page
          </button>
          {!exam && (
            <button className="btn btn-primary btn-sm" onClick={check} disabled={!text.trim() || !ready}>
              ✓ Check
            </button>
          )}
        </div>
      </div>
      <div className="locator-input">
        <input
          className="input mono"
          spellCheck="false"
          placeholder={strategy === 'xpath' ? "//button[text()='Login']" : '#login-button'}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setGraded(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && !exam && check()}
          aria-label="Your locator"
        />
        <div className="locator-live small">
          {live.error ? (
            <span className="err-text">{live.error}</span>
          ) : text.trim() ? (
            <span>
              Matches <strong>{live.nodes.length}</strong> element{live.nodes.length === 1 ? '' : 's'}
              {live.nodes[0] && (
                <span className="muted mono">
                  {' '}
                  · first: &lt;{live.nodes[0].tagName.toLowerCase()}
                  {live.nodes[0].id ? `#${live.nodes[0].id}` : ''}&gt; {(live.nodes[0].textContent || live.nodes[0].value || '').trim().slice(0, 40)}
                </span>
              )}
            </span>
          ) : (
            <span className="muted">Type a locator — matches are highlighted on the page below as you type.</span>
          )}
        </div>
        {text.trim() && !live.error && <code className="java-line mono small">{javaLine(strategy, text)}</code>}
        {warnings.map((w) => (
          <div key={w} className="warn-text small">
            ⚠ {w}
          </div>
        ))}
        {graded && (
          <div className={`result-banner ${graded.pass ? 'ok' : 'bad'}`}>
            {graded.pass
              ? `✓ Exactly the right element${graded.count > 1 ? 's' : ''} — marked solved.`
              : graded.error
                ? graded.error
                : graded.count === 0
                  ? 'Your locator matches nothing on the page.'
                  : `Not quite: ${graded.extra ? `${graded.extra} extra element${graded.extra > 1 ? 's' : ''} matched` : ''}${graded.extra && graded.missing ? ', ' : ''}${graded.missing ? `${graded.missing} expected element${graded.missing > 1 ? 's' : ''} missing` : ''}.`}
          </div>
        )}
      </div>
      <div className="locator-frame">
        <iframe ref={frame} title="Practice page" src={`practice-site/${p.page}`} onLoad={() => setReady(true)} />
      </div>
    </section>
  )
}
