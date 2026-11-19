// Validates every problem under src/content: required fields, ids, and that each code/gherkin
// solution passes all its checks while the starter fails at least one.
// Usage: node scripts/check-content.mjs [category]
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runChecks } from '../src/grading/checks.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'src', 'content')
const only = process.argv[2]
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']
const KINDS = ['code', 'gherkin', 'locator', 'quiz']
let errors = 0
let count = 0
const ids = new Set()
const fail = (id, msg) => {
  errors++
  console.log(`✗ ${id}: ${msg}`)
}

for (const cat of readdirSync(contentDir)) {
  if (only && cat !== only) continue
  const dir = join(contentDir, cat)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    count++
    let p
    try {
      p = (await import(pathToFileURL(join(dir, file)).href)).default
    } catch (e) {
      fail(file, `does not load: ${e.message}`)
      continue
    }
    const id = p?.id ?? file
    if (`${p.id}.js` !== file) fail(id, `id does not match file name ${file}`)
    if (ids.has(p.id)) fail(id, 'duplicate id')
    ids.add(p.id)
    if (p.category !== cat) fail(id, `category "${p.category}" is not the folder "${cat}"`)
    if (!KINDS.includes(p.kind)) fail(id, `bad kind ${p.kind}`)
    if (!LEVELS.includes(p.level)) fail(id, `bad level ${p.level}`)
    for (const f of ['title', 'scenario', 'description', 'explanation']) if (!p[f]) fail(id, `missing ${f}`)
    if (!Array.isArray(p.tags)) fail(id, 'tags must be an array')
    if (!Array.isArray(p.hints) || !p.hints.length) fail(id, 'needs hints')
    if (!Array.isArray(p.interview) || !p.interview.every((x) => x.q && x.a)) fail(id, 'interview must be [{q,a}]')
    if (p.kind === 'code' || p.kind === 'gherkin') {
      if (!p.starterCode || !p.solution) fail(id, 'needs starterCode and solution')
      if (!Array.isArray(p.checks) || p.checks.length < 2) fail(id, 'needs at least 2 checks')
      else {
        try {
          const sol = runChecks(p, p.solution)
          sol.filter((r) => !r.pass).forEach((r) => fail(id, `solution fails check "${r.label}"`))
          const st = runChecks(p, p.starterCode)
          if (st.every((r) => r.pass)) fail(id, 'starter code already passes every check')
        } catch (e) {
          fail(id, `check error: ${e.message}`)
        }
      }
    }
    if (p.kind === 'locator') {
      for (const f of ['page', 'strategy', 'expected', 'solution']) if (!p[f]) fail(id, `missing ${f}`)
      if (p.page && !existsSync(join(root, 'public', 'practice-site', p.page))) fail(id, `practice page ${p.page} not found`)
    }
    if (p.kind === 'quiz') {
      if (!Array.isArray(p.questions) || !p.questions.length) fail(id, 'needs questions')
      else
        p.questions.forEach((q, i) => {
          if (!q.q || !Array.isArray(q.options) || q.options.length < 2) fail(id, `question ${i + 1} malformed`)
          if (!(q.answer >= 0 && q.answer < q.options.length)) fail(id, `question ${i + 1} answer out of range`)
          if (!q.why) fail(id, `question ${i + 1} missing why`)
        })
    }
  }
}
console.log(`\n${count} problems checked, ${errors} error(s).`)
process.exit(errors ? 1 : 0)
