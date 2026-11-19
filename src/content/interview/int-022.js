export default {
  id: 'int-022',
  category: 'interview',
  kind: 'quiz',
  title: 'Git for testers: branches, a merge conflict in a page object, and PR reviews',
  level: 'BEGINNER',
  tags: ['git', 'branching', 'merge-conflict', 'pull-request', 'code-review'],
  estMinutes: 15,
  scenario: `"How do you use Git in your daily work?" is asked in almost every automation interview, and often followed by a practical one: *"You and a colleague both changed LoginPage.java — what happens and how do you fix it?"* As a manual tester you may have used Git only to read code. In an automation team you branch, commit, review and resolve conflicts every week. This quiz walks through that daily flow on the ShopEasy framework.`,
  description: `Pick the best answer for each step of a normal working day in a team test repository.`,
  hints: [
    'Never work directly on main: pull the latest main, then create a feature branch.',
    'A conflict is Git asking a human to choose — read both versions, keep the right code, remove the markers, run the tests.',
  ],
  questions: [
    {
      q: 'You are starting a new test for the checkout total. What is the right first sequence?',
      options: [
        'Edit files directly on main and push',
        '`git checkout main` → `git pull` → `git checkout -b feature/checkout-total-test`, then commit small, meaningful changes on that branch',
        'Download the repository as a ZIP and email changes to the lead',
        '`git push --force` to make sure your version wins',
      ],
      answer: 1,
      why: 'Start from the **latest** main so you build on current code, then isolate your work on a **feature branch** that becomes a pull request. Small commits with clear messages ("Add checkout total test for two items") make review and rollback easy. Force-pushing to shared branches overwrites other people\'s work.',
    },
    {
      q: `After \`git pull origin main\` you see this in \`LoginPage.java\`:

\`\`\`java
<<<<<<< HEAD
    private final By loginButton = By.id("login-button");
=======
    private final By loginButton = By.cssSelector("[data-testid='login-button']");
>>>>>>> main
\`\`\`

What do you do?`,
      options: [
        'Delete the whole file and re-create it from memory',
        'Always keep HEAD because it is your code',
        'Talk to whoever made the other change if the intent is unclear, keep the correct version (here the team agreed on data-testid locators), delete the <<<<<<< ======= >>>>>>> markers, compile and run the affected tests, then `git add` and commit the merge',
        'Commit the file with the markers — Java will ignore them',
      ],
      answer: 2,
      why: 'A conflict means two changes touched the same lines; Git cannot decide which is right. HEAD is your version, the part below ======= is the incoming one. Resolve it consciously, remove **all** markers (they are a compile error), **run the tests**, then stage and commit. Saying "I check with the other author" shows teamwork.',
    },
    {
      q: 'A teammate opens a pull request with a new ShopEasy cart test. Which review comments add the most value?',
      options: [
        '"Looks good" without opening the files',
        'Only formatting nits such as spaces and blank lines',
        'Is there any Thread.sleep? Are locators in page objects, not in the test? Does each assertion have a message and check a real value? Does the test create its own data and run independently? Would it actually fail if the feature broke? Any secrets committed?',
        '"Please rewrite it in another language"',
      ],
      answer: 2,
      why: 'Reviewing test code is testing the test. The highest-value checks are about **reliability** (waits, independence, data), **maintainability** (page objects, naming) and **correctness** (would it fail when the product breaks?). Mention that you sometimes break the feature locally to see the test go red.',
    },
    {
      q: 'Which files should normally be listed in the framework\'s `.gitignore`?',
      options: [
        '`pom.xml` and the feature files',
        '`target/`, generated reports and screenshots, IDE folders such as `.idea/`, local config with secrets (e.g. `config/local.properties`)',
        'All Java files',
        'Nothing — everything should be committed',
      ],
      answer: 1,
      why: 'Commit **source**: code, features, test data, pom.xml, shared config templates. Ignore **generated or personal** files: build output, reports, screenshots, IDE settings and anything with credentials. Reports belong in the CI job\'s artifacts, not in Git.',
    },
    {
      q: 'You accidentally committed and pushed `qa.properties` containing the real QA admin password. What is the right response?',
      options: [
        'Delete the line in a new commit — then it is gone',
        'Do nothing, the repository is private',
        'Tell the lead, have the password changed (rotated) immediately, remove it from the file, move the secret to CI credentials or environment variables, and add the local config to .gitignore — the old commit still contains the password in history',
        'Rename the file',
      ],
      answer: 2,
      why: 'Git keeps every version, so a follow-up commit does **not** remove the secret — anyone with access can read it in history. The secret must be treated as leaked and **rotated**. Then fix the cause: secrets come from Jenkins credentials or environment variables, never from committed files. Admitting and fixing it fast is what interviewers want to hear.',
    },
  ],
  explanation: `**Model answer — "How do you use Git in your daily work?"**
> "The framework lives in a Git repository with main protected. For each task I pull the latest main and create a feature branch, commit small changes with clear messages, and push the branch. I open a pull request; at least one teammate reviews it and the CI job runs the smoke tests on the branch before it can be merged. When I get a conflict — usually in a shared page object — I read both versions, check with the other author if needed, keep the right one, remove the markers and rerun the tests before committing. Reports, screenshots and credentials are git-ignored."

**Commands worth knowing**
| Command | Use |
|---|---|
| \`git status\` / \`git diff\` | what changed, before you commit |
| \`git checkout -b feature/x\` (or \`git switch -c\`) | new branch |
| \`git add\` + \`git commit -m\` | save a snapshot |
| \`git pull\` | fetch + merge the remote changes |
| \`git fetch\` | download remote changes without merging |
| \`git stash\` | park unfinished work to switch branches |
| \`git log --oneline\` | recent history |`,
  mistakes: [
    'Working directly on main or force-pushing a shared branch.',
    'Resolving a conflict by blindly taking "mine" and not running the tests afterwards.',
    'Committing target/, reports or screenshots, which bloats the repository.',
    'Thinking a new commit removes a leaked password from history.',
  ],
  interview: [
    { q: 'What branching strategy did your team use?', a: 'Feature branches off main: one branch per task, a pull request with at least one reviewer and a CI run of the smoke tests before merge, and main protected from direct pushes. Releases were tagged. Some teams use GitFlow with develop and release branches; the key point is that main always stays runnable.' },
    { q: 'What is the difference between git pull and git fetch?', a: 'fetch downloads the remote commits and updates the remote-tracking branches but does not touch your working branch; pull is fetch followed by a merge (or rebase) into your current branch. I fetch when I want to look before integrating.' },
    { q: 'How do you resolve a merge conflict?', a: 'Open the conflicting file, read both sides between the markers, decide the correct final code — talking to the other author if the intent is unclear — remove the markers, compile and run the affected tests, then git add the file and complete the merge with a commit.' },
  ],
}
