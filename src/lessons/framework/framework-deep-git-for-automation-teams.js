export default {
  slug: 'framework-deep-git-for-automation-teams',
  category: 'framework',
  order: 14,
  title: 'Deep dive: Git for senior automation engineers — internals, branching strategies, conflicts and recovery',
  minutes: 30,
  summary: 'Use Git like a senior — the object model, refs and the reflog, merge vs rebase vs squash vs cherry-pick, every kind of undo, conflicts in page objects, feature files, pom.xml and package-lock.json, bisect driven by an automated ShopEasy check, branching strategies and where test code lives, review gates, hooks, line endings and LFS, and what to do when a secret was pushed.',
  manualAnalogy: `A good manual tester can always answer three questions: which build was tested, what changed since the last good one, and how to get back to a known state. Git answers exactly those for code. Bisecting a regression is what you already do by hand when you install older builds one by one to find where a bug came in — only with a script and a binary search.`,
  body: `## Where the earlier lessons stop

Git has no beginner lesson in this section; the beginner lessons only touch it (\`framework-maven-and-project-structure\` on the repository layout, \`framework-config-and-environments\` on keeping secrets out of it). This lesson assumes you commit and open pull requests every day, and answers what senior interviews probe: what Git stores, how to choose between integration methods, how to recover anything, and how a test team organises its repository.

Related deep dives, not repeated here: the Selenium-layer code review checklist in \`selenium-deep-framework-design\`, dependency conflict diagnosis in \`framework-deep-maven-build-internals\`, and pipelines that run on your branches in \`framework-deep-jenkins-ci-cd-pipelines\` (the next lesson).

The outputs below came from Git 2.51; commands are written for Git 2.38 or newer. Examples use the ShopEasy repository: the app in the root (\`npm run dev\` on port 5180, \`npm run api\` on 5181), with a typical \`tests-java/\` and \`tests-pw/\` next to it.

## 1. What Git really stores

### Why a tester should care

Almost every "Git emergency" — a lost commit, a wrong reset, a detached HEAD, a force-push that erased a colleague's work — becomes a two-minute job once you know that **commits are immutable and branches are just pointers**. You never edit history; you create new objects and move a pointer.

### The four objects

Git is a content-addressed store. Each object's name is the hash of its content (SHA-1 by default, SHA-256 as an option).

| Object | Holds | Analogy |
|---|---|---|
| **blob** | the bytes of one file version, no name, no path | a page of text |
| **tree** | a directory: mode, type, hash and **name** of each entry | a folder listing |
| **commit** | one root tree, zero or more **parents**, author, committer, message | a labelled snapshot |
| **annotated tag** | a target object, tagger, message, optional signature | a signed label |

You can look at them:

\`\`\`text
$ git cat-file -p HEAD
tree d1e70ba1c0d70745ea88daafaed194df4a0c0e59
parent 4f57036e143310f98380ee440bcadfea965c36ac
author T <t@example.com> 1795601025 +0530
committer T <t@example.com> 1795601025 +0530

change 10

$ git cat-file -p 'HEAD^{tree}'
100644 blob f599e28b8ab0d8c9c57a486c89c4a5132dcbd3b2    n.txt
100644 blob 2dcdab314cdd3931afa79fa3eee446d668ef6e9f    tax.mjs
\`\`\`

Read the consequences out of that output:

- A commit is a **full snapshot**, not a diff. Git computes diffs when you ask. Unchanged files share the same blob, and packfiles delta-compress similar objects, so this is cheap — for text. Binary screenshots barely delta; that is why baselines hurt (section 9).
- The parent hash is part of the content, so changing **anything** (message, date, parent) gives a new hash, and every descendant gets a new hash too. "Rewriting history" always means "creating a parallel history".
- A merge commit has two parents, the root commit none. History is a directed acyclic graph.
- Author and committer differ after a rebase or cherry-pick. \`git log --format=fuller\` shows both; this explains "why is this two-week-old commit new in main today?".

### Refs, HEAD, index, reflog

\`\`\`text
working tree  --git add-->  index (staging area)  --git commit-->  commit objects
                                                                     ^
refs/heads/main            a file (or packed entry) holding a hash --+
refs/remotes/origin/main   what the server had at your LAST fetch
refs/tags/v1.4.0
HEAD                       normally "ref: refs/heads/main" (a pointer to a pointer)
.git/logs/HEAD             the reflog: every value HEAD ever had on this machine
\`\`\`

- A **branch** is one movable pointer. Creating one costs nothing; deleting one deletes no commits.
- **HEAD** points at the current branch; commit moves *that branch*. When HEAD holds a hash directly, it is *detached*.
- The **index** is a real file, a flat list of path → blob. During a conflict it holds up to three versions of a path (stage 1 = base, 2 = ours, 3 = theirs), visible with \`git ls-files -u\`.
- The **reflog** is local and per ref. By default entries expire after 90 days (30 for unreachable ones), after which \`git gc\` may prune the objects. That is your recovery window. Uncommitted, never-staged edits are **not** in it.

## 2. Integrating work: merge, rebase, squash, cherry-pick

### Fast-forward vs three-way merge

If \`main\` has not moved since your branch started, merging needs no new content: Git slides \`main\` forward (**fast-forward**). If both moved, Git finds the **merge base** (best common ancestor) and runs a **three-way merge**: for each hunk, if only one side differs from the base take that side; if both differ in different ways, conflict. The base is what makes it safe — a two-way diff could not tell "they added the line" from "you removed it".

\`\`\`text
before                  merge (3-way)             rebase + fast-forward      squash merge
A--B--C  main           A--B--C-----M  main       A--B--C--D'--E'  main      A--B--C--S  main
    \\                       \\      /                                         (S = D+E, one parent;
     D--E  feat              D----E               (D,E copied as D',E')       D,E stay only on feat)
\`\`\`

\`\`\`bash
git merge --ff-only origin/main     # move forward or refuse: safe for updating local main
git merge --no-ff feature           # always create a merge commit
git merge-base main feature         # the common ancestor used for the 3-way merge
git log --oneline --graph --all -15 # see the shape before you decide
\`\`\`

### The four methods compared

| | Merge commit | Rebase (then fast-forward) | Squash merge | Cherry-pick |
|---|---|---|---|---|
| How it works | new commit with two parents | replays each commit on a new base as **new** commits | one new commit holding the whole branch's change | copies the change of selected commits as new commits |
| Advantages | true history; safe for shared branches; revert a feature with \`revert -m 1\` | linear, easy to read and bisect | one commit per PR; trivial revert; hides "fix typo" commits | moves one fix to a release branch |
| Disadvantages | noisy graph; needs \`--first-parent\` to read | new hashes: dangerous on shared branches; the same conflict may repeat per commit | loses the individual steps; stacked branches conflict afterwards; Git does not see the branch as merged | duplicates the change; the branches still have to converge |
| Performance | one conflict round | one round per replayed commit | one round | one per commit |
| Maintainability | good with discipline | best if every commit is clean | good with small PRs | poor as a routine |
| Scalability | large teams, long-lived branches | small teams, disciplined commits | any size with small PRs | hotfixes only |
| When to use | merging release branches back | cleaning your **private** branch | default button for feature PRs | back-porting a fix |

**Recommended approach and why:** rebase **locally** while the branch is private, open a **small** PR, and **squash-merge** it. \`main\` stays linear, every commit on it passed CI, and \`git bisect\` and \`git revert\` work on whole changes. Use a real merge commit for long-lived branches (release back to main), where squashing would lose the shared ancestry and create the same conflicts every time.

The golden rule, stated precisely: **do not rewrite commits that other people have based work on.** Your own pushed feature branch that nobody else uses may be rebased, with \`--force-with-lease\`.

### Interactive rebase: preparing a reviewable PR

\`\`\`bash
git fetch origin
git rebase -i --autosquash origin/main
\`\`\`

\`\`\`text
pick   a1b2c3d Add CheckoutPage with total locators
pick   d4e5f6a Add tax assertions for the checkout overview
fixup  9f8e7d6 fixup! Add CheckoutPage with total locators
reword 1c2d3e4 wip
drop   5b6a7c8 temporary Thread.sleep for debugging
\`\`\`

- \`pick\` keep, \`reword\` change the message, \`edit\` stop here to amend or split, \`squash\` combine and edit the message, \`fixup\` combine and discard the message, \`drop\` remove, \`exec <cmd>\` run a command at that point.
- \`git commit --fixup=a1b2c3d\` during review creates the \`fixup!\` commit; \`--autosquash\` places it automatically. Reviewers see what changed, and the final history stays clean.
- \`git rebase -x "mvn -q -B -f tests-java/pom.xml test-compile" origin/main\` runs the build after **each** commit. If commit 3 of 5 does not compile, the rebase stops there. That protects bisect.
- \`git rebase --update-refs\` moves the branches stacked below in one go — useful for a chain "wait helpers" → "checkout tests" of small PRs.
- \`git rebase --abort\` restores the start state at any moment. After finishing, \`ORIG_HEAD\` and \`git reflog\` still know the old tip.

### Cherry-pick a test fix to a release branch

\`\`\`bash
git switch release/2.4
git cherry-pick -x 7c1d9e2        # -x appends "(cherry picked from commit 7c1d9e2...)" to the message
git push origin release/2.4
\`\`\`

Fix on \`main\` first, then cherry-pick to the release branch. The reverse order is how a fix gets lost in the next release. For a merge commit you must name the mainline parent: \`git cherry-pick -m 1 <merge>\`.

## 3. Undoing: reset, revert, restore, stash

### What each command moves

\`git reset\` moves the **current branch** and optionally overwrites the index and working tree. \`git restore\` changes **files** and no ref. \`git revert\` adds a **new** commit that undoes an old one. (\`git checkout\` did several of these jobs; \`switch\` and \`restore\` split it into two safer commands.)

| Command | Branch moves? | Index | Working tree | Use |
|---|---|---|---|---|
| \`git reset --soft HEAD~1\` | yes | kept | kept | redo the last commit; everything stays staged |
| \`git reset HEAD~1\` (mixed, default) | yes | reset | kept | unstage, re-split into several commits |
| \`git reset --hard origin/main\` | yes | reset | **overwritten** | throw away local work, on purpose |
| \`git restore LoginPage.java\` | no | — | from the index | discard an unstaged edit (**not recoverable**) |
| \`git restore --staged LoginPage.java\` | no | from HEAD | kept | unstage |
| \`git restore --source=HEAD~3 -- testng.xml\` | no | — | from that commit | bring back one old file |
| \`git revert <sha>\` | forward by one commit | — | updated | undo on a **shared** branch |
| \`git revert -m 1 <merge>\` | forward by one | — | updated | undo a merged feature |
| \`git commit --amend\` | replaces the tip | — | — | fix the last **unpushed** commit |

**Recommended:** on \`main\`, always \`revert\`: it is auditable and nobody's clone breaks. On a private branch \`reset\` is fine. One trap worth knowing: after reverting a *merge*, merging the same branch again brings **nothing** back, because Git considers those commits already merged. You must revert the revert (or rebase the branch into new commits).

### Stash, and why a WIP commit is often better

\`\`\`bash
git stash push -u -m "half-done cart badge test" -- tests-java/src/test   # -u includes untracked files
git stash list
git stash show -p stash@{0}
git stash pop                        # apply and drop; on conflict the stash is KEPT
git stash branch cart-badge stash@{0} # new branch at the commit where the stash was made
\`\`\`

A stash is a commit object too, but it is local, unnamed in the graph and easily forgotten for weeks. For anything longer than a context switch: \`git commit -m "WIP"\` on your branch, later \`git reset --soft HEAD~1\`. A dropped stash is still an object: \`git fsck --unreachable --no-reflogs\` lists candidates until garbage collection.

### Detached HEAD

\`git switch --detach v2.3.0\` (or a CI checkout, or a bisect step) puts HEAD on a commit instead of a branch. Commits you make are real but referenced only by the reflog. Keep them with \`git switch -c keep-this\` **before** leaving; if you already left, \`git reflog\` shows the hash and \`git branch keep-this <sha>\` recovers it.

CI jobs usually run detached. Scripts using \`git rev-parse --abbrev-ref HEAD\` get the string \`HEAD\`; take the branch name from the CI variable instead (\`BRANCH_NAME\` in a Jenkins multibranch job, \`GITHUB_REF_NAME\` or \`GITHUB_HEAD_REF\` in Actions).

### Reflog recovery, step by step

You ran \`git reset --hard HEAD~3\` on the wrong branch:

\`\`\`text
$ git reflog -3
71be94e HEAD@{0}: reset: moving to HEAD~3
27b1dcb HEAD@{1}: checkout: moving from 71be94e... to main
71be94e HEAD@{2}: checkout: moving from b65a1bc... to 71be94e...

$ git reset --hard "HEAD@{1}"
HEAD is now at 27b1dcb change 10
\`\`\`

1. \`git reflog\` lists where HEAD was and **why** it moved. The entry *before* the mistake is the one you want.
2. Reset to it, or — safer — \`git branch rescue 27b1dcb\` first and inspect.
3. For one branch only: \`git reflog show feature/checkout\`. A deleted branch prints its last hash (\`Deleted branch feature (was 100fe5d).\`); \`git branch feature 100fe5d\` restores it.
4. Quote \`"HEAD@{1}"\` in PowerShell and some shells, where braces are special.

The reflog cannot recover uncommitted edits. If they were ever staged, the blob still exists: \`git fsck --lost-found\`. Otherwise the IDE's local history is the last hope. Hence the habit: **commit early, clean up later**.

## 4. Talking to the remote

| Command | What it really does |
|---|---|
| \`git fetch --prune\` | updates \`refs/remotes/origin/*\` only; your branches and files are untouched; removes refs deleted on the server |
| \`git pull\` | fetch + integrate into the current branch (merge, or rebase if configured) |
| \`git pull --rebase\` | fetch + replay your unpushed commits on top: no "Merge branch 'main' of …" noise |
| \`git pull --ff-only\` | fetch + move forward, or stop and make you decide |
| \`git push --force\` | overwrite the remote ref, whatever is there |
| \`git push --force-with-lease\` | overwrite **only if** the remote ref is still what your remote-tracking ref says |

Team defaults worth scripting into the onboarding:

\`\`\`bash
git config --global pull.ff only            # or pull.rebase true: choose one, as a team
git config --global rebase.autoStash true
git config --global fetch.prune true
git config --global merge.conflictStyle zdiff3
git config --global rerere.enabled true     # remember conflict resolutions
git config --global push.autoSetupRemote true
\`\`\`

**Why \`--force-with-lease\` is not a complete shield.** The lease compares with \`origin/feature\` *in your clone*. An IDE that fetches in the background updates that ref without you having seen the new commits, and the lease then passes. Add \`--force-if-includes\` (Git checks that the remote tip you would overwrite was integrated into your local branch at some point), or state the expected value: \`--force-with-lease=feature:<sha>\`. On shared branches, forbid force-pushes in branch protection; politeness is not a control.

**Tags.** A lightweight tag is a ref; an annotated one (\`git tag -a v2.4.0 -m "..."\`) is an object with an author and date. Tags are **not** pushed by default: \`git push origin v2.4.0\` or \`git push --follow-tags\`. For a test team: tag the test code that certified a release (\`cert/2.4.0\`), so six months later you can rerun exactly that suite. Never move a published tag — other clones keep the old one.

**Worktrees** give you a second checkout of the same repository, sharing the object store:

\`\`\`bash
git worktree add ../shopeasy-hotfix -b hotfix/tax origin/release/2.4
git worktree list
git worktree remove ../shopeasy-hotfix
\`\`\`

This beats stash + switch when a 40-minute regression is running in your main folder: the run keeps its files, you fix the hotfix next door. One branch can be checked out in only one worktree at a time. Each worktree has its own \`target/\` and needs its own \`npm ci\`.

## 5. Conflicts in test code

### See the base, or you are guessing

With \`merge.conflictStyle=zdiff3\` the marker block contains the **base**:

\`\`\`text
class LoginPage {
  By user = By.id("user-name");
<<<<<<< HEAD
  By btn = By.name("login");
||||||| 100fe5d
  By btn = By.id("login-button");
=======
  By btn = By.cssSelector("[data-testid='login-button']");
>>>>>>> a
}
\`\`\`

Both sides changed the same locator, for different reasons. Without the base you would guess which one is "newer". With it, you ask the right question: which matches the real page? ShopEasy's button has \`id="login-button"\` and \`data-testid="login-button"\` but no \`name\` attribute, so HEAD's version is simply wrong. **Resolve against the application, not against the authors.**

Useful commands during a conflict:

\`\`\`bash
git status                              # what is unmerged
git diff                                # combined diff of the conflict
git log --merge -p -- LoginPage.java    # the commits of both sides that touched this file
git show :1:LoginPage.java              # base (:2: ours, :3: theirs)
git checkout --conflict=zdiff3 -- LoginPage.java   # write the markers again
git restore --ours package-lock.json    # take one whole side
git add LoginPage.java && git merge --continue     # or: git rebase --continue
git merge --abort                       # back to before
git merge-tree --write-tree main feature # dry run: prints conflicts, exit code 1, touches no files
\`\`\`

**ours/theirs are swapped during rebase.** In a merge, *ours* is your branch. In a rebase Git checks out the *upstream* and replays your commits on it, so *ours* is upstream and *theirs* is **your** commit. Taking \`--ours\` by habit in a rebase deletes your own work.

### Recipes by file type

| File | Why it conflicts | How to resolve |
|---|---|---|
| **Page object** | two people add methods or locators at the end of the file | keep both; check for two locators for one element; run the tests of **both** PRs. Prevent: small component classes instead of one 900-line page |
| **Feature file** | both edit the same scenario outline or Background | keep both scenarios; a changed \`Background\` affects **every** scenario, so rerun the whole feature; do a Cucumber dry run afterwards — duplicate or undefined steps do not show as text conflicts |
| **Step definitions** | no text conflict, yet both branches added the same step text | \`DuplicateStepDefinitionException\` at run time: a *semantic* conflict; search and unify |
| **pom.xml** | adjacent dependency or plugin versions | keep both entries, take the **higher compatible** version deliberately, then \`mvn -B dependency:tree\` and a test run; pins usually have a reason (Surefire pinned to 3.5.4 for \`suiteXmlFiles\`) |
| **package-lock.json** | generated; every install changes hundreds of lines | never edit by hand: resolve \`package.json\`, then regenerate (below) |
| **testng.xml / config** | both append classes | group- or tag-based selection removes the file from most PRs |
| **Screenshots, visual baselines** | binary: no textual merge | take neither on trust: re-record from the merged code in the CI image and review the image |
| **Reports committed by accident** | should not be there | \`git rm -r --cached\`, then ignore |

\`\`\`bash
# package-lock.json: resolve package.json by hand first, then
git checkout --theirs -- package-lock.json     # any valid starting point
npm install --package-lock-only                # npm rewrites the lock from the resolved package.json
git add package.json package-lock.json
npm ci                                         # proves lock and package.json agree
\`\`\`

### Semantic conflicts and rerere

Git merges **text**. Branch A renames \`CartPage.total()\` to \`subtotal()\`; branch B adds a test calling \`total()\`. Clean merge, broken compile. A cleaner example of the same: A changes the API's tax rounding, B adds a test with the old expected value. The defence is not a better merge tool; it is **testing the merge result before it lands**: "require branches to be up to date", or a merge queue (GitHub merge queue, GitLab merge trains) that runs CI on \`main + your PR\`.

\`rerere\` ("reuse recorded resolution") stores how you resolved a hunk and replays it the next time. It pays off when you rebase a long branch repeatedly. Check replayed results with \`git diff\` — a wrong resolution is remembered as faithfully as a right one (\`git rerere forget <path>\`).

## 6. Bisect: let a test find the breaking commit

### How it works

\`git bisect\` is a binary search over the commit graph: give it one bad and one good commit, it checks out the middle, you answer good, bad or skip. 1,000 commits take about 10 steps. \`git bisect run <command>\` automates the answer through the **exit code**: \`0\` good, \`1\`–\`127\` bad — except \`125\`, "cannot test this commit, skip". Codes of 128 and above abort the bisect.

Two rules make it reliable:

1. The check must live **outside** the repository (or be copied in each step); older commits do not contain your new test.
2. "The build is broken" must not be reported as "the bug is here". Return **125**.

### Complete example: who broke the 8% tax?

Nightly says a ShopEasy order's tax is wrong; last week's release tag was fine. The script starts the API **of the commit being tested** on a spare port and places a real order.

\`\`\`js
// C:/bisect/tax-check.mjs: kept OUTSIDE the repository. Run by \`git bisect run\`.
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const GOOD = 0, BAD = 1, SKIP = 125
const PORT = 5999                                  // not 5181: do not talk to a dev server by accident
const BASE = \`http://localhost:\${PORT}\`

const api = spawn(process.execPath, ['scripts/api-server.mjs'], {
  env: { ...process.env, PORT: String(PORT) },     // api-server.mjs reads PORT
  stdio: 'ignore',
})
let exited = false
const closed = once(api, 'exit').then(() => { exited = true })

async function waitUntilReady() {
  for (let i = 0; i < 50 && !exited; i++) {
    try {
      if ((await fetch(\`\${BASE}/api/health\`)).ok) return true
    } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return false
}

async function post(path, body, token) {
  const res = await fetch(\`\${BASE}\${path}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: \`Bearer \${token}\` }) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(\`\${path} -> HTTP \${res.status}\`)
  return res.json()
}

async function verdict() {
  if (!(await waitUntilReady())) return SKIP        // server does not start on this commit
  try {
    const { token } = await post('/api/auth/login', { username: 'standard_user', password: 'secret_sauce' })
    const order = await post('/api/orders', {
      firstName: 'Bisect', lastName: 'Bot', postalCode: '560001',
      items: [{ productId: 1, quantity: 1 }],       // Trailblazer Backpack, 29.99
    }, token)
    console.log(\`subtotal=\${order.subtotal} tax=\${order.tax} total=\${order.total}\`)
    return order.tax === 2.4 ? GOOD : BAD           // 29.99 * 0.08 = 2.3992 -> 2.40
  } catch (e) {
    console.log(\`cannot judge: \${e.message}\`)       // e.g. the endpoint did not exist yet
    return SKIP
  }
}

const code = await verdict()
if (!exited) { api.kill(); await closed }           // free the port before the next step
process.exit(code)
\`\`\`

\`\`\`bash
git bisect start
git bisect bad origin/main
git bisect good v2.3.0
git bisect run node C:/bisect/tax-check.mjs
git bisect log > bisect-evidence.txt        # attach to the defect
git bisect reset                            # back to your branch: always
\`\`\`

On a ten-commit demo repository whose tax changed in commit 7 and whose commit 5 does not even parse, the run looks like this (shortened):

\`\`\`text
Bisecting: 4 revisions left to test after this (roughly 2 steps)   change 5  -> exit 125, skipped
Bisecting: 3 revisions left to test after this (roughly 2 steps)   change 6  -> tax 0.08  good
Bisecting: 1 revision left to test after this (roughly 1 step)     change 8  -> tax 0.18  bad
Bisecting: 0 revisions left to test after this (roughly 0 steps)   change 7  -> tax 0.18  bad
71be94ef3330e923d926a74776a64afe858891a7 is the first bad commit
    change 7
\`\`\`

**Step by step**

- \`spawn(process.execPath, …)\` runs the same Node that runs the script; the working directory is the repository root, which bisect has just checked out.
- The readiness loop stops early when the server process has exited; waiting 10 s on every unbuildable commit would waste the run.
- HTTP failures become SKIP, only a wrong **value** becomes BAD. That distinction is the whole quality of a bisect script.
- The process is killed and *awaited*: otherwise the next step could get an answer from the previous commit's server.

### The Maven version

\`\`\`bash
#!/usr/bin/env bash
# /opt/bisect/java-check.sh: TaxRegressionTest.java lives beside this script, not in the repository.
# The test itself starts scripts/api-server.mjs of this commit (ProcessBuilder, spare PORT) and stops it.
T=tests-java/src/test/java/com/shopeasy/bisect/TaxRegressionTest.java
mkdir -p "$(dirname "$T")" && cp /opt/bisect/TaxRegressionTest.java "$T"
trap 'rm -f "$T"' EXIT                                    # leave the tree clean for the next checkout

mvn -q -B -f tests-java/pom.xml test-compile || exit 125  # does not compile: skip, not bad
mvn -q -B -f tests-java/pom.xml test -Dtest=TaxRegressionTest || exit 1
\`\`\`

### When bisect is not enough

- **Flaky check:** one wrong "good" sends the search to the wrong half. Run the check N times and report BAD if any run fails.
- **Merge-heavy history:** \`git bisect start --first-parent\` walks only \`main\`'s own commits and answers "which PR", usually what you need.
- **Separate test repository:** bisect the **application** repository with the test repository pinned. If builds are slow but images are kept per commit (\`shopeasy-api:<sha>\`), let the script \`docker run\` the image of \`git rev-parse HEAD\`.
- **You know the text:** \`git log -S "TAX_RATE" --oneline -- scripts/api-server.mjs\` (commits that changed the number of occurrences) or \`-G '<regex>'\` is faster than bisect. \`git blame -w -C\` ignores whitespace and follows moved code.

## 7. Branching strategies, and where test code lives

| | GitFlow | GitHub Flow | Trunk-based |
|---|---|---|---|
| How it works | \`develop\`, \`release/*\`, \`hotfix/*\`, \`main\` | short feature branches → PR → \`main\`, deploy from \`main\` | everyone integrates to trunk at least daily; unfinished work behind feature flags |
| Advantages | clear for several supported versions | simple; matches PR tooling | smallest merges; fastest feedback; true CI |
| Disadvantages | long-lived branches, late integration, double merges | needs good CI on the PR | needs strong automated tests, flags and discipline |
| Test impact | suites per branch; which version of the tests fits \`release/2.4\`? | PR gate + post-merge regression | the gate must be fast (<10 min) and trusted; tests must handle flag on/off |
| When to use | packaged products, regulated releases | most web teams | mature teams with continuous delivery |

**Recommended:** GitHub Flow for a typical e-commerce team, moving towards trunk-based as the PR gate becomes fast. Release branches only when you must patch a released version — then branch the tests with the app.

| | Tests in the **same** repository | Tests in a **separate** repository | Shared framework repo + tests with each service |
|---|---|---|---|
| How it works | \`/tests-java\` beside the app | own repo, own pipeline, runs against deployed environments | \`framework-core\` published as a versioned artifact |
| Advantages | app and test change in **one PR**; test version always matches app version; developers run it | independent access and release; covers many apps | reuse without one huge repo |
| Disadvantages | larger repo; app pipeline carries browsers | a UI change breaks tests *after* merge; "which test version fits this build?" | version bumps across consumers |
| Scalability | good with path filters | good for cross-system E2E | good with many teams |
| When to use | product team owns its tests | E2E across several products, external QA team | several product teams |

**Recommended:** component, API and product E2E tests **with the product**; cross-product journeys in a separate repository that records the deployed version it ran against. When a team insists on a separate repo, add contract-like protection: stable \`data-testid\`s, and a smoke job from the test repo triggered on the app's PR.

## 8. Reviewing and gating test code

### PR checklist (Git and process part)

The code-level list is in \`selenium-deep-framework-design\`; the items below are about the change itself:

- **One purpose** and reviewable size (guideline: under ~400 changed lines without generated files). Refactoring and new tests in separate commits or PRs.
- The description states what behaviour is covered, how it was run (link to the CI run), and for a fix: **the test was seen failing** before the fix.
- New or changed tests were repeated (\`--repeat-each=10\`, or TestNG \`invocationCount\` locally) to show they are stable; a parallel-safety change shows several green runs.
- No disabled test, \`.only\`, commented assertion or raised timeout without a linked ticket.
- Lock files and baselines changed only for a stated reason. Dependency bumps in their own PR.
- No secrets, real personal data, downloaded binaries or reports in the diff.
- Expected values come from a requirement, not from the current output.

### CODEOWNERS

\`\`\`text
# .github/CODEOWNERS: the LAST matching pattern wins
*                                 @shopeasy/dev
/tests-java/                      @shopeasy/qa-automation
/tests-pw/                        @shopeasy/qa-automation
/tests-java/pom.xml               @shopeasy/qa-leads
/.github/                         @shopeasy/platform @shopeasy/qa-leads
\`\`\`

General rules first, specific ones last; several owners of a pattern go on the same line. Owners need write access. Negation (\`!\`) and character ranges do not work here, unlike \`.gitignore\`. It enforces anything only together with "Require review from Code Owners" in branch protection or a ruleset. Protecting \`/.github/\` matters: whoever edits the workflow can disable your gate.

### Commit messages

Conventional Commits (\`type(scope): subject\`) is a widely used convention and lets tools build changelogs:

\`\`\`text
test(checkout): assert 8% tax on the overview page

The overview showed tax for the subtotal before discount. Covers SHOP-1412.
The test fails on build 2.3.0 and passes with the fix.
\`\`\`

Subject in the imperative, about 50 characters, and a body explaining **why**. \`fix\`, \`feat\`, \`test\`, \`refactor\`, \`ci\`, \`build\`, \`chore\` cover a test repo. If PRs are squashed, the **PR title** becomes the commit: validate that instead of every WIP commit.

### Hooks

Client hooks live in \`.git/hooks\` (not versioned). To share them: husky (Node), the \`pre-commit\` framework (Python), or \`git config core.hooksPath .githooks\` (no dependency).

\`\`\`bash
npm install --save-dev husky lint-staged
npx husky init            # creates .husky/pre-commit and the "prepare" script in package.json
\`\`\`

\`\`\`bash
# .husky/pre-commit: keep it under a few seconds
npx lint-staged

# block focused tests and hard sleeps in STAGED lines only
if git diff --cached -U0 -- '*.ts' '*.java' | grep -E '^\\+.*(\\b(test|describe)\\.only\\(|Thread\\.sleep\\()'; then
  echo "Remove .only / Thread.sleep before committing"
  exit 1
fi
\`\`\`

\`\`\`bash
#!/usr/bin/env sh
# .githooks/pre-push for a Java-only repo, enabled with: git config core.hooksPath .githooks
mvn -q -B -f tests-java/pom.xml test-compile || { echo "does not compile: push stopped"; exit 1; }
\`\`\`

Any client hook can be skipped with \`--no-verify\`, so **a hook is a convenience and CI is the control**. Put formatting and secret scanning in both; put browser tests in neither hook — a four-minute pre-commit teaches everyone to type \`--no-verify\`.

## 9. Line endings, ignore rules, LFS

**\`.gitignore\`** affects only *untracked* files; \`git rm --cached\` is needed for what is already tracked. \`git check-ignore -v path\` shows the rule responsible. Decide what belongs there yourself in problem \`fw-033\`.

**\`.gitattributes\`** is versioned and beats each developer's \`core.autocrlf\`:

\`\`\`text
* text=auto
*.sh      text eol=lf
mvnw      text eol=lf
*.feature text eol=lf
*.bat     text eol=crlf
*.png     binary
package-lock.json -diff
\`\`\`

Why it matters for QA: a \`mvnw\` or \`entrypoint.sh\` checked out with CRLF on Windows fails in a Linux container with \`bad interpreter: /bin/sh^M\` (or the confusing \`no such file or directory\`). After adding the file, \`git add --renormalize .\` converts what is stored. \`package-lock.json -diff\` hides lock noise from local diffs; the file is still versioned. Case is another cross-platform trap: renaming \`loginPage.ts\` to \`LoginPage.ts\` on Windows or macOS may leave the old name in Git and break the import on Linux CI — use \`git mv\`.

**Git LFS for baselines.** LFS stores a small pointer file in Git and the bytes on an LFS server:

\`\`\`bash
git lfs install
git lfs track "tests-pw/**/*-snapshots/*.png"   # writes to .gitattributes: commit that file too
git lfs ls-files
git lfs migrate import --include="*.png" --everything   # converts history = rewrites every hash
\`\`\`

| | Plain Git | Git LFS | External service or artifact storage |
|---|---|---|---|
| Clone size | grows with every baseline version, forever | current versions only | none |
| Review | image diff in most PR UIs | image diff in most PR UIs | service UI with an approval workflow |
| Operations | none | LFS quota and bandwidth; CI must fetch LFS objects | cost, vendor |
| When | under ~100 small images | hundreds of baselines | visual testing at scale |

Failure signature: a test or image viewer receives a text file starting with \`version https://git-lfs.github.com/spec/v1\`. The CI checkout fetched pointers only (\`actions/checkout\` needs \`lfs: true\`; or run \`git lfs pull\`).

## 10. A secret was pushed: what now

Order matters more than tooling.

1. **Rotate or revoke the credential first.** Minutes count; scanners find public leaks very quickly. A rotated secret in history is harmless, an un-rotated one is dangerous even in a "cleaned" repository: clones, forks, PR refs, CI caches and logs still have it.
2. Tell security or the owner; check the access logs of the system for use.
3. Remove it from the current code: environment variable or secret store (problem \`fw-021\`), commit an \`.example\` file.
4. **Then decide** whether rewriting history is worth it. After rotation it is usually optional; for personal data or keys you cannot rotate it is needed:

\`\`\`bash
# fresh clone; git-filter-repo is a separate tool (2.47+ for --sensitive-data-removal)
git filter-repo --sensitive-data-removal --invert-paths --path tests-java/src/test/resources/config-qa.properties
git filter-repo --sensitive-data-removal --replace-text ../passwords.txt      # the alternative: replace strings
git push --force --mirror origin     # coordinate: branch protection, open PRs and every clone are affected
\`\`\`

GitHub's guide adds what people miss: pull-request refs are read-only, so you must contact support to remove cached views; forks keep the data; and colleagues must re-clone, or **rebase** (not merge) old branches — a merge brings the bad commits back.

5. **Prevent:** push protection / secret scanning on the server, a scanner such as gitleaks in pre-commit and CI, separate low-privilege test accounts, masked CI variables.

\`git revert\` or deleting the line in a new commit removes nothing from history. Saying "I deleted the file" in an interview answers the wrong question.

## 11. A ShopEasy day, end to end

A typical sequence for "tax line on the checkout overview":

\`\`\`bash
git fetch --prune
git switch -c test/checkout-tax origin/main
# ... page object + test ...
git add -p                                    # stage hunk by hunk: leave the debug print out
git commit -m "test(checkout): assert 8% tax on the overview page"
# review comment: use data-testid
git commit --fixup=HEAD -- tests-java/src/test/java/com/shopeasy/pages/CheckoutOverviewPage.java
git fetch && git rebase -i --autosquash origin/main
git range-diff origin/main ORIG_HEAD HEAD     # what changed between the two versions of my branch
git push --force-with-lease --force-if-includes
\`\`\`

\`git add -p\` is the cheapest quality tool in Git: you review your own diff once more, hunk by hunk. \`git range-diff\` shows reviewers, commit by commit, what a rebase changed.

## Common mistakes and debugging

| Symptom | Cause | Find it | Fix |
|---|---|---|---|
| \`rejected (non-fast-forward)\` | remote has commits you lack | \`git log HEAD..origin/feature\` | fetch + rebase (or merge), then push |
| \`refusing to merge unrelated histories\` | two root commits (repo re-created, history rewritten) | \`git merge-base A B\` is empty | re-clone or graft deliberately; do not just add the flag |
| \`You are in 'detached HEAD' state\` | checked out a commit or tag | \`git status\` | \`git switch -c name\` |
| "My commits vanished" | reset, rebase, deleted branch, amend | \`git reflog\`, \`git fsck --unreachable\` | \`git branch rescue <sha>\` |
| Merge brings nothing back after a revert of a merge | commits are already ancestors | \`git log --oneline --graph\` | revert the revert |
| Every file shows as modified on one machine | line endings or file mode | \`git diff --stat\`; \`git ls-files --eol\` | \`.gitattributes\`, \`--renormalize\`; \`core.fileMode=false\` |
| Same conflict at every rebase step | many commits touch one hunk | \`git log --oneline origin/main..\` | squash first, or merge instead; rerere |
| \`fatal: bad object\` / \`shallow update not allowed\`, wrong merge base in CI | shallow clone | \`git rev-parse --is-shallow-repository\` | \`fetch-depth: 0\` or \`git fetch --unshallow\` |
| Ignored file still tracked | added before the rule | \`git ls-files path\` | \`git rm --cached path\` |
| Duplicate commits with equal messages | old branch merged after rebase or force-push | \`git log --cherry-mark origin/main...HEAD\` | \`git pull --rebase\`; agree on who may rewrite |
| \`index.lock: File exists\` | another Git process crashed or the IDE is running one | check processes | close it, then remove the lock file |
| \`bad interpreter: ^M\` in CI | CRLF in a script | \`git ls-files --eol mvnw\` | \`eol=lf\` + renormalize |
| PR shows 200 unrelated commits | branch created from the wrong base | \`git merge-base\` | \`git rebase --onto origin/main wrong-base my-branch\` |

## Best practices for experienced engineers

- Small PRs, integrated daily; the branch age is a better risk metric than the line count.
- Every commit on \`main\` compiles and passed the gate — otherwise bisect, revert and release tagging all degrade.
- Rewrite private history freely; never rewrite shared history; enforce it with branch protection, not with a wiki page.
- Keep generated files out, lock files in; pin line endings with \`.gitattributes\` on day one.
- Make recovery boring: \`git reflog\`, \`git branch rescue\`, \`git revert\` practised by the whole team once.
- Record what was tested: the test commit **and** the application commit in every report.
- Treat workflow files, hooks and CODEOWNERS as production code with owners.

## Equivalent in the other stack

Git is stack-neutral; the conflict and repository habits differ slightly:

| | Selenium + Java | Playwright + TypeScript |
|---|---|---|
| Generated lock file | none by default (pin versions in the pom) | \`package-lock.json\`: regenerate, never hand-merge |
| Binary baselines | rare | \`*-snapshots/*.png\`, per platform: record in the CI image; LFS when many |
| Shared hooks | \`core.hooksPath\`, Maven plugins, Spotless or Checkstyle in CI | husky + lint-staged |
| Change-aware runs | path → group mapping in CI | \`npx playwright test --only-changed=origin/main\` (needs history, so not a shallow clone) |
| Focused-test guard | grep for \`enabled = false\` | \`forbidOnly: !!process.env.CI\` |

## Interview questions

### Q: Explain the difference between merge and rebase, and when you use each.

**Short answer (30–60 s):** Merge joins two histories with a commit that has two parents; nothing existing changes. Rebase copies my commits onto a new base, creating new commits with new hashes, which gives a linear history. I rebase my private branch to keep it current and clean, and never rewrite a branch others build on. At the PR I prefer squash merge, so main has one tested commit per change.

**Detailed answer:** A merge does one three-way merge against the merge base, so conflicts appear once. A rebase replays commit by commit, so the same conflict may appear several times, and *ours/theirs* are swapped. Long-lived branches (a release branch going back to main) deserve real merges because the shared ancestry prevents repeated conflicts; squashing them is a common mistake. After a rebase I push with \`--force-with-lease --force-if-includes\`.

### Q: What happens internally when you commit?

**Short answer (30–60 s):** \`git add\` has already written blobs and updated the index. Commit writes tree objects from the index, then a commit object with the root tree, the parent, author and message, and moves the branch HEAD points to. The reflog records the move.

**Detailed answer:** Objects are addressed by the hash of their content, so identical files are stored once and a commit cannot be modified without changing its hash and all its descendants'. A branch is a pointer, which is why branching is free and why "deleting a branch" loses nothing until garbage collection. It also explains \`--amend\`: it builds a *new* commit with the same parent.

### Q: reset, revert and restore — differences and risks?

**Short answer (30–60 s):** reset moves the branch pointer (soft keeps index and files, mixed resets the index, hard overwrites files too). revert creates a new commit that undoes an old one, so it is safe on shared branches. restore changes files in the working tree or index without moving any branch.

**Detailed answer:** On main I only revert, because a reset requires a force-push that breaks other clones. \`reset --hard\` destroys *uncommitted* work irrecoverably, while the commits it drops are in the reflog for weeks. Reverting a merge needs \`-m 1\`, and bringing the feature back later means reverting the revert.

### Q: A regression appeared somewhere in 300 commits. How do you find it?

**Short answer (30–60 s):** \`git bisect run\` with an automated check kept outside the repository, exiting 0 for good, 1 for bad, 125 when the commit cannot be tested. 300 commits take about nine steps. If I know the code involved, \`git log -S\` or \`-G\` may be faster.

**Detailed answer:** The difficult part is the script: build failures must return 125, the check must be deterministic (repeat it if not), and the environment must be rebuilt per commit. With merge commits I start with \`--first-parent\` to get the guilty PR. With a separate test repository I bisect the application repository and pin the tests. The \`git bisect log\` goes into the defect as evidence.

### Q: How do you handle conflicts in page objects and lock files?

**Short answer (30–60 s):** I look at the base version (zdiff3), understand both intentions and verify against the real page, then run the tests of both sides. Lock files are generated, so I resolve the manifest and regenerate the lock.

**Detailed answer:** Frequent conflicts are a design smell: a 900-line page object or a central testng.xml that everyone edits. Smaller components and tag-based selection remove the conflict at the source. And the worst conflicts are semantic — they merge cleanly and break at compile or run time — so CI must test the merge result (up-to-date branches or a merge queue).

### Q: Which branching strategy do you recommend for a test automation team, and where do tests live?

**Short answer (30–60 s):** Short-lived branches with PRs to main (GitHub Flow), moving to trunk-based as the gate gets fast. Product tests in the product's repository so a UI change and its test change are one PR; cross-product journeys in a separate repository.

**Detailed answer:** GitFlow is justified when several released versions are supported; then tests must be branched with the product. With a separate repository the key problem is version matching: I record the app build in the report, and trigger a smoke run from the app's PR so breakage is found before merge. Trunk-based needs feature flags, so tests need a strategy for flag states.

### Q: Someone pushed an API token. Walk me through it.

**Short answer (30–60 s):** Rotate first, then inform and check for misuse, remove it from the code, and only then decide about rewriting history. Finally prevent: push protection, scanning in CI, secrets from a store.

**Detailed answer:** Rewriting does not reach clones, forks, PR refs, CI logs and caches, so it can never replace rotation. If a rewrite is needed (personal data), use git-filter-repo in a fresh clone, coordinate the mirror force-push, contact the hosting provider for cached views, and have everyone re-clone.

## Scenario-based questions

### Scenario 1: "Someone force-pushed main and yesterday's merged tests are gone"

Do not push anything. Find the old tip: any colleague's \`git reflog show origin/main\` or the last CI run's commit hash, or the host's audit/activity log. Create \`rescue/main-<date>\` at that hash and compare with \`git log --oneline --left-right origin/main...rescue\`. Restore with a fast-forward push if possible, otherwise re-apply the missing commits through a PR. Then fix the cause: forbid force-pushes and deletions on \`main\`, for administrators too. In the communication I say what was lost, for how long, and what prevents it now — not who did it.

### Scenario 2: "The release branch fails 30 tests that are green on main"

First hypothesis: version mismatch, not product defects. Which test commit ran against which app commit? If \`main\`'s tests ran against \`release/2.4\`, new tests expect features that are not there. Run the tests **from the release branch**. If they fail too, check for fixes on main that were never cherry-picked: \`git log --cherry-pick --right-only --oneline release/2.4...main -- tests-java\`. Cherry-pick with \`-x\` what is needed and no more. Permanently: branch tests with the app and print both hashes in the report.

### Scenario 3: "Our test repository takes 12 minutes to clone in CI"

Measure before acting: \`git count-objects -vH\` and a list of the largest blobs (\`git rev-list --objects --all\` piped to \`git cat-file --batch-check\`). The usual answer: years of committed reports and baselines. Short term: shallow or blobless clone (\`--filter=blob:none\`) and reference caches on agents — noting that bisect, change detection and \`--only-changed\` need history. Long term: stop committing outputs, move baselines to LFS, and, if the team accepts one coordinated rewrite, remove the old blobs with git-filter-repo on an announced date.

## Tricky follow-ups

**Q: Is \`git pull --rebase\` dangerous?** A: It rewrites only your *unpushed* commits. It is dangerous only if you had pushed them and somebody used them, or if you had local merge commits (use \`--rebase=merges\`).

**Q: Does deleting a branch delete its commits?** A: No. They stay reachable through the reflog (and any other ref) until garbage collection prunes unreachable objects.

**Q: Why does \`git branch -d\` refuse after a squash merge?** A: Your commits are not ancestors of main; the squash commit is a different object. Check that the content landed, then \`-D\`.

**Q: Can two branches point at the same commit?** A: Yes, branches are pointers. Right after \`git switch -c\`, they always do.

**Q: \`HEAD~2\` vs \`HEAD^2\`?** A: \`~2\` is the first parent's first parent (two generations back); \`^2\` is the *second parent* of a merge commit.`,
  keyPoints: [
    'Commits are immutable snapshots; branches, HEAD and tags are pointers. Rewriting history means creating new commits, and the reflog keeps the old ones reachable for weeks.',
    'Rebase private branches, squash-merge small PRs, use real merges for long-lived branches, and revert (never reset) on shared branches.',
    'Use zdiff3 to see the merge base, resolve against the real application, and remember that ours and theirs are swapped during a rebase.',
    'Regenerate package-lock.json instead of merging it; resolve pom.xml deliberately and check with dependency:tree and a test run.',
    'git bisect run needs a check outside the repository: 0 good, 1 bad, 125 skip; a broken build is a skip, not a bad commit.',
    '--force-with-lease is weakened by background fetches: add --force-if-includes, and forbid force-pushes on shared branches.',
    'Client hooks can be skipped, so CI is the control; CODEOWNERS uses the last matching pattern and must also protect the workflows.',
    'A pushed secret is rotated first; rewriting history is a later, optional step and never replaces rotation.',
  ],
  mistakes: [
    'Bisecting with `mvn test` alone, so a commit that does not compile is reported as the culprit — compile first and `exit 125`, and keep the test outside the repository.',
    'Taking `--ours` by habit during a rebase and deleting your own change — in a rebase *ours* is upstream; check with `git show :2:file` and `:3:file` before choosing.',
    'Hand-editing conflict markers in package-lock.json — resolve package.json, run `npm install --package-lock-only`, then prove it with `npm ci`.',
    'Merging a branch again after reverting its merge commit and wondering why nothing comes back — revert the revert, or rebase into new commits.',
    'Deleting a leaked password in a new commit (or rewriting history) without rotating it — rotate, check access logs, then clean up and add push protection.',
    'Shallow CI clones with merge-base logic (`--only-changed`, three-dot diff) — wrong or failing results; use `fetch-depth: 0` for those jobs.',
  ],
  tryIt: `Make a copy of this repository (do not experiment in the original), create five commits in it and change \`TAX_RATE\` in \`scripts/api-server.mjs\` in the third one. Save the lesson's \`tax-check.mjs\` outside the repository and run \`git bisect start\`, \`git bisect bad\`, \`git bisect good <first>\`, \`git bisect run node <path>/tax-check.mjs\`. Then break the syntax of the file in the second commit and see the skip (125) at work. Finish with \`git bisect reset\`, do a \`git reset --hard HEAD~3\` and bring everything back with \`git reflog\`.`,
  problems: ['fw-021', 'fw-033', 'fw-038'],
}
