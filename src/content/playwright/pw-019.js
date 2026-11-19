export default {
  id: 'pw-019',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'CustomWorld and hooks: browser per scenario, screenshot and trace on failure',
  level: 'EXPERT',
  tags: ['cucumber-js', 'world', 'hooks', 'screenshots', 'trace'],
  estMinutes: 40,
  scenario: `The Cucumber + Playwright suite now runs nightly with \`--parallel 4\`. Two problems: (1) a failed scenario leaves nothing in the
HTML report but a stack trace — the team wants the **screenshot attached to the failing scenario** like the old Java \`Hooks\` class did;
(2) zombie Chromium processes pile up on the CI agent because nobody closes the browser when a step throws. You own \`src/support/world.ts\`
and \`src/support/hooks.ts\`.`,
  description: `Write both files (shown together in one editor).

**world.ts**
- \`export class CustomWorld extends World\` with \`browser\`, \`context\`, \`page\` (Playwright types) and the page objects \`loginPage\`,
  \`inventoryPage\`; constructor \`(options: IWorldOptions)\` calling \`super(options)\`; register it with \`setWorldConstructor\`.

**hooks.ts**
- \`setDefaultTimeout(60_000)\` (Cucumber's default 5 s per step is too short for browser work).
- \`Before\`: \`chromium.launch({ headless: … })\` from an env flag, \`browser.newContext({ baseURL })\`, start **tracing**, create the page and page objects.
- \`After\`: if the scenario **failed**, take a full-page screenshot and \`this.attach(png, 'image/png')\`, and save the trace to
  \`reports/traces/<scenario-name>.zip\`; otherwise stop tracing without saving. **Always** close context and browser — even if the screenshot fails (\`try/finally\`).
- Use \`function (this: CustomWorld, …)\` and \`Status.FAILED\`.`,
  starterCode: `// src/support/world.ts
import { World } from '@cucumber/cucumber';

export class CustomWorld extends World {
  page: any;
}

// src/support/hooks.ts
import { Before, After } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';

Before(async function () {
  const browser = await chromium.launch();
  this.page = await browser.newPage();
});

After(async function () {
  await this.page.close();
  // TODO: screenshot on failure, close the browser
});
`,
  solution: `// src/support/world.ts
import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { LoginPage, InventoryPage } from '../pages/pages';

export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  loginPage!: LoginPage;
  inventoryPage!: InventoryPage;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(CustomWorld);

// src/support/hooks.ts
import { After, Before, Status, setDefaultTimeout, type ITestCaseHookParameter } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { LoginPage, InventoryPage } from '../pages/pages';
import type { CustomWorld } from './world';

setDefaultTimeout(60_000);

Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  this.context = await this.browser.newContext({
    baseURL: process.env.BASE_URL ?? 'http://localhost:5180/practice-site/',
  });
  await this.context.tracing.start({ screenshots: true, snapshots: true });
  this.page = await this.context.newPage();
  this.loginPage = new LoginPage(this.page);
  this.inventoryPage = new InventoryPage(this.page);
});

After(async function (this: CustomWorld, { result, pickle }: ITestCaseHookParameter) {
  try {
    if (result?.status === Status.FAILED) {
      const png = await this.page.screenshot({ fullPage: true });
      this.attach(png, 'image/png');
      const safeName = pickle.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      await this.context.tracing.stop({ path: 'reports/traces/' + safeName + '.zip' });
    } else {
      await this.context.tracing.stop();
    }
  } finally {
    await this.context?.close();
    await this.browser?.close();
  }
});
`,
  checks: [
    { label: 'CustomWorld extends World with typed Playwright fields', pattern: 'class\\s+CustomWorld\\s+extends\\s+World[\\s\\S]*page!?\\s*:\\s*Page', hint: 'export class CustomWorld extends World { page!: Page; ... }' },
    { label: 'World registered with setWorldConstructor', pattern: 'setWorldConstructor\\(\\s*CustomWorld\\s*\\)', hint: 'setWorldConstructor(CustomWorld);' },
    { label: 'Browser launched with chromium.launch in Before', pattern: 'Before\\(\\s*async\\s+function\\s*\\(\\s*this\\s*:\\s*CustomWorld[\\s\\S]*chromium\\.launch\\(', hint: 'Before(async function (this: CustomWorld) { this.browser = await chromium.launch(...) })' },
    { label: 'Failure detected with Status.FAILED', pattern: 'status\\s*===\\s*Status\\.FAILED', hint: 'if (result?.status === Status.FAILED) { … }' },
    { label: 'Screenshot attached to the report', pattern: 'this\\.attach\\(\\s*\\w+\\s*,\\s*[\'"]image/png[\'"]', hint: "this.attach(png, 'image/png');" },
    { label: 'Cleanup in finally', pattern: 'finally\\s*\\{[\\s\\S]*browser\\??\\.close\\(', hint: 'try { … } finally { await this.context?.close(); await this.browser?.close(); }' },
    { label: 'Longer step timeout set', pattern: 'setDefaultTimeout\\(', hint: 'setDefaultTimeout(60_000);' },
  ],
  hints: [
    'The After hook receives { result, pickle }: result.status tells you PASSED/FAILED, pickle.name is the scenario name.',
    'this.attach(buffer, mediaType) embeds the image in the html/json Cucumber reports.',
    'If screenshot() throws (page already crashed), a finally block still closes the browser — no zombie processes.',
  ],
  explanation: `**World** holds everything a scenario needs; Cucumber creates one per scenario, so parallel workers (separate processes) and
consecutive scenarios never share a page. The \`!\` (definite assignment) tells TypeScript "this is set in the Before hook".

**Before** gives each scenario a fresh browser + context + page. Launching a browser per scenario is the simplest fully isolated design;
when the suite grows, move \`chromium.launch\` to a \`BeforeAll\` (one browser per worker) and keep only \`newContext\` per scenario — contexts
are already isolated and much cheaper.

**After** is where evidence is collected: the screenshot is attached via \`this.attach\` so it appears inside the failing scenario in the
HTML report; the **trace** (\`tracing.start\`/\`stop({ path })\`) can be opened with \`npx playwright show-trace\` and shows DOM snapshots,
network and console for every step. \`try/finally\` guarantees cleanup even if collecting evidence fails — the cause of zombie browsers.

Cucumber's default step timeout is 5 s; a browser launch alone can take longer on CI, hence \`setDefaultTimeout\`.`,
  mistakes: [
    'Using arrow functions in hooks — this is not the World, so this.page is undefined.',
    'Closing only the page — the browser process keeps running after every scenario.',
    'Attaching a screenshot for every scenario — reports become huge; attach on failure.',
    'Keeping the 5 s default step timeout — "function timed out, ensure the promise resolves within 5000 milliseconds" on slow CI agents.',
  ],
  interview: [
    { q: 'How do you attach a screenshot to a Cucumber report on failure in TypeScript?', a: "In an After hook check result.status === Status.FAILED, take await this.page.screenshot(), and call this.attach(buffer, 'image/png'). The html and json formatters embed it in that scenario." },
    { q: 'Browser per scenario or per worker?', a: 'Per scenario is simplest and fully isolated but slower. Per worker (BeforeAll) with a new context per scenario gives the same isolation of cookies/storage at a fraction of the cost and is the usual choice for big suites.' },
    { q: 'Why can a Cucumber + Playwright suite not use Playwright fixtures?', a: 'Fixtures belong to the @playwright/test runner; Cucumber has its own runner. You recreate the lifecycle with the World and hooks, and lose features like the Playwright HTML report and projects unless you rebuild them.' },
  ],
}
