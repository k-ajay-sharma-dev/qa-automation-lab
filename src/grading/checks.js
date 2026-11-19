// Rule-based grading for Java and Gherkin answers. Comments are removed first so a keyword
// written in a comment never counts.
export function stripComments(code, language) {
  if (language === 'gherkin') return code.replace(/^\s*#.*$/gm, '')
  // remove /* */ and // comments, but keep "//" inside string literals (e.g. URLs)
  let out = ''
  let i = 0
  let inStr = null
  while (i < code.length) {
    const c = code[i]
    const n = code[i + 1]
    if (inStr) {
      out += c
      if (c === '\\') {
        out += n ?? ''
        i += 2
        continue
      }
      if (c === inStr) inStr = null
      i++
      continue
    }
    if (c === '"' || c === "'") {
      inStr = c
      out += c
      i++
      continue
    }
    if (c === '/' && n === '*') {
      const end = code.indexOf('*/', i + 2)
      i = end === -1 ? code.length : end + 2
      continue
    }
    if (c === '/' && n === '/') {
      const end = code.indexOf('\n', i)
      i = end === -1 ? code.length : end
      continue
    }
    out += c
    i++
  }
  return out
}

export function runChecks(problem, code) {
  const clean = stripComments(code ?? '', problem.language)
  return problem.checks.map((c) => {
    const re = new RegExp(c.pattern, c.flags ?? 'm')
    const found = re.test(clean)
    return { label: c.label, hint: c.hint, pass: c.mustNot ? !found : found }
  })
}
