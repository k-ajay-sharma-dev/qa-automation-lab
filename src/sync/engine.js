// Cloud sync: keeps this browser's progress and your Google account in step through Firestore.
//
//   users/{uid}/qaProgress/{problemId}  { entry: JSON, updatedAt: ISO, syncedAt: server time }  — one per problem
//   users/{uid}/qaState/{storageKey}    { value: string|null, updatedAt: ms, syncedAt }       — the other keys
//
// The browser stays the working copy (fast, works offline). Each sync pulls only what changed since the last pull
// (by server time, so device clocks don't matter), merges it, then pushes what changed here.
// Conflicts: per problem the two copies are merged part by part (merge.js); other keys go to the newest write.
// Ported from the Mule Practice Lab sync engine.
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { collection, doc, getDocs, getFirestore, query, serverTimestamp, Timestamp, where, writeBatch } from 'firebase/firestore'
import { onLocalChange, readMeta, SYNCED_KEYS, writeMeta } from '../store/local.js'
import { reloadFromStorage } from '../store/progress.js'
import { reloadSettings } from '../store/settings.js'
import { COLLECTIONS, firebaseConfig } from './config.js'
import { mergeEntry, sameEntry } from './merge.js'
import { setStatus } from './status.js'

const PROGRESS_KEY = 'qa.progress'
const STATE_KEYS = SYNCED_KEYS.filter((k) => k !== PROGRESS_KEY)
// { uid, lastPull: {seconds, nanoseconds}, pushed: {problemId: updatedAt}, pushedKeys: {key: ms} }
const SYNC_STATE_KEY = 'qa.sync.state'
const BATCH_SIZE = 400 // Firestore allows 500 writes per batch

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return isObject(value) ? value : fallback
  } catch {
    return fallback
  }
}

const readSyncState = () => readJson(SYNC_STATE_KEY, {})
function writeSyncState(next) {
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(next))
  } catch {
    // storage blocked: the next sync starts from a full pull
  }
}

function reloadAll() {
  reloadFromStorage()
  reloadSettings()
}

let auth
let db
let user = null
let timer = null
let running = false
let again = false
let lastRun = 0
let failures = 0

export function start() {
  const app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)

  onAuthStateChanged(auth, async (u) => {
    user = u
    if (!u) return setStatus({ state: 'signed-out', user: null })
    setStatus({ user: { name: u.displayName, email: u.email, photo: u.photoURL } })

    const synced = readSyncState()
    if (synced.uid && synced.uid !== u.uid) {
      // this browser holds another account's progress: never mix two people's data
      const replace = confirm(
        `This browser has progress saved for a different Google account.\n\nReplace it with the progress of ${u.email}? (The other account's data stays safe in that account.)`,
      )
      if (!replace) return signOut(auth)
      for (const key of [...SYNCED_KEYS, 'qa.sync.meta']) localStorage.removeItem(key)
      writeSyncState({ uid: u.uid })
      reloadAll()
    } else if (!synced.uid) {
      // first sign-in here: whatever this browser already has is uploaded to the account
      writeSyncState({ ...synced, uid: u.uid })
    }
    schedule(0)
  })

  onLocalChange(() => schedule(3000))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRun > 30000) schedule(0)
  })
  window.addEventListener('online', () => schedule(0))
}

function schedule(delay) {
  clearTimeout(timer)
  timer = setTimeout(run, delay)
}

const friendly = (error) =>
  error?.code === 'permission-denied'
    ? 'The Firestore rules do not allow the QA app yet. Publish firestore.rules from this project in the Firebase console (see DEPLOY.md).'
    : (error?.message ?? String(error))

async function run() {
  if (!user) return
  if (running) {
    again = true
    return
  }
  running = true
  setStatus({ state: 'syncing', error: null })
  try {
    await syncOnce(user.uid)
    failures = 0
    setStatus({ state: 'synced', lastSync: Date.now(), error: null, retryAt: null })
  } catch (error) {
    // the work stays safe in this browser; try again by itself, waiting longer each time (30s, 1m, 2m, up to 5m)
    failures++
    const wait = Math.min(30000 * 2 ** (failures - 1), 300000)
    const retryAt = Date.now() + wait
    setStatus(navigator.onLine ? { state: 'error', error: friendly(error), retryAt } : { state: 'offline', retryAt })
    if (!again) timer = setTimeout(run, wait)
  } finally {
    running = false
    lastRun = Date.now()
    if (again) {
      again = false
      schedule(0)
    }
  }
}

async function syncOnce(uid) {
  const synced = readSyncState()
  const ref = (name) => collection(db, 'users', uid, COLLECTIONS[name])
  const since = synced.lastPull ? new Timestamp(synced.lastPull.seconds, synced.lastPull.nanoseconds) : null
  const pull = (name) => getDocs(since ? query(ref(name), where('syncedAt', '>', since)) : ref(name))
  const [remoteProgress, remoteState] = await Promise.all([pull('progress'), pull('state')])

  // ---- merge what came in (no awaits from here until the writes, so nothing local changes underneath)
  let newest = since
  const seen = (d) => {
    const t = d.get('syncedAt')
    if (t && (!newest || t.valueOf() > newest.valueOf())) newest = t
  }
  const pushed = { ...synced.pushed }
  const pushedKeys = { ...synced.pushedKeys }
  const progress = readJson(PROGRESS_KEY, {})
  let changed = false

  remoteProgress.forEach((d) => {
    seen(d)
    const { entry, updatedAt = '' } = d.data()
    let remote
    try {
      remote = JSON.parse(entry)
    } catch {
      return
    }
    const local = progress[d.id]
    const merged = isObject(local) ? mergeEntry(local, remote) : remote
    if ((pushed[d.id] ?? '') < updatedAt) pushed[d.id] = updatedAt
    // a merge that differs from the account's copy is pushed back, so both devices end up the same
    if (!sameEntry(merged, remote) && (merged.updatedAt ?? '') <= updatedAt) {
      merged.updatedAt = new Date(Math.max(Date.now(), Date.parse(updatedAt) + 1 || 0)).toISOString()
    }
    if (!isObject(local) || !sameEntry(merged, local)) {
      progress[d.id] = merged
      changed = true
    }
  })
  if (changed) localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))

  const meta = readMeta()
  // data saved before sync existed has no change time: treat it as the oldest version
  for (const key of STATE_KEYS) if (meta[key] == null && localStorage.getItem(key) != null) meta[key] = 1
  remoteState.forEach((d) => {
    seen(d)
    const key = d.id
    if (!STATE_KEYS.includes(key)) return
    const { value = null, updatedAt = 0 } = d.data()
    if (updatedAt > (meta[key] ?? 0)) {
      if (value == null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
      meta[key] = updatedAt
      pushedKeys[key] = updatedAt
      changed = true
    }
  })
  writeMeta(meta)
  if (changed) reloadAll()

  // ---- push what changed here
  const ops = []
  for (const [id, entry] of Object.entries(readJson(PROGRESS_KEY, {}))) {
    if (!isObject(entry) || typeof entry.updatedAt !== 'string' || entry.updatedAt <= (pushed[id] ?? '')) continue
    ops.push({
      ref: doc(ref('progress'), id),
      data: { entry: JSON.stringify(entry), updatedAt: entry.updatedAt, syncedAt: serverTimestamp() },
      done: () => (pushed[id] = entry.updatedAt),
    })
  }
  for (const key of STATE_KEYS) {
    const at = meta[key] ?? 0
    if (at <= (pushedKeys[key] ?? 0)) continue
    ops.push({
      ref: doc(ref('state'), key),
      data: { value: localStorage.getItem(key), updatedAt: at, syncedAt: serverTimestamp() },
      done: () => (pushedKeys[key] = at),
    })
  }
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const chunk = ops.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    chunk.forEach((op) => batch.set(op.ref, op.data))
    await batch.commit()
    chunk.forEach((op) => op.done())
    writeSyncState({ ...readSyncState(), uid, pushed, pushedKeys })
  }

  writeSyncState({
    ...readSyncState(),
    uid,
    pushed,
    pushedKeys,
    lastPull: newest ? { seconds: newest.seconds, nanoseconds: newest.nanoseconds } : synced.lastPull,
  })
}

const SIGN_IN_ERRORS = {
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain': `This address (${location.hostname}) isn't allowed to sign in yet. Add it in Firebase → Authentication → Settings → Authorized domains.`,
  'auth/network-request-failed': "Couldn't reach Google. Check your connection and try again.",
  'auth/operation-not-allowed': 'Google sign-in is not enabled. Turn it on in Firebase → Authentication → Sign-in method.',
}

export async function signIn() {
  setStatus({ error: null })
  try {
    await signInWithPopup(auth, new GoogleAuthProvider())
  } catch (error) {
    if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error?.code)) return
    setStatus({ error: SIGN_IN_ERRORS[error?.code] ?? error?.message ?? String(error) })
  }
}

// Progress stays in this browser after signing out; signing in again (same account) carries on syncing.
export async function signOutUser() {
  clearTimeout(timer)
  await signOut(auth)
}

export function syncNow() {
  schedule(0)
}
