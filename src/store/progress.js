import { useSyncExternalStore } from 'react'
import { finishTimer } from '../study/timer.js'
import { writeLocal } from './local.js'

// Everything is kept in this browser's localStorage under one key, and synced to the account when signed in.
// Shape: { [problemId]: { status, statusAt, updatedAt, editedAt?, code?, answers?, solvedAt?, attempts, timer?, timeLog? } }
const KEY = 'qa.progress'
const listeners = new Set()
let state = read()

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

function write(next) {
  state = next
  writeLocal(KEY, JSON.stringify(next))
  listeners.forEach((l) => l())
}

// After a sync or a restore changed localStorage directly.
export function reloadFromStorage() {
  state = read()
  listeners.forEach((l) => l())
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useProgress = () => useSyncExternalStore(subscribe, () => state)

const EMPTY = {}
export const getEntry = (id) => state[id] ?? EMPTY
export const useEntry = (id) => useSyncExternalStore(subscribe, () => state[id] ?? EMPTY)

export const statusOf = (entry) => entry?.status ?? 'not-started'

const WORK_KEYS = ['code', 'answers', 'strategy']

export function updateProblem(id, patch) {
  const prev = state[id] ?? {}
  const now = new Date().toISOString()
  const entry = { ...prev, ...patch, updatedAt: now }
  // solved stays solved unless the learner marks it for revisit
  if (prev.status === 'solved' && patch.status === 'attempted') entry.status = 'solved'
  if (entry.status !== prev.status) entry.statusAt = now
  if (WORK_KEYS.some((k) => k in patch)) entry.editedAt = now
  if (patch.status === 'solved' && prev.status !== 'solved') {
    entry.solvedAt = now
    Object.assign(entry, finishTimer(prev, now))
  }
  write({ ...state, [id]: entry })
}

export function setTimer(id, timer) {
  const prev = state[id] ?? {}
  write({ ...state, [id]: { ...prev, timer, updatedAt: new Date().toISOString() } })
}

export function resetProgress() {
  write({})
}
