export default {
  slug: 'interview',
  title: 'Interview Ready — Top 40 Questions & Framework Template',
  sections: [
    {
      heading: 'Template: "Explain your framework" (90–120 seconds)',
      body: `Fill the blanks with **your** project. Say it out loud until it sounds natural.

> **1. Context** — "In my last project I worked on a **[domain: e-commerce / banking / insurance]** web application — modules like **[login, catalogue, cart, checkout, orders]**. I was part of a team of **[N]** QA engineers."
>
> **2. Stack** — "We built a **[BDD hybrid]** framework with **Java [17], Selenium 4, Cucumber 7 and TestNG**, **Maven** for build and dependencies, **Git/[Bitbucket/GitHub]** for version control and **Jenkins** for CI."
>
> **3. Layers** — "Business scenarios are in **feature files** tagged **@smoke / @regression / by module**. Steps map to **step definitions**, which call **page objects** — one class per page with **private By locators** and business methods, extending a **BasePage** that wraps **explicit waits**. A **DriverManager with ThreadLocal** creates the browser from config. **ConfigReader** loads **[qa/stage].properties** chosen by \`-Denv\`; test data comes from **JSON files** and **APIs**."
>
> **4. Execution** — "**Hooks** start the browser, take a **screenshot on failure** and quit. The **TestNG runner** runs scenarios **in parallel ([4] threads)**. On Jenkins, **smoke runs after every deployment (~[8] min)** and **full regression nightly (~[45] min, [300] scenarios)** in headless Chrome."
>
> **5. Reporting & my role** — "We publish **[Cucumber HTML / Extent / Allure]** reports with screenshots and triage failures every morning. I owned **[cart & checkout]**, and I **[replaced hard waits with explicit waits / introduced ThreadLocal for parallel / added API-based test data]**, which **[reduced flaky failures / cut run time from X to Y]**."

**Folder structure to describe if asked:**
\`\`\`text
src/test/java/com/company/
  runners/      TestRunner.java (CucumberOptions, parallel DataProvider)
  stepdefs/     LoginSteps, CartSteps, CommonSteps
  hooks/        Hooks.java (@Before/@After, screenshots)
  pages/        BasePage, LoginPage, InventoryPage, CartPage, CheckoutPage
  utils/        DriverManager, ConfigReader, WaitUtils, PriceUtils, JsonReader
src/test/resources/
  features/     login.feature, cart.feature, checkout.feature
  config/       qa.properties, stage.properties
  testdata/     users.json, addresses.json
pom.xml, testng.xml, Jenkinsfile
\`\`\``,
    },
    {
      heading: 'Framework & design (1–8)',
      body: `**1. Explain your framework.** → Use the template above: context, stack, layers, execution, reporting + your role.

**2. What is POM? Why use it?** → One class per page with its locators and actions. A UI change touches one class; tests read like user journeys; methods are reusable.

**3. POM vs PageFactory?** → POM is the pattern; PageFactory (\`@FindBy\` + \`initElements\`) is one way to initialise elements as lazy proxies. We used By locators because ExpectedConditions take By and our pages re-render a lot.

**4. Where do assertions go?** → In tests/step definitions. Page objects expose actions and state (\`getErrorMessage()\`), so they can be reused for positive and negative checks.

**5. What is in your BasePage?** → Driver, WebDriverWait, helpers like \`click(By)\`, \`type(By, text)\`, \`getText(By)\` with waits built in, scroll and JS helpers.

**6. Why Cucumber and TestNG together?** → Cucumber = BDD layer (Gherkin, steps, hooks, tags) for collaboration; TestNG = runner underneath (assertions, parallel DataProvider, listeners, suites).

**7. How do you manage configuration?** → Properties per environment selected by \`-Denv=qa\`; ConfigReader; secrets from Jenkins credentials/env vars, not Git.

**8. How do you report results?** → Cucumber HTML/Extent/Allure with screenshots on failure attached in the \`@After\` hook; Jenkins publishes and notifies the team.`,
    },
    {
      heading: 'Selenium (9–20)',
      body: `**9. Types of waits?** → Implicit (global, lookup only), explicit (\`WebDriverWait\` + \`ExpectedConditions\`), fluent (custom polling/ignored exceptions). We set implicit to 0 and use explicit only — mixing causes unpredictable timeouts.

**10. Why not Thread.sleep?** → Always waits the full time (slow) and still fails when the app is slower (flaky).

**11. findElement vs findElements?** → First match or \`NoSuchElementException\`; vs a List (empty if none, no exception).

**12. How do you handle dynamic elements?** → Stable attributes (\`data-test\`, name), \`contains()\`/\`starts-with()\`, anchor on visible text + XPath axes, parameterised locators with \`String.format\`; ask devs for test ids.

**13. CSS vs XPath?** → CSS is faster/cleaner for attributes and classes; XPath can match text and go to parents/ancestors. Never absolute XPath.

**14. How do you handle iframes?** → \`frameToBeAvailableAndSwitchToIt\`, work inside, then \`defaultContent()\` (or \`parentFrame()\` for nested).

**15. Multiple windows/tabs?** → Save \`getWindowHandle()\`, wait \`numberOfWindowsToBe(2)\`, switch to the handle ≠ parent, \`close()\`, switch back.

**16. Alerts?** → \`wait.until(alertIsPresent())\`, then \`accept()\`, \`dismiss()\`, \`getText()\`, \`sendKeys()\` for prompts.

**17. Dropdowns?** → \`Select\` for native \`<select>\` (\`selectByVisibleText/Value/Index\`); custom dropdowns: click to open, click option by text with waits.

**18. Mouse/keyboard actions?** → \`Actions\`: \`moveToElement\` (hover), \`dragAndDrop\`, \`doubleClick\`, \`contextClick\`, \`keyDown/keyUp\`, always \`.perform()\`.

**19. When do you use JavascriptExecutor?** → Scrolling, reading values not exposed by the DOM API, rare clicks on hidden native inputs — never as the default click.

**20. StaleElementReferenceException?** → DOM node replaced after a re-render; re-locate after the change, keep By locators, wait with \`stalenessOf\`/\`numberOfElementsToBe\`.`,
    },
    {
      heading: 'Cucumber (21–26)',
      body: `**21. What is BDD?** → Collaboration practice: business, dev and QA agree on behaviour as Given/When/Then examples, which become executable specs.

**22. Background vs hooks?** → Background is business-visible precondition in the feature; hooks are technical setup/teardown in code.

**23. Scenario vs Scenario Outline?** → Outline runs the same steps for each row of the Examples table (data-driven).

**24. DataTable?** → Structured data passed to one step; read as \`asMaps()\`, \`asList()\` or mapped to objects.

**25. How do you run specific scenarios?** → Tags: \`@smoke and not @wip\` in \`@CucumberOptions\` or \`-Dcucumber.filter.tags\`.

**26. Undefined / ambiguous steps?** → Undefined: glue or text mismatch (use snippet, \`dryRun\`). Ambiguous: step matches 2+ definitions — keep one, use Cucumber expressions.`,
    },
    {
      heading: 'Execution, CI/CD & stability (27–33)',
      body: `**27. How do you run tests in parallel?** → Runner overrides \`scenarios()\` with \`@DataProvider(parallel = true)\`; threads in testng.xml; \`ThreadLocal<WebDriver>\`; unique data per scenario; Grid for scale.

**28. Why ThreadLocal?** → Each thread gets its own driver; a static driver gets shared → wrong browser, \`NoSuchSessionException\`.

**29. Jenkins integration?** → Jenkinsfile; smoke after each deployment, regression nightly; \`mvn clean test -Denv=qa -Dheadless=true -Dcucumber.filter.tags=@smoke\`; publish reports, archive screenshots, notify.

**30. A test fails in the pipeline — what do you do?** → Read failure + evidence → group → reproduce manually → classify (product / test / environment) → act → communicate.

**31. How do you handle flaky tests?** → Detect from history, quarantine, find root cause (sync, data, env, locators, parallel), fix, prevent with review checklist and burn-in runs; at most one visible retry.

**32. Passes locally, fails on Jenkins?** → Headless window size, slower agent (waits), browser/driver versions, data/URLs/config, locale/time zone. Check the failure screenshot first.

**33. Headless execution?** → \`ChromeOptions\` with \`--headless=new\` and \`--window-size=1920,1080\`, controlled by \`-Dheadless\`.`,
    },
    {
      heading: 'Test data, limitations & strategy (34–37)',
      body: `**34. Test data management?** → Config per env; JSON for static data; Examples for variations; generated unique data; preconditions via API; cleanup in hooks.

**35. Selenium limitations?** → Browser-only (no desktop/native mobile/OS dialogs), no built-in runner/reporting/API/performance testing, CAPTCHA/OTP need environment support, canvas/images hard.

**36. CAPTCHA/OTP in automation?** → Test keys/disabled CAPTCHA on QA; fixed OTP for test users or read from a test mailbox/API; real flows verified manually.

**37. What do you automate and what not?** → Automate stable, repetitive, high-value regression and smoke flows, data-driven checks; keep exploratory, usability, one-off and rapidly changing features manual. Prioritise by risk and frequency — your manual experience is the strength here.`,
    },
    {
      heading: 'Java (38–40)',
      body: `**38. OOP in your framework?** → Inheritance: pages extend BasePage, tests extend BaseTest. Encapsulation: private locators + public methods. Polymorphism: \`WebDriver driver = new ChromeDriver()\`, overloaded helpers. Abstraction: WebDriver interface, abstract BasePage \`isLoaded()\`.

**39. Collections you used?** → \`List<WebElement>\` (findElements, prices for sorting), \`Set<String>\` (window handles, duplicates), \`Map\` (config, DataTables, form data).

**40. Typical live-coding tasks** → Reverse a string (loop from \`length()-1\`), count characters (\`LinkedHashMap\` + \`getOrDefault\`), find duplicates (\`HashSet.add\` returns false), verify sorted (copy → sort → compare, parse numbers first), extract numbers (\`replaceAll("[^0-9.]", "")\`, \`Pattern\`/\`Matcher.find()\`), money as \`BigDecimal\`.`,
    },
    {
      heading: 'Phrases that make answers sound real',
      body: `- "**In my project we…**" — then a concrete module, class name or number.
- "**The problem we had was… so we…**" — every technical choice has a reason.
- "**I personally…**" — modules you automated, utilities you wrote, fixes you made.
- "**The trade-off is…**" — e.g. fresh browser per test is slower but independent; we recovered time with parallel.
- "**My manual testing background helped me…**" — edge cases, triage, deciding what to automate, defect reports with evidence.
- When you don't know: "**I haven't used that directly; in our framework we solved the similar problem with… and I'd approach it by…**" — honest and still technical.`,
    },
  ],
}
