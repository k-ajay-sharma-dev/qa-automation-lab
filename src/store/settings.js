import { useSyncExternalStore } from 'react'
import { writeLocal } from './local.js'

// Study preferences, saved to the account with the rest of your progress.
const KEY = 'qa.settings'
export const DEFAULTS = {
  timer: true, // count down from each problem's estimated time
  solutionGate: true, // ask before showing a solution you haven't earned yet
  mockLength: 'short', // default length offered for a new mock round
}

const listeners = new Set()
let settings = read()

function read() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) ?? {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function reloadSettings() {
  settings = read()
  listeners.forEach((l) => l())
}

export function setSetting(key, value) {
  settings = { ...settings, [key]: value }
  writeLocal(KEY, JSON.stringify(settings))
  listeners.forEach((l) => l())
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useSettings = () => useSyncExternalStore(subscribe, () => settings)
