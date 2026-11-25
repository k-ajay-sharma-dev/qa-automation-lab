export default {
  slug: 'interview-deep-senior-technical-qa',
  category: 'interview',
  order: 12,
  title: `Deep dive: senior technical interview — cross-topic questions, system design, coding and debugging rounds`,
  minutes: 50,
  summary: `43 questions that cross tools: framework design on a whiteboard, Java and TypeScript depth, output prediction, diagnosis from logs, microservices, data, CI, non-functional and AI topics, two code reviews and nine verified coding tasks, with a revision index and 40 rapid-fire answers.`,
  manualAnalogy: `In a hard test session you do not recite the test plan; you look at an unfamiliar screen, decide what could go wrong, form a hypothesis and choose the one check that tells you most. A senior technical round is the same session with a whiteboard, a log file or an editor instead of a screen. The interviewer watches how you decide, not how many terms you know.`,
  body: `## How to use this lesson

Every other deep dive ends with its own interview questions. This lesson holds what those cannot: questions that cross tools, design rounds, diagnosis from logs, code review, output prediction and nine new coding tasks. The **revision index** near the end tells you which lesson to reopen for each topic.

Where an answer says *"In my project, [module] …"*, fill in your own facts and numbers. Do not borrow a story or a figure from here: the second follow-up question exposes it. The arithmetic below uses invented inputs to show the *method*.

| Round | What is really scored | Sections to rehearse |
|---|---|---|
| Framework design | clarifying, boundaries, trade-offs, failure modes | A, D, E |
| Language depth | can you predict behaviour, not recite definitions | B, C |
| Debugging | evidence before opinion | D |
| Coding | working code, tests, complexity, communication | J |
| Code review | priorities and tone, not a list of nitpicks | I |
| Architecture / lead | risk, cost, people | A, E, F, G, H |

## A. Framework design round

### Q: You have 45 minutes and an empty whiteboard. Design test automation for an e-commerce product from zero.

**Short answer (30–60 s):** I spend the first minutes on questions, because stack and layers follow from risk, team and release rhythm. Then I draw four layers — tests, domain (tasks, clients, pages), adapters (browser, HTTP, DB), platform (config, data, reports) — write one or two contracts, and spend the rest on data, parallelism, CI gates and what can fail. I finish by naming the weakest point and what I would postpone.

**Detailed answer:** run the board on a clock.

| Minute | Do | Say or draw |
|---|---|---|
| 0–7 | clarify | who writes tests, languages in the team, releases per week, browsers, number of services, who owns environments, what escaped to production lately |
| 7–10 | rank risks | pay, price, stock, login; three flows that must never break |
| 10–18 | layers | diagram below; the dependency arrow points down only |
| 18–26 | contracts | two interfaces and one test that reads like a specification |
| 26–32 | data + parallelism | each test owns its customer; unique ids; no global reset |
| 32–38 | CI gates | pull request, post-deploy smoke, nightly; time budget and owner for each |
| 38–42 | failure modes | flaky third party, environment down, slow feedback, secret in a log |
| 42–45 | close | weakest point, first two weeks, what I left out on purpose |

\`\`\`text
 tests        checkout.spec / CheckoutTest            (what is true)
   |
 domain       tasks, page and component objects, API clients, builders
   |
 adapters     browser session | HTTP client | SQL reader | mail sandbox
   |
 platform     typed config | identity + data | evidence | reporting
\`\`\`

The contract you write matters more than the number of boxes:

\`\`\`ts
export interface Identity { username: string; token: string }

export interface Customers {
  /** A customer nobody else uses; cleaned up by the fixture that created it. */
  fresh(): Promise<Identity>;
}

export interface Orders {
  place(as: Identity, lines: ReadonlyArray<{ productId: number; quantity: number }>): Promise<{ id: number; total: number }>;
}
\`\`\`

Why this is a good contract: a test can be written before the adapter exists, the adapter can change from REST to GraphQL without touching tests, and \`fresh()\` makes isolation the easy path. On ShopEasy \`fresh()\` maps to \`POST /api/users\` plus \`POST /api/auth/login\`, and \`place()\` to \`POST /api/orders\`.

| Choice | Option 1 | Option 2 | Recommendation |
|---|---|---|---|
| Stack | the developers' language | the testers' language | the language whose owners will *fix* tests; usually the developers' |
| Repository | with the product | separate | with the product when one team owns it; separate for cross-product journeys |
| Scope of v1 | broad, thin | three flows, all layers, in CI | three flows: proves the skeleton early |
| Business-readable layer | Gherkin | named test steps | Gherkin only when business people read or write it |

**Follow-up:** "What would you cut if I gave you two weeks?" Keep API tests for the three flows, two UI journeys, one gate and evidence on failure. Cut visual tests, the second browser, dashboards and the generic utilities.

**What the interviewer is checking:** whether you ask before drawing, whether arrows are consistent, and whether you can stop.

### Q: We have 1,500 Selenium tests. Management wants Playwright. How do you migrate?

**Short answer (30–60 s):** First I ask which problem we are paying for: slow feedback, flakiness, hiring or licence. Often half of it is test design, and a rewrite copies it. If the case holds, I freeze new Selenium tests, migrate by business capability, delete or push down tests on the way, and run both suites in one pipeline until the old one is empty. Success is measured per capability: duration, flake rate, maintenance hours.

**Detailed answer:**

| Approach | How | Advantage | Danger | Use when |
|---|---|---|---|---|
| Big bang | stop, rewrite, switch | one stack quickly | months without value; parity never proven | under roughly 100 tests |
| Line-by-line port | translate each test | easy to plan | imports sleeps, shared state and duplicates | almost never |
| **Strangler by capability** | new tests in Playwright; move the most painful capability first; delete the old one when parity is signed | value every sprint | two stacks for months, needs an end date | **default** |
| Improve what exists | API setup, isolation, explicit waits | cheapest | a genuine tool limit remains | cause is design, or real Safari, or Appium reuse |

Steps I would show: inventory (last failure that found a bug, duration, owner, flake rate) → delete tests nobody would miss → extract what is tool-neutral (builders, API clients, SQL, config) → pilot on one capability for two sprints with the team that will own it → decision with numbers → roll out with a per-capability exit checklist → remove the Grid when the last suite is gone. When languages differ, tool-neutral code has to be rewritten too, so put it in the estimate. \`pw-deep-enterprise-playwright-typescript\` and \`pw-playwright-vs-selenium\` compare the stacks.

**Follow-up:** "How do you prove parity?" Map risks, not test names: list the rules each old test checks, break each rule on purpose (a mutated response or a feature branch), and show the new suite turns red.

**What the interviewer is checking:** resistance to tool fashion, and whether you have an exit plan.

### Q: 5,000 tests take six hours. Give me feedback in 30 minutes.

**Short answer (30–60 s):** I calculate before I buy machines. Six hours on ten workers means about 43 s per test. Same tests in 30 minutes would need 120 perfectly used workers, around 160 in reality, and the environment would probably fail first. So: delete, push down, make setup cheap, then shard by duration.

**Detailed answer:** total work = 360 min × 10 workers × 60 = 216,000 worker-seconds.

| Step | Effect on the arithmetic (invented inputs) |
|---|---|
| as is | 216,000 ÷ 1,800 s = **120** workers ideal; ÷ 0.75 utilisation = **160** |
| move 2,500 rule checks to the API (1.5 s each) | 3,750 s of API work: three workers |
| API login and data for the remaining 2,500 UI tests: 43 → 25 s | 62,500 s |
| UI workers for 30 min | 62,500 ÷ 1,800 = 34.7; ÷ 0.75 = **47** |

Then three limits: the longest single test is the floor of the run; one unbalanced shard sets the total (task 1 in section J balances them); the environment and third parties must survive 47 sessions, so watch its CPU, connection pool and 429 responses before scaling further. Finally split *when* tests run: not everything has to be inside the 30 minutes. A pull request gets the affected tests and the critical journeys; the full set runs after merge.

**Follow-up:** "Management says just use a cloud grid." It removes *our* machines from the limit, not the environment, and 216,000 worker-seconds are still paid for on every run.

### Q: One code base serves eight brands in different countries. How do you design the tests?

**Short answer (30–60 s):** I separate *what is the same* (behaviour) from *what varies* (theme, texts, tax, payment methods, features). Behaviour is tested once on a reference brand; variation is data in a typed brand profile and gets its own small, data-driven checks. I do not run everything × 8, and I do not write \`if (brand === "X")\` in tests.

**Detailed answer:**

\`\`\`ts
type Capability = 'giftCard' | 'cashOnDelivery' | 'loyalty';

interface BrandProfile {
  readonly id: string;
  readonly baseURL: string;
  readonly locale: string;                 // 'de-DE'
  readonly currency: string;               // 'EUR'
  readonly taxRate: string;                // decimal as text, never a float
  readonly capabilities: ReadonlySet<Capability>;
}
\`\`\`

| Approach | Advantages | Disadvantages | Use when |
|---|---|---|---|
| copy of the suite per brand | total freedom | eight diverging suites | never by choice |
| \`if (brand)\` in tests | quick | unreadable, untested branches | never |
| full matrix, same tests × 8 | simple | 8× cost, same bug reported 8× | short smoke only |
| **reference brand + capability tags + pairwise for variation** | cost follows risk | needs an honest capability list | **recommended** |

A test declares \`needs: ['giftCard']\`; the runner skips brands without it and *reports* the skip, with a minimum count per brand so that a wrong profile cannot silently skip everything. Tenant isolation is a security risk of its own: a customer of brand A must not log in to, read or price through brand B. Those negative tests run at API level for every pair of neighbouring tenants.

**What the interviewer is checking:** variation as data, and whether you think of cross-tenant leakage without being asked.

### Q: How would you cover web, API and mobile with one framework?

**Short answer (30–60 s):** I share the domain and the platform, not the UI layer. Data builders, API clients, config, reporting and naming of business tasks are common; web pages and mobile screens are separate, because gestures, permissions, deep links and app lifecycle have no web equivalent. One *driver abstraction over both* is the idea I argue against.

**Detailed answer:**

| Share | Keep apart |
|---|---|
| builders, API clients, accounts, SQL readers | page objects and screen objects |
| business vocabulary: \`signIn\`, \`placeOrder\` | waits, gestures, context switching |
| config, evidence, reports, tags | capabilities, device pool, app build distribution |
| expected results | navigation (back button, deep link, push) |

Level choice: rules at the API, mobile-only risks on a few real devices (permissions, offline, upgrade from the previous app version, interruption, OS text size), and the same three business journeys on each channel. Interfaces per task (\`SignIn\` with \`WebSignIn\` and \`AppSignIn\`) are enough for those three; Screenplay suits this well (\`pom-deep-screenplay-pattern\`).

**Follow-up:** "Emulator or real device?" Emulators for logic on every pull request, real devices nightly for camera, biometrics, performance and vendor skins. Mobile web in a desktop browser's emulation is neither: it checks layout and touch events, not iOS Safari.

### Q: How do you know your framework is not lying to you? Who tests the tests?

**Short answer (30–60 s):** A green suite proves nothing until I have seen it red for the right reason. I check three things: can each important test fail, does the framework report failures honestly, and did everything that should run actually run.

**Detailed answer:**

* **Can it fail?** Seeded faults: a proxy or mocked response that changes the total by a cent, drops an item, returns 500. At unit level, mutation testing (PIT for Java, Stryker for JS/TS). Code coverage says a line ran, not that anything checked it.
* **Honest reporting:** unit tests for parsers, retry, config and custom matchers; a deliberately failing test in the framework's own pipeline must produce a red job, a screenshot and a message a stranger understands.
* **Completeness:** minimum number of executed tests per job, skipped and quarantined counts on the report, an alert when a tag selects zero tests.

**Follow-up:** "Isn't that testing the test of the test?" Stop where the cost of being wrong is small. The total calculator used by 300 tests deserves unit tests; a page object does not.

## B. Java and TypeScript depth that crosses tools

### Q: Which objects in a test framework may be shared between threads?

**Short answer (30–60 s):** Immutable ones and those documented as thread-safe. The rest is confined: one per thread, per test or per call. I decide by documentation, not by "it never failed".

**Detailed answer:**

| Object | Share? | Why / what instead |
|---|---|---|
| records with immutable fields, \`String\`, \`BigDecimal\` | yes | nothing can change |
| \`java.util.regex.Pattern\` / \`Matcher\` | yes / **no** | pattern immutable; matcher holds position |
| \`DateTimeFormatter\` / \`SimpleDateFormat\` | yes / **no** | the old one keeps a mutable calendar: wrong dates, not always exceptions |
| Jackson \`ObjectMapper\` | yes, after configuration | reconfiguring it while in use is unsafe |
| \`HttpClient\` (JDK), HikariCP pool | yes | built for it; a JDBC \`Connection\` is not meant to be shared |
| \`WebDriver\`, \`WebElement\`, \`Actions\` | **no** | one session, one command stream |
| REST Assured static defaults | **no** | process-wide mutable state; build one specification per call site |
| Playwright \`Browser\` / \`Page\` in TypeScript | within its worker | workers are processes, so test code cannot share memory across them |

Subtle one: \`ConcurrentHashMap\` makes each call atomic, not your sequence. \`if (!map.containsKey(u)) map.put(u, login(u))\` still logs in twice; \`computeIfAbsent(u, this::login)\` does not — and holds a bin lock while it logs in, so keep the function short or store a future. Processes protect memory, not *data*: two Playwright workers can still fight over one customer.

### Q: A list comparison in a test fails although both lists print the same. Why?

**Short answer (30–60 s):** Printing uses \`toString\`, comparing uses \`equals\`. Typical causes: \`BigDecimal\` with different scale, a class without \`equals\`, an array inside a record, invisible characters, or a different element type.

**Detailed answer:** this runs on Java 17; the comments are the real output.

\`\`\`java
import java.math.BigDecimal;
import java.util.*;

public class SamePrintDifferentEquals {
    record Line(String name, BigDecimal price) { }
    record Tagged(String name, String[] tags) { }

    public static void main(String[] args) {
        Line ui = new Line("Backpack", new BigDecimal("29.9"));
        Line api = new Line("Backpack", new BigDecimal("29.90"));
        System.out.println(ui.equals(api));                                                   // false
        System.out.println(ui.price().compareTo(api.price()));                                // 0
        System.out.println(new HashSet<>(List.of(ui.price(), api.price())).size());           // 2
        System.out.println(new TreeSet<>(List.of(ui.price(), api.price())).size());           // 1
        System.out.println(new Tagged("a", new String[]{"x"}).equals(new Tagged("a", new String[]{"x"}))); // false
        System.out.println("Storm Fleece".equals("Storm Fleece"));                       // false
        System.out.println(List.of(1, 2).equals(List.of(1L, 2L)));                            // false
    }
}
\`\`\`

Fixes: normalise scale in the record's compact constructor, or compare with a comparator (AssertJ \`usingRecursiveComparison().withComparatorForType(BigDecimal::compareTo, BigDecimal.class)\`); use \`List\` instead of arrays in records; normalise non-breaking spaces at the boundary where UI text enters the framework. In TypeScript the same question has another answer: \`toBe\` is identity, \`toEqual\` ignores \`undefined\` properties and types of classes, \`toStrictEqual\` does not.

### Q: Where do generics help page objects, and where do they hurt?

**Short answer (30–60 s):** They help when they remove a cast or make a wrong call uncompilable: a fluent base class that returns the concrete page, a wait that returns the condition's type, a table that returns typed rows. They hurt when the type parameter appears in five signatures only to save three lines.

**Detailed answer:**

\`\`\`java
import java.util.function.*;

public class FluentPages {
    static abstract class BasePage<T extends BasePage<T>> {
        protected abstract T self();
        T open() { System.out.println("open " + getClass().getSimpleName()); return self(); }
        <R> R read(String what, Supplier<R> reader) {
            R value = reader.get();
            System.out.println(what + "=" + value);
            return value;
        }
    }
    static final class CartPage extends BasePage<CartPage> {
        @Override protected CartPage self() { return this; }
        CartPage remove(String slug) { System.out.println("remove " + slug); return this; }
    }
    public static void main(String[] args) {
        int rows = new CartPage().open().remove("junior-onesie").read("rows", () -> 2);
        System.out.println(rows + 1);
    }
}
\`\`\`

\`open()\` returns \`CartPage\`, so \`remove\` is available without a cast. Erasure sets the limits: no \`new T()\`, no \`T.class\`, no overload on \`List<Row>\` versus \`List<Product>\`, so you pass a factory (\`Function<WebElement, T>\`) instead of reflecting. TypeScript needs none of the self-type ceremony: a method declared \`open(): this\` (or \`Promise<this>\`) is polymorphic, and constructors can be passed as \`new (page: Page) => T\`.

**Follow-up:** "Does \`@SuppressWarnings("unchecked")\` worry you?" In one private method with a comment that says why it is safe, no. At class level, yes.

### Q: An assertion in TypeScript passes although the filter should have returned nothing. What is wrong?

**Short answer (30–60 s):** An async callback was given to a function that does not await. \`filter(async …)\` receives promises, every promise is truthy, so nothing is filtered. The compiler accepts it because a \`filter\` predicate may return anything; recent versions of typed lint (\`no-misused-promises\`) catch it.

**Detailed answer:**

\`\`\`ts
const prices: number[] = [5, 15, 25];
const isExpensive = async (p: number): Promise<boolean> => p > 10;

const wrong = prices.filter(async (p) => isExpensive(p));
console.log(wrong.length);                                   // 3

const flags = await Promise.all(prices.map(isExpensive));    // resolve first
const right = prices.filter((_, i) => flags[i]);
console.log(right);                                          // [ 15, 25 ]
\`\`\`

The same family: \`array.some(async …)\` is always true for a non-empty array, \`sort(async …)\` compares promises, \`forEach(async …)\` returns before the work, and \`if (isLoggedIn())\` with a forgotten \`await\` is always true (here TypeScript does complain with \`strictNullChecks\`, when the promise is not otherwise used). The promise mechanics are in \`pw-deep-async-await-and-promises\`.

### Q: How do you stop tests from reading \`body.total\` of an error response?

**Short answer (30–60 s):** With a discriminated union. The result is either \`{ok: true, body}\` or \`{ok: false, error}\`, so the compiler forces a check before either is used. \`as Order\` only silences the compiler; nothing is verified at runtime.

**Detailed answer:**

\`\`\`ts
type ApiError = { code: string; message: string };
type ApiResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: ApiError };

function unwrap<T>(r: ApiResult<T>): T {
  if (r.ok) return r.body;                       // narrowed to the success branch
  throw new Error(\`\${r.status} \${r.error.code}: \${r.error.message}\`);
}

type Outcome = 'placed' | 'declined' | 'pending';
function badge(o: Outcome): string {
  switch (o) {
    case 'placed': return 'green';
    case 'declined': return 'red';
    case 'pending': return 'amber';
    default: { const never: never = o; return never; }   // a new outcome breaks the build here
  }
}

const placeEmptyOrder = (): ApiResult<{ total: number }> =>
  ({ ok: false, status: 422, error: { code: 'EMPTY_CART', message: 'Cannot place an order with no items' } });
try { console.log(unwrap(placeEmptyOrder()).total); } catch (e) { console.log((e as Error).message); }
console.log(badge('pending'));
\`\`\`

The Java 17 equivalent is a \`sealed interface\` with two records; exhaustive \`switch\` over it is final in Java 21 (\`java-deep-modern-java-9-to-21\`). **What the interviewer is checking:** whether you know the boundary: types describe what you *hope* the server sent; only a schema check at the edge verifies it.

## C. Predict the output

### Q: What does this Java program print, and where would it bite a tester?

Cover the right-hand comments first. Verified on Java 17.

\`\`\`java
import java.util.*;

public class Predict {
    public static void main(String[] args) {
        List<Integer> ids = new ArrayList<>(List.of(10, 20, 30, 1));
        ids.remove(1);
        ids.remove(Integer.valueOf(1));
        System.out.println(ids);                                             // [10, 30]
        System.out.println(true ? 1 : 2.0);                                  // 1.0
        System.out.println('1' + 1 + "1");                                   // 501
        System.out.println("a,,b,,".split(",").length + " " + "".split(",").length);  // 3 1
        System.out.println("$29.99".replaceAll("$", ""));                    // $29.99
        Map<String, Integer> stock = new HashMap<>();
        stock.put("tee", null);
        System.out.println(stock.getOrDefault("tee", 0));                    // null
        int[] total = {0};
        try { total[0] = 1; throw new IllegalStateException("x"); }
        catch (IllegalStateException e) { total[0] += 10; }
        finally { total[0] += 100; }
        System.out.println(total[0]);                                        // 111
        System.out.println(List.of("b", "a").stream().sorted().toList() + " " + Objects.equals(1, 1L));  // [a, b] false
    }
}
\`\`\`

**Short answer (30–60 s):** \`remove(int)\` removes by index, \`remove(Object)\` by value. Mixed numeric branches of \`?:\` are promoted. A \`char\` plus an \`int\` is arithmetic until a \`String\` appears. \`split\` drops trailing empty strings but returns one empty string for empty input. \`replaceAll\` takes a regex, where \`$\` is "end". \`getOrDefault\` returns the stored \`null\`. \`Objects.equals(1, 1L)\` compares \`Integer\` with \`Long\`.

**Detailed answer:** testing impact: price parsing that silently keeps the \`$\` (use \`replace\` or escape), CSV rows with empty last columns that become shorter (use \`split(",", -1)\`), JDBC \`Long\` compared with an \`Integer\` literal that can never match, and a "default 0" that is null and then fails on unboxing far from the cause.

### Q: What does this TypeScript print in Node, and which tests would it corrupt?

\`\`\`ts
console.log([10, 9, 1].sort());                                  // [ 1, 10, 9 ]
console.log(['1', '2', '3'].map((s, i) => parseInt(s, i)));      // [ 1, NaN, NaN ]
console.log((1.005).toFixed(2), 0.1 + 0.2 === 0.3);              // 1.00 false
console.log(JSON.stringify({ a: undefined, b: NaN, c: new Map([['k', 1]]), d: [undefined] }));  // {"b":null,"c":{},"d":[null]}
const qty: number = 0;
console.log(qty || 5, qty ?? 5);                                 // 5 0
console.log('🎒'.length, [...'🎒'].length);                      // 2 1
const base = { user: { name: 'Asha' } };
const copy = { ...base };
copy.user.name = 'Vera';
console.log(base.user.name);                                     // Vera
setTimeout(() => console.log('timer'), 0);
Promise.resolve().then(() => console.log('microtask'));
(async () => { console.log('sync part'); await null; console.log('after await'); })();
console.log('end');                                              // sync part, end, microtask, after await, timer
\`\`\`

**Short answer (30–60 s):** \`sort\` without a comparator compares strings. \`map\` passes the index as second argument, which becomes the radix. Binary fractions are not exact, so money is compared in minor units or as text. \`JSON.stringify\` drops \`undefined\` in objects, turns \`NaN\` into \`null\` and a \`Map\` into \`{}\`. \`||\` replaces zero, \`??\` does not. \`length\` counts UTF-16 units. Spread copies one level. Microtasks run before timers.

**Detailed answer:** testing impact: a "sorted by price" check on \`[9.99, 49.99, 7.99]\` that uses bare \`sort()\` can agree with a wrong page; a request body that loses a field because the builder set \`undefined\`, so "null is rejected" was never tested; a length limit of 20 that a customer with emoji hits at 10; a shared builder default changed by one test and seen by the next.

## D. Diagnose from the log

The logs below are shortened illustrations. Method for all of them: **what is fact, what is inference, which one observation would separate the two best hypotheses?** Say that sentence before you propose a fix. The full workflow is in \`selenium-deep-troubleshooting-flaky-tests\` and \`pw-deep-reporting-debugging\`.

### Q: Log 1 — Playwright. Product bug or test bug?

\`\`\`text
Error: expect(locator).toHaveText(expected) failed
Locator:  getByTestId('order-status')
Expected: "Completed"
Received: "Processing"
Timeout:  3000ms
Call log:
  - Expect "toHaveText" with timeout 3000ms
  - waiting for getByTestId('order-status')
    4 × locator resolved to <strong id="order-status" data-testid="order-status">Pending</strong>
      - unexpected value "Pending"
    3 × locator resolved to <strong id="order-status" data-testid="order-status">Processing</strong>
      - unexpected value "Processing"
\`\`\`

**Short answer (30–60 s):** The locator is right and the state machine moves: Pending, then Processing. The assertion's budget ended first. On ShopEasy's \`waits.html\` the status needs about four seconds and the budget was three. Whether it is a *product* bug depends on the requirement for that duration.

**Detailed answer:** if four seconds is acceptable, raise the timeout for **this** assertion (\`toHaveText('Completed', { timeout: 10_000 })\`), not globally: a global raise makes every genuine failure slower. If the requirement says three seconds, the test found a defect; report the measured distribution, not one run. Do not assert the intermediate states unless they are a requirement: "Processing" may be too short to observe.

**What the interviewer is checking:** that you read the call log from top to bottom instead of saying "add a wait".

### Q: Log 2 — an API test with automatic retry. Why 409?

\`\`\`text
attempt 1  POST /api/cart/items {"productId":2}   java.net.SocketTimeoutException: Read timed out (after 2000 ms)
attempt 2  POST /api/cart/items {"productId":2}   409 ITEM_ALREADY_IN_CART
java.lang.AssertionError: Expected status code <201> but was <409>.
\`\`\`

**Short answer (30–60 s):** A *read* timeout says nothing about whether the server did the work. It did; the retry repeated a non-idempotent call. Our retry turned a slow answer into a wrong conclusion.

**Detailed answer:** evidence to ask for: the server log for attempt 1 (ShopEasy returns an \`X-Request-Id\` per request, and its log line shows status and duration) and a \`GET /api/cart\`. Fixes: retry only connection failures and idempotent methods; after an unknown outcome *query the state*; use an idempotency key where the product supports one. Then ask why it took two seconds. In a real client, not only in a test, this same retry creates the second order.

### Q: Log 3 — passes in the morning, fails at night.

\`\`\`text
expected: "Delivery by 2026-03-29"   but was: "Delivery by 2026-03-28"
CI agent TZ=UTC, started 2026-03-25T19:40:11Z ; developer laptop TZ=Asia/Kolkata
Expected value built by:  LocalDate.now().plusDays(3).format(ISO_LOCAL_DATE)
\`\`\`

**Short answer (30–60 s):** Look at *which side* computed the date. One side takes the date in the machine's zone, the other in the shop's zone. Between 18:30 and 24:00 UTC, India is already on the next day, so the two disagree for five and a half hours a day.

**Detailed answer:** here the log is inconsistent with a naive reading, and saying so earns points: an agent in UTC at 19:40Z computes 28 March, yet the *expected* value is the 29th. Two explanations fit. Either the JVM's zone is overridden (\`-Duser.timezone=Asia/Kolkata\` in the build) and the page shows UTC, or the arguments of the assertion are **swapped** (TestNG is \`actual, expected\`; JUnit is the reverse), so that the "expected" 29th is really the page. One observation separates them: print \`ZoneId.systemDefault()\` and the page text. Fix: decide which zone is the **requirement** (usually the store's), inject a \`Clock\` (\`LocalDate.now(clock)\`), and set the browser's zone explicitly (\`timezoneId\` in Playwright). Add cases for both sides of midnight and for the daylight-saving weekend, instead of only making the night run pass.

### Q: Log 4 — the pipeline is green. Why are you unhappy?

\`\`\`text
[INFO] --- surefire:test (default-test) @ shop-e2e ---
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS            Total time: 6.412 s
\`\`\`

**Short answer (30–60 s):** Zero tests ran. A renamed group, a tag typo, a class pattern that no longer matches or the wrong suite file gives a green build that checked nothing.

**Detailed answer:** compare with the last good run: count, command line, changed files. Prevent: a minimum executed-test count per stage and an alert on a sudden drop. Surefire's \`failIfNoTests\` can help for some cases, but a run with 3 tests instead of 300 passes it, so the count check is the real guard (\`framework-deep-jenkins-ci-cd-pipelines\` shows one).

### Q: Log 5 — click timeout. Which layer would you blame first?

\`\`\`text
locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Finish' })
    - locator resolved to <button id="finish" data-testid="finish" class="btn btn-primary">Finish</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="consent-overlay">…</div> intercepts pointer events
  - retrying click action
    - waiting 20ms
\`\`\`

**Short answer (30–60 s):** The button is fine; something is on top of it. (Typical real app: ShopEasy has no consent overlay.) First question: would a *user* be blocked too? A cookie dialog that appears once per fresh profile is expected, so the test must handle the state in setup. An overlay that never disappears is a product defect.

**Detailed answer:** \`force: true\` or a JavaScript click hides both cases, and the click then does something no user can do. Options: store consent before the test (cookie or \`storageState\`), dismiss it in a fixture, or register \`page.addLocatorHandler\` for an overlay that may appear at any moment. In Selenium the same situation is \`ElementClickInterceptedException\`, whose message names the element that would receive the click. Read that name before changing anything.

## E. API, microservices and events

### Q: 25 services are deployed independently. What replaces the big end-to-end environment?

**Short answer (30–60 s):** Most confidence moves to the service's own pipeline: component tests with stubbed neighbours and a real database, plus contract tests that keep the stubs honest. A handful of journeys remain in an integrated environment or run as synthetic checks in production. Shared end-to-end as a release gate does not scale: any of 25 versions can turn it red for everybody.

**Detailed answer:**

| Technique | Finds | Misses | Cost |
|---|---|---|---|
| unit | logic | wiring | lowest |
| component (service + real DB, stubbed neighbours) | API rules, persistence, failure handling | wrong assumptions about neighbours | low |
| consumer-driven contracts | broken assumptions per pair | behaviour across three services | medium; needs discipline |
| ephemeral environment per change | wiring, config | production data and scale | money, start-up time |
| shared staging journeys | cross-service flow | determinism; blames the wrong team | high |
| canary + synthetic monitoring | reality | needs rollback and good alerts | operational maturity |

**Recommended:** component + contracts as gates, 5–10 journeys non-blocking for a single service but blocking for the journey's owner, canary with automatic rollback. Pact mechanics are in \`restassured-deep-advanced-api-testing\`. **Follow-up:** "Who owns a red journey?" The team whose last change correlates, found through the trace id; without tracing you get meetings instead.

### Q: How do you test a flow that communicates through events?

**Short answer (30–60 s):** I test the *producer* (right event, right schema, only after commit), the *consumer* (same event twice, out of order, invalid, old version) and the *journey* (eventually consistent, with a deadline). I never assert "immediately", and I prove absence with a bounded wait plus a marker event.

**Detailed answer:** typical real app; ShopEasy has no broker.

| Risk | Test |
|---|---|
| duplicate delivery (at-least-once) | send the same event id twice: one refund, one mail |
| wrong order | \`OrderCancelled\` before \`OrderPlaced\`: parked or rejected, never lost |
| poison message | invalid payload goes to the dead-letter queue, the next message is processed |
| DB commit without event, or the reverse | kill between both steps (component test); outbox pattern expected |
| schema change | old consumer reads the new event, new consumer reads the old one |
| replay | rebuild the read model from history; totals equal |
| nothing should happen | send the event, then a *marker* you can observe; when the marker's effect is visible, the first event must have had no effect (same partition, so order holds) |

Consume in tests with a *unique consumer group* and a filter on your correlation id; a shared group steals messages from the application or from another test.

### Q: A team says their API change is backward compatible. How do you judge that?

**Short answer (30–60 s):** Compatible means *for existing callers*, not "the schema validator is happy". I check requests (accepts everything it accepted before), responses (still sends everything readers use) and behaviour (same meaning, errors, order, limits).

**Detailed answer:**

| Change | Safe? | Why |
|---|---|---|
| new optional request field | yes | old callers omit it |
| new required request field, stricter validation | **no** | old calls fail |
| new response field | usually | breaks strict readers (\`additionalProperties: false\`, failing on unknown properties) |
| new enum value in a response | **often no** | old \`switch\` has no branch |
| removed or renamed field, number → string | **no** | |
| default page size 50 → 20, other sort order | **no** | same schema, different behaviour |
| 200 → 202, other error code | **no** | callers branch on it |

ShopEasy's product schema forbids additional properties: adding one field would break a test that validates strictly, which is right for a *provider* test and wrong for a *consumer*. Automate with an OpenAPI diff in the pull request, run the **previous** version's test suite against the new build, and let contracts answer "who really uses it".

## F. Database and data

### Q: May we use a copy of production data in the test environment?

**Short answer (30–60 s):** Not as it is. It is personal data in a less protected place, and its content is uncontrolled, which makes poor expected results. I use synthetic data for functional tests, and a masked subset for volume, migration and "strange data" questions, with the privacy owner's approval.

**Detailed answer:**

| Source | Realism | Privacy risk | Determinism | Use |
|---|---|---|---|---|
| raw copy | highest | unacceptable by default | low | – |
| masked copy | high | residual: re-identification through combinations | low | performance, migration |
| masked subset | medium | lower | medium | exploratory, migration rehearsal |
| **synthetic through APIs** | as good as our imagination | none | high | **default for automation** |

Masking must be consistent (the same customer masks to the same value everywhere, or joins break), irreversible and complete, including free-text notes, logs, file uploads and backups. A useful habit: analyse production *shapes* (longest name, null ratios, odd characters, oldest rows) and add those shapes to the synthetic builders.

### Q: A column is renamed with zero downtime. What do you test?

**Short answer (30–60 s):** That old and new application versions work at the same time on every intermediate schema. The safe pattern is expand, migrate, contract: add the new column, write both, backfill, switch reads, stop writing the old one, remove it. Each arrow is a test point and must be reversible.

**Detailed answer:** matrix per phase: *old app, new app* × *read, write* × *rows written before, during and after the backfill*. Checks: counts and sums before and after; rows changed **during** the backfill not overwritten by stale values; \`NULL\` and default rows; lock duration on a realistic volume (an \`ALTER\` that rewrites a table is an outage); rollback of the application without rollback of the schema; reports and jobs that read the table without going through the application. SQL techniques for the two-way difference are in \`restassured-deep-sql-for-testers\` and \`restassured-deep-database-testing-jdbc\`.

**What the interviewer is checking:** whether you think about *mixed versions*, the state in which most deployment incidents happen.

## G. CI/CD and cloud

### Q: Which tests run on a pull request?

**Short answer (30–60 s):** The set that gives the best chance of finding *this change's* defect within the time people are willing to wait, usually ten to fifteen minutes. Everything else runs after merge with a fast way back.

**Detailed answer:**

| Selection | Advantage | Danger | Use |
|---|---|---|---|
| everything | simple, complete | slow; people batch changes | small suites |
| fixed smoke tag | predictable | tag grows; blind to the change | always, as the base |
| path mapping (\`/checkout/**\` → \`@checkout\`) | cheap, explainable | mapping rots; shared code | good second step |
| coverage-based impact analysis | precise | instrumentation, blind to config, data and CSS | mature teams |
| ranked by failure history or a model | finds failures early | favours yesterday's failures; opaque | large suites, only for *ordering* |

**Recommended:** smoke + path mapping + tests changed in the same pull request; always everything on changes to shared libraries, build files and pipelines; full suite after merge and nightly, so a selection mistake is found within a day. Track "found after merge, would have been found by the full suite": it is the price of selection, and it should be a number, not a feeling.

### Q: The product has 60 feature flags. How do you test combinations?

**Short answer (30–60 s):** Not 2^60. Flags that cannot interact are tested separately; flags on the same flow are combined pairwise; only two global states always run: *exactly production today* and *production with the next flag on*. Tests set flags themselves, per user or per request, never by clicking in a shared console.

**Detailed answer:** for each flag: off works, on works, **toggling while a cart exists** works, and the default when the flag service is down is safe. A flag override through header, cookie or test API keeps parallel tests independent; a global switch breaks isolation. Every flag has an owner and a removal date, and the tests of the losing branch are deleted with it. Canary is the natural extension: on for 1 %, compare error rate and conversion with the control group, automatic stop.

### Q: Tests that pass locally fail in short-lived Kubernetes environments. What do you suspect?

**Short answer (30–60 s):** *Ready* is not *warm*, and *deployed* is not *consistent*. I suspect start-up order, missing seed data, resource limits, DNS/TLS for new host names and third-party allow-lists, roughly in this order.

**Detailed answer:** gate on a business readiness check (can log in, can read a product), not on "pod is Running". CPU limits throttle rather than kill, so timeouts appear under load; memory limits kill with exit code 137, which looks like a lost browser. Cookies and CORS depend on host names; sandboxes of payment providers often allow only registered URLs. Ask for logs to be collected **before** the namespace is destroyed, otherwise every failure is unexplainable. Cost control: time-to-live on every environment, smaller data, and one shared instance of heavy, stateless dependencies.

## H. Performance, security, accessibility — and AI

### Q: A load-test report says "average 400 ms, 0.2 % errors, pass". What do you ask?

**Short answer (30–60 s):** Which percentile, at what arrival rate, for how long, with which data, and was the generator the bottleneck? An average hides the tail that customers feel. I want p95 and p99 per transaction, throughput, error rate *by type*, and saturation of the system.

**Detailed answer:** **Little's law**: concurrency = throughput × response time. 50 orders per second at 0.4 s are 20 requests in flight; a report with 500 "users" and the same throughput has mostly measured think time. *Closed* models (fixed users) slow down when the system slows down and so hide overload; *open* models (fixed arrival rate) show the queue. Load = expected peak, stress = beyond it until something breaks, spike = sudden, soak = hours, for leaks. Cached data, one customer id and an empty database make any system fast. Errors often answer faster than successes, so report them apart. For an SDET in functional automation: keep a smoke load in the pipeline to see *changes*, and leave capacity statements to a controlled environment.

### Q: What can automation say about accessibility?

**Short answer (30–60 s):** It can find a useful part of the problems — missing names, contrast, invalid ARIA, missing language — and it can guard keyboard journeys we script ourselves. It cannot say the product is accessible. Whether an alternative text is meaningful or the reading order makes sense needs a person, ideally one using assistive technology.

**Detailed answer:** three layers: a rule engine on key pages and states, scripted keyboard tests (Tab order, focus returns after a dialog closes, Escape works), manual screen-reader sessions per release of important flows.

\`\`\`ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('login error state has no detectable WCAG A/AA violations', async ({ page }) => {
  await page.goto('/practice-site/login.html');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('alert')).toBeVisible();               // scan the state, not only the page
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => \`\${v.id}: \${v.nodes.length}\`)).toEqual([]);
});
\`\`\`

For an old product, record the existing violations as a baseline and fail only on new ones, with a date to empty it. Role-based locators help twice: a control that \`getByRole\` cannot find often has a problem for a screen reader too.

### Q: Where does security testing sit in your pipeline, and where do you stop?

**Short answer (30–60 s):** I own authorisation and input-validation tests at API level, and I make sure scanners run and somebody reads them. I do not claim to replace a penetration test.

**Detailed answer:**

| Check | When | Owner | Typical mistake |
|---|---|---|---|
| secret scanning | commit / pull request | team | finding removed, secret not rotated |
| dependency scan (SCA) | pull request + daily | team | hundreds of findings without reachability or priority |
| static analysis (SAST) | pull request | developers | ignored false positives |
| **role × resource matrix, object ownership** | API regression | **SDET** | only "401 without token" is tested |
| dynamic scan (DAST) | nightly on a disposable environment | security + SDET | scanning shared data, no login |
| penetration test | before major releases | specialists | once a year, no retest |

On ShopEasy the ownership rule is concrete: customer A reading B's order gets 403 \`FORBIDDEN\`; an unauthenticated call gets 401. Attacks on systems you have no written permission for are never an exercise. More: \`restassured-deep-auth-security-testing\`.

### Q: Would you switch on self-healing locators?

**Short answer (30–60 s):** For suggestions, yes; for silently passing a build, no. A healed locator is a guess that another element means the same. I want the test reported as *healed*, with old and new locator, and a reviewed change in the code. The bigger win is usually stable test ids agreed with developers.

**Detailed answer:**

| Approach | Advantages | Risks | Recommendation |
|---|---|---|---|
| test ids / roles as a team contract | deterministic, free | needs agreement | **first choice** |
| healing at run time, test stays green | fewer red builds | clicks the wrong "Remove"; hides real UI defects; slow | only outside gates, always reported |
| healing as a proposed pull request | human decision, code improves | review effort; rubber-stamping | good |
| computer-vision or agent clicks | works on canvas, remote desktops | non-deterministic, cost per run, data leaves the company | niche |

What exists moves fast, so treat this as *status late 2026, check the documentation*: Selenium has no built-in healing (libraries such as Healenium add it); Playwright ships *test agents* (planner, generator, healer) initialised with \`npx playwright init-agents\`, and its documentation notes that the healer may mark a test as **skipped** when it concludes that the functionality is broken. So a "healed" run still needs a look at skips. ShopEasy makes a good thought experiment: on \`cart.html\` all remove buttons are called "Remove". A heuristic that loses \`remove-junior-onesie\` and picks the nearest "Remove" deletes the wrong product and goes green.

### Q: An AI assistant wrote 40 tests overnight. How do you review them?

**Short answer (30–60 s):** As code from a fast junior who has never seen our requirements. My first question per test: *which rule does it check, and does it go red when that rule is broken?* Generated tests often describe what the application **does**, including its bugs.

**Detailed answer:** checklist: expected values come from a requirement and not from observed output; negative and boundary cases exist; assertions are not just "is visible"; data is owned and cleaned; locators follow our policy; no invented API or config key; no duplicate of an existing test; no secret or customer data went into the prompt. Seed two or three faults and count how many tests notice. Where assistance pays off: boilerplate, builders, converting a tested pattern to 15 cases, log summaries, first drafts of test ideas. Where it does not decide: risk, expected result, go/no-go. Company policy on which tools may see the code comes before all of this.

**Follow-up:** "Will it replace testers?" A balanced answer: it lowers the price of writing a test, so the valuable part moves to choosing what to check and judging the result. Support it with something you have really tried: *"In my project, [module], I used [tool] for [task]; it saved [x] and I had to correct [y]."*

### Q: The shop adds an AI assistant that answers customers. How do you test something non-deterministic?

**Short answer (30–60 s):** I separate the deterministic shell from the model. The shell — permissions, prices from the API, rate limits, logging, fallback — gets normal tests with the model stubbed. The model's answers are evaluated on a versioned data set with thresholds, not exact text, and safety rules are hard gates.

**Detailed answer:** properties instead of strings: mentions the correct price from the catalogue, cites an existing product, refuses another customer's order, answers in the customer's language, never promises a discount. Run each case several times and gate on a rate ("≥ 98 % correct price on 500 cases; 0 data leaks"); one leak is a failure even at 99.9 %. Prompt injection belongs in the set: a product review that says "ignore your rules". A model used as a *judge* is itself to be validated against human labels. Re-run on every model or prompt version, because both are releases. Costs and latency are part of the acceptance criteria.

## I. Code review round

### Q: Review this Java test. What would you say, in which order?

\`\`\`java
public class CheckoutTest {
    static WebDriver driver;

    @BeforeClass
    public void setup() {
        driver = new ChromeDriver();
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(20));
    }

    @Test(priority = 1)
    public void login() throws Exception {
        driver.get("http://localhost:5180/practice-site/login.html");
        driver.findElement(By.xpath("//form/div[2]/input")).sendKeys("standard_user");
        driver.findElement(By.id("password")).sendKeys("secret_sauce");
        driver.findElement(By.id("login-button")).click();
        Thread.sleep(3000);
    }

    @Test(priority = 2)
    public void total() {
        try {
            driver.findElement(By.id("add-to-cart-trailblazer-backpack")).click();
            driver.get("http://localhost:5180/practice-site/checkout.html");
            driver.findElement(By.id("first-name")).sendKeys("A");
            driver.findElement(By.id("last-name")).sendKeys("B");
            driver.findElement(By.id("postal-code")).sendKeys("12345");
            driver.findElement(By.id("continue")).click();
            String text = driver.findElement(By.id("summary-total")).getText();
            Assert.assertTrue(Double.parseDouble(text.replace("$", "")) == 29.99 * 1.08);
        } catch (Exception e) {
            System.out.println("checkout failed");
        }
    }
}
\`\`\`

**Short answer (30–60 s):** First correctness: the test can pass when checkout is broken, and fails when it is right. Then independence, then stability, then style. I would say the first two in the review and offer to pair on the rest.

**Detailed answer:**

| # | Problem | Severity | Consequence |
|---|---|---|---|
| 1 | \`catch (Exception)\` prints and continues | critical | every WebDriver failure becomes green |
| 2 | \`29.99 * 1.08\` in \`double\` (32.3892…) against displayed 32.39 | critical | always red; the \`AssertionError\` is not an \`Exception\`, so this one escapes the catch |
| 3 | expected value repeats an assumed formula instead of the rule "8 %, rounded to cents" | high | rounding never checked |
| 4 | \`static\` driver, never quit | high | no parallelism, orphan browsers |
| 5 | test 2 depends on test 1 through \`priority\` | high | cannot run alone; misleading failures |
| 6 | \`Thread.sleep\`, implicit wait 20 s | medium | slow; "element absent" checks cost 20 s |
| 7 | position-based XPath; URLs and password in code | medium | breaks on layout change, no second environment |
| 8 | \`assertTrue(a == b)\`; no message | medium | failure says "expected [true]" |
| 9 | no page objects | low here | fix after 1–6 |

Improved version (imports and the page classes omitted; \`data\` creates or reads the account):

\`\`\`java
public class CheckoutTotalTest extends BrowserTest {          // new session per method, quit in alwaysRun teardown

    @Test
    public void totalIsItemPricePlusEightPercentTaxRoundedToCents() {
        LoginPage login = new LoginPage(session());
        CheckoutOverviewPage overview = login.open()
                .loginAs(data.customer())
                .addToCart("trailblazer-backpack")
                .goToCheckout()
                .continueAs("Asha", "Rao", "560001");

        assertEquals(overview.itemTotal(), new BigDecimal("29.99"), "item total");
        assertEquals(overview.tax(), new BigDecimal("2.40"), "tax");
        assertEquals(overview.total(), new BigDecimal("32.39"), "total");
    }
}

public final class CheckoutOverviewPage {
    private static final By TOTAL = By.id("summary-total");
    private final WebDriverWait wait;

    CheckoutOverviewPage(WebDriver driver, Duration timeout) {
        this.wait = new WebDriverWait(driver, timeout);
    }

    public BigDecimal total() {
        String text = wait.until(ExpectedConditions.visibilityOfElementLocated(TOTAL)).getText();
        return new BigDecimal(text.replace("$", ""));
    }
}
\`\`\`

\`session()\` must come from a thread-confined holder if methods run in parallel: TestNG reuses one test instance, so an instance field would be shared. The literals 2.40 and 32.39 are calculated from the requirement by hand, so the test does not repeat the program's formula. \`itemTotal()\` and \`tax()\` look like \`total()\`.

### Q: Review this Playwright test. Where is the false green?

\`\`\`ts
import { test, expect } from '@playwright/test';
let page: any;

test.describe.serial('cart', () => {
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });

  test('add', async () => {
    await page.goto('http://localhost:5180/practice-site/inventory.html');
    await page.waitForTimeout(2000);
    page.click('.btn-inventory >> nth=0');
    expect(page.locator('.shopping-cart-badge')).toHaveText('1');
  });

  test('cart total', async () => {
    await page.goto('http://localhost:5180/practice-site/cart.html');
    const prices = await page.$$('.item-price');
    let sum = 0;
    prices.forEach(async (p: any) => { sum += parseFloat((await p.textContent()).slice(1)); });
    expect(sum).toBe(29.99);
    if (await page.isVisible('#checkout')) await page.click('#checkout');
  });
});
\`\`\`

**Short answer (30–60 s):** Two promises are not awaited, so "add" can end green before anything is checked. \`forEach(async …)\` leaves \`sum\` at 0 when the assertion runs. A shared serial page makes the second test depend on the first, and the \`if\` means checkout may never be exercised. \`any\` is why the compiler and lint rules could not help.

**Detailed answer:** further points, in order: \`beforeAll\` page has no automatic tracing, isolation or closing as the \`page\` fixture has; element handles instead of locators; "first button" depends on sort order; hard wait; hard-coded origin (\`baseURL\`); two unrelated behaviours in one chain; float comparison. Note that ShopEasy's cart page shows prices but no total, so the honest assertion is the price *text*.

\`\`\`ts
import { test, expect } from '@playwright/test';

test('an added product is in the cart with its price', async ({ page }) => {
  await page.goto('/practice-site/inventory.html');
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');

  await page.getByTestId('shopping-cart-link').click();
  const row = page.getByTestId('cart-item').filter({ hasText: 'Trailblazer Backpack' });
  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(row.getByTestId('inventory-item-price')).toHaveText('$29.99');

  await page.getByTestId('checkout').click();
  await expect(page.getByTestId('checkout-step-one')).toBeVisible();
});
\`\`\`

Process fix: enable typed linting (\`no-floating-promises\`, \`no-explicit-any\`) and the Playwright lint plugin, so the next review can talk about risk. In a real suite the locators move into page objects (\`pw-deep-fixtures-pom-components\`).

**What the interviewer is checking:** that you find the false green first, and that your wording would leave the author willing to show you the next pull request.

## J. Coding round: nine tasks you have not seen in the other lessons

Work each one for 15 minutes before reading. Every program below was run (Java 17, Node 24); the comments show the printed output. How to run the round itself (clarify, plan, test) is in \`live-coding-rounds\` and \`java-deep-coding-interview-problems\`.

### Q: Task 1 (Java) — split test files over N shards so that the slowest shard is as short as possible.

\`\`\`java
import java.util.*;
import java.util.stream.*;

public class Shards {
    record Spec(String file, int seconds) { }
    static final class Shard {
        final List<Spec> specs = new ArrayList<>();
        int total;
        void add(Spec s) { specs.add(s); total += s.seconds(); }
    }
    static List<Shard> balance(List<Spec> specs, int n) {
        if (n < 1) throw new IllegalArgumentException("need at least one shard");
        List<Shard> shards = Stream.generate(Shard::new).limit(n).toList();
        PriorityQueue<Shard> lightest = new PriorityQueue<>(Comparator.comparingInt((Shard s) -> s.total));
        lightest.addAll(shards);
        specs.stream().sorted(Comparator.comparingInt(Spec::seconds).reversed()).forEach(spec -> {
            Shard s = lightest.poll();
            s.add(spec);
            lightest.add(s);                 // re-insert: the heap does not notice a changed key
        });
        return shards;
    }
    public static void main(String[] args) {
        List<Spec> specs = List.of(new Spec("login", 30), new Spec("checkout", 90), new Spec("search", 40),
                new Spec("orders", 60), new Spec("profile", 20));
        System.out.println(balance(specs, 2).stream().map(s -> s.total).toList());   // [120, 120]
    }
}
\`\`\`

**Short answer (30–60 s):** Longest first, always into the lightest shard (greedy LPT) with a min-heap: O(m log m + m log n).

**Detailed answer:** the exact problem is NP-hard; LPT is known to stay within 4/3 of the optimum, which is enough because durations are estimates anyway. Round-robin in file order is the naive approach: here [90, 150] seconds. Edge cases: new file without history (use the median), more shards than files (empty shards must not fail the job), a single huge file sets the floor, so split it.

### Q: Task 2 (Java) — services depend on each other; print a start order or report a cycle.

\`\`\`java
import java.util.*;

public class StartOrder {
    static List<String> order(Map<String, List<String>> needs) {
        Map<String, Integer> open = new TreeMap<>();                 // sorted: deterministic result
        Map<String, List<String>> neededBy = new HashMap<>();
        new TreeMap<>(needs).forEach((service, deps) -> {
            open.merge(service, deps.size(), Integer::sum);
            for (String d : deps) {
                open.putIfAbsent(d, 0);
                neededBy.computeIfAbsent(d, k -> new ArrayList<>()).add(service);
            }
        });
        Deque<String> ready = new ArrayDeque<>();
        open.forEach((s, n) -> { if (n == 0) ready.add(s); });
        List<String> result = new ArrayList<>();
        while (!ready.isEmpty()) {
            String s = ready.remove();
            result.add(s);
            for (String next : neededBy.getOrDefault(s, List.of()))
                if (open.merge(next, -1, Integer::sum) == 0) ready.add(next);
        }
        if (result.size() < open.size()) {
            open.keySet().removeAll(result);
            throw new IllegalStateException("cycle involving " + open.keySet());
        }
        return result;
    }
    public static void main(String[] args) {
        System.out.println(order(Map.of("web", List.of("api"), "api", List.of("db", "queue"), "worker", List.of("queue"))));
        // [db, queue, api, worker, web]
        try { order(Map.of("a", List.of("b"), "b", List.of("a"))); }
        catch (IllegalStateException e) { System.out.println(e.getMessage()); }       // cycle involving [a, b]
    }
}
\`\`\`

**Short answer (30–60 s):** Topological sort with Kahn's algorithm: count open dependencies, take those with zero, decrement their dependants. Anything left over is in, or behind, a cycle. O(V + E).

**Detailed answer:** the alternative is depth-first search with three colours; it names the cycle path more easily but needs care with recursion depth. Watch out: a dependency listed twice is counted twice in both directions, which still works here; \`Integer == 0\` is safe because the comparison unboxes to \`int\`. Same pattern: Maven reactor, setup projects, deleting rows in foreign-key order.

### Q: Task 3 (Java) — builds 1…n, at some point all are bad. Find the first bad one with few checks.

\`\`\`java
import java.util.function.IntPredicate;

public class FirstBad {
    static int firstBad(int good, int bad, IntPredicate isBad) {
        while (bad - good > 1) {                  // invariant: good is good, bad is bad
            int mid = good + (bad - good) / 2;
            if (isBad.test(mid)) bad = mid; else good = mid;
        }
        return bad;
    }
    public static void main(String[] args) {
        int[] calls = {0};
        System.out.println(firstBad(0, 1000, b -> { calls[0]++; return b >= 737; }) + " in " + calls[0]);  // 737 in 10
    }
}
\`\`\`

**Short answer (30–60 s):** Binary search on a predicate, keeping the invariant "left good, right bad": O(log n) checks; it is what \`git bisect\` does.

**Detailed answer:** the follow-up is always "the check is flaky". Binary search with a wrong answer ends in the wrong half and looks precise. With a bug that reproduces 30 % of the time, one green proves little: repeat k times until 0.7^k is acceptable (k = 9 gives 4 % risk of a false "good"). Two more: builds that do not start (try a neighbour), and more than one change of state (the invariant no longer identifies *the* cause).

### Q: Task 4 (Java) — given start and end of every session, how many Grid slots were needed at the peak?

\`\`\`java
import java.util.*;

public class PeakSessions {
    record Session(int start, int end) { }                       // end is exclusive
    static int peak(List<Session> sessions) {
        List<int[]> events = new ArrayList<>();
        for (Session s : sessions) {
            if (s.end() <= s.start()) continue;                  // zero-length: needs no slot
            events.add(new int[]{s.start(), +1});
            events.add(new int[]{s.end(), -1});
        }
        events.sort(Comparator.<int[]>comparingInt(e -> e[0]).thenComparingInt(e -> e[1]));  // release before acquire
        int now = 0, peak = 0;
        for (int[] e : events) peak = Math.max(peak, now += e[1]);
        return peak;
    }
    public static void main(String[] args) {
        System.out.println(peak(List.of(new Session(0, 10), new Session(5, 15), new Session(10, 20), new Session(12, 13))));  // 3
        System.out.println(peak(List.of(new Session(0, 10), new Session(10, 20))));                                          // 1
    }
}
\`\`\`

**Short answer (30–60 s):** Sweep line: +1 at each start, −1 at each end, sort, take the running maximum. O(n log n) time, O(n) space.

**Detailed answer:** the decision that matters is the tie. If a slot released at 10 can be reused at 10, ends sort first; if browsers need clean-up time, add it to \`end\`. Checking every second is O(range × n) and breaks with milliseconds. Same technique: peak of parallel orders, maximum number of open carts, meeting rooms.

### Q: Task 5 (Java) — allow at most N calls in any sliding window of W milliseconds, thread-safe and testable.

\`\`\`java
import java.util.*;
import java.util.function.LongSupplier;

public class SlidingWindow {
    private final int limit;
    private final long windowMs;
    private final LongSupplier clock;                 // injected: no sleeping in tests
    private final Deque<Long> calls = new ArrayDeque<>();

    SlidingWindow(int limit, long windowMs, LongSupplier clock) {
        this.limit = limit; this.windowMs = windowMs; this.clock = clock;
    }
    synchronized boolean tryAcquire() {
        long now = clock.getAsLong();
        while (!calls.isEmpty() && now - calls.peekFirst() >= windowMs) calls.removeFirst();
        if (calls.size() == limit) return false;
        calls.addLast(now);
        return true;
    }
    public static void main(String[] args) {
        long[] t = {0};
        SlidingWindow w = new SlidingWindow(2, 1000, () -> t[0]);
        StringBuilder out = new StringBuilder();
        for (long at : new long[]{0, 400, 900, 1000, 1399, 1400}) { t[0] = at; out.append(w.tryAcquire()).append(' '); }
        System.out.println(out.toString().trim());    // true true false true false true
    }
}
\`\`\`

**Short answer (30–60 s):** Keep timestamps of accepted calls in a deque, drop those older than the window, accept if fewer than N remain. Amortised O(1) per call, O(N) memory.

**Detailed answer:** fixed windows allow a burst of 2N at the boundary; a token bucket needs O(1) memory and permits controlled bursts. In production code pass \`() -> System.nanoTime() / 1_000_000\`: wall-clock time can jump. \`synchronized\` is right here because check and add must be one atomic step; a concurrent deque alone would not make them one. Use in a framework: keep parallel API setup under a test environment's rate limit.

### Q: Task 6 (TypeScript) — run async jobs with at most \`limit\` in flight; results in input order.

\`\`\`ts
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be a positive integer');
  const results = new Array<R>(items.length);
  let next = 0;
  const lane = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;                         // no await between read and increment, so no race
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}

let active = 0, peak = 0;
const out = await mapLimit([30, 10, 20, 5], 2, async (ms, i) => {
  peak = Math.max(peak, ++active);
  await new Promise((r) => setTimeout(r, ms));
  active--;
  return \`job\${i}\`;
});
console.log(out.join(), 'peak', peak);          // job0,job1,job2,job3 peak 2
\`\`\`

**Short answer (30–60 s):** Start \`limit\` lanes; each takes the next index until none is left. Unlike fixed batches, a slow job blocks only its own lane.

**Detailed answer:** after one rejection \`Promise.all\` rejects, but the other lanes **keep going** and take further items; add an \`AbortController\` or a \`stopped\` flag if that matters, or collect \`allSettled\`-style results. O(n) overhead. JavaScript's single thread makes \`next++\` safe; the Java version needs \`AtomicInteger\` or a semaphore (\`java-deep-executors-completablefuture\`).

### Q: Task 7 (TypeScript) — list the differences between two JSON values with their paths.

\`\`\`ts
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const isObject = (v: Json | undefined): v is { [key: string]: Json } =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function diff(a: Json | undefined, b: Json | undefined, path = '$'): string[] {
  if (a === b) return [];
  if (Array.isArray(a) && Array.isArray(b)) {
    return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => diff(a[i], b[i], \`\${path}[\${i}]\`)).flat();
  }
  if (isObject(a) && isObject(b)) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap((k) => diff(a[k], b[k], \`\${path}.\${k}\`));
  }
  const show = (v: Json | undefined) => (v === undefined ? '(missing)' : JSON.stringify(v));
  return [\`\${path}: \${show(a)} -> \${show(b)}\`];
}

console.log(diff(
  { id: 1, total: 32.39, items: [{ name: 'Tee', qty: 1 }], note: null },
  { id: 1, total: '32.39', items: [{ name: 'Tee', qty: 2 }, { name: 'Cap', qty: 1 }] },
).join('\\n'));
// $.items[0].qty: 1 -> 2
// $.items[1]: (missing) -> {"name":"Cap","qty":1}
// $.note: null -> (missing)
// $.total: 32.39 -> "32.39"
\`\`\`

**Short answer (30–60 s):** Recurse on two values of the same kind, union of keys for objects, longest length for arrays, otherwise report. O(n) nodes plus sorting keys.

**Detailed answer:** say what the specification must decide: is array order significant (if not, match by a key such as \`productId\`)? Is \`null\` equal to missing (often not, in a PATCH)? Are generated fields ignored (pass a predicate on the path)? Keys containing dots need \`['…']\` notation. Deep nesting is recursion, so mention the stack.

### Q: Task 8 (TypeScript) — group 64 failures into root-cause candidates.

\`\`\`ts
interface Failure { test: string; message: string }
const fingerprint = (message: string): string =>
  message.split('\\n')[0]
    .replace(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\\d+ms\\b/g, '<time>')
    .replace(/"[^"]*"|'[^']*'/g, '<text>')
    .replace(/\\d+/g, '<n>')
    .trim();

function group(failures: Failure[]): Array<[string, string[]]> {
  const byPrint = new Map<string, string[]>();
  for (const f of failures) {
    const key = fingerprint(f.message);
    byPrint.set(key, [...(byPrint.get(key) ?? []), f.test]);
  }
  return [...byPrint].sort((x, y) => y[1].length - x[1].length);
}

for (const [key, tests] of group([
  { test: 'login', message: 'Timeout 10000ms exceeded waiting for #inventory-list' },
  { test: 'sort', message: 'Timeout 5000ms exceeded waiting for #inventory-list' },
  { test: 'total', message: 'expected "$32.39" but was "$32.40"' },
  { test: 'order', message: 'GET /api/orders/1007 returned 500' },
  { test: 'reorder', message: 'GET /api/orders/1012 returned 500' },
])) console.log(tests.length, key);
// 2 Timeout <time> exceeded waiting for #inventory-list
// 2 GET /api/orders/<n> returned <n>
// 1 expected <text> but was <text>
\`\`\`

**Short answer (30–60 s):** Replace everything variable in the first line by placeholders, count by the rest. O(total text).

**Detailed answer:** the art is how much to erase. This version merges 500 with 404, because status codes are numbers too; keep them if your triage needs it (normalise only ids after \`/\`). Too little erasing yields 64 groups, too much yields one. Improve with the top stack frame of *your* code, and keep one sample message per group. A \`Map\` in insertion order makes ties stable.

### Q: Task 9 (TypeScript) — from run history, list the flaky tests.

\`\`\`ts
interface Run { test: string; commit: string; passed: boolean }

function flaky(runs: Run[]): Array<{ test: string; flakyCommits: number; commits: number }> {
  const seen = new Map<string, Map<string, Set<boolean>>>();
  for (const { test, commit, passed } of runs) {
    const commits = seen.get(test) ?? new Map<string, Set<boolean>>();
    commits.set(commit, (commits.get(commit) ?? new Set<boolean>()).add(passed));
    seen.set(test, commits);
  }
  return [...seen]
    .map(([test, commits]) => ({
      test,
      flakyCommits: [...commits.values()].filter((outcomes) => outcomes.size === 2).length,
      commits: commits.size,
    }))
    .filter((r) => r.flakyCommits > 0)
    .sort((x, y) => y.flakyCommits / y.commits - x.flakyCommits / x.commits);
}

const r = (test: string, commit: string, passed: boolean): Run => ({ test, commit, passed });
console.log(flaky([
  r('cart', 'c1', true), r('cart', 'c1', false), r('cart', 'c2', true),
  r('total', 'c1', true), r('total', 'c2', false), r('total', 'c2', false),
]));   // [ { test: 'cart', flakyCommits: 1, commits: 2 } ]
\`\`\`

**Short answer (30–60 s):** Flaky means both outcomes **on the same commit**. Pass on one commit and fail on the next is what a regression looks like. One pass over the runs, O(n log n) with sorting.

**Detailed answer:** weaknesses to mention: the same commit may run in two environments (add it to the key); tests that run once per commit can never be detected, so schedule repeats on main; small samples (1 of 2) should not outrank 40 of 400 (use a minimum or a confidence bound). SQL alternative: \`GROUP BY test, commit HAVING COUNT(DISTINCT passed) = 2\`, where \`commit\` needs quoting as a column name.

## K. Revision index

| Topic | Reopen | Must-know points |
|---|---|---|
| Playwright engine | \`pw-deep-architecture\`, \`pw-deep-locators-actionability-timeouts\` | browser/context/page; strictness; actionability per action; timeout layers |
| Async and TypeScript | \`pw-deep-async-await-and-promises\`, \`pw-deep-typescript-for-automation\` | microtasks; floating promises; \`unknown\` vs \`any\`; unions; utility types |
| Playwright structure | \`pw-deep-fixtures-pom-components\`, \`pw-deep-test-organisation-data-driven\` | fixture scopes; composition; tags; serial mode cost |
| Playwright web features | \`pw-deep-browser-interactions\`, \`pw-deep-network-cookies-sessions\` | frames, tabs, dialogs; route/fulfill; HAR; storageState limits |
| Playwright API, config, reports | \`pw-deep-api-testing\`, \`pw-deep-config-environments-ci\`, \`pw-deep-reporting-debugging\` | request contexts; option precedence; projects; sharding; traces |
| OOP, SOLID, exceptions | \`java-deep-oop-and-solid\`, \`java-deep-exception-design\` | equals/hashCode; composition; LSP example; suppressed exceptions |
| Collections, strings, memory | \`java-deep-collections-hashmap-internals\`, \`java-deep-strings-memory-gc\` | put path; treeify; ConcurrentHashMap; heap vs stack; OOM steps |
| Streams, modern Java | \`java-deep-functional-streams\`, \`java-deep-modern-java-9-to-21\` | laziness; toMap duplicates; records; sealed types; virtual threads |
| Concurrency | \`java-deep-multithreading-synchronization\`, \`java-deep-executors-completablefuture\` | happens-before; ThreadLocal leak; pool queueing; thenCompose |
| Java coding | \`java-deep-coding-interview-problems\` | six moves; hashing, windows, heaps; complexity out loud |
| Selenium internals | \`selenium-deep-architecture\`, \`selenium-deep-synchronization\` | W3C protocol; element reference; implicit + explicit; staleness |
| Selenium locators, actions | \`selenium-deep-locators-xpath-dynamic\`, \`selenium-deep-interactions\` | axes; CSS vs XPath; frames; Actions; shadow DOM |
| Selenium at scale | \`selenium-deep-parallel-execution\`, \`selenium-deep-grid-infrastructure\`, \`selenium-deep-framework-design\` | confinement; slots and queue; decorators; sizing |
| Flaky and failing tests | \`selenium-deep-troubleshooting-flaky-tests\` | workflow; evidence; quarantine; retry position |
| Page models | \`pom-deep-variants-pagefactory-loadable\`, \`pom-deep-components-and-reusable-methods\`, \`pom-deep-screenplay-pattern\` | proxies; scoped components; task/ability/question |
| Patterns | \`pom-deep-creational-patterns\`, \`pom-deep-structural-behavioural-patterns\` | factory family; builder vs mother; facade, decorator, strategy |
| Cucumber | \`cucumber-deep-architecture-internals\`, \`cucumber-deep-steps-parameter-types-datatables\`, \`cucumber-deep-dependency-injection-hooks\`, \`cucumber-deep-execution-reporting-parallel\`, \`cucumber-deep-bdd-practice-at-scale\` | pickles; DI per scenario; hook order; parallel strategies; when not to use |
| Runners and build | \`framework-deep-testng-internals-extensibility\`, \`framework-deep-junit5-vs-testng-assertions\`, \`framework-deep-maven-build-internals\` | listeners; Platform vs Jupiter; mediation; Surefire vs Failsafe |
| API testing | \`restassured-deep-internals-http\`, \`restassured-deep-assertions-json-contracts\`, \`restassured-deep-api-framework-architecture\` | spec merge; GPath floats; schema; client boundaries |
| Advanced API, security | \`restassured-deep-auth-security-testing\`, \`restassured-deep-advanced-api-testing\` | authorisation matrix; JWT checks; Pact; async; idempotency |
| SQL and databases | \`restassured-deep-sql-for-testers\`, \`restassured-deep-database-testing-jdbc\` | NULL logic; windows; isolation; when not to check the DB |
| Git, CI, containers | \`framework-deep-git-for-automation-teams\`, \`framework-deep-jenkins-ci-cd-pipelines\`, \`framework-deep-docker-for-test-automation\` | reflog; gates; secrets; layers; networking |
| Whole frameworks | \`framework-deep-enterprise-java-selenium\`, \`pw-deep-enterprise-playwright-typescript\` | decisions and the weakest point of each |
| Business scenarios | \`interview-deep-scenarios-account-and-catalog\`, \`interview-deep-scenarios-cart-and-checkout\`, \`interview-deep-scenarios-orders-and-end-to-end\` | rules first; level choice; money; idempotent payment |
| Behavioural, leadership | \`interview-deep-leadership-and-behavioural-qa\` | stories, metrics, rubric, four-week plan |

## L. Rapid fire: 40 questions, one line each

| # | Q | A |
|---|---|---|
| 1 | Test vs check? | a check compares; testing decides what is worth comparing |
| 2 | Verification vs validation? | built right vs right thing |
| 3 | Severity vs priority? | impact vs order of fixing |
| 4 | Smoke vs sanity? | broad and shallow on a build vs narrow on a change; teams differ, ask |
| 5 | Oracle? | the source that tells you what is correct |
| 6 | Stub vs mock vs fake? | fixed answers; verified interactions; working light implementation |
| 7 | Boundary of 1–10? | 0, 1, 2, 9, 10, 11 |
| 8 | Pairwise covers? | every pair of values once, not every combination |
| 9 | Safe vs idempotent? | no change vs same effect when repeated |
| 10 | 401 vs 403? | who are you vs you may not |
| 11 | 409 vs 422? | conflict with state vs understood but invalid content |
| 12 | PUT vs PATCH? | replace vs partial change |
| 13 | Cookie \`HttpOnly\`? | page scripts cannot read it |
| 14 | CORS protects? | the user's browser; not the API from curl |
| 15 | JWT payload secret? | no, only signed unless encrypted |
| 16 | CSRF in one line? | another site makes your logged-in browser act |
| 17 | \`==\` on two \`Integer\`s? | compares references; cached only −128…127 by default |
| 18 | \`final\` list? | reference fixed, content not |
| 19 | \`hashCode\` equal means equal? | no; equal means same hashCode |
| 20 | Checked exception at a lambda? | wrap it; most functional interfaces declare none |
| 21 | \`volatile\` makes \`i++\` safe? | no, visibility only |
| 22 | \`any\` vs \`unknown\`? | \`unknown\` must be narrowed before use |
| 23 | \`?.\` returns? | \`undefined\` when the left side is null or undefined |
| 24 | \`const\` object? | binding constant, properties mutable |
| 25 | Optional parameter vs \`\\| undefined\`? | may be omitted vs must be passed |
| 26 | Implicit + explicit wait? | do not mix: durations become unpredictable |
| 27 | Stale element? | reference to a node no longer attached |
| 28 | \`findElements\` when none? | empty list, after the implicit wait |
| 29 | \`isVisible()\` in Playwright waits? | no, immediate answer |
| 30 | \`locator.all()\` waits? | no; assert the count first |
| 31 | Isolation in Playwright? | a new context per test |
| 32 | Why role locators? | close to what users and assistive technology perceive |
| 33 | \`WHERE\` vs \`HAVING\`? | before vs after grouping |
| 34 | \`NOT IN\` with NULL? | returns no rows |
| 35 | \`merge\` vs \`rebase\`? | keeps history vs rewrites it |
| 36 | \`fetch\` vs \`pull\`? | download vs download plus integrate |
| 37 | Image vs container? | template vs running instance |
| 38 | Exit code 137? | killed by SIGKILL, often out of memory |
| 39 | Canary vs blue-green? | small share of traffic vs switch between two environments |
| 40 | Quality gate? | a condition with threshold and owner that stops a change |
`,
  keyPoints: [
    `Design rounds run on a clock: clarify, rank risks, four layers, one real contract, data and parallelism, gates, weakest point.`,
    `Calculate before scaling: total worker-seconds, then delete, push down, cheaper setup, and only then shards and machines.`,
    `Diagnose with facts first: identical session ids, the call log from top to bottom, which side computed the value, how many tests really ran.`,
    `Share only immutable or documented thread-safe objects; processes protect memory, but not shared customers and data.`,
    `Types describe what you hope the server sent; discriminated unions force a check and a schema at the edge verifies it.`,
    `Independent deployments need component and contract tests as gates, few journeys, and tests for duplicates, order and mixed versions.`,
    `Treat healed locators and generated tests as proposals: reported, reviewed, and seen red before they are trusted.`,
    `In code review name the false green first; in coding rounds state the edge-case decision (ties, order, missing, repeated outcome) and the complexity.`,
  ],
  mistakes: [
    `Drawing the framework before asking about team, risks and release rhythm. Fix: seven minutes of questions, written on the board, then one sentence that links each layer to a risk.`,
    `Answering every log with "add a wait" or "add a retry". Fix: state fact, inference and the one observation that separates two hypotheses; check whether a retry is idempotent.`,
    `Proposing more machines for a slow suite. Fix: show the worker-second arithmetic, the longest single test and the environment limit first.`,
    `Quoting AI or tool features as settled facts. Fix: say what you tried, the date, and that it must be checked in the current documentation.`,
    `Presenting an optimal algorithm without naming its specification choices. Fix: ask about ties, duplicates, null versus missing and noisy input, then write two tests for them.`,
    `Listing twenty style remarks in a review round. Fix: order by consequence, starting with tests that pass when the feature is broken, and offer to pair.`,
  ],
  tryIt: `Set a 45-minute timer and design a framework for ShopEasy on paper with the timeline of section A: the shop on http://localhost:5180/practice-site/ and the API on http://localhost:5181. Write one contract and one test against it. Then take the diff function of section J and run it on \`GET /api/products/3\` and \`GET /api/products/6\`: predict the paths it reports before you run it, and decide which of them a test should ignore. Finally explain the three riskiest points of your design aloud in two minutes.`,
  problems: ['int-003', 'int-006', 'int-010', 'int-035'],
}
