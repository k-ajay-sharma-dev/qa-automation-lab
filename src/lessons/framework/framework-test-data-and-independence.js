export default {
  slug: 'framework-test-data-and-independence',
  category: 'framework',
  order: 9,
  title: 'Test data and independent tests: builders, Faker, API set-up and clean-up',
  minutes: 9,
  summary: 'Write tests that each create their own data quickly through the API, describe it with readable builders and random-but-valid values, and always clean up — so the suite can run in any order and in parallel.',
  manualAnalogy: `In a manual cycle you learn the hard way that two testers sharing one test account step on each other: one empties the cart while the other is checking out. And you never trust "it worked because the previous test case left the data in the right state". Good automation follows the same rules: each test has its own data, prepares it itself, and tidies up after itself.`,
  body: `## Three rules of independent tests

1. **No order.** A test passes when run alone, first, last, or twice.
2. **No shared mutable state.** Nothing stored in \`static\` fields for "the next test"; each test keeps its pages and data in local variables.
3. **No leftovers.** Whatever a test creates, it removes — even when it fails.

Break rule 1 and one bug turns into a cascade of red and skipped tests. Break rule 2 and parallel runs fail randomly. Break rule 3 and *other* tests fail tomorrow ("409 item already in cart") for reasons that have nothing to do with them.

## Set up below the UI

Only the behaviour a test is about needs to go through the browser. Everything else is a **precondition**, and preconditions should be fast and reliable:

| Shortcut | Example on ShopEasy |
|---|---|
| REST API call | \`POST /api/cart/items\` on \`http://localhost:5181\` with a bearer token |
| Browser storage | the web shop keeps its cart in \`sessionStorage\` under \`shopeasy.cart\` |
| Database seed / reset endpoint | \`POST /api/reset\` restores the seed data (only safe on a private environment) |

A test of the *checkout form* that clicks through login, inventory and cart first is slow and fails for reasons unrelated to the checkout form.

## Builders: readable data with sensible defaults

Copy-pasted maps like \`Map.of("street", "12 MG Road", "city", "Bengaluru", ...)\` in every test hide what matters. A **test data builder** keeps a valid default for every field and lets a test change only what it is about:

\`\`\`java
Address address = anAddress().withCity("").build();      // "a valid address, but with no city"
\`\`\`

\`\`\`java
public final class AddressBuilder {
    private String street = "12 MG Road";
    private String city = "Bengaluru";

    public static AddressBuilder anAddress() { return new AddressBuilder(); }

    public AddressBuilder withCity(String city) {
        this.city = city;
        return this;                     // returning this lets you chain .withX().withY()
    }

    public Address build() { return new Address(street, city); }
}
\`\`\`

When the API adds a mandatory field next sprint, you change the builder once instead of forty tests.

## Faker: realistic, varied values

The Datafaker library (\`net.datafaker:datafaker\`) generates plausible data:

\`\`\`java
Faker faker = new Faker();
faker.name().firstName();     // "Priya"
faker.address().city();       // "Lake Ramon"
faker.number().digits(6);     // "402913"
\`\`\`

Use it for **defaults in builders**, so every run uses different names and avoids collisions on unique fields. Two cautions: generated data must always be **valid** for the rule you are not testing (a random value that sometimes breaks validation makes the test flaky), and log or seed it (\`new Faker(new Random(42))\`) so a failure can be reproduced. Boundary values you test on purpose stay fixed and explicit.

## Clean-up that always runs

\`\`\`java
@AfterMethod(alwaysRun = true)
public void restoreProfile() {
    if (token != null) {
        // put the user's original data back through the API
    }
}
\`\`\`

- Clean-up in the **test body** is skipped as soon as an assertion fails — exactly the case that leaves dirty data. Put it in \`@AfterMethod(alwaysRun = true)\`.
- Guard against a set-up that failed half-way (\`token\` still \`null\`).
- Prefer data that cannot collide (unique names) over clean-up when the system has no delete endpoint.

## Parallel runs and shared accounts

Server-side state often belongs to a **user**: the cart, the order history, the profile. Two parallel tests logged in as the same user still collide even with perfect clean-up. Give parallel tests separate accounts (ShopEasy's API has \`standard_user\` and \`visual_user\` as customers) or keep those tests sequential.

## Flaky tests are usually data or timing

When a different set of tests fails every night, look here first: shared accounts, leftovers from a failed test, tests relying on order, and missing waits. Only after ruling those out is a retry (see the *Listeners* lesson) a reasonable temporary bridge — and an intermittent *wrong value* is a product bug to report, not flakiness.`,
  keyPoints: [
    'Independent tests: no order, no shared mutable state, no leftovers.',
    'Create preconditions below the UI — API calls or browser storage — and use the UI only for what the test checks.',
    'Builders give every field a valid default; tests override only the field they are about.',
    'Faker makes defaults realistic and unique; keep them valid and reproducible.',
    'Clean up in @AfterMethod(alwaysRun = true), and give parallel tests separate accounts.',
  ],
  mistakes: [
    'Cleaning up at the end of the test body — a failed assertion skips it. Use alwaysRun teardown.',
    'Static fields that pass pages or data from one test to the next — breaks reruns and parallel runs.',
    'Random data that is sometimes invalid — the generator becomes a source of flakiness.',
    'Parallel tests sharing one user account, colliding on the server-side cart.',
  ],
  tryIt: `Start the API (\`npm run api\`) and open http://localhost:5181/api/health. Log in as standard_user with a REST client, add product 1 to the cart twice and note the second response (409). That error is what a missing clean-up looks like to the next test — then send \`DELETE /api/cart\` and try again.`,
  problems: ['fw-019', 'fw-023', 'fw-026'],
}
