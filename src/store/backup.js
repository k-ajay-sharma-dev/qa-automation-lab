import { mergeEntry } from '../sync/merge.js'
import { BACKUP_KEYS, writeLocal } from './local.js'
import { reloadFromStorage } from './progress.js'

// One JSON file with everything, to keep yourself or move to another browser.
export function exportBackup() {
  const data = {}
  for (const key of BACKUP_KEYS) {
    const v = localStorage.getItem(key)
    if (v != null) data[key] = v
  }
  const blob = new Blob([JSON.stringify({ app: 'qa-automation-lab', version: 1, at: new Date().toISOString(), data }, null, 2)], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `qa-lab-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Progress is merged per problem (nothing done here is lost); other keys take the backup's value.
export async function importBackup(file) {
  let parsed
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('That file is not a valid backup.')
  }
  // also accept the older Progress-page export, which was just the progress object
  const data = parsed?.data ?? (parsed && typeof parsed === 'object' ? { 'qa.progress': JSON.stringify(parsed) } : null)
  if (!data) throw new Error('That file is not a valid backup.')
  let count = 0
  for (const [key, value] of Object.entries(data)) {
    if (!BACKUP_KEYS.includes(key) || typeof value !== 'string') continue
    if (key === 'qa.progress') {
      const mine = JSON.parse(localStorage.getItem(key) || '{}')
      const theirs = JSON.parse(value)
      for (const [id, entry] of Object.entries(theirs)) {
        mine[id] = mine[id] ? mergeEntry(mine[id], entry) : entry
        count++
      }
      writeLocal(key, JSON.stringify(mine))
    } else writeLocal(key, value)
  }
  reloadFromStorage()
  return count
}
