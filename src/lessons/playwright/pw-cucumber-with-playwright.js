export default {
  slug: 'pw-cucumber-with-playwright',
  category: 'playwright',
  order: 8,
  title: 'Cucumber with Playwright: features, World, hooks, steps and cucumber.js',
  minutes: 10,
  summary: 'Wire @cucumber/cucumber to Playwright in TypeScript: write declarative features, a CustomWorld holding browser/context/page, Before/After hooks with screenshots, typed step definitions, and cucumber.js profiles with tags.',
  manualAnalogy: `Your manual test cases already have a business-readable part (title, preconditions, steps, expected result) and an "how do I actually do it" part that lives in your head. Cucumber splits them the same way: the **feature file** is the readable test case the BA signs off; the **step definitions** and **page objects** are the "how", written once with Playwright.`,
  body: `## Two runners, one choice

Playwright has its own runner (\`@playwright/test\`). Cucumber has another (\`@cucumber/cucumber\`, command \`cucumber-js\`). When you use Cucumber you **use Playwright as a library** — you launch the browser yourself and you do not get Playwright fixtures, projects or its HTML report. In return the business gets Gherkin. Many teams run both: Cucumber for customer journeys, \`@playwright/test\` for everything else.

## Project layout

\`\`\`
features/            *.feature (Gherkin)
src/pages/           page objects (same classes as in the POM lesson)
src/support/world.ts CustomWorld: browser, context, page, page objects
src/support/hooks.ts Before / After (+ BeforeAll / AfterAll), timeouts
src/steps/*.steps.ts step definitions
cucumber.js          profiles: paths, require, format, tags, parallel
\`\`\`

Install: \`npm i -D @cucumber/cucumber @playwright/test ts-node typescript\` and \`npx playwright install chromium\`.

## Features: declarative, tagged, with data

\`\`\`gherkin
@checkout
Feature: Checkout
  Background:
    Given the shopper has "Storm Fleece Jacket" in the cart

  @regression
  Scenario: Missing postcode is rejected
    When the shopper continues checkout as "Jane" "Doe" without a postcode
    Then the checkout error "Postal Code is required" is shown
\`\`\`

Write **what** the shopper does, never **how** (no clicks, selectors or URLs) — then UI changes touch only page objects. Use \`Background\` for shared visible preconditions, \`Scenario Outline\` + \`Examples\` for the same behaviour with several data rows, a **data table** under a step for structured input, and \`Rule:\` to group scenarios by business rule. Tags (\`@smoke\`, \`@regression\`, \`@wip\`) on a Feature are inherited by its scenarios.

Turning manual test cases or an email of acceptance criteria into a feature:

- **One behaviour per scenario.** Cases that differ only in data become one outline; a different flow (cancel instead of confirm) is its own scenario.
- **One \`Rule:\` per business rule** in the criteria, so the reader can tick them off.
- **Pick examples on purpose**: one row per field or path that matters, plus the empty / no-result case.
- **Random values** (order numbers, dates) are stated as a rule — "starts with SE-" — and checked with a pattern in the step definition.
- **Verify the expected data** against the real system before handing the feature over; a wrong count in an Examples row is a test bug.

## The World: per-scenario state

\`\`\`ts
// src/support/world.ts
import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { CheckoutPage } from '../pages/CheckoutPage';

export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  checkoutPage!: CheckoutPage;
  constructor(options: IWorldOptions) { super(options); }
}
setWorldConstructor(CustomWorld);
\`\`\`

Cucumber creates a **new World for every scenario** and passes it as \`this\` to hooks and steps — the TypeScript equivalent of PicoContainer's \`TestContext\`. The \`!\` tells TypeScript the field is assigned later (in the Before hook).

## Hooks: launch, isolate, collect evidence, clean up

\`\`\`ts
// src/support/hooks.ts (shape)
import { Before, After, Status, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';

setDefaultTimeout(60_000);                      // Cucumber's default is 5 s per step

Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  this.context = await this.browser.newContext({ baseURL: process.env.BASE_URL });
  this.page = await this.context.newPage();
  this.checkoutPage = new CheckoutPage(this.page);
});

After(async function (this: CustomWorld, { result }) {
  if (result?.status === Status.FAILED) {
    // take a screenshot and this.attach(...) it — see the exercise
  }
  await this.browser.close();
});
\`\`\`

- Each scenario gets its own context, so cookies and \`sessionStorage\` never leak.
- Launching per scenario is simplest; for speed, launch once per worker in \`BeforeAll\` and create only a new context per scenario.
- \`this.attach(buffer, 'image/png')\` puts a screenshot into the HTML/JSON report of that scenario; \`context.tracing\` can save a Playwright trace for failures too.
- Wrap evidence collection in \`try/finally\` so the browser is **always** closed.
- Tagged hooks: \`Before({ tags: '@api' }, …)\` runs only for matching scenarios.

## Step definitions

\`\`\`ts
import { Given, When, Then, type DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../support/world';

Then('the checkout error {string} is shown', async function (this: CustomWorld, message: string) {
  await expect(this.checkoutPage.error).toContainText(message);
});
\`\`\`

- Use \`async function (this: CustomWorld, …)\`, **not** arrow functions — arrows have no \`this\`, so they cannot see the World.
- Cucumber expressions: \`{string}\` → \`string\`, \`{int}\`/\`{float}\` → \`number\`, \`{word}\`. A data table arrives as the last parameter: \`table.hashes()\` (header rows → objects), \`table.rowsHash()\` (two columns → key/value), \`table.raw()\`.
- Steps stay thin: call page objects, assert with Playwright's \`expect\` (web-first assertions work outside the Playwright runner). Share values between steps on \`this\`, never in module-level variables.
- \`npx cucumber-js --dry-run\` lists undefined or ambiguous steps without opening a browser, and prints snippets to paste.

## cucumber.js: profiles and tags

\`\`\`js
// cucumber.js
const common = {
  paths: ['features/**/*.feature'],
  requireModule: ['ts-node/register'],          // lets Cucumber load .ts files
  require: ['src/support/**/*.ts', 'src/steps/**/*.ts'],
  format: ['progress-bar', 'html:reports/cucumber-report.html'],
};
module.exports = {
  default: { ...common, tags: 'not @wip' },
  nightly: { ...common, tags: '@regression and not @wip', parallel: 3, retry: 1 },
};
\`\`\`

Run: \`npx cucumber-js\` (default profile), \`npx cucumber-js --profile nightly\`, or override tags on the command line: \`npx cucumber-js --tags "@checkout and @smoke"\`. Tag expressions support \`and\`, \`or\`, \`not\` and parentheses. In CI, upload the \`reports/\` folder as an artifact with \`if: always()\`.`,
  keyPoints: [
    'With Cucumber, Playwright is a library: you own the browser lifecycle in hooks.',
    'Features are declarative and tagged; Background, Scenario Outline, data tables and Rule keep them readable.',
    'CustomWorld (setWorldConstructor) holds browser/context/page/page objects per scenario.',
    'Hooks: Before creates context + page, After attaches a screenshot on failure and always closes; setDefaultTimeout above 5 s.',
    'Steps: async function (this: CustomWorld, …), typed parameters, Playwright expect, no locators.',
    'cucumber.js profiles hold paths, require (ts-node), formats, tags, parallel and retry.',
  ],
  mistakes: [
    'Arrow functions in steps or hooks — this is not the World.',
    'Module-level let page — shared between scenarios, breaks with --parallel.',
    'Leaving the default 5 s step timeout — browser launches and slow pages time out.',
    'Feature files full of clicks and selectors (often pasted from codegen) — unreadable and brittle.',
  ],
  tryIt: `Write (on paper or in an editor) the Gherkin for: "a shopper with Junior Onesie in the cart checks out and sees the order confirmation". Keep it to 3–4 declarative steps, then list which page-object methods the step definitions would call.`,
  problems: ['pw-015', 'pw-016', 'pw-017', 'pw-018', 'pw-019', 'pw-020', 'pw-024', 'pw-028'],
}
