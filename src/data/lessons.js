import { CATEGORIES } from './categories.js'

// Topic lessons (src/lessons/<category>/<slug>.js, see LESSON_SCHEMA.md), in course order:
// section by section as in the sidebar, then each section's own order.
const modules = import.meta.glob('../lessons/*/*.js', { eager: true })
const catOrder = CATEGORIES.map((c) => c.slug)

export const lessons = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => catOrder.indexOf(a.category) - catOrder.indexOf(b.category) || a.order - b.order)

export const lessonBySlug = new Map(lessons.map((l) => [l.slug, l]))

const byProblem = new Map()
for (const l of lessons) for (const id of l.problems ?? []) byProblem.set(id, [...(byProblem.get(id) ?? []), l])

export const lessonsForProblem = (id) => byProblem.get(id) ?? []
export const lessonsInCategory = (slug) => lessons.filter((l) => l.category === slug)
