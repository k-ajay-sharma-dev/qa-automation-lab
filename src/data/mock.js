import { runChecks } from '../grading/checks.js'
import { categoryBySlug } from './categories.js'
import { problems } from './problems.js'

// Round shapes. A mock interview mixes written questions, coding, a locator and spoken follow-ups;
// a practice exam is multiple choice only.
export const MODES = {
  mock: {
    label: 'Mock interview',
    blurb: 'Mixed round like a real technical interview: multiple choice, live coding, a locator task and spoken follow-ups.',
    lengths: {
      short: { label: 'Short · 25 min', minutes: 25, mcq: 10, code: 1, locator: 1, spoken: 2 },
      standard: { label: 'Standard · 45 min', minutes: 45, mcq: 16, code: 2, locator: 2, spoken: 3 },
      long: { label: 'Long · 60 min', minutes: 60, mcq: 22, code: 3, locator: 2, spoken: 4 },
    },
  },
  exam: {
    label: 'Practice exam',
    blurb: 'Multiple choice only, against the clock. Good for a quick check of how much has stuck.',
    lengths: {
      short: { label: '20 questions · 20 min', minutes: 20, mcq: 20, code: 0, locator: 0, spoken: 0 },
      standard: { label: '40 questions · 40 min', minutes: 40, mcq: 40, code: 0, locator: 0, spoken: 0 },
      long: { label: '60 questions · 60 min', minutes: 60, mcq: 60, code: 0, locator: 0, spoken: 0 },
    },
  },
}

export const LEVEL_SETS = {
  all: { label: 'All levels', levels: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] },
  core: { label: 'Beginner + Intermediate', levels: ['BEGINNER', 'INTERMEDIATE'] },
  senior: { label: 'Intermediate and up', levels: ['INTERMEDIATE', 'ADVANCED', 'EXPERT'] },
}

const shuffle = (a) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

// Take n items, spreading them across sections so one big section doesn't dominate.
function spread(pool, n) {
  const bySection = new Map()
  for (const it of shuffle(pool)) {
    const k = it.problemId.split('-')[0]
    if (!bySection.has(k)) bySection.set(k, [])
    bySection.get(k).push(it)
  }
  const queues = shuffle([...bySection.values()])
  const out = []
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift())
  return out
}

export function buildRound({ mode, length, sections, levelSet }) {
  const shape = MODES[mode].lengths[length]
  const levels = LEVEL_SETS[levelSet].levels
  const pool = problems.filter((p) => sections.includes(p.category) && levels.includes(p.level))

  const mcqPool = pool.flatMap((p) => (p.kind === 'quiz' ? p.questions.map((q, qi) => ({ type: 'mcq', problemId: p.id, qi })) : []))
  const codePool = pool.filter((p) => (p.kind === 'code' || p.kind === 'gherkin') && p.estMinutes <= 25).map((p) => ({ type: 'code', problemId: p.id }))
  const locPool = pool.filter((p) => p.kind === 'locator').map((p) => ({ type: 'locator', problemId: p.id }))
  const spokenPool = pool.flatMap((p) => (p.interview ?? []).map((_, ii) => ({ type: 'spoken', problemId: p.id, ii })))

  const items = [
    ...spread(mcqPool, shape.mcq),
    ...spread(codePool, shape.code),
    ...spread(locPool, shape.locator),
    ...spread(spokenPool, shape.spoken),
  ]
  return {
    id: Date.now().toString(36),
    mode,
    length,
    sections,
    levelSet,
    minutes: shape.minutes,
    startedAt: Date.now(),
    endsAt: Date.now() + shape.minutes * 60_000,
    items,
    answers: {}, // index -> mcq: option index | code/locator: { code, strategy, pass } | spoken: 'yes'|'partly'|'no'
    flagged: {},
  }
}

export const problemOf = (item) => problems.find((p) => p.id === item.problemId)

// Score each item 0..1. Code gets partial credit for the share of reviewer checks it passes.
export function scoreItem(item, answer) {
  const p = problemOf(item)
  if (item.type === 'mcq') return answer === p.questions[item.qi].answer ? 1 : 0
  if (item.type === 'code') {
    if (!answer?.code) return 0
    const r = runChecks(p, answer.code)
    return r.filter((x) => x.pass).length / r.length
  }
  if (item.type === 'locator') return answer?.pass ? 1 : 0
  if (item.type === 'spoken') return { yes: 1, partly: 0.5 }[answer] ?? 0
  return 0
}

export function gradeRound(round) {
  const scored = round.items.map((it, i) => ({ ...it, score: scoreItem(it, round.answers[i]) }))
  const total = scored.reduce((s, x) => s + x.score, 0)
  const pct = scored.length ? Math.round((total / scored.length) * 100) : 0

  const group = (keyFn) => {
    const m = new Map()
    for (const s of scored)
      for (const k of [keyFn(s)].flat()) {
        const g = m.get(k) ?? { key: k, got: 0, n: 0 }
        g.got += s.score
        g.n++
        m.set(k, g)
      }
    return [...m.values()].map((g) => ({ ...g, pct: Math.round((g.got / g.n) * 100) }))
  }
  const bySection = group((s) => problemOf(s).category)
    .map((g) => ({ ...g, label: categoryBySlug.get(g.key)?.label ?? g.key }))
    .sort((a, b) => a.pct - b.pct)
  const byType = group((s) => s.type)
  const weakTags = group((s) => problemOf(s).tags)
    .filter((g) => g.n >= 2 && g.pct < 60)
    .sort((a, b) => a.pct - b.pct || b.n - a.n)
    .slice(0, 8)
  const missed = [...new Set(scored.filter((s) => s.score < 1).map((s) => s.problemId))]

  return { scored, total, pct, bySection, byType, weakTags, missed }
}

export const verdict = (pct) =>
  pct >= 85
    ? { label: 'Strong hire', tone: 'ok', note: 'You would pass most technical rounds at this level.' }
    : pct >= 70
      ? { label: 'Hire', tone: 'ok', note: 'Solid. Close the weak areas below and you are interview-ready.' }
      : pct >= 50
        ? { label: 'Borderline', tone: 'mid', note: 'The basics are there — practise the weak areas, then take another round.' }
        : { label: 'Not yet', tone: 'bad', note: 'Go back to the roadmap stages for the sections below before the next round.' }
