import Editor from '@monaco-editor/react'
import { useTheme } from '../theme.jsx'

// Monaco has Java syntax built in; Gherkin has none, so feature files are shown as plain text with
// a small custom language that colours the keywords.
let gherkinReady = false
function setupGherkin(monaco) {
  if (gherkinReady) return
  gherkinReady = true
  monaco.languages.register({ id: 'gherkin' })
  monaco.languages.setMonarchTokensProvider('gherkin', {
    tokenizer: {
      root: [
        [/^\s*#.*$/, 'comment'],
        [/^\s*@\S+/, 'annotation'],
        [/^\s*(Feature|Background|Scenario Outline|Scenario Template|Scenario|Examples|Rule|Example):/, 'keyword'],
        [/^\s*(Given|When|Then|And|But|\*)\b/, 'keyword'],
        [/"[^"]*"/, 'string'],
        [/<[^>]+>/, 'variable'],
        [/\|/, 'delimiter'],
        [/\b\d+(\.\d+)?\b/, 'number'],
      ],
    },
  })
}

export default function CodeEditor({ value, onChange, language = 'java', readOnly = false, height = '100%' }) {
  const { theme } = useTheme()
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      beforeMount={setupGherkin}
      onChange={(v) => onChange?.(v ?? '')}
      loading={<div className="editor-loading muted small">Loading editor…</div>}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        scrollBeyondLastLine: false,
        tabSize: 4,
        automaticLayout: true,
        wordWrap: 'on',
        padding: { top: 10 },
      }}
    />
  )
}
