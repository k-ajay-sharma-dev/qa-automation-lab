# Deploying QA Automation Lab

| Piece | Where | What it is |
|---|---|---|
| The site | GitHub Pages | Built by `npm run build`, published by `.github/workflows/deploy-pages.yml` on every push to `main` |
| Your progress | Firebase — the **same project as Mule Practice Lab** (`mule-practice-lab`) | Saved to your Google account after you sign in, in its own collections (`qaProgress`, `qaState`) |

No server is needed: all grading runs in the browser.

## 1. GitHub Pages (once)

Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**, then re-run the workflow
(Actions tab) or push any commit. The site is then at `https://<user>.github.io/qa-automation-lab/`.

## 2. Cloud sync (once)

The app reuses the Mule Practice Lab Firebase project, so Google sign-in and the `<user>.github.io` authorized domain
are already set up. Only the Firestore rules need the QA collections added:

1. <https://console.firebase.google.com> → project **mule-practice-lab** → **Firestore Database → Rules**.
2. Replace everything with the contents of [`firestore.rules`](firestore.rules) from this repository
   (it is the Mule Practice Lab rules plus a block for `qaProgress` / `qaState`) → **Publish**.

Keep the two repositories' `firestore.rules` identical: publishing an older copy from either one would cut the other
app off. Until the rules are published, signing in works but Settings shows "The Firestore rules do not allow the QA
app yet" and progress stays in the browser.

Then: **Settings → Sign in with Google**. Progress already in the browser is uploaded on the first sign-in.

What syncs: problem status, code and quiz answers, problem timer history, mock interview history and the Practice
settings. The theme and a mock round in progress stay on each device.
