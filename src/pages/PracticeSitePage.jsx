import { useState } from 'react'

const PAGES = [
  ['index.html', 'Home', 'Start page with links to everything'],
  ['login.html', 'Login', 'Valid, invalid and locked-out users, error banner'],
  ['inventory.html', 'Inventory', 'Product cards, sorting dropdown, add to cart, cart badge'],
  ['cart.html', 'Cart', 'Cart lines, remove, continue to checkout'],
  ['checkout.html', 'Checkout', 'Form validation, overview totals, order confirmation'],
  ['form.html', 'Registration form', 'Text, radio, checkbox, select, date, file upload'],
  ['table.html', 'Web table', 'Sort, search filter, pagination, row Edit buttons'],
  ['waits.html', 'Waits', 'Delayed elements, spinners, late-enabled buttons, re-rendering'],
  ['alerts.html', 'Alerts', 'alert(), confirm(), prompt() and an HTML modal'],
  ['frames.html', 'Frames', 'An iframe and a nested iframe with a form'],
  ['windows.html', 'Windows', 'New tab and popup window handling'],
  ['dynamic.html', 'Dynamic elements', 'Changing ids, shadow DOM, hover menu, drag and drop'],
]

export default function PracticeSitePage() {
  const [page, setPage] = useState('index.html')
  const base = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}practice-site/`
  return (
    <div className="category-page">
      <section className="category-head">
        <div>
          <p className="eyebrow">// the application under test</p>
          <h1>ShopEasy practice site</h1>
          <p className="muted">
            A small web shop built for automation practice. Point your real Selenium scripts at it while this app runs locally —
            every exercise in the course uses these pages.
          </p>
        </div>
      </section>

      <div className="site-layout">
        <div className="site-list">
          {PAGES.map(([file, name, what]) => (
            <button key={file} className={`site-item${page === file ? ' active' : ''}`} onClick={() => setPage(file)}>
              <strong>{name}</strong>
              <span className="muted small">{what}</span>
            </button>
          ))}
          <div className="site-note small">
            <strong>Use it from Java</strong>
            <pre className="code-block">{`driver.get("${base}login.html");`}</pre>
            <span className="muted">Demo login: standard_user / secret_sauce</span>
          </div>
          <div className="site-note small">
            <strong>ShopEasy REST API (for RestAssured)</strong>
            <span className="muted">
              Runs on your machine: in the project folder run <code>npm run api</code>, then use base URI:
            </span>
            <pre className="code-block">{`RestAssured.baseURI = "http://localhost:5181";`}</pre>
            <span className="muted">
              Products, login/token, cart, orders, users, a slow endpoint and a JSON Schema — full list in the{' '}
              <a href="#/cheatsheets/restassured">RestAssured cheat sheet</a>.
            </span>
          </div>
        </div>
        <div className="site-preview">
          <div className="site-bar">
            <span className="mono small muted">{base + page}</span>
            <a className="btn btn-sm" href={`practice-site/${page}`} target="_blank" rel="noreferrer">
              Open in new tab ↗
            </a>
          </div>
          <iframe key={page} title="Practice site" src={`practice-site/${page}`} />
        </div>
      </div>
    </div>
  )
}
