export default {
  slug: 'selenium-browser-state-and-network',
  category: 'selenium',
  order: 10,
  title: 'Beyond clicks: cookies, web storage, HTTP checks and BiDi',
  minutes: 9,
  summary: 'Set up test state through cookies and web storage instead of slow UI steps, check links over HTTP, and listen to the browser (console errors, network) with Selenium 4 BiDi and NetworkInterceptor.',
  manualAnalogy: `As a manual tester you sometimes take shortcuts that a user would not: you paste a URL instead of clicking through five menus, ask a developer to put an item into your cart in the database, or keep DevTools open to spot red console errors and failed requests. Automation can take the same shortcuts — and watch the same DevTools signals — on every run.`,
  body: `## Where a web app keeps its state

Most "where am I / who am I / what is in my basket" information lives in the browser:

| Store | Lifetime | Shared between tabs? | Typical use |
|---|---|---|---|
| Cookies | until expiry / session end | yes (same site) | login session id |
| \`localStorage\` | until cleared | yes (same origin) | "Remember me", preferences |
| \`sessionStorage\` | until the tab closes | no — one per tab | ShopEasy's cart (\`shopeasy.cart\`) and user (\`shopeasy.user\`) |

A fresh WebDriver session starts with a fresh browser profile, so all three are empty at the start of every test.

## Cookies through driver.manage()

\`\`\`java
driver.get("http://localhost:5180/practice-site/index.html");   // be on the site first
driver.manage().addCookie(new Cookie("currency", "EUR"));
Cookie c = driver.manage().getCookieNamed("currency");          // null if missing
driver.manage().deleteCookieNamed("currency");
driver.manage().deleteAllCookies();                              // "log out" quickly
\`\`\`

Cookies belong to a domain. On the blank page a new browser starts with there is no domain, so \`addCookie\` throws \`InvalidCookieDomainException\` — open any page of the site first. The classic speed-up: log in once through the API, copy the session cookie into the browser with \`addCookie\`, then open the page you want to test — already logged in.

## Web storage through JavascriptExecutor

WebDriver has no storage methods, so you ask the page (see the *Actions API and JavascriptExecutor* lesson for \`executeScript\`):

\`\`\`java
JavascriptExecutor js = (JavascriptExecutor) driver;
js.executeScript("localStorage.setItem('shopeasy.rememberedUser', arguments[0]);", "standard_user");
driver.get("http://localhost:5180/practice-site/login.html");   // the page reads it on load
String saved = (String) js.executeScript("return localStorage.getItem('shopeasy.rememberedUser');");
\`\`\`

- Pass values as \`arguments[n]\`; a Java \`List\` becomes a JavaScript array, so \`JSON.stringify(arguments[0])\` builds JSON without hand-written quotes.
- Pages read storage when they load: write first, then refresh or navigate.
- Seed state for the steps *before* the feature under test. Keep at least one real end-to-end test of the flow you skip.

## Checking things Selenium cannot see: HTTP status

A 404 page renders like any other page, and Selenium has no status-code API. For link checks, let Selenium **collect** the URLs and a plain HTTP client **check** them:

\`\`\`java
Set<String> urls = new LinkedHashSet<>();
for (WebElement a : driver.findElements(By.cssSelector("#page-cards a[href]"))) {
    urls.add(a.getDomProperty("href"));          // absolute URL resolved by the browser
}
HttpClient http = HttpClient.newHttpClient();    // java.net.http, Java 11+
HttpRequest head = HttpRequest.newBuilder(URI.create(url))
        .method("HEAD", HttpRequest.BodyPublishers.noBody()).build();
int status = http.send(head, HttpResponse.BodyHandlers.discarding()).statusCode();
\`\`\`

\`getDomAttribute("href")\` would give the relative \`"login.html"\`; the property gives the full URL. Collect every failure first and assert once at the end, so the report lists all broken links.

## Listening to the browser: BiDi and NetworkInterceptor

Classic WebDriver only answers questions. **WebDriver BiDi** (Selenium 4) opens a two-way channel so the browser can *push* events to your test:

\`\`\`java
options.setCapability("webSocketUrl", true);                    // ChromeOptions: enable BiDi
LogInspector logs = new LogInspector(driver);                    // org.openqa.selenium.bidi.module
List<String> errors = new CopyOnWriteArrayList<>();
logs.onConsoleEntry(e -> { if (e.getLevel() == LogLevel.ERROR) errors.add(e.getText()); });
logs.onJavaScriptException(e -> errors.add(e.getText()));
\`\`\`

- The callbacks run on another thread: use a thread-safe list and *wait* for events (a \`FluentWait\` can poll any object, including a list).
- Fail tests on console errors to catch "looks fine, is broken" bugs — but allow-list third-party noise.

For Chrome and Edge, \`NetworkInterceptor\` (built on the Chrome DevTools Protocol) can answer requests itself — block heavy images, or fake an API error:

\`\`\`java
try (NetworkInterceptor stub = new NetworkInterceptor(driver,
        Route.matching(req -> req.getUri().contains("/api/cart"))
             .to(() -> req -> new HttpResponse().setStatus(500)))) {
    driver.get(url);   // the page now sees a server error
}
\`\`\`

It is \`AutoCloseable\`: close it (try-with-resources) so the next test talks to the real network again. CDP is Chromium-only; BiDi is the cross-browser standard Selenium is moving to.`,
  keyPoints: [
    'Cookies, localStorage and sessionStorage hold most client-side state; a new WebDriver session starts empty.',
    'Open a page of the site before `addCookie` or writing storage, then refresh so the app reads it.',
    'Use storage/cookie seeding for preconditions, not for the feature you are testing.',
    'Selenium collects URLs; an HTTP client checks status codes. Report all failures at once.',
    'BiDi pushes console errors and exceptions to listeners on another thread — thread-safe list, wait for events.',
    '`NetworkInterceptor` can block or fake responses in Chromium; always close it.',
  ],
  mistakes: [
    'Calling addCookie on the blank start page — InvalidCookieDomainException. Navigate to the site first.',
    'Expecting sessionStorage to carry over to a new tab — it is per tab; cookies and localStorage are shared.',
    'Clicking every link to find broken ones — slow, and a 404 page still "loads".',
    'Asserting right after triggering a console error — BiDi events arrive asynchronously; wait for them.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/inventory.html\` open DevTools → Console and run \`sessionStorage.setItem('shopeasy.cart', JSON.stringify(['junior-onesie']))\`, then refresh. The badge shows 1 and the onesie's button says Remove — that is exactly what your Java \`executeScript\` call will do.`,
  problems: ['sel-025', 'sel-031', 'sel-032'],
}
