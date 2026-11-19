import { CATEGORIES } from './categories.js'

const modules = import.meta.glob('../content/*/*.js', { eager: true })
const order = CATEGORIES.map((c) => c.slug)

export const problems = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.id.localeCompare(b.id))

export const problemById = new Map(problems.map((p) => [p.id, p]))

export const problemsFor = (category) => problems.filter((p) => p.category === category)

const sheets = import.meta.glob('../cheatsheets/*.js', { eager: true })
const SHEET_ORDER = ['java', 'locators', 'selenium', 'pom', 'cucumber', 'framework', 'restassured', 'playwright', 'exceptions', 'interview']
export const cheatsheets = Object.values(sheets)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => {
    const ia = SHEET_ORDER.indexOf(a.slug)
    const ib = SHEET_ORDER.indexOf(b.slug)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
