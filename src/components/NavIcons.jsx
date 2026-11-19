// Line icons for the sidebar (24×24, stroke = currentColor), one per destination.
const PATHS = {
  path: <path d="M4 19h4l3-7 3 4 2-3 4 6M4 5h16" />,
  dashboard: <path d="M4 20h16M7 16v-4M12 16V8M17 16v-7" />,
  review: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7L20 8" />
      <path d="M20 4v4h-4M12 8v4l3 2" />
    </>
  ),
  lessons: (
    <>
      <path d="M3 5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15a1.5 1.5 0 0 0-1.5-1.5H3z" />
      <path d="M21 5a2 2 0 0 0-2-2h-5a2 2 0 0 0-2 2v15a1.5 1.5 0 0 1 1.5-1.5H21z" />
    </>
  ),
  mock: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 10v3l2 2M10 3h4M12 3v3" />
    </>
  ),
  flashcards: (
    <>
      <rect x="3" y="7" width="14" height="12" rx="2" />
      <path d="M7 4h12a2 2 0 0 1 2 2v10" />
    </>
  ),
  java: (
    <>
      <path d="M6 10h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M17 11h1.5a2 2 0 0 1 0 4H17M9 3c-1 1.5 1 2 0 3.5M13 3c-1 1.5 1 2 0 3.5" />
    </>
  ),
  locators: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  selenium: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M7 6.5h.01M10 6.5h.01M8 14l2.5 2.5L16 12" />
    </>
  ),
  pom: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>
  ),
  cucumber: (
    <>
      <path d="M7 17c-3-3-3-8 1-11s9-2 10 2-1 8-5 10-4 1-6-1z" />
      <path d="M10 9h.01M14 9h.01M9 13h.01M13 13h.01M15 15h.01" />
    </>
  ),
  framework: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  debugging: (
    <>
      <path d="M8 8a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0z" />
      <path d="M12 9v8M4 10h4M16 10h4M4 16h4M16 16h4M9 4l1 2M15 4l-1 2" />
    </>
  ),
  interview: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </>
  ),
  site: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  blueprint: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M8 13h8" />
    </>
  ),
  cheatsheets: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h7M9 16h7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
  collapse: <path d="M15 6l-6 6 6 6" />,
  expand: <path d="M9 6l6 6-6 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
}

export default function NavIcon({ name, size = 18 }) {
  return (
    <svg
      className="nav-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.path}
    </svg>
  )
}
