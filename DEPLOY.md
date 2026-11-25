# Deploying QA Automation Lab

| Piece | Where | What it is |
|---|---|---|
| The site | GitHub Pages | Built by `npm run build`, published by `.github/workflows/deploy-pages.yml` on every push to `main` |
| Your progress | Firebase — the app's own project (its id is in `src/sync/config.js`) | Saved to your Google account after you sign in (`qaProgress`, `qaState`) |

No server is needed: all grading runs in the browser.

## 1. GitHub Pages (once)

Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**, then re-run the workflow
(Actions tab) or push any commit. The site is then at `https://<user>.github.io/qa-automation-lab/`.

## 2. Cloud sync (once)

The app has its own Firebase project; nothing is shared with any other app.

1. <https://console.firebase.google.com> → **Add project** (Google Analytics is not needed).
2. **Project settings → General → Your apps → Web (`</>`)** → register an app (no Hosting) and copy the
   `firebaseConfig` values into [`src/sync/config.js`](src/sync/config.js). They are not secrets.
3. **Authentication → Get started → Sign-in method → Google → Enable** (pick a support email) → **Save**.
4. **Authentication → Settings → Authorized domains → Add domain** → `<user>.github.io` (`localhost` is there already).
5. **Firestore Database → Create database** (production mode, any region) → **Rules** → replace everything with
   [`firestore.rules`](firestore.rules) → **Publish**.
6. Optional: **Project settings → General → Public-facing name** is the name Google shows when you sign in.

Until the rules are published, signing in works but Settings shows "The Firestore rules do not allow the QA app yet"
and progress stays in the browser. The rules are the same for every Google account, so one account syncing while
another does not is never a rules problem.

Moving to a new project: the same Google account gets a new user id there, so the app uploads this browser's progress
to the new project on the first sign-in. Progress that only exists in the old project is not copied — sign in once on
each device you used so its browser uploads what it has, or move a device's progress with **Settings → Export backup /
Import backup**.

Then: **Settings → Sign in with Google**. Progress already in the browser is uploaded on the first sign-in.

What syncs: problem status, code and quiz answers, problem timer history, mock interview history and the Practice
settings. The theme and a mock round in progress stay on each device.
