export default {
  id: 'dbg-037',
  category: 'debugging',
  kind: 'quiz',
  title: 'Cucumber hooks in the wrong order: logging in twice and screenshots of a closed browser',
  level: 'INTERMEDIATE',
  tags: ['cucumber', 'hooks', 'Before', 'After', 'order', 'background', 'tagged-hooks'],
  estMinutes: 14,
  scenario: `Your Cucumber suite for ShopEasy grew from one \`Hooks\` class to three: a browser hook, a tagged \`@loggedIn\` hook added by another team, and a screenshot hook. Since then the cart scenarios fail in strange ways — sometimes an NPE before the browser opens, sometimes \`NoSuchElementException\` on \`#user-name\` **after** a successful login, and failure reports with no screenshots. Nothing in the feature files changed.`,
  description: `Cucumber runs **@Before** hooks from the lowest \`order\` to the highest, and **@After** hooks from the highest to the lowest. The default order is **10000**. Hooks with the same order run in an order you should not rely on.`,
  hints: [
    'Before: low order number first. After: high order number first.',
    'A tagged hook and a Background step can both do the same thing for one scenario.',
  ],
  questions: [
    {
      q: `Scenarios tagged \`@loggedIn\` sometimes fail like this before the browser opens:

\`\`\`text
java.lang.NullPointerException: Cannot invoke "org.openqa.selenium.WebDriver.get(String)" because "com.shopeasy.hooks.DriverHooks.driver" is null
	at com.shopeasy.hooks.LoginHooks.logIn(LoginHooks.java:14)
\`\`\`

\`\`\`java
public class DriverHooks {
    @Before
    public void startBrowser() { driver = new ChromeDriver(); }
}
public class LoginHooks {
    @Before("@loggedIn")
    public void logIn() { DriverHooks.driver.get(BASE + "login.html"); /* type user, click #login-button */ }
}
\`\`\``,
      options: [
        'The @loggedIn tag is spelled wrong in the feature file',
        'Both hooks have the default order 10000, so Cucumber may run logIn before startBrowser; give the browser hook a lower order, e.g. @Before(order = 0), and the login hook @Before(value = "@loggedIn", order = 10)',
        'Tagged hooks always run before untagged hooks',
        'ChromeDriver must be started in the runner class',
      ],
      answer: 1,
      why: 'With equal order numbers Cucumber gives no guarantee which @Before runs first, so it can change between machines or versions. Make dependencies explicit: lower order = runs earlier for @Before. The tag spelling is fine — the hook clearly ran.',
    },
    {
      q: `After fixing the order, this scenario logs in **twice** and fails on the second login:

\`\`\`gherkin
@loggedIn
Feature: Cart
  Background:
    Given I am logged in as "standard_user"

  Scenario: Add the backpack to the cart
    When I add "Trailblazer Backpack" to the cart
\`\`\`

\`\`\`text
org.openqa.selenium.NoSuchElementException: no such element: Unable to locate element: {"method":"css selector","selector":"#user-name"}
	at com.shopeasy.stepdefs.LoginSteps.iAmLoggedInAs(LoginSteps.java:19)
\`\`\`

Why?`,
      options: [
        'The Background runs before the hooks',
        'The @loggedIn hook already logged in and the app redirected to the inventory page; then the Background step tries to log in again on a page with no #user-name field',
        'Feature-level tags are not inherited by scenarios',
        'standard_user can only log in once per day',
      ],
      answer: 1,
      why: 'Feature tags are inherited, so the @loggedIn hook ran, logged in, and landed on inventory.html. The Background step then waited for #user-name on a page that does not have it. Choose ONE place for the login: keep it visible as a Background step (preferred for readability) or in the hook — not both.',
    },
    {
      q: `Failed scenarios have no screenshot in the report. The log shows \`NoSuchSessionException: Session ID is null\` inside the screenshot hook.

\`\`\`java
@After(order = 0)
public void takeScreenshot(Scenario s) { /* getScreenshotAs + s.attach(...) */ }

@After(order = 100)
public void quitBrowser() { driver.quit(); }
\`\`\`

What is the fix?`,
      options: [
        'Change @After to @AfterStep',
        'Swap the numbers: @After hooks run from HIGH to LOW order, so quitBrowser (100) ran first; give takeScreenshot the higher order (e.g. 100) and quitBrowser the lower one (e.g. 0)',
        'Call driver.close() instead of quit()',
        'Take the screenshot in the step definition instead',
      ],
      answer: 1,
      why: '@After is the mirror of @Before: higher order runs first. The browser was quit before the screenshot was taken. Give the screenshot hook the higher number so it runs while the browser is still open, and quit last.',
    },
    {
      q: `A new \`ApiHooks\` class with \`@Before("@api")\` never runs at all — no output, no error. The class is in \`com.shopeasy.api.hooks\`, the runner has \`glue = {"com.shopeasy.stepdefs", "com.shopeasy.hooks"}\`, and the hooks in \`com.shopeasy.hooks\` do run. What is the most likely explanation?`,
      options: [
        'Hooks must be static methods',
        'The runner glue must cover every package that contains hooks or steps; com.shopeasy.api.hooks is not on it, so Cucumber never sees the class',
        'Tagged hooks are disabled by default',
        'The @api tag needs to be declared in cucumber.properties',
      ],
      answer: 1,
      why: 'Cucumber only scans the glue packages (and their sub-packages) for hooks and step definitions. A hook outside them is silently ignored. Add the package to glue, e.g. glue = {"com.shopeasy.stepdefs", "com.shopeasy.hooks", "com.shopeasy.api.hooks"}, or move the class under an existing glue package.',
    },
  ],
  explanation: `**Hook order rules (Cucumber 7):**
- \`@Before(order = n)\`: **lowest n first**. Start the browser at order 0, log in / seed data later.
- \`@After(order = n)\`: **highest n first**. Screenshot/attach at a high number, quit the browser at a low number.
- Default is 10000; equal numbers have no guaranteed order — never depend on it.

**Duplicated setup:** a tagged hook plus a Background step that do the same thing = double login. Keep business-visible setup in the Background, technical setup (browser, data reset) in hooks.

**Hooks that never run:** check that their package is on the runner's \`glue\`.`,
  mistakes: [
    'Leaving every hook at the default order and hoping the file order decides.',
    'Assuming @After hooks run in the same direction as @Before hooks.',
    'Logging in both in a tagged hook and in the Background.',
    'Putting a hooks class outside the glue packages and wondering why nothing happens.',
  ],
  interview: [
    { q: 'How does Cucumber order multiple @Before and @After hooks?', a: 'Each hook has an order value, default 10000. @Before hooks run from the lowest to the highest value, @After hooks from the highest to the lowest, so setup and teardown nest like brackets. I give the browser hook the lowest @Before and the lowest @After order so it starts first and quits last.' },
    { q: 'When would you use a tagged hook instead of a Background?', a: 'For technical setup that readers do not need to see, such as resetting test data for @api scenarios. If the setup is part of the business story, such as being logged in as a specific user, I prefer a Background step so it is visible in the feature and in the report.' },
  ],
}
