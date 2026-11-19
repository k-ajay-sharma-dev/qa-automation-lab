export default {
  id: 'pw-032',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Visual regression with toHaveScreenshot: masks, thresholds and stable baselines',
  level: 'EXPERT',
  tags: ['visual-testing', 'toHaveScreenshot', 'snapshots', 'config', 'ci'],
  estMinutes: 40,
  scenario: `Release 4.0 migrated \`site.css\` to design tokens. All 1,200 functional tests stayed green — and production shipped with the
*Finish* button overlapping the order summary on the checkout overview. Functional assertions cannot see layout. The team wants a small
set of **visual regression tests**. A first attempt uses \`expect(await page.screenshot()).toMatchSnapshot()\`: it fails on every run because
the order number (\`SE-\` + 6 random digits) changes, and the baselines made on a Mac never match the Linux CI agents.`,
  description: `Write \`tests/visual/checkout.visual.spec.ts\` and the visual part of \`playwright.config.ts\` (shown together).

**Tests**
- **Order complete page** — add *Pulse Bike Light*, go through checkout (Jane / Doe / 10001) and *Finish*. Wait for the real state first
  (\`data-testid="complete-header"\` has \`Thank you for your order!\`), then \`await expect(page).toHaveScreenshot('order-complete.png', …)\`
  with \`fullPage: true\` and the order number (\`#order-number\`) **masked**.
- **One product card** — an **element** screenshot of the *Pulse Bike Light* card on \`inventory.html\`: \`expect(card).toHaveScreenshot('pulse-bike-light-card.png')\`.

**Config**
- \`expect.toHaveScreenshot\`: \`animations: 'disabled'\` and a small tolerance (\`maxDiffPixelRatio: 0.01\`).
- \`snapshotPathTemplate\` that keeps baselines in \`__screenshots__\` per project: \`'{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}'\`.
- A \`visual\` project that only runs \`*.visual.spec.ts\` in Desktop Chrome with a fixed \`viewport\` of 1280×720.

**Rules**: no \`waitForTimeout\`, no \`toMatchSnapshot\` on a manual screenshot.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('order complete looks right', async ({ page }) => {
  await page.goto('inventory.html');
  await page.getByTestId('add-to-cart-pulse-bike-light').click();
  await page.goto('checkout.html');
  await page.getByLabel('First Name').fill('Jane');
  await page.getByLabel('Last Name').fill('Doe');
  await page.getByLabel('Zip/Postal Code').fill('10001');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.waitForTimeout(3000); // let it settle

  expect(await page.screenshot({ fullPage: true })).toMatchSnapshot('checkout.png'); // fails every run: random order number
});
`,
  solution: `// tests/visual/checkout.visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual: checkout', () => {
  test('order complete page', async ({ page }) => {
    await page.goto('inventory.html');
    const card = page.getByTestId('inventory-item').filter({ hasText: 'Pulse Bike Light' });
    await card.getByRole('button', { name: 'Add to cart' }).click();
    await page.getByTestId('shopping-cart-link').click();
    await page.getByRole('button', { name: 'Checkout' }).click();
    await page.getByLabel('First Name').fill('Jane');
    await page.getByLabel('Last Name').fill('Doe');
    await page.getByLabel('Zip/Postal Code').fill('10001');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    // functional check first: the screenshot must be of the right state
    await expect(page.getByTestId('complete-header')).toHaveText('Thank you for your order!');

    await expect(page).toHaveScreenshot('order-complete.png', {
      fullPage: true,
      mask: [page.locator('#order-number')],
    });
  });

  test('product card', async ({ page }) => {
    await page.goto('inventory.html');
    const card = page.getByTestId('inventory-item').filter({ hasText: 'Pulse Bike Light' });

    await expect(card).toHaveScreenshot('pulse-bike-light-card.png');
  });
});

// playwright.config.ts (visual part)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    },
  },
  projects: [
    {
      name: 'visual',
      testMatch: /.*\\.visual\\.spec\\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
});
`,
  checks: [
    { label: 'Page screenshot compared with toHaveScreenshot', pattern: "expect\\(\\s*page\\s*\\)\\.toHaveScreenshot\\(\\s*['\"][\\w-]+\\.png['\"]", hint: "await expect(page).toHaveScreenshot('order-complete.png', { … })" },
    { label: 'Random order number masked', pattern: 'mask\\s*:\\s*\\[[^\\]]*order-number', hint: "mask: [page.locator('#order-number')]" },
    { label: 'Element-level screenshot', pattern: 'expect\\(\\s*(?!page\\s*\\))\\w+\\s*\\)\\.toHaveScreenshot\\(', hint: "await expect(card).toHaveScreenshot('pulse-bike-light-card.png');" },
    { label: 'Animations disabled and a tolerance set', pattern: "animations\\s*:\\s*['\"]disabled['\"][\\s\\S]*maxDiffPixel(Ratio|s)\\s*:|maxDiffPixel(Ratio|s)\\s*:[\\s\\S]*animations\\s*:\\s*['\"]disabled['\"]", hint: "expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 } }" },
    { label: 'Baselines per project via snapshotPathTemplate', pattern: "snapshotPathTemplate\\s*:\\s*['\"][^'\"]*\\{projectName\\}", hint: "snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}'" },
    { label: 'Fixed viewport for the visual project', pattern: 'viewport\\s*:\\s*\\{\\s*width\\s*:\\s*\\d+\\s*,\\s*height\\s*:\\s*\\d+', hint: 'use: { ...devices[\'Desktop Chrome\'], viewport: { width: 1280, height: 720 } }' },
    { label: 'No fixed waits or manual screenshot snapshots', pattern: '(waitForTimeout|toMatchSnapshot)', mustNot: true, hint: 'toHaveScreenshot waits for two identical consecutive screenshots before comparing.' },
  ],
  hints: [
    'toHaveScreenshot is a web-first assertion: it takes screenshots until two in a row are identical, then compares with the baseline.',
    'mask paints the given locators with a solid box in both the baseline and the new screenshot — dynamic content no longer causes diffs.',
    'Baselines depend on OS, browser and fonts: generate and compare them in the same environment (e.g. the official Playwright Docker image) — that is why {projectName} (and often {platform}) is in the path.',
  ],
  explanation: `\`expect(await page.screenshot()).toMatchSnapshot()\` compares **one** screenshot taken at an arbitrary moment. \`toHaveScreenshot\` is
built for UI: it disables animations (CSS animations finish, transitions jump to the end), waits for fonts, takes screenshots until the page
is **stable**, then compares pixel by pixel with the baseline and attaches *expected / actual / diff* images to the HTML report.

Making visual tests trustworthy is about removing noise:

- **Dynamic data** — mask it (\`mask: [locator]\`), or stub it (\`page.route\`, a fixed clock with \`page.clock\`). Here the random order number is masked.
- **Environment** — fonts and anti-aliasing differ between macOS, Windows and Linux. Pin the viewport, run in one browser, and create baselines
  where CI runs: \`docker run mcr.microsoft.com/playwright:<version> npx playwright test --update-snapshots\`. Never mix baselines from different machines.
- **Tolerance** — a small \`maxDiffPixelRatio\` absorbs anti-aliasing; a large one hides real bugs.
- **Scope** — element screenshots (\`expect(card).toHaveScreenshot()\`) are smaller and fail for one reason; keep full-page shots for a few key pages.

Workflow: the first run creates the baseline (and fails, by design); review it, commit it, and update it deliberately with
\`--update-snapshots\` when a design change is approved — the diff in the pull request is the visual review.`,
  mistakes: [
    'Not masking or stubbing dynamic content (dates, order numbers, ads) — the test fails on every run and gets ignored.',
    'Creating baselines on a laptop and comparing on Linux CI — font rendering differs and every image "changes".',
    'Running --update-snapshots to make a red build green without looking at the diff.',
    'Taking the screenshot before checking the page reached the right state — you baseline a loading spinner.',
  ],
  interview: [
    { q: 'How do you make visual tests stable?', a: 'Fixed viewport and browser, baselines generated in the same Docker image as CI, animations disabled, dynamic content masked or stubbed, a small pixel tolerance, and a functional assertion before the screenshot so the page is in the expected state.' },
    { q: 'toHaveScreenshot vs toMatchSnapshot?', a: 'toHaveScreenshot takes and compares screenshots of a page or locator with retries until the UI is stable, with screenshot-specific options (mask, animations, fullPage). toMatchSnapshot compares any value or buffer you pass once, with no waiting.' },
    { q: 'What would you cover with visual tests and what not?', a: 'Key pages and shared components where layout matters (checkout, product card, header) — not every page and state. Functional behaviour stays in functional assertions; visual tests catch CSS and layout regressions they cannot see.' },
  ],
}
