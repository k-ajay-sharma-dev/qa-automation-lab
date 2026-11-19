import { useState } from 'react'
import { updateProblem } from '../store/progress.js'
import Markdown from './Markdown.jsx'

export default function QuizWorkspace({ p, entry, onResult }) {
  const [answers, setAnswers] = useState(() => entry?.answers ?? {})
  const [submitted, setSubmitted] = useState(false)
  const total = p.questions.length
  const score = p.questions.filter((q, i) => answers[i] === q.answer).length
  const answered = Object.keys(answers).length

  function submit() {
    setSubmitted(true)
    updateProblem(p.id, { answers })
    onResult(score === total)
  }

  return (
    <section className="panel">
      <div className="editor-toolbar">
        <span className="mono muted small">
          Quiz · {answered}/{total} answered
        </span>
        <div className="toolbar-actions">
          {submitted && (
            <button
              className="btn btn-sm"
              onClick={() => {
                setAnswers({})
                setSubmitted(false)
              }}
            >
              Try again
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={answered < total || submitted}>
            Submit answers
          </button>
        </div>
      </div>
      <div className="panel-body">
        <div className="quiz">
          {submitted && (
            <div className={`result-banner ${score === total ? 'ok' : 'bad'}`}>
              {score === total ? `✓ ${score}/${total} — all correct, marked solved.` : `${score}/${total} correct. Read the explanations, then try again.`}
            </div>
          )}
          {p.questions.map((q, i) => {
            const chosen = answers[i]
            const right = chosen === q.answer
            return (
              <div key={i} className={`question${submitted ? (right ? ' correct' : ' wrong') : ''}`}>
                <div className="question-head">
                  <span className="question-num">Question {i + 1}</span>
                  {submitted && <span className="question-mark">{right ? '✓ Correct' : '✗ Not quite'}</span>}
                </div>
                <div className="question-prompt">
                  <Markdown>{q.q}</Markdown>
                </div>
                <div className="options">
                  {q.options.map((opt, k) => {
                    let cls = 'option'
                    if (chosen === k) cls += ' chosen'
                    if (submitted && k === q.answer) cls += ' is-answer'
                    else if (submitted && chosen === k) cls += ' is-wrong'
                    return (
                      <label key={k} className={cls}>
                        <input
                          type="radio"
                          name={`q${i}`}
                          checked={chosen === k}
                          disabled={submitted}
                          onChange={() => setAnswers({ ...answers, [i]: k })}
                        />
                        <span className="option-text">
                          <Markdown>{opt}</Markdown>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {submitted && (
                  <div className="question-explain">
                    <Markdown>{q.why}</Markdown>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
