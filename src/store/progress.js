import { useSyncExternalStore } from 'react'

// Everything is kept in this browser's localStorage under one key.
// Shape: { [problemId]: { status, updatedAt, code?, answers?, solvedAt?, attempts } }
const KEY = 'qa.progress'
const listeners = new Set()
let state = read()

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

function write(next) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked: progress lasts for this visit
  }
  listeners.forEach((l) => l())
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useProgress = () => useSyncExternalStore(subscribe, () => state)

export const statusOf = (entry) => entry?.status ?? 'not-started'

export function updateProblem(id, patch) {
  const prev = state[id] ?? {}
  const entry = { ...prev, ...patch, updatedAt: new Date().toISOString() }
  // solved stays solved unless the learner marks it for revisit
  if (prev.status === 'solved' && patch.status === 'attempted') entry.status = 'solved'
  if (patch.status === 'solved' && prev.status !== 'solved') entry.solvedAt = entry.updatedAt
  write({ ...state, [id]: entry })
}

export function resetProgress() {
  write({})
}

export function exportProgress() {
  return JSON.stringify(state, null, 2)
}

export function importProgress(json) {
  write(JSON.parse(json))
}
