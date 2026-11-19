// The round in progress (survives a page refresh) and the history of finished rounds.
const ACTIVE = 'qa.mock.active'
const HISTORY = 'qa.mock.history'

const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback
  } catch {
    return fallback
  }
}
const write = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    // storage blocked: the round lasts for this visit
  }
}

export const loadActive = () => read(ACTIVE, null)
export const saveActive = (round) => write(ACTIVE, round)
export const clearActive = () => write(ACTIVE, null)

export const loadHistory = () => read(HISTORY, [])
export function addHistory(entry) {
  write(HISTORY, [entry, ...loadHistory()].slice(0, 20))
}
