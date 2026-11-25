export default {
  slug: 'interview-deep-scenarios-account-and-catalog',
  category: 'interview',
  order: 9,
  title: `Deep dive: real project scenarios 1 — login, registration, search, product listing and product details`,
  minutes: 45,
  summary: `Five e-commerce modules the way a senior explains them: business rules and risks, scenario tables with levels, Gherkin, Selenium-Java and Playwright-TypeScript code on the two enterprise frameworks, API and database checks, OTP/CAPTCHA/SSO strategies, real failures and 60-second interview answers.`,
  manualAnalogy: `Before you tested a module by hand you made a sheet: the rules, what could go wrong, the cases, the data, and where you would look when something failed. These scenarios are the same sheets, with one extra column: the level at which a machine checks each case fastest and most reliably.`,
  body: `## How to use these three lessons

"Walk me through how you automated login / cart / checkout" is the most common senior question, because it shows everything at once: business understanding, choice of level, framework habits and debugging. Each module below has the same ten parts, so you can practise the order in which a senior speaks: **rules and risks → scenarios → Gherkin → UI code in both stacks → API → database → synchronisation and real failures → data → the 60-second answer.**

The frameworks are the finished ones: **Framework A** (\`framework-deep-enterprise-java-selenium\`) and **Framework B** (\`pw-deep-enterprise-playwright-typescript\`). Their classes (\`BasePage\`, \`Waits\`, \`SessionSeeder\`, \`ScenarioContext\`, fixtures, \`ApiResult\`, matchers) are used, not reprinted. Java API tests use the client layer of \`restassured-deep-api-framework-architecture\`, SQL uses the schema of \`restassured-deep-sql-for-testers\`, database access the \`Db\` helper of \`restassured-deep-database-testing-jdbc\`.

**What the practice shop really has.** Say this kind of thing in an interview too: it proves that you looked.

| Module | Web shop (5180) | API (5181) | So here |
|---|---|---|---|
| Login | form, 2 users, session in \`sessionStorage\` | \`POST /api/auth/login\`, tokens | UI and API, separately |
| Registration | only \`form.html\`, a *seller application*; no account is created | \`POST /api/users\` | rules at the API, form technique on \`form.html\` |
| Search | none for products; \`table.html\` searches employees | \`GET /api/products?q=\` | rules at the API, UI pattern on \`table.html\` |
| Listing | 6 cards, sort in browser code; no filter, no paging | sort and paging; no category filter | sort in both; paging at the API and on \`table.html\` |
| Details | none: product links do nothing | \`GET /api/products/{id}\` | card = details; API list against API details |

Java \`import\` lines are left out to save space; the IDE adds them. UI and API do not share data, and neither has a database. Code marked **typical real app (illustrative)** needs an application that does; it carries the tag \`@real-app\` and is switched off here.

## 1. Plumbing shared by lessons 1–3

**Framework A.** Three additions. \`pom.xml\` gets the two modules those lessons describe, \`com.shopeasy:shopeasy-api-client\` and \`com.shopeasy:shopeasy-db\`, plus \`org.awaitility:awaitility\`, all with \`test\` scope: page objects still cannot import them. \`RunCucumberTest\` gets a second glue package and a longer default filter:

\`\`\`java
        glue = {"com.shopeasy.e2e.bdd", "com.shopeasy.e2e.realapp"},
        tags = "not @wip and not @quarantine and not @real-app and not @known-defect",
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/ApiWorld.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

/** The API side of one scenario. Only the stateless facade is static; customer and response are scenario state. */
public final class ApiWorld {

    private static final ShopEasyApi API = new ShopEasyApi(ApiConfig.fromEnvironment());

    private final NewUser credentials = UserBuilder.aCustomer().build();
    private CustomerSession customer;
    private Response last;

    public ShopEasyApi api() {
        return API;
    }

    /** A brand-new customer, registered on first use. */
    public CustomerSession customer() {
        if (customer == null) {
            customer = API.newCustomer(credentials);
        }
        return customer;
    }

    public String token() {
        customer();
        return API.auth().tokenFor(credentials.username(), credentials.password());
    }

    public void received(Response response) {
        this.last = response;
    }

    public Response last() {
        if (last == null) {
            throw new IllegalStateException("No API call yet: a When step must call received() first");
        }
        return last;
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/SuiteDb.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

/** One read-only pool per JVM, opened by the first scenario that needs it (typical real app only). */
public final class SuiteDb {

    private SuiteDb() {
    }

    public static Db shared() {
        return Holder.DB;
    }

    private static final class Holder {
        private static final Db DB = new Db(DbConfig.fromEnvironment());
    }
}
\`\`\`

In the API client module, add to \`ShopEasyApi\` (to act as nobody, or with any token) and to \`ProductsClient\`; \`Product\` is the record from \`restassured-deep-assertions-json-contracts\`:

\`\`\`java
    public CustomerSession guest()                 { return session(specs.anonymous()); }
    public CustomerSession withToken(String token) { return session(specs.forToken(token)); }

    private CustomerSession session(RequestSpecification spec) {
        return new CustomerSession(null, new CartClient(spec), new OrdersClient(spec), new UsersClient(spec));
    }
\`\`\`

\`\`\`java
    public ProductPage search(java.util.Map<String, ?> query) { return Expect.status(searchRaw(query), 200, ProductPage.class); }
    public Product byId(int id)                               { return Expect.status(byIdRaw(id), 200, Product.class); }
\`\`\`

\`\`\`java
public record ProductPage(List<Product> data, int page, int size, int total, int totalPages) { }   // models
\`\`\`

**Framework B.** \`env.ts\` gains \`DATABASE_URL: z.url().optional()\` and \`SHOP_TOTP_SECRET: z.string().min(16).optional()\`; \`playwright.config.ts\` gains one line and one project:

\`\`\`ts
  grepInvert: env.SHOP_ENV === 'staging' ? undefined : /@real-app/,
  // projects:
  { name: 'e2e', testDir: './tests/e2e', dependencies: ['api-ready', 'web-ready'], use: { ...devices['Desktop Chrome'] } },
\`\`\`

**\`src/fixtures/db.ts\`**

\`\`\`ts
import { Pool } from 'pg';
import { Db } from '@core/db';           // list() and find(), from restassured-deep-database-testing-jdbc
import { env } from '@core/env';
import { test as base } from './base';

export const test = base.extend<{ db: Db }, { dbPool: Pool | undefined }>({
  dbPool: [async ({}, use) => {
    const pool = env.DATABASE_URL
      ? new Pool({ connectionString: env.DATABASE_URL, max: 2, statement_timeout: 10_000,
                   options: '-c default_transaction_read_only=on' })
      : undefined;
    await use(pool);
    await pool?.end();
  }, { scope: 'worker' }],

  db: async ({ dbPool }, use, testInfo) => {
    testInfo.skip(!dbPool, 'DATABASE_URL is not set: ShopEasy itself has no database');
    await use(new Db(dbPool!));
  },
});
\`\`\`

**\`src/fixtures/e2e.ts\`**

\`\`\`ts
import { mergeTests } from '@playwright/test';
import { test as api } from './api';
import { test as db } from './db';
import { test as ui } from './ui';

/** Only for tests that really cross layers. Everything stays lazy: no page, no API context, no pool unless asked for. */
export const test = mergeTests(ui, api, db);
export { expect } from './matchers';
\`\`\`

**Why like this.** \`ApiWorld\` keeps Cucumber steps thin and typed; \`SuiteDb\` opens lazily, so a run without \`@real-app\` needs no database. In B, \`mergeTests\` combines the three worlds only for the few specs that cross layers; the import tells the reviewer. Specs in \`tests/real-app\` belong to a project of their own (\`testDir: './tests/real-app'\`, staging only). A missing database *skips with a reason* instead of passing silently.

## 2. Login and session

### Business rules and risks

| Rule (real ShopEasy) | Risk if broken |
|---|---|
| Both fields are required; user name is trimmed in the web form | support calls, or a login with the wrong account |
| Unknown user and wrong password give the **same** message | user enumeration |
| A locked user is told so **only** with the right password (UI and API check the password first) | attackers learn which accounts exist and are locked |
| The session lives in \`sessionStorage\`: one tab, until logout | shared computers; or surprise "guest" in a second tab |
| Every cart and order call needs a bearer token | data of other customers |

**Not implemented in ShopEasy, so not testable here:** lockout after N attempts, session expiry (the login answer says \`expiresIn: 3600\`, but the server never expires a token and has no logout endpoint), MFA, CAPTCHA, password reset. Report the second one as a finding, do not test around it.

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| L1 | valid user reaches the products | positive | P1 | UI smoke | yes |
| L2 | locked user, right password: lock message / 403 \`USER_LOCKED\` | negative | P1 | UI + API | yes |
| L3 | locked user, **wrong** password: generic message / 401 | security | P1 | UI + API | yes |
| L4 | empty and missing fields, wrong types | negative | P2 | API rows, 2 UI rows | yes |
| L5 | unknown user and wrong password are indistinguishable | security | P1 | API | yes |
| L6 | no token or a forged token opens nothing | security | P1 | API | yes |
| L7 | logout ends the session; deep link afterwards is a guest | positive | P1 | UI | yes |
| L8 | second tab, lost session | boundary | P2 | UI | yes |
| L9 | leading/trailing spaces, capitals, 255+ characters | boundary | P3 | API | yes |
| L10 | lockout after N failures, counter resets on success, unlock time | security | P1 | API + DB | real app |
| L11 | idle and absolute expiry, return to the page afterwards | security | P1 | UI + API | real app |
| L12 | OTP/MFA, SSO, CAPTCHA | security | P1 | see below | partly |
| L13 | password manager, show/hide password, screen reader | usability | P3 | – | manual |

### Gherkin

\`login.feature\` already covers L1, L2 and L4. Add:

\`\`\`gherkin
  @regression @security
  Scenario Outline: A wrong password says nothing about the account
    When I sign in as "<user>" with password "wrong"
    Then I see the sign-in error "Error: Username and password do not match any user in this service"

    Examples:
      | user            |
      | no_such_user    |
      | locked_out_user |

  @regression
  Scenario: The session belongs to one tab
    When I sign in as the standard customer
    Then the products page greets the standard customer
    When I open the products page in a new tab
    Then I am browsing as a guest
\`\`\`

### Selenium and Java

**\`src/main/java/com/shopeasy/e2e/ui/Tabs.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

public final class Tabs {

    private final BrowserSession session;

    public Tabs(BrowserSession session) {
        this.session = session;
    }

    public void openNew() {
        session.driver().switchTo().newWindow(WindowType.TAB);      // also switches to it
    }

    public void reload() {
        session.driver().navigate().refresh();
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/SessionSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class SessionSteps {

    private final InventoryPage inventoryPage;
    private final Header header;
    private final Tabs tabs;

    public SessionSteps(InventoryPage inventoryPage, Header header, Tabs tabs) {
        this.inventoryPage = inventoryPage;
        this.header = header;
        this.tabs = tabs;
    }

    @When("I open the products page directly")
    public void openProductsDirectly() {
        inventoryPage.open();
    }

    @When("I open the products page in a new tab")
    public void openProductsInNewTab() {
        tabs.openNew();
        inventoryPage.open();
    }

    @Then("I am browsing as a guest")
    public void browsingAsGuest() {
        assertThat(header.userName()).isEqualTo("guest");
    }
}
\`\`\`

The first scenario needs no new code: the steps exist in \`SignInSteps\`. \`Tabs\` is a small injected component, because steps may not touch the driver. Logout (L7) uses \`I sign out\` from section 13 of Framework A, followed by \`I open the products page directly\` and \`I am browsing as a guest\`.

### Playwright and TypeScript

**\`tests/ui/session.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { env } from '@core/env';
import { InventoryPage } from '@ui/pages/inventory-page';

test('the session belongs to one tab', async ({ context, inventoryPage }) => {
  await inventoryPage.open();
  await expect(inventoryPage.header.userName).toHaveText(env.SHOP_USER);

  const secondTab = new InventoryPage(await context.newPage());
  await secondTab.open();
  await expect(secondTab.header.userName).toHaveText('guest');
});

test('losing the session in the middle of a visit turns the customer into a guest', async ({ page, inventoryPage }) => {
  await inventoryPage.open();
  await page.evaluate(() => window.sessionStorage.removeItem('shopeasy.user'));
  await page.reload();
  await expect(inventoryPage.header.userName).toHaveText('guest');
  await expect(page.locator('#guest-notice')).toHaveText('You are browsing as a guest. Log in to check out.');
});

test.describe('sign-in form', () => {
  test.use({ signedInAs: null });

  for (const user of ['no_such_user', 'locked_out_user']) {
    test(\`a wrong password says nothing about \${user}\`, async ({ loginPage }) => {
      await loginPage.open();
      await loginPage.submit(user, 'wrong');
      await expect(loginPage.error).toContainText('Error: Username and password do not match any user in this service');
    });
  }
});
\`\`\`

The second tab is created from the *context*: the \`page\` fixture's init script belongs to the first page only, so the new tab shows what a customer would see. The session-loss test removes the key instead of waiting an hour.

### API integration

**\`shopeasy-api-client: com/shopeasy/api/tests/LoginApiTest.java\`**

\`\`\`java
package com.shopeasy.api.tests;

public class LoginApiTest extends BaseApiTest {

    @DataProvider
    public Object[][] refusals() {
        return new Object[][] {
                {"no fields",               Map.of(),                                                  400, "VALIDATION_FAILED"},
                {"password is a number",    Map.of("username", "standard_user", "password", 12345678), 400, "VALIDATION_FAILED"},
                {"unknown user",            credentials("no_such_user", "secret_sauce"),               401, "INVALID_CREDENTIALS"},
                {"wrong password",          credentials("standard_user", "wrong"),                     401, "INVALID_CREDENTIALS"},
                {"user name in capitals",   credentials("STANDARD_USER", "secret_sauce"),              401, "INVALID_CREDENTIALS"},
                {"injection probe",         credentials("' OR '1'='1", "' OR '1'='1"),                 401, "INVALID_CREDENTIALS"},
                {"locked, wrong password",  credentials("locked_out_user", "wrong"),                   401, "INVALID_CREDENTIALS"},
                {"locked, right password",  credentials("locked_out_user", "secret_sauce"),            403, "USER_LOCKED"},
        };
    }

    @Test(dataProvider = "refusals")
    public void loginIsRefusedWithoutAToken(String name, Map<String, ?> body, int status, String code) {
        api.auth().loginRaw(body).then()
                .statusCode(status).body("error.code", equalTo(code)).body("$", not(hasKey("token")));
    }

    @Test(description = "No user enumeration: the two answers are identical")
    public void unknownUserAndWrongPasswordLookTheSame() {
        String unknown = api.auth().loginRaw(credentials("no_such_user", "wrong")).asString();
        String wrong = api.auth().loginRaw(credentials("standard_user", "wrong")).asString();
        assertThat(unknown).isEqualTo(wrong);
    }

    @Test
    public void cartAndOrdersNeedAValidToken() {
        for (CustomerSession session : List.of(api.guest(), api.withToken("se_1_9999_forged"))) {
            session.cart().getRaw().then().statusCode(401)
                    .header("WWW-Authenticate", startsWith("Bearer")).body("error.code", equalTo("UNAUTHORIZED"));
            session.orders().mineRaw().then().statusCode(401);
        }
    }

    private static Map<String, String> credentials(String username, String password) {
        return Map.of("username", username, "password", password);
    }
}
\`\`\`

In B the same rows are three lines each with \`toBeApiError\`:

**\`tests/api/auth.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/api';
import { env } from '@core/env';
import { ShopApi } from '@api/clients';
import { HttpClient } from '@core/http';

const refusals = [
  { title: 'unknown user', user: 'no_such_user', password: env.SHOP_PASS, status: 401, code: 'INVALID_CREDENTIALS' },
  { title: 'capitals', user: env.SHOP_USER.toUpperCase(), password: env.SHOP_PASS, status: 401, code: 'INVALID_CREDENTIALS' },
  { title: 'locked, wrong password', user: 'locked_out_user', password: 'wrong', status: 401, code: 'INVALID_CREDENTIALS' },
  { title: 'locked, right password', user: 'locked_out_user', password: env.SHOP_PASS, status: 403, code: 'USER_LOCKED' },
  { title: 'empty password', user: env.SHOP_USER, password: '', status: 400, code: 'VALIDATION_FAILED' },
];

for (const { title, user, password, status, code } of refusals) {
  test(\`sign-in refused: \${title}\`, async ({ anonymousApi }) => {
    expect(await anonymousApi.auth.login(user, password)).toBeApiError(status, code);
  });
}

test('a forged token opens nothing', { tag: '@security' }, async ({ apiContext, log }) => {
  const forged = new ShopApi(new HttpClient(apiContext, log, 'se_1_9999_forged'));
  expect(await forged.cart.get()).toBeApiError(401, 'UNAUTHORIZED');
});
\`\`\`

Two details a reviewer likes: every refusal also asserts that **no token** came back, and the enumeration test compares the two *whole bodies*, because a different wording or an extra field is enough for an attacker. Timing differences are a third channel; note them, do not assert milliseconds.

### Database validation (typical real app, illustrative)

\`\`\`sql
-- after five wrong passwords: locked, counter written, nothing else changed
SELECT u.locked, COUNT(a.id) AS failures
FROM   users u LEFT JOIN login_attempts a
       ON a.user_id = u.id AND a.success = FALSE AND a.created_at > now() - INTERVAL '15 minutes'
WHERE  u.username = $1
GROUP  BY u.locked;

-- after logout: no session is usable
SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now();   -- 0

-- never, for anybody
SELECT id FROM users WHERE password_hash IS NULL OR password_hash NOT LIKE '$argon2%';            -- 0 rows
\`\`\`

Lockout is a state machine, so test it like one: N−1 failures then success (counter resets), N failures (locked), right password while locked (refused), after the lock time (accepted), and N failures **in parallel** (a counter that is read and written in two steps lets an attacker through). Never lock a shared account: create the user in the test.

### OTP, CAPTCHA and SSO

| Obstacle | Bad idea | What a senior proposes |
|---|---|---|
| Authenticator app (TOTP) | a phone on the desk | the test user's secret is a CI secret; compute the code, as below |
| SMS / e-mail OTP | reading real phones | a test sink (mail catcher, SMS provider sandbox) or a test-only lookup API; one real delivery check per release |
| CAPTCHA | solving services, image recognition | the provider's published **test keys** or a disabled check in the test environment. Bypassing it in production is not our job: it exists to stop programs like ours |
| SSO / identity provider | driving the provider's page in every test | one nightly UI test of the redirect; all others receive a session by API (\`restassured-deep-auth-security-testing\`, \`pw-deep-network-cookies-sessions\`) |
| Trusted device prompt | clicking it away | seeded device cookie |

**\`src/main/java/com/shopeasy/e2e/data/Totp.java\`**

\`\`\`java
package com.shopeasy.e2e.data;

/** RFC 6238 time-based one-time password: 30-second step, 6 digits, HMAC-SHA1 (the authenticator-app default). */
public final class Totp {

    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private Totp() {
    }

    public static String code(String base32Secret, Instant at) {
        byte[] counter = ByteBuffer.allocate(8).putLong(at.getEpochSecond() / 30).array();
        byte[] hash = hmacSha1(decode(base32Secret), counter);
        int offset = hash[hash.length - 1] & 0x0f;
        int binary = ByteBuffer.wrap(hash, offset, 4).getInt() & 0x7fffffff;
        return String.format("%06d", binary % 1_000_000);
    }

    private static byte[] hmacSha1(byte[] key, byte[] message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            return mac.doFinal(message);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA1 is not available", e);
        }
    }

    private static byte[] decode(String base32) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        int buffer = 0;
        int bits = 0;
        for (char c : base32.toUpperCase().replaceAll("[ =]", "").toCharArray()) {
            int value = BASE32.indexOf(c);
            if (value < 0) {
                throw new IllegalArgumentException("not Base32: " + c);
            }
            buffer = (buffer << 5 | value) & 0xfff;
            bits += 5;
            if (bits >= 8) {
                bits -= 8;
                bytes.write(buffer >> bits);
            }
        }
        return bytes.toByteArray();
    }
}
\`\`\`

**\`src/domain/totp.ts\`**

\`\`\`ts
import { createHmac } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 6238: 30-second step, 6 digits, HMAC-SHA1. */
export function totp(base32Secret: string, at: Date = new Date()): string {
  const bits = [...base32Secret.toUpperCase().replace(/[ =]/g, '')]
    .map((c) => BASE32.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at.getTime() / 30_000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash.readUInt8(hash.length - 1) & 0x0f;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
\`\`\`

Both give \`287082\` for the RFC 6238 test secret (\`GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ\`) at second 59: check your helper against the standard before blaming the application. A code is valid for 30 seconds, so compute it immediately before typing; a machine whose clock is wrong by a minute fails every MFA test.

**\`tests/real-app/mfa.spec.ts\`**

\`\`\`ts
// typical real app (illustrative)
import { test, expect } from '@fixtures/ui';
import { env } from '@core/env';
import { totp } from '@domain/totp';

test.use({ signedInAs: null });

test('sign in with an authenticator code', { tag: '@real-app' }, async ({ page, loginPage }) => {
  await loginPage.open();
  await loginPage.submit(env.SHOP_USER, env.SHOP_PASS);
  await page.getByLabel('Authentication code').fill(totp(env.SHOP_TOTP_SECRET ?? ''));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/account/);
});

test('thirty idle minutes end the session and keep the way back', { tag: '@real-app' }, async ({ page }) => {
  await page.clock.install();
  await page.goto('account/orders');
  await page.clock.fastForward('30:01');
  await expect(page).toHaveURL(/login\\?returnTo=%2Faccount%2Forders/);
});

test('a session revoked on the server is noticed', { tag: '@real-app' }, async ({ page, context }) => {
  await page.goto('account/orders');
  await context.clearCookies({ name: 'session' });
  await page.getByRole('link', { name: 'Addresses' }).click();
  await expect(page).toHaveURL(/login/);
});
\`\`\`

\`page.clock\` moves the *browser's* time. A timeout enforced by the server needs a short TTL in the test configuration, a test clock in the backend, or revoking the session. "Wait 30 minutes" is never the answer.

### Synchronisation pitfalls and real failures

| Symptom | Cause | How you find and fix it |
|---|---|---|
| typed user name disappears | test types before the page's script attached its listeners or filled the remembered user | \`BasePage.waitUntilLoaded()\`; in Playwright assert \`toHaveValue\` once while debugging |
| "Timed out waiting for login error", but the screenshot shows the products | the wait was for the wrong outcome: credentials differ per environment | wait for *either* outcome and fail with the message that appeared |
| user is \`guest\` only on the Grid | seeding ran on another origin (\`localhost\` against \`web\`) | \`docker.properties\`; compare \`location.origin\` in the log |
| passes alone, 401 in the nightly | another suite called \`POST /api/reset\` | grep for \`reset\`; tokens are in memory |
| after logout, Back shows the private page | browser's back/forward cache | real app: assert that private pages are sent with \`Cache-Control: no-store\`, and check once by hand |

### Test data

\`standard_user\` and \`locked_out_user\` are read-only reference data. Anything that changes state (lockout, password change, MFA enrolment) creates its own user. The password of the demo users is public; a real one comes from \`SHOP_PASS\` and is wrapped in \`Secret\`.

### How I would explain this in an interview (60 seconds)

> "Login is small in the UI and big in the API. In the UI I keep one smoke scenario through the real form, one locked user and a few messages; every other test gets its session seeded. The matrix — missing fields, wrong types, unknown user, locked user, forged token — runs at API level as data rows. Security is part of it: the same answer for an unknown user and a wrong password, a lock that is revealed only with the right password, no token in any refusal. For MFA I compute the TOTP from a secret, OTP goes to a test mailbox, CAPTCHA is switched to test keys, and SSO has one end-to-end check. On this practice shop I would also report that tokens never expire although the response promises an hour."

## 3. Registration

### Business rules and risks

Real rules of \`POST /api/users\`: user name 3–40 characters of \`a-z 0-9 _ . -\`; password at least 8 characters (no complexity rule, no maximum); first name, last name and e-mail required; e-mail format checked (422 \`INVALID_EMAIL\`, only after the field checks passed); user name unique (409 \`USERNAME_TAKEN\`); the role is always \`CUSTOMER\`. **E-mail is not unique** and there is no confirmation mail: ask the product owner, do not invent a rule.

Risks: duplicate accounts by a double click, mass assignment ("send \`roles: ['ADMIN']\`"), password in answers or logs, and \`GET /api/users/{id}\`, which ShopEasy answers **without any token**, e-mail and phone included. That is a privacy finding, not a test trick.

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| R1 | minimal valid data creates an account that can log in | positive | P1 | API | yes |
| R2 | user name length 2 / 3 / 40 / 41 | boundary | P2 | API | yes |
| R3 | capitals, space, apostrophe, emoji in the user name | negative | P2 | API | yes |
| R4 | password 7 / 8 characters | boundary | P1 | API | yes |
| R5 | name of spaces only; e-mail without domain | negative | P2 | API | yes |
| R6 | user name taken; two simultaneous registrations | negative, race | P1 | API + DB | yes |
| R7 | role and lock flag in the request are ignored | security | P1 | API | yes |
| R8 | password never returned, stored hashed | security | P1 | API + DB | yes |
| R9 | the form reports all problems; correction clears them | UI | P2 | UI (\`form.html\`) | yes |
| R10 | confirmation link: used, reused, expired, changed | security | P1 | API + mail | real app |
| R11 | terms text, tab order, autofill | usability | P3 | – | manual |

### Gherkin

\`\`\`gherkin
@registration @regression @api
Feature: Register a customer account

  Rule: A user name has 3 to 40 characters

    Scenario Outline: A user name of <length> characters is accepted
      When a visitor registers with a user name of <length> characters
      Then the account is created

      Examples:
        | length |
        | 3      |
        | 40     |

    Scenario Outline: A user name of <length> characters is refused
      When a visitor registers with a user name of <length> characters
      Then registration is refused because of the username

      Examples:
        | length |
        | 2      |
        | 41     |

  Rule: A user name consists of lower-case letters, digits, underscore, dot and dash

    Scenario Outline: The user name "<name>" is refused
      When a visitor registers with the user name "<name>"
      Then registration is refused because of the username

      Examples:
        | name     |
        | Asha     |
        | asha rao |
        | o'brien  |

  Rule: A password has at least 8 characters

    Scenario: Seven characters are too short
      When a visitor registers with the password "1234567"
      Then registration is refused because of the password

  Rule: A user name belongs to one account

    Scenario: The user name is already taken
      Given a registered customer
      When another visitor registers with the same user name
      Then registration is refused because the user name is taken
\`\`\`

### Java: steps over the API clients

Add to \`UserBuilder\`:

\`\`\`java
    /** Boundary tests cannot use the run prefix: a 3-character name has no room for it. */
    public static String usernameOfLength(int length) {
        String alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
        return java.util.concurrent.ThreadLocalRandom.current().ints(length, 0, alphabet.length())
                .mapToObj(i -> String.valueOf(alphabet.charAt(i)))
                .collect(java.util.stream.Collectors.joining());
    }
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/RegistrationSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class RegistrationSteps {

    private final ApiWorld world;
    private NewUser registered;

    public RegistrationSteps(ApiWorld world) {
        this.world = world;
    }

    @Given("a registered customer")
    public void registeredCustomer() {
        registered = UserBuilder.aCustomer().build();
        world.api().users().register(registered);
    }

    @When("a visitor registers with a user name of {int} characters")
    public void registerWithLength(int length) {
        submit(UserBuilder.aCustomer().withUsername(UserBuilder.usernameOfLength(length)));
    }

    @When("a visitor registers with the user name {string}")
    public void registerWithName(String name) {
        submit(UserBuilder.aCustomer().withUsername(name).withEmail("visitor@example.test"));
    }

    @When("a visitor registers with the password {string}")
    public void registerWithPassword(String password) {
        submit(UserBuilder.aCustomer().withPassword(password));
    }

    @When("another visitor registers with the same user name")
    public void registerSameName() {
        submit(UserBuilder.aCustomer().withUsername(registered.username()));
    }

    @Then("the account is created")
    public void created() {
        world.last().then().statusCode(201);
    }

    @Then("registration is refused because of the {word}")
    public void refusedBecauseOf(String field) {
        world.last().then().statusCode(400)
                .body("error.code", equalTo("VALIDATION_FAILED")).body("error.details.field", hasItem(field));
    }

    @Then("registration is refused because the user name is taken")
    public void refusedAsTaken() {
        world.last().then().statusCode(409).body("error.code", equalTo("USERNAME_TAKEN"));
    }

    private void submit(UserBuilder visitor) {
        world.received(world.api().users().registerRaw(visitor.build()));
    }
}
\`\`\`

The scenarios run without a browser, because \`BrowserSession\` starts one only on demand. That is why API-level rules may live in the same feature tree: the business reads one specification, the machine runs the cheap level.

### Java: the form technique on \`form.html\`

\`\`\`gherkin
@seller @regression
Feature: Seller application

  Scenario: All missing fields are reported together
    When I submit an empty seller application
    Then exactly these problems are reported:
      | firstName | First name is required     |
      | lastName  | Last name is required      |
      | email     | Email is required          |
      | country   | Please select a country    |
      | terms     | You must accept the terms  |
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/SellerFormPage.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

/** form.html, "Become a ShopEasy seller": the only registration form the practice site has. */
public final class SellerFormPage extends BasePage {

    private static final By SUBMIT = By.id("submit-btn");
    private static final By ERRORS = By.cssSelector("#registration-form .field-error");

    public SellerFormPage(BrowserSession session) {
        super(session, "form.html");
    }

    @Override
    protected By ready() {
        return SUBMIT;
    }

    public void submit() {
        click(SUBMIT);
    }

    /** Field id -> message, only for fields that show one. */
    public Map<String, String> problems() {
        Map<String, String> problems = new LinkedHashMap<>();
        for (WebElement error : all(ERRORS)) {
            if (!error.getText().isEmpty()) {
                problems.put(error.getDomAttribute("id").replace("-error", ""), error.getText());
            }
        }
        return problems;
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/SellerFormSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class SellerFormSteps {

    private final SellerFormPage form;

    public SellerFormSteps(SellerFormPage form) {
        this.form = form;
    }

    @When("I submit an empty seller application")
    public void submitEmpty() {
        form.open();
        form.submit();
    }

    @Then("exactly these problems are reported:")
    public void problems(Map<String, String> expected) {
        assertThat(form.problems()).isEqualTo(expected);
    }
}
\`\`\`

Comparing the *whole map* also fails when a sixth, unexpected message appears.

### Playwright and TypeScript

**\`src/ui/pages/seller-form-page.ts\`**

\`\`\`ts
import type { Locator, Page } from '@playwright/test';

/** form.html, "Become a ShopEasy seller". */
export class SellerFormPage {
  readonly submitButton: Locator;
  readonly result: Locator;

  constructor(private readonly page: Page) {
    this.submitButton = page.getByRole('button', { name: 'Register' });
    this.result = page.getByTestId('result-panel');
  }

  async open(): Promise<void> {
    await this.page.goto('form.html');
  }

  problem(field: string): Locator {
    return this.page.locator(\`#\${field}-error\`);
  }

  async fillRequired(firstName: string, lastName: string, email: string): Promise<void> {
    await this.page.getByLabel('First name').fill(firstName);
    await this.page.getByLabel('Last name').fill(lastName);
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Country').selectOption('IN');
    await this.page.getByLabel('I accept the seller terms').check();
  }
}
\`\`\`

**\`tests/ui/seller-form.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { SellerFormPage } from '@ui/pages/seller-form-page';

test.use({ signedInAs: null });

test('all missing fields are reported together', async ({ page }) => {
  const form = new SellerFormPage(page);
  await form.open();
  await form.submitButton.click();

  await expect.soft(form.problem('firstName')).toHaveText('First name is required');
  await expect.soft(form.problem('lastName')).toHaveText('Last name is required');
  await expect.soft(form.problem('email')).toHaveText('Email is required');
  await expect.soft(form.problem('country')).toHaveText('Please select a country');
  await expect.soft(form.problem('terms')).toHaveText('You must accept the terms');
  await expect(form.result).toBeHidden();
});

test('a corrected form is accepted', async ({ page }) => {
  const form = new SellerFormPage(page);
  await form.open();
  await form.fillRequired('Asha', 'Rao', 'asha@example');
  await form.submitButton.click();
  await expect(form.problem('email')).toHaveText('Enter a valid email address');

  await form.fillRequired('Asha', 'Rao', 'asha@example.test');
  await form.submitButton.click();
  await expect(form.problem('email')).toHaveText('');
  await expect(form.result).toContainText('Email: asha@example.test');
});
\`\`\`

**\`tests/api/registration.spec.ts\`**

\`\`\`ts
import { randomInt } from 'node:crypto';
import { test, expect } from '@fixtures/api';
import { unwrap } from '@core/http';
import { aRegistration } from '@domain/builders';

const nameOf = (length: number): string =>
  Array.from({ length }, () => randomInt(36).toString(36)).join('');

const accepted = [
  { title: 'user name of 3 characters', overrides: () => ({ username: nameOf(3) }) },
  { title: 'user name of 40 characters', overrides: () => ({ username: nameOf(40) }) },
  { title: 'password of 8 characters', overrides: () => ({ password: '12345678' }) },
];
for (const { title, overrides } of accepted) {
  test(\`registration accepts a \${title}\`, async ({ anonymousApi }) => {
    expect((await anonymousApi.users.register(aRegistration(overrides()))).status).toBe(201);
  });
}

const refused = [
  { overrides: { username: 'ab' }, status: 400, code: 'VALIDATION_FAILED', field: 'username' },
  { overrides: { username: 'a'.repeat(41) }, status: 400, code: 'VALIDATION_FAILED', field: 'username' },
  { overrides: { username: 'Asha' }, status: 400, code: 'VALIDATION_FAILED', field: 'username' },
  { overrides: { username: "o'brien" }, status: 400, code: 'VALIDATION_FAILED', field: 'username' },
  { overrides: { password: '1234567' }, status: 400, code: 'VALIDATION_FAILED', field: 'password' },
  { overrides: { firstName: '   ' }, status: 400, code: 'VALIDATION_FAILED', field: 'firstName' },
  { overrides: { email: 'asha@' }, status: 422, code: 'INVALID_EMAIL', field: 'email' },
];
for (const { overrides, status, code, field } of refused) {
  test(\`registration refuses \${JSON.stringify(overrides).slice(0, 40)}\`, async ({ anonymousApi }) => {
    const result = await anonymousApi.users.register(aRegistration(overrides));
    expect(result).toBeApiError(status, code);
    if (!result.ok) expect(result.error.details?.map((d) => d.field)).toEqual([field]);
  });
}

test('two visitors want the same user name at the same moment', async ({ anonymousApi }) => {
  const same = aRegistration();
  const results = await Promise.all([anonymousApi.users.register(same), anonymousApi.users.register(same)]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
});

test('a visitor cannot choose a role, and no answer contains the password', { tag: '@security' }, async ({ apiContext, anonymousApi }) => {
  const greedy = { ...aRegistration(), roles: ['ADMIN'], locked: false };
  const response = await apiContext.post('/api/users', { data: greedy });     // raw: the typed client could hide both
  expect(response.status()).toBe(201);
  expect(await response.text()).not.toContain(greedy.password);

  const session = unwrap(await anonymousApi.auth.login(greedy.username, greedy.password));
  expect(unwrap(await anonymousApi.users.byId(session.user.id)).roles).toEqual(['CUSTOMER']);
});
\`\`\`

**Read the last test twice.** \`userSchema\` is a tolerant reader: zod *removes* unknown fields. \`expect(user).not.toHaveProperty('password')\` on the typed result would pass even if the server leaked the password. Security checks about extra fields need the raw body (or \`z.strictObject\`).

### Database validation (typical real app, illustrative)

\`\`\`sql
SELECT username, email, locked FROM users WHERE username = $1;          -- exactly one row, locked = FALSE
SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER($1);              -- 1, if the business wants unique e-mails
SELECT role FROM user_roles WHERE user_id = $1;                         -- CUSTOMER only
\`\`\`

The race R6 deserves the database: two parallel requests, then *one* row. The application check alone can be passed by two requests at the same moment; only a unique index decides (the Java version of such a race is in \`java-deep-executors-completablefuture\`).

### Pitfalls and real failures

- **A 3-character user name collides on the second run.** No room for a run id: 46,656 random combinations are enough for a few tests, and \`POST /api/reset\` (local only) clears them. A collision shows as 409 instead of 201: the status tells you it is data, not a defect.
- **\`VALIDATION_FAILED\` hides the e-mail problem**: ShopEasy checks the format only when all fields are present. A row that breaks two things proves only the first.
- **The builder's e-mail follows the user name**: \`withUsername("asha rao")\` would also make an invalid e-mail. The step sets a valid one, so each row breaks exactly one rule.
- **Field errors stay after correction** is a frequent real bug: therefore the "corrected form" test asserts \`toHaveText('')\`.

### Test data

Valid by default, unique by construction (\`RUN_ID\` + counter, or UUID), one broken field per row. ShopEasy has no "delete user": leftovers must be harmless.

### How I would explain this in an interview (60 seconds)

> "Registration rules are API rules, so boundaries and formats run there: 2, 3, 40, 41 characters, 7 and 8 for the password, one broken field per row, and I assert the field name in the error, not only 400. The UI gets two tests: all messages appear, and a corrected form is accepted. Then the things functional testers forget: two simultaneous registrations must give one account; a role in the request must be ignored; the password must not come back, which I check on the raw body because a typed client drops unknown fields. In the database I verify one row and a hash."

## 4. Search

### Business rules and risks

Real rules of \`GET /api/products?q=\`: substring of the **name**, case ignored, outer spaces trimmed, description not searched, no match is 200 with an empty list, special characters are ordinary characters. Risks: wrong or missing results (lost sales), wildcard characters reaching SQL, script injection when the term is echoed, and two typical UI faults: a request per key stroke and *an old answer overwriting a newer one*.

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| S1 | exact, partial, other case | positive | P1 | API | yes |
| S2 | outer spaces, inner double spaces | boundary | P3 | API | yes |
| S3 | no result: empty list **and** a friendly message | negative | P1 | API + UI | yes |
| S4 | \`%\`, \`_\`, quote, \`<script>\`, emoji, 1 and 200+ characters | security | P1 | API | yes |
| S5 | clearing the term restores the list | positive | P2 | UI | yes |
| S6 | debounce: one request per pause | performance | P2 | UI network | real app |
| S7 | slow old answer does not win | race | P1 | UI network | real app |
| S8 | search + sort + page together | combination | P2 | API | yes |
| S9 | ranking, typos, synonyms | relevance | P2 | – | judged by people, sampled |

### Gherkin

\`\`\`gherkin
@directory @regression
Feature: Find people in the directory

  Background:
    Given the employee directory is open

  Scenario Outline: Search looks at name, department and status
    When I search the directory for "<term>"
    Then the directory says "<summary>"

    Examples:
      | term   | summary                      |
      | qa     | Showing 1–3 of 3 employees   |
      | active | Showing 1–5 of 13 employees  |

  Scenario: Nothing matches
    When I search the directory for "zzz"
    Then the directory tells me that nothing matches

  Scenario: Sorting holds on every page
    When I sort the directory by salary
    Then all pages together list 15 different people, starting with "Fatima Khan"
\`\`\`

The second row is a real finding: \`active\` also matches *In**active***, so 11 + 2 people are shown. Is that wanted? An example in a feature file is the cheapest way to ask.

### Selenium and Java

**\`src/main/java/com/shopeasy/e2e/ui/DirectoryPage.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

/** table.html: the practice page that really has search, sorting and paging. */
public final class DirectoryPage extends BasePage {

    private static final By SEARCH = By.id("table-search");
    private static final By SUMMARY = By.id("row-count");
    private static final By NAMES = By.cssSelector("#employee-table tbody tr:not(.no-results) td:first-child");
    private static final By NO_RESULTS = By.cssSelector("#employee-table tr.no-results");
    private static final By NEXT = By.id("next-page");
    private static final By PAGE_INFO = By.id("page-info");

    public DirectoryPage(BrowserSession session) {
        super(session, "table.html");
    }

    @Override
    protected By ready() {
        return SUMMARY;
    }

    public void search(String term) {
        type(SEARCH, term);
    }

    public void sortBy(String column) {
        click(By.cssSelector("#employee-table th[data-sort='" + column + "']"));
    }

    public String summary() {
        return text(SUMMARY);
    }

    public String noResultsMessage() {
        return text(NO_RESULTS);
    }

    public List<String> namesOnAllPages() {
        List<String> names = new ArrayList<>(namesOnThisPage());
        while (waits.visible(NEXT).isEnabled()) {
            String before = text(PAGE_INFO);
            click(NEXT);
            waits.until("a page after '" + before + "'", driver -> !text(PAGE_INFO).equals(before));
            names.addAll(namesOnThisPage());
        }
        return names;
    }

    private List<String> namesOnThisPage() {
        return all(NAMES).stream().map(WebElement::getText).toList();
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/DirectorySteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class DirectorySteps {

    private final DirectoryPage directory;

    public DirectorySteps(DirectoryPage directory) {
        this.directory = directory;
    }

    @Given("the employee directory is open")
    public void open() {
        directory.open();
    }

    @When("I search the directory for {string}")
    public void search(String term) {
        directory.search(term);
    }

    @When("I sort the directory by {word}")
    public void sortBy(String column) {
        directory.sortBy(column);
    }

    @Then("the directory says {string}")
    public void says(String summary) {
        assertThat(directory.summary()).isEqualTo(summary);
    }

    @Then("the directory tells me that nothing matches")
    public void nothingMatches() {
        assertThat(directory.noResultsMessage()).isEqualTo("No employees match your search.");
    }

    @Then("all pages together list {int} different people, starting with {string}")
    public void allPages(int count, String first) {
        List<String> names = directory.namesOnAllPages();
        assertThat(names).hasSize(count).doesNotHaveDuplicates().startsWith(first);
    }
}
\`\`\`

### Playwright and TypeScript

**\`src/ui/pages/directory-page.ts\`**

\`\`\`ts
import { expect, type Locator, type Page } from '@playwright/test';

export class DirectoryPage {
  readonly search: Locator;
  readonly summary: Locator;
  readonly names: Locator;
  readonly noResults: Locator;
  private readonly next: Locator;
  private readonly pageInfo: Locator;

  constructor(private readonly page: Page) {
    this.search = page.getByLabel('Search employees');
    this.summary = page.getByTestId('row-count');
    this.names = page.locator('#employee-table tbody tr:not(.no-results) td:first-child');
    this.noResults = page.locator('#employee-table tr.no-results');
    this.next = page.locator('#next-page');
    this.pageInfo = page.locator('#page-info');
  }

  async open(): Promise<void> {
    await this.page.goto('table.html');
  }

  async sortBy(column: 'name' | 'department' | 'salary' | 'status'): Promise<void> {
    await this.page.locator(\`#employee-table th[data-sort="\${column}"]\`).click();
  }

  async namesOnAllPages(): Promise<string[]> {
    const names = await this.names.allTextContents();
    while (await this.next.isEnabled()) {
      const before = await this.pageInfo.innerText();
      await this.next.click();
      await expect(this.pageInfo).not.toHaveText(before);        // synchronisation, not a verdict
      names.push(...(await this.names.allTextContents()));
    }
    return names;
  }
}
\`\`\`

**\`tests/ui/directory.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { DirectoryPage } from '@ui/pages/directory-page';

const searches = [
  { term: 'qa', summary: 'Showing 1–3 of 3 employees' },
  { term: 'active', summary: 'Showing 1–5 of 13 employees' },      // "Inactive" contains "active": ask the owner
  { term: '<b>', summary: 'Showing 0–0 of 0 employees' },
];

for (const { term, summary } of searches) {
  test(\`searching the directory for \${term}\`, async ({ page }) => {
    const directory = new DirectoryPage(page);
    await directory.open();
    await directory.search.fill(term);
    await expect(directory.summary).toHaveText(summary);
  });
}

test('a search without a match says so, and clearing it brings everything back', async ({ page }) => {
  const directory = new DirectoryPage(page);
  await directory.open();
  await directory.search.fill('zzz');
  await expect(directory.noResults).toHaveText('No employees match your search.');
  await directory.search.fill('');
  await expect(directory.summary).toHaveText('Showing 1–5 of 15 employees');
});

test('sorting by salary holds across all pages', async ({ page }) => {
  const directory = new DirectoryPage(page);
  await directory.open();
  await directory.sortBy('salary');
  await expect(directory.names.first()).toHaveText('Fatima Khan');

  const names = await directory.namesOnAllPages();
  expect(new Set(names).size).toBe(15);
  expect(names.at(-1)).toBe('Lucas Silva');
});
\`\`\`

### Debounce and the stale answer (typical real app)

**\`tests/real-app/search.spec.ts\`**

\`\`\`ts
// typical real app (illustrative): the search box calls the products API
import { test, expect } from '@fixtures/ui';
import { products } from '@domain/catalogue';

test('a slow old answer never replaces a newer one', { tag: '@real-app' }, async ({ page }) => {
  const asked: string[] = [];
  await page.route('**/api/products?*', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    asked.push(q);
    if (q === 'f') await new Promise((resolve) => setTimeout(resolve, 1_500));      // the first request answers last
    const data = Object.values(products).filter((p) => p.name.toLowerCase().includes(q));
    await route.fulfill({ json: { data, page: 1, size: 10, total: data.length, totalPages: 1 } });
  });
  await page.goto('products');
  const results = page.getByTestId('product-name');

  const lateAnswer = page.waitForResponse((r) => new URL(r.url()).searchParams.get('q') === 'f');
  await page.getByRole('searchbox').fill('f');
  await expect.poll(() => asked).toContain('f');
  await page.getByRole('searchbox').fill('fleece');
  await expect(results).toHaveText(['Storm Fleece Jacket']);

  await lateAnswer;                                                        // a positive signal, then look again
  await expect(results).toHaveText(['Storm Fleece Jacket']);
});

test('typing a word asks the server once', { tag: '@real-app' }, async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/products?')) asked.push(new URL(r.url()).searchParams.get('q') ?? '');
  });
  await page.goto('products');
  await page.getByRole('searchbox').pressSequentially('fleece', { delay: 30 });     // faster than the debounce
  await expect(page.getByTestId('product-name')).toHaveText(['Storm Fleece Jacket']);
  expect(asked.filter((q) => q !== '')).toEqual(['fleece']);
});
\`\`\`

**Step by step.** The route delays only the first query, so the order of answers is *guaranteed* wrong; no luck involved. After the correct list is shown the test waits for the late answer (a positive signal) and looks again. Without that line it would pass before the bug can happen. In Selenium the same control needs a proxy, a stub backend (WireMock with \`withFixedDelay\`), or Chromium's \`NetworkInterceptor\`; that is a fair example of choosing the tool by the risk.

### API integration

**\`shopeasy-api-client: com/shopeasy/api/tests/ProductSearchTest.java\`**

\`\`\`java
package com.shopeasy.api.tests;

public class ProductSearchTest extends BaseApiTest {

    @DataProvider
    public Object[][] queries() {
        return new Object[][] {
                {"tee",           List.of("Retro Red Tee")},            // substring, so not "T-Shirt"
                {"T-SHIRT",       List.of("Classic Crew T-Shirt")},     // case is ignored
                {"  fleece  ",    List.of("Storm Fleece Jacket")},      // outer spaces are trimmed
                {"bike  light",   List.of()},                           // inner spaces are not
                {"wind-blocking", List.of()},                           // the description is not searched
                {"%",             List.of()},                           // a wildcard is an ordinary character
                {"o'neill",       List.of()},
                {"<script>alert(1)</script>", List.of()},
        };
    }

    @Test(dataProvider = "queries")
    public void searchFindsExactly(String q, List<String> names) {
        ProductPage page = api.products().search(Map.of("q", q, "size", 50));
        assertThat(page.data()).extracting(Product::name).containsExactlyInAnyOrderElementsOf(names);
        assertThat(page.total()).isEqualTo(names.size());
    }

    @Test(description = "A parameter the API does not know is ignored, so 200 proves nothing about filtering")
    public void unknownFilterIsIgnored() {
        ProductPage page = api.products().search(Map.of("category", "clothing"));
        assertThat(page.total()).isEqualTo(6);
        assertThat(page.data()).extracting(Product::category).contains("bags");
    }
}
\`\`\`

In B: \`unwrap(await anonymousApi.products.list({ q }))\` with the same rows. The last Java test documents a trap: ShopEasy silently ignores unknown parameters. A test that calls \`?category=clothing\` and asserts 200 is green and worthless; assert that **every item satisfies the filter**.

### Database validation (typical real app, illustrative)

\`\`\`sql
-- the oracle for "contains", with user wildcards escaped
SELECT id FROM products
WHERE  LOWER(name) LIKE '%' || REPLACE(REPLACE(REPLACE(LOWER(TRIM($1)), '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%' ESCAPE '\\'
ORDER  BY id;
\`\`\`

Compare ids as sets with the API answer. If the search runs on an index (Elasticsearch, OpenSearch), the database is the truth and the index is a *copy*: poll until the new product appears, and test deletion too.

### Pitfalls and real failures

| Symptom | Cause | Fix |
|---|---|---|
| list is read before it changed | the wait was "results visible", and the old ones are visible | wait for the summary or the exact list, not for presence |
| clearing the box does nothing in Selenium | \`clear()\` may not fire the \`input\` event the page listens to | send the keys a person would use (select all, Delete) and assert the summary |
| stale element while reading names | the table body is rebuilt on each key | read inside one call; \`Waits\` ignores \`StaleElementReferenceException\` only inside \`until\` |
| \`Showing 1-3 of 3\` never matches | the page uses an en dash (–) | copy the text from the page source |

### Test data

Search needs *near misses*: "Tee" against "T-Shirt", same word in name and description, accented names. Six products are enough; a copy of production is not.

### How I would explain this in an interview (60 seconds)

> "I split search into matching, states and timing. Matching is API: a table of terms with the exact expected set, including wildcards, quotes and an empty result. States are UI: results, no results with a message, cleared. Timing is where the bugs are: I mock the network in Playwright, delay the first answer and prove that the later query wins, and I count requests to verify the debounce. I never assert only 'some results appear' — an ignored parameter returns results too."

## 5. Product listing: sort, filter, pagination

### Rules, risks and scenarios

Sorting exists **twice** (browser code and API). Ties matter: the two 15.99 products keep name order in the UI and id order in the API. The promo banner above the list also has the class \`.item-price\` (\`$7.49\`), so a page-wide \`.item-price\` selector collects seven prices for six products.

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| P1 | four sort orders, whole list, ties | positive | P1 | UI + API | yes |
| P2 | sorting changes nothing but the order (set, cart) | regression | P2 | UI | yes |
| P3 | page sizes 1, 4, 5, 6, 7 of 6: no gap, no duplicate | boundary | P1 | API | yes |
| P4 | page 0, size 0, size 51: 400; page 99: 200 and empty | boundary | P2 | API | yes |
| P5 | order holds across pages | regression | P1 | API + UI | yes |
| P6 | every item satisfies the filter; counts add up; filter + sort + page | combination | P1 | API + DB | real app |
| P7 | filter in the URL survives reload and Back | positive | P2 | UI | real app |
| P8 | images, layout, 1,000 products | visual, performance | P2 | – | visual / load tools |

\`\`\`gherkin
  Scenario Outline: The whole catalogue is sorted
    Given I am signed in
    When I sort the products by <order>
    Then the whole catalogue is listed by <order>

    Examples:
      | order             |
      | name A to Z       |
      | name Z to A       |
      | price low to high |
      | price high to low |
\`\`\`

### Selenium and Java

Add to \`Catalogue\`:

\`\`\`java
    public static List<Product> all() {
        return PRODUCTS;
    }
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/ListingSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class ListingSteps {

    private static final Comparator<Product> BY_NAME = Comparator.comparing(Product::name);
    private static final Map<SortOrder, Comparator<Product>> RULES = Map.of(
            NAME_ASC, BY_NAME,
            NAME_DESC, BY_NAME.reversed(),
            PRICE_ASC, Comparator.comparing(Product::price).thenComparing(BY_NAME),
            PRICE_DESC, Comparator.comparing(Product::price, Comparator.reverseOrder()).thenComparing(BY_NAME));

    private final InventoryPage inventoryPage;

    public ListingSteps(InventoryPage inventoryPage) {
        this.inventoryPage = inventoryPage;
    }

    @Then("the whole catalogue is listed by {sortOrder}")
    public void wholeCatalogueListedBy(SortOrder order) {
        List<String> expected = Catalogue.all().stream().sorted(RULES.get(order)).map(Product::name).toList();
        assertThat(inventoryPage.productNames()).isEqualTo(expected);
    }
}
\`\`\`

### Playwright and TypeScript

**\`tests/ui/listing.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { products, type Product } from '@domain/catalogue';
import type { SortOption } from '@ui/pages/inventory-page';

const byName = (a: Product, b: Product): number => a.name.localeCompare(b.name);
const rules: Record<SortOption, (a: Product, b: Product) => number> = {
  az: byName,
  za: (a, b) => byName(b, a),
  lohi: (a, b) => a.price - b.price || byName(a, b),
  hilo: (a, b) => b.price - a.price || byName(a, b),
};

for (const option of Object.keys(rules) as SortOption[]) {
  test(\`sorting by \${option} lists the whole catalogue in order\`, async ({ inventoryPage }) => {
    await inventoryPage.open();
    await inventoryPage.sortBy(option);
    const expected = Object.values(products).sort(rules[option]).map((p) => p.name);
    await expect(inventoryPage.productNames).toHaveText(expected);       // order, count and names in one assertion
  });
}

test('sorting does not touch the cart', async ({ inventoryPage }) => {
  await inventoryPage.open();
  await inventoryPage.card(products.fleece).addButton.click();
  await inventoryPage.sortBy('hilo');
  await expect(inventoryPage.card(products.fleece).removeButton).toBeVisible();
  await expect(inventoryPage.header).toShowCartCount(1);
});
\`\`\`

### API integration

**\`shopeasy-api-client: com/shopeasy/api/tests/ProductPagingTest.java\`**

\`\`\`java
package com.shopeasy.api.tests;

public class ProductPagingTest extends BaseApiTest {

    @DataProvider
    public Object[][] sizes() {
        return new Object[][] {{1}, {4}, {5}, {6}, {7}};             // 6 products: below, at and above one page
    }

    @Test(dataProvider = "sizes")
    public void pagesTogetherAreTheWholeSortedList(int size) {
        List<Product> whole = api.products().search(Map.of("sort", "price_asc", "size", 50)).data();

        List<Product> collected = new ArrayList<>();
        ProductPage page;
        int number = 1;
        do {
            page = api.products().search(Map.of("sort", "price_asc", "size", size, "page", number++));
            collected.addAll(page.data());
        } while (number <= page.totalPages());

        assertThat(page.totalPages()).isEqualTo((int) Math.ceil(whole.size() / (double) size));
        assertThat(collected).isEqualTo(whole);                      // no gap, no duplicate, sorted across pages
    }

    @Test
    public void detailsRepeatTheListedProduct() {
        for (Product listed : api.products().search(Map.of("size", 50)).data()) {
            assertThat(api.products().byId(listed.id())).isEqualTo(listed);       // record equality: every field
        }
    }
}
\`\`\`

In B the same properties are three loops over \`unwrap(await anonymousApi.products.list({ page, size }))\`.

### Which oracle for "is it sorted?"

| Approach | How it works | Advantages | Disadvantages | Maintainability | Use when |
|---|---|---|---|---|---|
| literal list in the feature | exact names | readable, independent | changes with every product | low with a living catalogue | one agreed example |
| compute from known data (above) | sort the expected catalogue with an own comparator | exact, checks ties and completeness | needs reference data | high | stable or seeded catalogue |
| property: each price ≤ next | compare neighbours | no data needed, scales | a missing or duplicated product passes | high | large or foreign data; add a count and a set check |
| compare with the API or DB | read the truth elsewhere | always current | the same wrong rule may be behind both | medium | shared backend, ETL |

**Recommended:** computed list where the data is yours, property plus count plus uniqueness where it is not. Never sort the *displayed* list with the page's own code and compare it with itself.

### Database validation (typical real app, illustrative)

\`\`\`sql
SELECT category, COUNT(*) FROM products WHERE stock > 0 GROUP BY category ORDER BY category;      -- filter counters
SELECT id FROM products ORDER BY price, id LIMIT 4 OFFSET 4;                                      -- page 2 of 4, with tie-breaker
\`\`\`

A page query without a unique tie-breaker is a defect even if today's test is green: the database may return tied rows in any order, so a product appears on two pages or on none.

### Pitfalls and real failures

- **\`localeCompare\` and \`compareTo\` differ** for lower case, accents and punctuation. ASCII names hide it; with real data use \`Collator\` in Java and decide which locale the requirement means.
- **Reading names in a loop while the list re-renders** gives a mixture of both orders. Playwright's \`toHaveText([...])\` retries on the whole list. In Selenium wait until the *expected first* item is there, then read once.
- **Animation**: ids stay, positions move; wait for text, not for coordinates.
- **Infinite scroll**: wait until the item *count* grows (practice: \`waits.html\`, "Load more").

**Test data:** a catalogue with ties (two products at 15.99), page sizes around the total, and for real shops names with accents and one category without products.

### How I would explain this in an interview (60 seconds)

> "For listings I test invariants. Sorting: the displayed list equals my own sorted copy, ties included, so a missing product fails too. Paging: all pages together equal the unpaged list — no gap, no duplicate, sorted across the border — with page sizes below, at and above the total. Filtering: every item matches and the counters agree with SQL. Because this shop implements sorting in the browser and in the API, I need both; an API test never executes the page's code."

## 6. Product details and price consistency

### Rules, risks and scenarios

The classic e-commerce complaint: *the list said 49.99, the product page 52.99, the cart 49.99*. Causes: several caches, currency or tax display, a price change during the visit, an outdated search index. ShopEasy has no details page, so here **details = the card** (UI) and \`GET /api/products/{id}\` (API), and the real risk is drift between two copies of the catalogue.

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| D1 | details equal the list entry, every field | positive | P1 | API | yes (\`ProductPagingTest\`) |
| D2 | unknown id 404, malformed id 400 | negative | P2 | API | yes (Framework B) |
| D3 | web shop card agrees with the API | consistency | P1 | UI + API | yes |
| D4 | one price on list, details, cart, overview | consistency | P1 | UI | real app |
| D5 | price changes while the page is open | race | P1 | UI + API | real app |
| D6 | sold-out product cannot be added | negative | P1 | API (422); UI: **gap** | yes, see lesson 2 |
| D7 | gallery, zoom, reviews | visual | P3 | – | visual / manual |

\`\`\`gherkin
  Scenario Outline: Web shop and API describe the same product
    Given I am signed in
    Then the card of "<product>" agrees with the API

    Examples:
      | product              |
      | Trailblazer Backpack |
      | Retro Red Tee        |
\`\`\`

### Selenium and Java

**\`src/test/java/com/shopeasy/e2e/bdd/CatalogueApiSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class CatalogueApiSteps {

    private final ApiWorld world;
    private final InventoryPage inventoryPage;

    public CatalogueApiSteps(ApiWorld world, InventoryPage inventoryPage) {
        this.world = world;
        this.inventoryPage = inventoryPage;
    }

    @Then("the card of {product} agrees with the API")
    public void cardAgreesWithApi(Product product) {
        var found = world.api().products().search(Map.of("q", product.name())).data();
        assertThat(found).as("API search for %s", product.name()).hasSize(1);
        var fromApi = found.get(0);

        Product card = inventoryPage.card(product).details();
        assertThat(card).isEqualTo(
                new Product(fromApi.slug(), fromApi.name(), fromApi.price(), fromApi.description()));
    }
}
\`\`\`

\`BigDecimal\` from Jackson and from \`Prices.parse\` both have scale 2 here (\`49.99\`), so record equality works; a price such as \`30\` would arrive as scale 0. Then compare with \`isEqualByComparingTo\`, or normalise in one place.

### Playwright and TypeScript

**\`tests/e2e/catalogue-drift.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/e2e';
import { unwrap } from '@core/http';
import { products } from '@domain/catalogue';
import { usd } from '@domain/money';

for (const product of Object.values(products)) {
  test(\`web shop and API agree on \${product.name}\`, async ({ inventoryPage, anonymousApi }) => {
    const fromApi = unwrap(await anonymousApi.products.byId(product.id));
    await inventoryPage.open();
    const card = inventoryPage.card(product);
    await expect.soft(card.name).toHaveText(fromApi.name);
    await expect.soft(card.price).toHaveText(usd(fromApi.price));
    await expect.soft(card.description).toHaveText(fromApi.description);
  });
}
\`\`\`

**\`tests/real-app/price-consistency.spec.ts\`**

\`\`\`ts
// typical real app (illustrative): a product page exists and the same backend serves every screen
import { test, expect } from '@fixtures/e2e';
import { unwrap } from '@core/http';
import { products } from '@domain/catalogue';
import { usd } from '@domain/money';

test('one price on every screen', { tag: '@real-app' }, async ({ page, inventoryPage, cartPage, anonymousApi }) => {
  const { price } = unwrap(await anonymousApi.products.byId(products.fleece.id));

  await inventoryPage.open();
  await expect(inventoryPage.card(products.fleece).price).toHaveText(usd(price));
  await inventoryPage.card(products.fleece).name.click();

  await expect(page).toHaveURL(/storm-fleece-jacket/);
  await expect(page.getByTestId('details-price')).toHaveText(usd(price));
  await page.getByRole('button', { name: 'Add to cart' }).click();

  await cartPage.open();
  await expect(page.getByTestId('cart-item').filter({ hasText: products.fleece.name })).toContainText(usd(price));
});
\`\`\`

Selenium version of D4, with an illustrative \`ProductDetailsPage extends BasePage\` (one \`price()\` method that returns \`Prices.parse(text(PRICE))\`):

\`\`\`java
BigDecimal expected = world.api().products().byId(4).price();          // the truth, read first
assertThat(inventoryPage.card(fleece).details().price()).isEqualByComparingTo(expected);
assertThat(detailsPage.price()).isEqualByComparingTo(expected);
assertThat(cartPage.priceOf(fleece)).isEqualByComparingTo(expected);    // priceOf() comes in lesson 2
\`\`\`

### API integration

\`ProductPagingTest#detailsRepeatTheListedProduct\` (section 5) compares list entry and details as whole records, so a new field is covered without a new assertion. The wrong ids: \`/products/99\` is 404, \`/products/abc\` and \`/products/-1\` are 400, and \`/products/01\` is accepted as 1 — ask whether that is intended.

### Database validation (typical real app, illustrative)

\`\`\`sql
SELECT price FROM products WHERE slug = $1;
-- the catalogue price must equal the newest history entry
SELECT p.id, p.price, h.price AS newest
FROM   products p
JOIN   (SELECT DISTINCT ON (product_id) product_id, price FROM price_history
        ORDER BY product_id, valid_from DESC) h ON h.product_id = p.id
WHERE  p.price <> h.price;                                              -- 0 rows
\`\`\`

### Pitfalls and real failures

- **Two screens, two moments.** Reading the list price at 10:00:00 and the details at 10:00:04 is not atomic. Read the truth (API) before and after; if it changed in between, the test is inconclusive, not failed.
- **Text comparison**: \`$1,299.00\` against \`1299\`. Parse once (\`Prices\`, \`usd\`).
- **Stale element after "refresh prices"** (try it on \`waits.html\`, section 6: the list is rebuilt after a second, with different prices): locate after the change, never keep a \`WebElement\`.
- **Test data**: one ordinary product, one on sale, one with a four-digit price, one sold out; a product whose price changes belongs to the test that changes it.
- **CDN cache**: the API is right, the page shows yesterday. The test should print the response headers (\`age\`, \`x-cache\`) when it fails.

### How I would explain this in an interview (60 seconds)

> "For product details I check consistency rather than single values. The API's list entry and details must be equal as records. In the UI I read one truth first and require the same price on the card, the product page, the cart and the overview, with BigDecimal or integer cents. When they differ, the report shows which layer is out of date, because I log the cache headers. In this practice shop the page and the API keep separate catalogues, so my cross-check is really a drift detector — I would propose to generate one from the other."

## Best practices for experienced engineers

- Start from the risk, choose the level, then the tool. Say the sentence "this rule lives in …, so the test lives there".
- One broken rule per row; assert the *reason* (field, code), not only the status.
- Every negative test ends with "and nothing changed".
- Do not let typed clients hide leaks; security checks read raw bodies.
- Report gaps of the product openly; never bend the test until it is green.
- Make timing deterministic: control the network, the clock and the data instead of waiting.

## Interview questions

### Q: How did you automate the login module?
**Short answer (30–60 s):** One smoke test through the form, messages for the important refusals, seeded sessions everywhere else. The refusal matrix and the token checks run at API level; security cases (enumeration, locked account, forged token) are ordinary rows.

**Detailed answer:** Explain the two layers and why the session is seeded: login is tested once, not two hundred times. Show the order of checks (password before lock) and how a test documents it. Mention what the product lacks and how you would test lockout and expiry as state machines with created users, parallel failures, a test clock or short TTL.

### Q: How do you handle OTP and CAPTCHA?
**Short answer (30–60 s):** TOTP is computed from the secret, SMS and mail codes come from a test sink, CAPTCHA uses the provider's test keys or is disabled in the test environment. I never automate around a CAPTCHA in production.

**Detailed answer:** The point is *testability as a requirement*: the hook must exist only in test environments and must itself be tested to be off in production. One release check covers real delivery. TOTP details that fail in practice: clock drift, reused code within the same 30 seconds, a secret printed in a report.

### Q: How do you verify sorting and pagination?
**Short answer (30–60 s):** The displayed list equals my own sorted copy, ties included; all pages together equal the whole list, for sizes around the total.

**Detailed answer:** Compare literal, computed, property and cross-source oracles (table in section 5). Explain why a neighbour comparison misses a lost product, why the tie-breaker matters for paging, and why API coverage does not replace UI coverage when the page sorts in the browser.

### Q: How do you test a search box with debounce?
**Short answer (30–60 s):** I observe the network: typing a word quickly sends one request, and a delayed older answer does not replace a newer list. Both are deterministic with route mocking.

**Detailed answer:** Show the delayed first answer and the positive signal before the final assertion. In Selenium I would use a stub backend with a fixed delay or a Chromium network interceptor, or leave this risk to component tests in the front-end repository.

### Q: Your registration tests pass, yet a tester registers as ADMIN. What was missing?
**Short answer (30–60 s):** A mass-assignment test: send fields that the form does not have and check the *effect* through a second request, on the raw data.

**Detailed answer:** Typed clients cannot send unknown fields and tolerant readers remove them from answers, so both hide the defect. Keep one raw path per resource for hostile input, and verify in the database or through a permission check that nothing was granted.

### Q: UI and API show different prices. Is it a bug, and whose?
**Short answer (30–60 s):** It is an inconsistency with evidence: value, time, request id and cache headers per layer. The owner is found by asking which system is the source of truth.

**Detailed answer:** I reproduce with one product, read database, API, rendered HTML and cached responses in this order, and the first layer that differs is the suspect. The regression test then goes to the lowest layer where the difference can be observed.

## Scenario-based questions

**1. After a release 40 % of UI tests fail at login, the API login tests are green.** I open one trace: the form is there, the button is clicked, nothing follows. The network list shows no request and the console shows a script error, so it is the front end. Because other tests seed their session, they still run: that is the value of the fast path. I report one defect with the console message, quarantine nothing, and add the console-error check to the \`web-ready\` setup so the next case fails once.

**2. The product owner says "search is bad", but all search tests pass.** I collect real queries from the logs: top terms, terms without results, terms followed by no click. Our tests checked matching, not relevance. I propose a small judged set (20 queries with expected top results), reviewed with the business each month, and keep the exact-set tests for correctness. Relevance is measured, not asserted to 100 %.

**3. A pagination test fails once a week with one duplicate product.** The suite runs while another suite creates products, and the page query has no tie-breaker. Both are possible; I check which. The test gets its own category or a frozen data set; the missing tie-breaker is a product defect, because a customer who pages while the catalogue changes sees the same. I prove it with two products of equal price and a loop of fifty reads.

## Tricky follow-ups

- **Is \`sessionStorage\` shared between tabs?** No. A tab opened by \`window.open\` may start with a *copy*; a new tab from the test starts empty.
- **Why is "user locked" a 403 and "wrong password" a 401?** 401: we do not know who you are. 403: we know, and refuse. Revealing the second only after a correct password is the security point.
- **Why not assert the response time to find enumeration by timing?** Functional environments are too noisy; use a security tool and review the code for an early return.
- **Can I reuse a TOTP code in two parallel tests?** Good servers refuse a second use in the same step. Give each worker its own user.
- **Why does \`expect\` appear in \`DirectoryPage\` although pages do not assert?** It waits for the page change (synchronisation); the verdict stays in the spec.`,
  keyPoints: [
    `Explain every module in one order: rules and risks, scenarios with level, Gherkin, UI code, API, database, synchronisation and failures, data, short answer.`,
    `Login is small in the UI (smoke, locked user, messages) and big in the API (refusal matrix, tokens, enumeration); all other tests get a seeded session.`,
    `Say what the application lacks: ShopEasy tokens never expire, there is no lockout, no product search box, no details page; report gaps instead of testing around them.`,
    `TOTP is computed, OTP goes to a test sink, CAPTCHA uses test keys, SSO gets one end-to-end check.`,
    `Break one rule per row and assert the reason (field, code); finish negative tests with "nothing changed" and read raw bodies for leaked or injected fields.`,
    `Search has matching, states and timing; the stale-answer race is made deterministic by delaying the first response and waiting for it before the last assertion.`,
    `Sorting and paging are invariants: own sorted copy including ties; all pages together equal the whole list; every item satisfies the filter.`,
    `Price consistency compares every screen with one truth, in BigDecimal or integer cents, and logs which layer is out of date.`,
  ],
  mistakes: [
    `Testing the login matrix through the browser, so the suite takes an hour and fails together with the login page. Fix: API rows for rules, one form scenario, seeded sessions; measure the time spent in preconditions.`,
    `Asserting only 200 for a filter or search. ShopEasy ignores unknown parameters and still answers 200 with everything. Fix: assert that every item satisfies the condition and that the count is the expected one.`,
    `Checking "no password in the response" on a typed, schema-stripped object; the schema removed the field, so the test can never fail. Fix: assert on the raw body or use a strict schema for that check.`,
    `Writing the no-stale-answer test without waiting for the late response: it passes before the bug can appear. Fix: keep the promise of the delayed response, await it, then assert again.`,
    `Locking a shared account in a lockout test and breaking forty other tests. Fix: create the user inside the test, and test the counter as a state machine including parallel failures.`,
    `Collecting prices with a page-wide .item-price selector; the promo banner adds a seventh price and the sort test fails. Fix: scope locators to the list (#inventory-list) and compare the number of prices with the number of cards.`,
  ],
  tryIt: `Use your \`tests-java\` and \`tests-pw\` projects from the enterprise framework lessons, with the shop and the API running. (1) Add \`ApiWorld\`, the registration feature and the paging test; run them with \`-Dcucumber.filter.tags="@registration"\` and confirm that no browser starts. (2) Add \`session.spec.ts\` and \`directory.spec.ts\`; run with \`--repeat-each=10\`. (3) In \`registration.spec.ts\` replace the raw-body check by \`expect(user).not.toHaveProperty("password")\` and explain why it can never fail. (4) Change one price in your local copy of \`shop.js\` and see which tests notice: oracle, drift check, or none. (5) Verify both TOTP helpers against the RFC value 287082. (6) Record yourself giving the five 60-second answers; each must name one risk, one level decision and one limit of the application.`,
  problems: ['int-009', 'int-013', 'int-015', 'int-008'],
}
