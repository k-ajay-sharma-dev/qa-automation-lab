export default {
  id: 'sel-018',
  category: 'selenium',
  kind: 'quiz',
  title: 'Read the stack trace: which Selenium exception, which root cause?',
  level: 'ADVANCED',
  tags: ['exceptions', 'debugging', 'flaky'],
  estMinutes: 12,
  scenario: `You are on triage duty for last night's 600-test regression on Jenkins: 23 failures. Your lead wants a first-pass classification before stand-up — "real bug", "test bug" or "environment" — and the fastest way to do that is to recognise each Selenium exception and know what usually causes it.`,
  description: `For each failure excerpt, pick the most likely cause or the right fix.`,
  hints: ['Read the exception name first, then the message — Selenium messages are quite specific.', 'Ask: was the element never found, found but unusable, or found and then lost?'],
  questions: [
    {
      q: '`org.openqa.selenium.ElementNotInteractableException: element not interactable` when typing into the search box. In DevTools the locator matches **two** inputs: one in the hidden mobile header and one in the desktop header. Most likely cause?',
      options: [
        'The page has not loaded yet',
        'findElement returned the first match — the hidden mobile input — which cannot receive keys',
        'The input is inside an iframe',
        'The session has expired',
      ],
      answer: 1,
      why: 'Not interactable = the element exists but is hidden, zero-size or disabled for that action. Duplicate matches where the first is hidden are a classic cause. Fix the locator to be unique (scope it to the desktop header) rather than adding waits.',
    },
    {
      q: '`NoSuchElementException: Unable to locate element: {"method":"css selector","selector":"#support-email"}` on `frames.html`. The id is correct in DevTools and the page is fully loaded. What should you check first?',
      options: [
        'Whether the element is inside an iframe (and the driver is still in the main document)',
        'Whether chromedriver is the right version',
        'Whether the element is stale',
        'Whether an alert is open',
      ],
      answer: 0,
      why: 'A correct locator + loaded page + NoSuchElement strongly suggests a frame (here the contact form lives in the `#support-frame` iframe; payment and chat widgets are usually iframes too) or a shadow root. Driver version mismatches fail at session creation with SessionNotCreatedException.',
    },
    {
      q: '`TimeoutException: Expected condition failed: waiting for visibility of element located by By.id: checkout-complete (tried for 10 second(s) with 500 milliseconds interval)`. The screenshot shows the checkout error "Error: Postal Code is invalid". Classification?',
      options: [
        'Test bug: increase the timeout to 30s',
        'Likely an application/data issue: the app showed an error instead of the confirmation; investigate the checkout test data (postal code) or the validation rules',
        'Environment: chromedriver crashed',
        'StaleElement problem disguised as a timeout',
      ],
      answer: 1,
      why: 'TimeoutException only says the condition never became true. The screenshot reveals *why*: a different state. Raising the timeout would just make the failure slower. This is why screenshot-on-failure matters.',
    },
    {
      q: '`SessionNotCreatedException: This version of ChromeDriver only supports Chrome version 118. Current browser version is 120` on a Jenkins agent, every test failing. Best fix?',
      options: [
        'Add Thread.sleep before new ChromeDriver()',
        'Remove the hard-coded webdriver.chrome.driver path / old driver binary and let Selenium Manager (Selenium 4.6+) resolve the matching driver, or pin the browser version in the Grid/Docker image',
        'Catch the exception and retry',
        'Switch to JavascriptExecutor',
      ],
      answer: 1,
      why: 'SessionNotCreatedException is an environment problem: browser and driver are incompatible (or the browser can\'t start). Chrome auto-updated but someone\'s pinned driver didn\'t. Selenium Manager or a versioned Docker image fixes it for good.',
    },
    {
      q: '`NoSuchSessionException: invalid session id` appears in the **second half** of tests in a class, only when running in parallel. Most likely cause?',
      options: [
        'The website logged the user out',
        'A shared static WebDriver: one thread\'s @AfterMethod quit() the driver another thread is still using',
        'Too many implicit waits',
        'The element moved',
      ],
      answer: 1,
      why: 'Invalid session id = the session behind the driver was already quit or crashed. In parallel runs the classic cause is a static/shared driver field. The fix is one driver per thread (ThreadLocal<WebDriver>).',
    },
    {
      q: 'Which pairing of exception → typical fix is WRONG?',
      options: [
        'StaleElementReferenceException → re-locate the element after the DOM update',
        'ElementClickInterceptedException → wait for the overlay to disappear / scroll element to centre',
        'NoAlertPresentException → wait with ExpectedConditions.alertIsPresent()',
        'InvalidSelectorException → add an explicit wait',
      ],
      answer: 3,
      why: 'InvalidSelectorException means the selector itself is syntactically invalid (e.g. a broken XPath like //div[@class="a"" or a compound class in By.className). No wait will fix a typo — correct the selector. The other three pairings are right.',
    },
  ],
  explanation: `A triage cheat-sheet:

| Exception | Meaning | Usual fix |
|---|---|---|
| NoSuchElementException | locator matched nothing *now* | fix locator, wait, switch frame/shadow root |
| TimeoutException | a wait's condition never became true | look at the screenshot — often a different app state |
| StaleElementReferenceException | element was found, then the DOM replaced it | re-locate; wait for re-render |
| ElementNotInteractableException | found but hidden/zero-size/disabled | unique locator, wait for visibility |
| ElementClickInterceptedException | something covers the click point | wait for overlay to go, scroll to centre |
| NoSuchFrameException / NoSuchWindowException | switching to a frame/window that's gone | wait for frame, keep correct handles |
| NoAlertPresentException / UnhandledAlertException | alert missing / alert blocking | alertIsPresent(); handle alerts |
| InvalidSelectorException | bad CSS/XPath syntax | fix the selector |
| SessionNotCreatedException | browser/driver can't start or mismatch | Selenium Manager, correct options |
| NoSuchSessionException | session already quit/crashed | one driver per thread, teardown order |

Classify first by *where* it failed (session start, finding, interacting, waiting) and you'll sort test bugs from real bugs in minutes.`,
  interview: [
    { q: 'Name five Selenium exceptions and their causes.', a: 'NoSuchElement (locator matches nothing), StaleElementReference (element detached after a DOM update), ElementClickIntercepted (another element covers it), Timeout (wait condition not met in time), NoSuchFrame/NoSuchWindow (switch target missing). Mention a fix for each.' },
    { q: 'How do you decide if a failure is a product bug or a test bug?', a: 'Read the exception type and message, check the screenshot/video and logs, re-run locally against the same build. Locator/sync exceptions with a correct-looking screen suggest test issues; a wrong page state or error message suggests a product or data issue.' },
    { q: 'What is the parent class of Selenium exceptions?', a: 'WebDriverException, which extends RuntimeException, so they are unchecked.' },
  ],
}
