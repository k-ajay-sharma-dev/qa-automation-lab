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
// ---- lessons: src/lessons/<category>/<slug>.js (see LESSON_SCHEMA.md)
const lessonsDir = join(root, 'src', 'lessons')
const covered = new Map() // problemId -> lesson slugs
const slugs = new Set()
let lessonCount = 0
if (existsSync(lessonsDir)) {
  for (const cat of readdirSync(lessonsDir)) {
    if (only && cat !== only) continue
    const dir = join(lessonsDir, cat)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      lessonCount++
      let l
      try {
        l = (await import(pathToFileURL(join(dir, file)).href)).default
      } catch (e) {
        fail(`lesson ${file}`, `does not load: ${e.message}`)
        continue
      }
      const id = `lesson ${l?.slug ?? file}`
      if (`${l.slug}.js` !== file) fail(id, `slug does not match file name ${file}`)
      if (slugs.has(l.slug)) fail(id, 'duplicate slug')
      slugs.add(l.slug)
      if (l.category !== cat) fail(id, `category "${l.category}" is not the folder "${cat}"`)
      for (const f of ['title', 'summary', 'manualAnalogy', 'body']) if (!l[f]) fail(id, `missing ${f}`)
      if (!(l.order > 0)) fail(id, 'order must be a positive number')
      if (!(l.minutes > 0)) fail(id, 'minutes must be a positive number')
      if (!Array.isArray(l.keyPoints) || l.keyPoints.length < 2) fail(id, 'needs at least 2 keyPoints')
      if (!Array.isArray(l.mistakes) || !l.mistakes.length) fail(id, 'needs mistakes')
      if (!Array.isArray(l.problems) || !l.problems.length) fail(id, 'needs problems')
      for (const pid of l.problems ?? []) {
        if (!ids.has(pid)) fail(id, `unknown problem ${pid}`)
        covered.set(pid, [...(covered.get(pid) ?? []), l.slug])
      }
    }
  }
  // every problem in a category that has lessons must be covered by at least one
  const lessonCats = new Set(readdirSync(lessonsDir).filter((c) => !only || c === only))
  for (const pid of ids) {
    const cat = [...lessonCats].find((c) => readdirSync(join(contentDir, c)).includes(`${pid}.js`))
    if (cat && !covered.has(pid)) fail(pid, `no lesson lists this problem (category ${cat})`)
  }
}

console.log(`\n${count} problems and ${lessonCount} lessons checked, ${errors} error(s).`)
process.exit(errors ? 1 : 0)
