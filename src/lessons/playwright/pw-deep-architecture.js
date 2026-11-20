export default {
  slug: 'pw-deep-architecture',
  category: 'playwright',
  order: 13,
  title: 'Deep dive: Playwright architecture — Browser, BrowserContext and Page',
  minutes: 25,
  summary: 'Explain how Playwright talks to browsers, why that enables auto-waiting and events, and design isolation with Browser, BrowserContext and Page the way Playwright Test does — including multi-user tests, context options, remote browsers and CI images.',
  manualAnalogy: `When you test a two-sided flow by hand you open one normal window and one incognito window so the shopper and the second user never share a login, and you never reinstall the browser between test cases — you just open a fresh private window. That is exactly the Browser (installed once, expensive) versus BrowserContext (a cheap private window) split that Playwright builds its whole isolation model on.`,
  body: `## Why architecture is an interview topic

The *Playwright vs Selenium* lesson gave you the one-line version: one persistent connection, and a fresh context per test. Senior interviews go further: *why* can Playwright wait without polling, *what exactly* is isolated between two tests in the same worker, *when* would you create your own context, and *what breaks* when you attach to a browser you did not launch. All of those answers follow from three facts: the client/server split, the protocol to the browser, and the Browser → BrowserContext → Page object model.

## The layers: test process, Playwright server, browser

\`\`\`
 Node test process (worker)                       Browser process(es)
 ┌──────────────────────────────┐                 ┌───────────────────────────┐
 │ your spec + @playwright/test │                 │ Chromium / Firefox / WebKit│
 │      │ Playwright client API │   pipe or       │  BrowserContext A          │
 │      ▼ (Page, Locator, …)    │   WebSocket     │    Page 1, Page 2          │
 │ Playwright "server" (driver) ├────────────────►│  BrowserContext B          │
 │  protocol dispatchers,       │  CDP (Chromium) │    Page 3                  │
 │  injected-script, waiting    │  own protocols  │                            │
 └──────────────────────────────┘  (FF / WebKit)  └───────────────────────────┘
\`\`\`

- **Client** — the API you call (\`page\`, \`locator\`, \`expect\`). Every call becomes a message to the server.
- **Server / driver** — the part of \`playwright-core\` that knows how to talk to each browser. In Node.js it normally runs **inside the same process** as your test, connected through an in-process channel. The Java, Python and .NET bindings start a bundled Node.js driver as a child process and talk to it over stdio. That is why every language binding behaves the same: they share one server implementation.
- **Browser** — launched as a child process. The server talks to it over a pipe (or a WebSocket for remote browsers):
  - **Chromium** (and branded Chrome / Edge) via the **Chrome DevTools Protocol (CDP)**.
  - **Firefox** — Playwright ships a **patched Firefox build** with its own protocol (historically called *Juggler*).
  - **WebKit** — a **patched WebKit build** with Playwright's protocol on top of WebKit's inspector backend. It is not Safari: it is the same engine, built for Linux, Windows and macOS.

So "Playwright drives three browsers through one protocol" is not accurate. It drives them through **three protocols** and hides the differences behind one API. That is also why Playwright pins the browser versions it supports: each release is tested against specific builds (\`npx playwright install\` downloads exactly those).

### Why this design gives you auto-waiting and events

The connection is **bidirectional and stateful**. The browser *pushes* events (frame navigated, request started, dialog opened, new page, console message) to the server without being asked. The server also **injects a script** into pages that can evaluate selectors, check visibility, stability and hit targets *inside the page*, close to the DOM. Put together:

1. \`locator.click()\` sends one command. The server resolves the selector in the page, checks actionability, retries on the next animation frame if needed, scrolls, then dispatches real input events — all without a round trip per check from your code.
2. \`page.on('dialog')\`, \`page.waitForResponse()\` and \`context.on('page')\` are real subscriptions, not polling loops.
3. Navigation tracking is precise: the server knows which frame navigated and when \`load\` / \`domcontentloaded\` fired.

### How this differs from WebDriver classic and WebDriver BiDi

| | Selenium / WebDriver classic | WebDriver BiDi (W3C, in progress) | Playwright |
|---|---|---|---|
| Transport | HTTP request/response per command to a driver (chromedriver, geckodriver) | WebSocket, bidirectional | pipe / WebSocket, bidirectional |
| Events from the browser | none in the classic spec — you poll | yes (log, network, browsing-context events) | yes |
| Who waits | your code (\`WebDriverWait\` polling) | client libraries can build on events | the server, before every action and in assertions |
| Standardised | W3C Recommendation, every vendor ships a driver | W3C draft, implemented by browser vendors | not a standard; Playwright's own protocol layer |
| Browser builds | your installed browsers | your installed browsers | its own pinned builds (or branded Chrome/Edge via CDP) |

Be careful in an interview: **Selenium 4 is adding BiDi** (and has CDP access for Chromium), so "Selenium has no events" is no longer strictly true. The honest summary: Selenium's portable core is still the classic HTTP protocol, its BiDi support is growing; Playwright had a bidirectional connection from day one but pays for it with patched Firefox/WebKit builds and no W3C standard behind it.

## Browser, BrowserContext and Page

| | Browser | BrowserContext | Page |
|---|---|---|---|
| What it is | one browser process (plus its child processes) | an isolated, incognito-like profile inside that browser | a tab or popup inside a context |
| Created by | \`chromium.launch()\`, \`connect()\` | \`browser.newContext(options)\` | \`context.newPage()\`, a popup, \`window.open\` |
| Rough cost | hundreds of ms to seconds, tens to hundreds of MB | milliseconds | milliseconds (plus your \`goto\`) |
| Owns | the process, launch args, the browser build/channel | cookies, localStorage, IndexedDB, cache, service workers, permissions, geolocation, locale, timezone, viewport defaults, HTTP credentials, routes, video recording | its frames, DOM, **sessionStorage**, dialogs, its own \`route\` handlers |
| Shared with siblings | — | the browser process only | **context** storage: cookies, localStorage, permissions |
| Typical lifetime | one per Playwright Test **worker** | one per **test** | one or more per test |
| Close | \`browser.close()\` | \`context.close()\` (also finalises videos, HAR, traces) | \`page.close()\` |

The key insight: **contexts give you the isolation of a new browser at the cost of a new tab.** Two contexts in one browser cannot see each other's cookies or storage; they are as separate as two different Chrome profiles.

### A ShopEasy subtlety: sessionStorage is per page

ShopEasy keeps the logged-in user (\`shopeasy.user\`) and the cart (\`shopeasy.cart\`) in **sessionStorage**, while "Remember me" writes \`shopeasy.rememberedUser\` to **localStorage**. Consequences:

- Two **pages in the same context** share localStorage (the remembered username is prefilled) but **not** sessionStorage — the second tab shows "Hi, guest" and an empty cart. (A popup opened by \`window.open\` starts with a copy of its opener's sessionStorage; a page from \`context.newPage()\` starts empty.)
- \`storageState\` saves cookies and localStorage (recent versions can also include IndexedDB on request) but **not sessionStorage** — the trap the *Auth state and API testing* lesson and problem pw-029 deal with.

## How Playwright Test wires these together

\`\`\`
playwright test
 ├─ worker process 0  ── browser (worker-scoped fixture, launched once)
 │     ├─ test A: context + page (test-scoped)  → closed after A
 │     └─ test B: context + page                → closed after B
 └─ worker process 1  ── browser
       └─ test C: context + page
\`\`\`

| Fixture | Scope | Built from |
|---|---|---|
| \`playwright\` | worker | the library |
| \`browserName\`, \`launchOptions\`, \`headless\`, \`channel\` | worker | project \`use\` |
| \`browser\` | **worker** | \`browserType.launch(launchOptions)\` or \`connectOptions\` |
| \`contextOptions\` + options like \`viewport\`, \`locale\`, \`storageState\` | test | project \`use\` / \`test.use\` |
| \`context\` | **test** | \`browser.newContext(...)\` with those options, plus tracing/video/screenshot hooks |
| \`page\` | **test** | \`context.newPage()\` |
| \`request\` | test | an \`APIRequestContext\` (no browser at all) |

Two consequences seniors are expected to know:

1. **Changing a worker-scoped option in one file** (\`test.use({ launchOptions: { slowMo: 100 } })\` or \`channel\`) means those tests need a different browser, so the runner groups them into a different worker. Changing a test-scoped option (\`viewport\`, \`locale\`, \`storageState\`) is cheap — it only affects the new context.
2. **After a test fails, the worker is thrown away** and a new one (with a new browser) starts for the next test. A crashed or polluted browser can therefore never leak into later tests, and \`beforeAll\` state in that worker is lost — another reason to keep tests independent.

## Multiple contexts in one test

Use your own contexts when **two independent users act in the same scenario**: a shopper and a support agent, a buyer and an admin approving the order, two people in a chat. ShopEasy has no admin UI, so here is the same pattern with what it does have: a logged-in shopper and a guest must never see each other's cart.

\`\`\`ts
// tests/isolation/two-shoppers.spec.ts
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

const SITE = 'http://localhost:5180/practice-site/';

async function loggedInShopper(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: SITE, locale: 'en-GB' });
  const page = await context.newPage();
  await page.goto('login.html');
  await page.getByLabel('Username').fill('standard_user');
  await page.getByLabel('Password').fill(process.env.SHOP_PASSWORD ?? 'secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByTestId('logged-in-user')).toHaveText('standard_user');
  return { context, page };
}

test('a guest never sees the cart of a logged-in shopper', async ({ browser }) => {
  const shopper = await loggedInShopper(browser);
  // explicit empty state: never inherit a logged-in storageState from the project's use block
  const guestContext = await browser.newContext({ baseURL: SITE, storageState: { cookies: [], origins: [] } });
  const guest = await guestContext.newPage();

  try {
    await test.step('shopper adds the backpack', async () => {
      await shopper.page.getByTestId('add-to-cart-trailblazer-backpack').click();
      await expect(shopper.page.getByTestId('shopping-cart-badge')).toHaveText('1');
    });

    await test.step('guest browses the same catalogue', async () => {
      await guest.goto('inventory.html');
      await expect(guest.getByTestId('logged-in-user')).toHaveText('guest');
      await expect(guest.locator('#guest-notice')).toBeVisible();
      await expect(guest.getByTestId('shopping-cart-badge')).toHaveCount(0);
    });

    await test.step('shopper is unaffected by the guest', async () => {
      await shopper.page.reload();
      await expect(shopper.page.getByTestId('shopping-cart-badge')).toHaveText('1');
    });
  } finally {
    await Promise.all([shopper.context.close(), guestContext.close()]);
  }
});
\`\`\`

What matters:

- The test asks for **\`browser\`**, not \`page\`: it builds its own contexts from the worker's browser. (Asking for \`page\` as well would create a third, unused context.)
- Each \`newContext\` gets its own options. While a test runs, contexts created from the runner's browser **inherit the context options from \`use\`** (baseURL, viewport, locale, storageState …) and explicit options win. Passing \`baseURL\` here is therefore redundant if the config sets it, but it makes the dependency visible. The catch is the other direction: if the project sets \`storageState\` for a logged-in user, your "guest" context inherits it too — pass \`storageState: { cookies: [], origins: [] }\` when a context must start anonymous.
- \`try/finally\` closes both contexts even when an assertion fails; otherwise videos and traces of those contexts are never finalised. A cleaner team-level version is a fixture that yields both users and closes them in teardown:

\`\`\`ts
// fixtures/two-users.ts
import { test as base, type Page } from '@playwright/test';

type Users = { shopper: Page; guest: Page };

export const test = base.extend<Users>({
  shopper: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5180/practice-site/' });
    const page = await context.newPage();
    // …log in as in loggedInShopper()
    await use(page);
    await context.close();
  },
  guest: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5180/practice-site/' });
    await use(await context.newPage());
    await context.close();
  },
});
\`\`\`

For a real buyer/admin flow the shape is identical: \`adminPage\` built from a context with the admin's \`storageState\`, \`buyerPage\` from the buyer's. The test reads like the business story: buyer places the order, admin approves it, buyer sees "Approved".

### Approaches to "more than one user" compared

| Approach | How it works | Advantages | Disadvantages | Performance | When to use |
|---|---|---|---|---|---|
| Two **contexts** in one browser | \`browser.newContext()\` twice | full storage isolation, fast, one trace per context | you manage options and closing | best | default for multi-user scenarios |
| Two **pages** in one context | \`context.newPage()\` | trivial | shares cookies/localStorage — not two users | best | multi-tab behaviour of **one** user |
| Two **browsers** | \`chromium.launch()\` twice, or two engines | can mix engines (Chromium shopper, WebKit admin) | slow, heavy, outside the fixture model | worst | true cross-browser interaction, rare |
| UI for one user, **API** for the other | \`request.newContext()\` for the admin | fastest, stable, tests the UI you care about | does not test the admin UI | very good | the second user is a precondition, not the subject |

**Recommended:** if the second user's UI is not what you are testing, drive them through the API (fastest, least flaky). If both UIs matter, use **two contexts packaged in fixtures** — it reads well, cleans up automatically and scales across workers.

## browser.newContext options worth knowing

\`\`\`ts
import { test, expect, devices } from '@playwright/test';

test('order confirmation for a Berlin customer on a phone', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['Pixel 7'],                       // viewport, userAgent, deviceScaleFactor, isMobile, hasTouch
    locale: 'de-DE',                             // navigator.language, Intl defaults, Accept-Language
    timezoneId: 'Europe/Berlin',                 // Date and Intl in the page
    geolocation: { latitude: 52.52, longitude: 13.405 },
    permissions: ['geolocation'],                // granted for every origin in this context
    storageState: 'playwright/.auth/standard_user.json',
    httpCredentials: { username: 'staging', password: process.env.BASIC_AUTH_PASSWORD ?? '' },
    recordVideo: { dir: 'test-results/videos', size: { width: 640, height: 360 } },
  });
  const page = await context.newPage();
  await page.goto('http://localhost:5180/practice-site/inventory.html');
  await expect(page.getByTestId('title')).toHaveText('Products');
  await context.close();                         // the video file is written on close
});
\`\`\`

| Option | Effect | Senior note |
|---|---|---|
| \`viewport\`, \`deviceScaleFactor\`, \`isMobile\`, \`hasTouch\` | emulation | emulation, not a real device — keep a real-device smoke on a device cloud if mobile matters |
| \`locale\`, \`timezoneId\` | i18n and date logic | catches "order placed tomorrow" bugs around midnight UTC |
| \`geolocation\` + \`permissions\` | location-based features | permission names supported differ per browser; \`context.grantPermissions()\` / \`clearPermissions()\` at runtime |
| \`storageState\` | start logged in | cookies + localStorage only (see above) |
| \`httpCredentials\` | HTTP Basic/NTLM-style auth on staging | keep secrets in env vars, never in the repo |
| \`recordVideo\` | video per page | in Playwright Test prefer \`use: { video: 'retain-on-failure' }\` |
| \`extraHTTPHeaders\`, \`offline\`, \`colorScheme\`, \`javaScriptEnabled\`, \`proxy\` | network and media | \`offline: true\` is a cheap resilience test |

In Playwright Test you normally set these in \`use\` (config, project or \`test.use\`) and the \`context\` fixture applies them. Create contexts yourself only when one test needs two different configurations.

## launch, connect and connectOverCDP

| | \`browserType.launch()\` | \`browserType.connect(wsEndpoint)\` | \`chromium.connectOverCDP(endpoint)\` |
|---|---|---|---|
| What | starts a Playwright-supported browser locally | attaches to a **Playwright server** (\`launchServer()\`, \`npx playwright run-server\`, a Playwright grid/cloud) | attaches to **any** Chromium that exposes CDP (\`--remote-debugging-port\`) |
| Browsers | all three | all three | Chromium-based only |
| Fidelity | full | full (same protocol layer, runs remotely) | **lower**: you get a generic CDP connection, not Playwright's own launch; some features may behave differently |
| Version rule | — | client and server Playwright versions must match | works across Chrome versions, best effort |
| In config | \`use: { launchOptions }\` | \`use: { connectOptions: { wsEndpoint } }\` | manual, in a fixture |
| Use for | everyday local and CI runs | browsers in Docker / Kubernetes / a vendor cloud | attaching to an existing Chrome, an Electron/CEF app, a debugging session |

Limitations of \`connectOverCDP\` to state in an interview: Chromium only; you attach to a browser that already has its own default context and state, so isolation is your job; the browser was not launched with Playwright's flags, so behaviour can differ; and the docs recommend \`connect\` over \`connectOverCDP\` whenever you can run a Playwright server.

\`launchPersistentContext(userDataDir)\` is the fourth option: one context that **is** a real profile on disk. You need it for browser extensions; you avoid it for tests because it removes isolation.

## Headless, headed, bundled Chromium and channels

- **Headless** is the default in Playwright Test; \`--headed\` or \`use: { headless: false }\` shows the window, and \`launchOptions: { slowMo: 250 }\` slows each operation for debugging. In recent Playwright versions headless Chromium runs on a separate lightweight headless build, and you can opt into Chrome's "new headless" mode via a channel — check the docs for your version before relying on either detail.
- **Bundled Chromium** (default) is an open-source Chromium build pinned to your Playwright version: reproducible, no auto-updates.
- **Channels** — \`channel: 'chrome'\`, \`'chrome-beta'\`, \`'msedge'\`, \`'msedge-beta'\` — use the **branded** browser installed on the machine (or installed with \`npx playwright install chrome\`). Use them when you must test proprietary codecs, enterprise policies or "the browser customers actually use". Trade-off: they auto-update, so your browser version can change between two CI runs.
- There is no channel for branded Firefox or Safari; Playwright's Firefox and WebKit are always its own builds.

## Installing browsers and the Docker image

\`\`\`bash
npx playwright install                     # all browsers for this Playwright version
npx playwright install --with-deps chromium  # one browser + Linux system libraries (CI)
npx playwright install-deps                # only the OS dependencies
\`\`\`

Browsers live in a shared cache (overridable with \`PLAYWRIGHT_BROWSERS_PATH\`), keyed by browser build, so upgrading \`@playwright/test\` without re-running \`install\` gives *"Executable doesn't exist at …"*. In CI, cache that folder keyed on the Playwright version, or use the official image:

\`\`\`dockerfile
# tag must match the @playwright/test version in package-lock.json
FROM mcr.microsoft.com/playwright:v<your-playwright-version>-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "playwright", "test"]
\`\`\`

The image contains the browsers and their OS libraries, not your \`@playwright/test\` package. A mismatched tag means the browsers in the image are not the ones your installed version expects. Run Chromium in Docker with \`--ipc=host\` (or a larger \`/dev/shm\`) to avoid out-of-memory crashes on heavy pages.

## Common mistakes and how to debug them

- **"Target page, context or browser has been closed"** — a promise was still running after the test ended (a missing \`await\`, a listener firing late) or you closed a context another step still used. Look for the last un-awaited call above the line in the stack trace.
- **Creating contexts in \`beforeAll\` and sharing them across tests** — state leaks between tests and the context dies with the worker after the first failure. Share data, not contexts.
- **Your own context is unexpectedly logged in (or mobile, or German)** — contexts created during a test inherit the \`use\` context options, including \`storageState\` and device emulation. Override explicitly (\`storageState: { cookies: [], origins: [] }\`). Contexts created *outside* a test (a standalone script, \`globalSetup\`) get no config at all.
- **Using \`connectOverCDP\` for the whole suite** "because the cloud gives a CDP URL" — expect subtle differences. Ask for a Playwright \`wsEndpoint\` instead.
- **Browser version drift** — channel \`chrome\` updated overnight and screenshots changed. Pin with bundled Chromium for visual tests.

## Best practices

- Let the runner own Browser and the default context; create extra contexts only for extra users or a different configuration, and always close them (fixtures make this automatic).
- Treat **context = user session**, **page = tab**. If you need two users, you need two contexts — never two pages.
- Keep worker-scoped options in projects, not scattered \`test.use\` calls, so worker grouping stays predictable.
- Pin versions: \`@playwright/test\` in the lockfile, Docker tag equal to it, browsers installed by that version.

## Selenium (Java) equivalent

Selenium has no cheap in-process context in its classic API. Isolation means **one WebDriver session per test**, usually one per thread:

\`\`\`java
public final class DriverFactory {
    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    public static WebDriver get() {
        if (DRIVER.get() == null) {
            ChromeOptions options = new ChromeOptions();
            options.addArguments("--headless=new", "--incognito");
            DRIVER.set(new ChromeDriver(options));      // a new browser process
        }
        return DRIVER.get();
    }

    public static void quit() {
        WebDriver driver = DRIVER.get();
        if (driver != null) { driver.quit(); DRIVER.remove(); }
    }
}
\`\`\`

| | Selenium Java | Playwright |
|---|---|---|
| Isolation unit | driver session (new browser process) | BrowserContext (same process) |
| Cost per test | seconds | milliseconds |
| Parallel model | TestNG/JUnit threads + \`ThreadLocal<WebDriver>\` | worker processes, browser per worker, context per test |
| Two users in one test | two drivers | two contexts |
| Clean-up | \`@AfterMethod driver.quit()\` (leaks if forgotten) | fixture teardown |

To reduce cost, Selenium teams reuse one driver per thread and clear cookies/storage between tests — faster, but leakier. WebDriver BiDi defines "user contexts" that resemble Playwright's contexts, and Selenium's BiDi APIs are moving in that direction, but driver-per-thread is still the mainstream Selenium pattern.

## Interview questions

### Q: Walk me through what happens when Playwright runs \`await page.click()\`.
**Short answer (30–60 s):** The client sends a single command over the connection to the Playwright server. The server resolves the locator inside the page with its injected script, runs actionability checks and retries until they pass, scrolls the element into view, and dispatches real mouse events through the browser protocol — CDP for Chromium, Playwright's own protocols for its Firefox and WebKit builds. Then it waits for any navigation the click started to be committed.

**Detailed answer:** Mention the layers: client API → in-process server in Node (a child Node driver for Java/Python/.NET) → browser over pipe/WebSocket. Waiting happens server-side, so there is no per-poll HTTP round trip. Events (navigation, dialogs, requests) are pushed by the browser, which is why Playwright can react to them instead of polling. Contrast with WebDriver classic: one HTTP request per command, and the client does the waiting.

### Q: What is the difference between Browser, BrowserContext and Page?
**Short answer (30–60 s):** Browser is the process — expensive, one per worker. A context is an isolated incognito-like profile with its own cookies, storage, cache and permissions — cheap, one per test. A page is a tab in a context; pages in a context share cookies and localStorage.

**Detailed answer:** Add the costs (seconds vs milliseconds), what is per page (sessionStorage, frames, dialogs), and the fixture scopes: \`browser\` worker-scoped, \`context\` and \`page\` test-scoped. Then the design rule: one context per user session, one page per tab. A ShopEasy detail shows depth: because ShopEasy stores the login in sessionStorage, a second page in the same context shows "guest".

### Q: How does Playwright Test achieve isolation without restarting the browser?
**Short answer (30–60 s):** Each test receives a new BrowserContext from the worker's shared browser and the context is closed after the test, so cookies, storage and cache never carry over. On failure the whole worker is replaced.

**Detailed answer:** Explain worker processes, the worker-scoped \`browser\` fixture, test-scoped \`context\`/\`page\`, and that contexts are separate at the browser level, not just "cleared". Note what is *not* isolated: server-side data (accounts, orders, stock). That needs unique test data per test or per worker.

### Q: When would you create your own BrowserContext instead of using the \`page\` fixture?
**Short answer (30–60 s):** When a test needs two independent users at once, or two configurations — for example a shopper and an admin, or desktop and mobile in one scenario.

**Detailed answer:** Show \`browser.newContext()\` in a fixture with teardown. Mention that during a test such contexts inherit the \`use\` context options (so override \`storageState\` for an anonymous user) and must be closed for videos/HAR to be written. Offer the alternative: drive the second user through the API when their UI is not under test.

### Q: launch, connect, connectOverCDP — when would you use each?
**Short answer (30–60 s):** \`launch\` for normal runs; \`connect\` to a remote Playwright server in Docker or a cloud with full fidelity; \`connectOverCDP\` only to attach to an existing Chromium (Electron, a debug Chrome) — it is Chromium-only and lower fidelity.

**Detailed answer:** Version matching for \`connect\` (client and server versions must match), \`connectOptions\` in config, and why \`connectOverCDP\` differs: the browser was not launched by Playwright, it has its own default context and state, and Playwright speaks generic CDP to it.

### Q: Bundled Chromium or \`channel: 'chrome'\`?
**Short answer (30–60 s):** Bundled Chromium for reproducibility — it is pinned to the Playwright version. A Chrome or Edge channel when you must test the branded browser customers use, accepting that it auto-updates.

**Detailed answer:** Typical split: PR pipeline on bundled Chromium (fast, deterministic, stable screenshots), a nightly project on \`chrome\`/\`msedge\` to catch branded-browser issues, WebKit as a Safari-engine approximation with a small real-Safari check on a device cloud if Safari share is high.

### Q: Why does Playwright ship patched Firefox and WebKit builds?
**Short answer (30–60 s):** Because their stock automation interfaces did not offer the deep, bidirectional control Playwright needs, so the team maintains builds with its own protocol. Chromium already had CDP.

**Detailed answer:** The trade-off: excellent control and consistent behaviour across engines, but WebKit is not Safari and the Firefox build is not the one users install. WebDriver BiDi may reduce the need for patches in the future; do not claim it already has.

## Scenario-based questions

**1. The suite takes 40 minutes; a colleague proposes launching the browser once in \`globalSetup\` and sharing a single context across all tests "to save time".** I would measure first: with Playwright, context creation is milliseconds, so the cost is almost certainly navigation and login, not isolation. I'd keep a context per test and remove the login cost with \`storageState\` from a setup project (or a context init script for ShopEasy's sessionStorage), plus more workers or sharding. A shared context would make tests order-dependent and turn one failure into many.

**2. A buyer/admin approval flow is flaky: the admin sometimes sees "no pending orders".** First question: are buyer and admin in separate contexts? Two pages in one context share cookies, so the admin may be acting as the buyer. Second: is the admin page reading before the order exists server-side? I'd wait on the buyer's \`POST /api/orders\` response, then reload the admin view and assert with a web-first assertion. Third: isolate data — each run creates its own order id.

**3. The vendor cloud gives a CDP URL and tests behave differently there than locally.** Explain that \`connectOverCDP\` is lower fidelity and Chromium-only, check whether the vendor offers a Playwright \`wsEndpoint\` with a matching version, and if not, compare traces from both environments to find the differing behaviour (viewport, permissions, existing default context).

## Tricky follow-ups

- **Do two pages in the same context share sessionStorage?** No. sessionStorage is per top-level page; cookies and localStorage are shared within the context. A \`window.open\` popup starts with a copy of its opener's sessionStorage.
- **Is the \`browser\` fixture shared between tests in different files?** Yes, if they run in the same worker and need the same worker-scoped options.
- **Does \`storageState\` restore sessionStorage?** No — cookies and localStorage (and, in recent versions, IndexedDB on request). Seed sessionStorage with \`context.addInitScript\`.
- **Can one test use Chromium and WebKit at the same time?** Yes, through the \`playwright\` fixture (\`playwright.webkit.launch()\`), but it is outside the normal project model and rarely worth it.
- **What does Playwright do after a test fails in a worker?** It discards the worker process (and its browser) and starts a fresh worker for the remaining tests.`,
  keyPoints: [
    'Client → Playwright server (in-process in Node, a child Node driver for other languages) → browser over CDP (Chromium) or Playwright\'s own protocols (patched Firefox/WebKit).',
    'A bidirectional connection plus an injected in-page script is what makes server-side auto-waiting and real events possible; WebDriver classic is HTTP request/response.',
    'Browser = process (expensive, per worker); BrowserContext = isolated profile (cheap, per test); Page = tab. Context = user session, page = tab.',
    'Contexts isolate cookies, localStorage, IndexedDB, cache, permissions; sessionStorage is per page, and storageState does not include it.',
    'In Playwright Test, browser is worker-scoped, context and page are test-scoped; a failed test replaces the worker.',
    'Multiple users → multiple contexts in fixtures (they inherit the use context options, so override storageState for a guest, and must be closed); second user not under test → use the API.',
    'launch for normal runs, connect for remote Playwright servers (matching versions), connectOverCDP only for attaching to existing Chromium — lower fidelity.',
    'Bundled Chromium for reproducibility, chrome/msedge channels for branded coverage; pin the Docker image tag to the @playwright/test version.',
  ],
  mistakes: [
    'Simulating two users with two pages in one context — they share cookies and localStorage. Fix: one context per user; verify by checking the logged-in name in each page.',
    'Creating a "guest" context in a project whose use block sets storageState — it silently inherits the logged-in state. Fix: pass storageState: { cookies: [], origins: [] }; and remember contexts created outside a test (scripts, globalSetup) get no config, so a relative goto there fails with "Cannot navigate to invalid URL".',
    'Sharing a context across tests via beforeAll to "save time". Fix: measure — context creation is milliseconds; remove login cost with storageState or an init script instead.',
    'Not closing self-made contexts, so videos and HAR files are empty or missing. Fix: close in finally or in fixture teardown.',
    'Upgrading @playwright/test without re-installing browsers or bumping the Docker tag. Fix: "Executable doesn\'t exist" means a version mismatch — run npx playwright install or align the image tag with the lockfile.',
    'Running the suite through connectOverCDP and treating differences as app bugs. Fix: prefer connect with a matching Playwright server; compare traces from both environments.',
  ],
  tryIt: `Write \`tests/isolation.spec.ts\` against \`http://localhost:5180/practice-site/\` with three tests: (1) two **pages** in one context — log in as \`standard_user\` with *Remember me* ticked in page 1, open \`login.html\` in page 2 and assert the username is prefilled (shared localStorage) but \`inventory.html\` in page 2 shows "guest" (separate sessionStorage); (2) two **contexts** — repeat and assert the username is *not* prefilled; (3) a context with \`locale: 'de-DE'\` and \`timezoneId: 'Asia/Kolkata'\` and assert \`await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)\` equals the timezone. Close every context you create.`,
  problems: ['pw-003', 'pw-019', 'pw-029', 'pw-031', 'pw-035'],
}
