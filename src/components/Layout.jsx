import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { CATEGORIES } from '../data/categories.js'
import { problems } from '../data/problems.js'
import { statusOf, useProgress } from '../store/progress.js'
import { useSyncStatus } from '../sync/status.js'
import { useTheme } from '../theme.jsx'
import NavIcon from './NavIcons.jsx'

const SIDEBAR_KEY = 'qa.sidebar'

export default function Layout({ children }) {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'collapsed'
    } catch {
      return false
    }
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => {
    setDrawerOpen(false)
    window.scrollTo({ top: 0 })
  }, [pathname])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'full')
    } catch {
      // storage blocked
    }
  }

  return (
    <div className={`app${collapsed ? ' sidebar-collapsed' : ''}${drawerOpen ? ' drawer-open' : ''}`}>
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu" title="Open menu">
          <NavIcon name="menu" />
        </button>
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </span>
          <span className="brand-name">
            QA<span className="brand-accent">Automation</span>Lab
          </span>
        </Link>
        <HeaderSearch />
        <div className="topbar-actions">
          <Link to="/search" className="icon-btn search-icon-link" aria-label="Search" title="Search">
            <NavIcon name="search" />
          </Link>
          <SolvedChip />
          <SyncBadge />
          <button
            className="icon-btn"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link to="/settings" className="icon-btn settings-link" aria-label="Settings" title="Settings">
            <GearIcon />
          </Link>
        </div>
      </header>

      <div className="app-body">
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} onClose={() => setDrawerOpen(false)} />
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

function SolvedChip() {
  const progress = useProgress()
  const solved = problems.filter((p) => statusOf(progress[p.id]) === 'solved').length
  return (
    <Link to="/progress" className="solved-chip" title={`${solved} of ${problems.length} problems solved`}>
      <span className="points-star" aria-hidden="true">●</span>
      <span className="mono">
        {solved}/{problems.length}
      </span>
    </Link>
  )
}

function Sidebar({ collapsed, onToggle, onClose }) {
  const progress = useProgress()
  const counts = {}
  for (const p of problems) {
    const c = (counts[p.category] ??= { solved: 0, total: 0 })
    c.total++
    if (statusOf(progress[p.id]) === 'solved') c.solved++
  }
  const revisit = problems.filter((p) => statusOf(progress[p.id]) === 'revisit').length

  const item = (to, icon, label, extra, end) => (
    <NavLink key={to} to={to} end={end} className="side-link" title={collapsed ? label : undefined}>
      <NavIcon name={icon} />
      <span className="side-label">{label}</span>
      {extra}
    </NavLink>
  )

  return (
    <aside className="sidebar" aria-label="Sections">
      <div className="sidebar-head">
        <span className="side-title">Menu</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close navigation">
          <NavIcon name="close" />
        </button>
      </div>
      <nav className="sidebar-scroll">
        <div className="side-group">
          <div className="side-group-title">Study</div>
          {item('/', 'path', 'Learning Path', null, true)}
          {item('/lessons', 'lessons', 'Lessons')}
          {item('/progress', 'dashboard', 'Progress')}
          {item('/mock', 'mock', 'Mock Interview')}
          {item('/review', 'review', 'Revisit', revisit > 0 && <span className="side-badge">{revisit}</span>)}
          {item('/flashcards', 'flashcards', 'Flashcards')}
        </div>
        <div className="side-group">
          <div className="side-group-title">Practice</div>
          {CATEGORIES.map((c) =>
            item(
              `/${c.slug}`,
              c.slug,
              c.label,
              <span className="side-count mono" title={`${counts[c.slug]?.solved ?? 0} of ${counts[c.slug]?.total ?? 0} solved`}>
                {counts[c.slug]?.solved ?? 0}/{counts[c.slug]?.total ?? 0}
              </span>,
            ),
          )}
        </div>
        <div className="side-group">
          <div className="side-group-title">Tools</div>
          {item('/practice-site', 'site', 'Practice Site')}
          {item('/framework', 'blueprint', 'Framework Blueprint')}
          {item('/cheatsheets', 'cheatsheets', 'Cheat Sheets')}
          {item('/search', 'search', 'Search')}
          {item('/settings', 'settings', 'Settings')}
        </div>
      </nav>
      <button className="side-collapse" onClick={onToggle} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
        <NavIcon name={collapsed ? 'expand' : 'collapse'} />
        <span className="side-label">Collapse</span>
      </button>
    </aside>
  )
}

function HeaderSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const input = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.closest('.monaco-editor')) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const q = query.trim().toLowerCase()
  const hits = q ? problems.filter((p) => `${p.title} ${p.id} ${p.tags.join(' ')}`.toLowerCase().includes(q)).slice(0, 8) : []

  function go(to) {
    navigate(to)
    setQuery('')
    setOpen(false)
    input.current?.blur()
  }

  return (
    <form
      className="header-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        go(q ? `/search?q=${encodeURIComponent(query.trim())}` : '/search')
      }}
    >
      <NavIcon name="search" size={16} />
      <input
        ref={input}
        className="input"
        type="search"
        placeholder="Search problems, tags, IDs…"
        aria-label="Search all problems"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <kbd className="kbd">/</kbd>
      {open && q && (
        <ul className="header-search-list" role="listbox">
          {hits.length === 0 && <li className="muted small header-search-empty">No problems match yet</li>}
          {hits.map((p) => (
            <li key={p.id}>
              <a
                href={`#/${p.category}/${p.id}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  go(`/${p.category}/${p.id}`)
                }}
              >
                <span className="mono muted small">{p.id.toUpperCase()}</span>
                <span className="header-search-title">{p.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

// Cloud icon showing whether progress is saved to the Google account; opens Settings.
function SyncBadge() {
  const sync = useSyncStatus()
  if (sync.state === 'off') return null
  const title = {
    loading: 'Connecting to your account…',
    'signed-out': 'Not signed in — progress is only in this browser. Click to sign in.',
    syncing: 'Saving to your account…',
    synced: `Progress saved to your Google account${sync.user?.email ? ` (${sync.user.email})` : ''}`,
    offline: 'You are offline. Your work is saved in this browser and syncs when you are back online.',
    error: `Your work is saved in this browser. Sync will try again by itself. (${sync.error ?? 'unknown error'})`,
  }[sync.state]
  return (
    <Link to="/settings" className={`icon-btn sync-badge sync-${sync.state}`} aria-label={title} title={title}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19H8a6 6 0 1 1 5.7-7.9A4.5 4.5 0 1 1 17.5 19z" />
        {sync.state === 'signed-out' ? <path d="M3 3l18 18" /> : <path d="M9.5 14.5l2 2 3.5-4" />}
      </svg>
    </Link>
  )
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
