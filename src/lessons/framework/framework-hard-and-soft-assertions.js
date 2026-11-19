export default {
  slug: 'framework-hard-and-soft-assertions',
  category: 'framework',
  order: 3,
  title: 'Assertions: hard Assert vs SoftAssert',
  minutes: 6,
  summary: 'Choose between TestNG hard assertions that stop at the first failure and SoftAssert that collects every failure, and use assertAll correctly.',
  manualAnalogy: `When you verify a product detail page by hand you do not stop at the first wrong thing — you note "price wrong, image missing, button disabled" and log all three in one defect. But if the page does not open at all, you stop: there is nothing to check. Soft assertions are the "note everything" mode; hard assertions are the "stop, the precondition failed" mode.`,
  body: `## Hard assertions: stop on first failure

\`\`\`java
import org.testng.Assert;

Assert.assertEquals(actual, expected, "message");
Assert.assertTrue(condition, "message");
Assert.assertFalse(condition, "message");
Assert.assertNotNull(object, "message");
\`\`\`

A failing \`Assert\` **throws an \`AssertionError\` immediately**. The rest of the test method does not run and the test is marked FAILED with that one message.

That is what you want for **preconditions**: if login failed, checking the cart badge is meaningless and only produces misleading extra failures.

## The problem with many hard checks in a row

Imagine checking the order overview on \`checkout.html\` (\`#summary-ship-to\`, \`#summary-subtotal\`, \`#summary-tax\`, \`#summary-total\`) after adding the backpack and the bike light:

\`\`\`java
Assert.assertTrue(overview.getShipTo().contains("Asha"));
Assert.assertEquals(overview.getSubtotal(), "$39.98");
Assert.assertEquals(overview.getTax(), "$3.20");
Assert.assertEquals(overview.getTotal(), "$43.18");
\`\`\`

If the ship-to line is wrong, you never learn whether the totals were right. You fix one thing, rerun, find the next — three CI runs for three bugs.

## SoftAssert: collect, then report

\`\`\`java
import org.testng.asserts.SoftAssert;

@Test
public void overviewShowsCorrectSummary() {
    CheckoutOverviewPage overview = goToOverview();
    Assert.assertTrue(overview.isLoaded(), "Overview page did not open");   // hard: precondition

    SoftAssert softly = new SoftAssert();                                    // 1
    softly.assertTrue(overview.getShipTo().contains("Asha"), "Ship-to name");
    softly.assertEquals(overview.getTotal(), "$43.18", "Grand total");
    softly.assertAll();                                                      // 2
}
\`\`\`

1. \`new SoftAssert()\` creates a collector. Its methods have the same names as \`Assert\`'s, but a failure is **recorded**, not thrown.
2. \`assertAll()\` throws **one** \`AssertionError\` listing every recorded failure. If nothing failed, it does nothing.

## The two rules that bite beginners

**Rule 1 — always call \`assertAll()\` at the end.** Without it the failures are recorded and then thrown away: the test passes even though the checks failed. This is the most dangerous mistake in this lesson because it produces *green* results that lie.

**Rule 2 — create the SoftAssert inside the test method.** A \`SoftAssert\` stored as a field of the class is shared across tests. Failures recorded in one test are reported again in the next test's \`assertAll()\`, and in parallel runs threads mix their failures. A new object per test keeps results honest.

## Which one, when?

| Situation | Use |
|---|---|
| Page/precondition must be OK before anything else | Hard \`Assert\` |
| A single outcome decides the test (login works / does not) | Hard \`Assert\` |
| Several independent fields on one screen (card details, a summary, a form's labels) | \`SoftAssert\` + \`assertAll()\` |
| A later step depends on an earlier value (you need the order number to search for it) | Hard \`Assert\` on that value |

Mixing is normal: hard for the gate, soft for the details.

## Messages still matter

The \`assertAll()\` report lists each failure with its message. "Grand total expected [$43.18] but found [$42.18]" pinpoints the problem; five unlabelled "expected [true] but found [false]" lines do not. Prefer \`assertEquals\` over \`assertTrue(a.equals(b))\` for the same reason: it prints both values.

## Cucumber note

The same classes work in step definitions. Remember a SoftAssert created in one step is not visible in the next step unless you share it (for example via a scenario context object), and \`assertAll()\` must be called somewhere — often in a final \`@Then\` step.`,
  keyPoints: [
    'Hard `Assert` throws at the first failure and stops the test.',
    '`SoftAssert` records failures and throws them all at `assertAll()`.',
    'Forgetting `assertAll()` makes the test pass no matter what — always end with it.',
    'Create a new SoftAssert per test method, never as a shared field.',
    'Hard-assert preconditions, soft-assert independent details; add messages to every check.',
  ],
  mistakes: [
    'No `assertAll()` at the end — failures silently disappear.',
    'A `SoftAssert` field shared between tests — failures leak into other tests.',
    'Soft-asserting a precondition — the test continues on a broken page and produces noise.',
    'Using `assertTrue(actual.equals(expected))` — the report cannot show the two values; use `assertEquals`.',
  ],
  tryIt: `Write a throwaway test with a \`SoftAssert\` containing two deliberately wrong checks and **no** \`assertAll()\`. Run it: it passes. Add \`assertAll()\` and run again: one failure listing both problems. That 30-second experiment will stop you ever forgetting it.`,
  problems: ['fw-003'],
}
