import { useSyncExternalStore } from 'react'
import { writeLocal } from './local.js'

// Lessons you have read: { [slug]: ISO date }. Synced to the account with the rest of your progress.
const KEY = 'qa.lessons'
const listeners = new Set()
let read = load()

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

export function reloadLessons() {
  read = load()
  listeners.forEach((l) => l())
}

export function setLessonRead(slug, done = true) {
  const next = { ...read }
  if (done) next[slug] = next[slug] ?? new Date().toISOString()
  else delete next[slug]
  read = next
  writeLocal(KEY, JSON.stringify(next))
  listeners.forEach((l) => l())
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useLessonsRead = () => useSyncExternalStore(subscribe, () => read)
