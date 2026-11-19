import { useState } from 'react'
// The rules come straight from the repository's firestore.rules, so this guide always shows the current file.
import RULES from '../../firestore.rules?raw'
import { firebaseConfig } from '../sync/config.js'
import { useSyncStatus } from '../sync/status.js'

function CopyBtn({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          // clipboard blocked: select the text in the box instead
          return
        }
        setDone(true)
        setTimeout(() => setDone(false), 1800)
      }}
    >
      {done ? '✓ Copied' : label}
    </button>
  )
}

// Step-by-step guide for turning on cloud sync, with the Firestore rules to paste.
export default function FirebaseGuide() {
  const sync = useSyncStatus()
  const project = firebaseConfig?.projectId ?? 'your-project'
  const rulesProblem = /rules/i.test(sync.error ?? '')
  const domain = location.hostname
  const consoleUrl = `https://console.firebase.google.com/project/${project}`

  return (
    <section className="settings-card">
      <h2>Cloud sync setup guide</h2>
      <p className="muted small">
        Sync uses the Firebase project <code>{project}</code> (shared with Mule Practice Lab; the QA app keeps its data in
        its own <code>qaProgress</code> and <code>qaState</code> collections). Google sign-in and the authorized domains
        are usually already set up from the DataWeave app — the step most often missing is <strong>step 4, the rules</strong>.
      </p>
      {rulesProblem && (
        <p className="err-text small">
          Your last sync was refused by the Firestore rules — do step 4 below, then press <em>Sync now</em>.
        </p>
      )}

      <details className="guide" open={rulesProblem}>
        <summary>Show the steps</summary>
        <ol className="guide-steps">
          <li>
            Open the{' '}
            <a href={consoleUrl} target="_blank" rel="noreferrer">
              Firebase console for {project} ↗
            </a>{' '}
            and sign in with the Google account that owns the project.
          </li>
          <li>
            <strong>Authentication → Sign-in method</strong>: make sure <strong>Google</strong> is <em>Enabled</em>. If not,
            click it, turn it on, pick your support email and <strong>Save</strong>.
          </li>
          <li>
            <strong>Authentication → Settings → Authorized domains</strong>: the list must contain the address you open
            this app from — right now that is <code>{domain}</code>. <code>localhost</code> is there by default; for the
            published site add <code>k-ajay-sharma-dev.github.io</code> (<strong>Add domain</strong>).
          </li>
          <li>
            <strong>Firestore Database → Rules</strong>: select everything in the editor, delete it, paste the rules below
            (button <em>Copy rules</em>) and click <strong>Publish</strong>. They contain the Mule Practice Lab rules too,
            so the DataWeave app keeps working.
          </li>
          <li>
            Come back here and press <strong>Sign in with Google</strong> (or <strong>Sync now</strong> if you are already
            signed in). The cloud icon in the top bar turns to a tick when your progress is saved.
          </li>
        </ol>

        <div className="guide-rules-head">
          <strong className="small">firestore.rules</strong>
          <CopyBtn text={RULES} label="Copy rules" />
        </div>
        <pre className="code-block guide-rules">{RULES}</pre>

        <p className="muted small">
          Keep this file identical in both repositories (<code>qa-automation-lab</code> and the DataWeave project). The
          console holds one set of rules per project, so publishing an older copy from either repository would cut the
          other app off.
        </p>
        <p className="muted small">
          <strong>Troubleshooting:</strong> “isn’t allowed to sign in yet” → step 3. “Google sign-in is not enabled” → step
          2. “rules do not allow the QA app” or “Missing or insufficient permissions” → step 4. A blocked pop-up → allow
          pop-ups for this site.
        </p>
      </details>
    </section>
  )
}
