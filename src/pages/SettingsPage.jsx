import { AccountCard, BackupCard } from '../components/AccountCard.jsx'
import FirebaseGuide from '../components/FirebaseGuide.jsx'
import { MODES } from '../data/mock.js'
import { resetProgress } from '../store/progress.js'
import { setSetting, useSettings } from '../store/settings.js'
import { useTheme } from '../theme.jsx'

function Toggle({ label, help, checked, onChange }) {
  return (
    <label className="setting-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <strong>{label}</strong>
        <span className="muted small">{help}</span>
      </span>
    </label>
  )
}

export default function SettingsPage() {
  const { theme, toggle } = useTheme()
  const s = useSettings()

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <AccountCard />
      <FirebaseGuide />

      <section className="settings-card">
        <h2>Practice</h2>
        <Toggle
          label="Problem timer"
          help="Counts down from each problem's estimated time while it is open. Pauses when you switch tabs; your times are kept for each problem."
          checked={s.timer}
          onChange={(v) => setSetting('timer', v)}
        />
        <Toggle
          label="Ask before showing a solution"
          help="The Solution tab asks you to try first until you have solved the problem."
          checked={s.solutionGate}
          onChange={(v) => setSetting('solutionGate', v)}
        />
        <label className="field setting-field">
          <span className="small">Default mock interview length</span>
          <select className="input" value={s.mockLength} onChange={(e) => setSetting('mockLength', e.target.value)}>
            {Object.entries(MODES.mock.lengths).map(([k, l]) => (
              <option key={k} value={k}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="settings-card">
        <h2>Appearance</h2>
        <div className="settings-actions">
          <span className="muted small">Theme: {theme}</span>
          <button className="btn" onClick={toggle}>
            Switch to {theme === 'dark' ? 'light' : 'dark'}
          </button>
        </div>
      </section>

      <BackupCard />

      <section className="settings-card">
        <h2>Start over</h2>
        <p className="muted small">
          Clears every problem's status, code and times in this browser. When you are signed in, problems already saved to
          your account come back on the next sync — export a backup first if you might want them.
        </p>
        <div className="settings-actions">
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (confirm('Clear all problem progress in this browser? This cannot be undone.')) resetProgress()
            }}
          >
            Reset progress
          </button>
        </div>
      </section>
    </div>
  )
}
