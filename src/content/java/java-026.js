export default {
  id: 'java-026',
  category: 'java',
  kind: 'code',
  title: 'Optional instead of null: test-user lookups that fail with a clear message',
  level: 'ADVANCED',
  tags: ['optional', 'null-safety', 'streams', 'test-data'],
  estMinutes: 30,
  scenario: `\`TestUsers.find(username)\` returns \`null\` when a username is not in the seed data. Last week a feature file said \`visual_usr\` (typo). The lookup returned \`null\`, and the test died 40 lines later with \`NullPointerException at LoginSteps.java:57\` inside \`user.username()\`. It took an hour to trace back.
A second bug: the header check expects the \`#logged-in-user\` text to be \`guest\` when nobody is logged in (that's what \`shop.js\` does), but the helper returns \`null\` for an empty session.
The team agrees: lookups that may find nothing return **\`Optional\`**, and callers must decide what "nothing" means.`,
  description: `Rewrite \`TestUsers\`. The seed users match the ShopEasy API (\`scripts/api-server.mjs\`): \`standard_user\`, \`locked_out_user\` (locked), \`visual_user\`.

**Acceptance**
* \`Optional<TestUser> findByUsername(String username)\`: a stream over \`USERS\` with \`filter\` + \`findFirst()\`.
* \`TestUser require(String username)\`: \`findByUsername(username).orElseThrow(() -> new IllegalArgumentException(...))\` with a message that names the missing user **and lists the known usernames**.
* \`Optional<TestUser> firstUnlockedUser()\`: the first user with \`locked == false\`.
* \`String expectedHeaderName(String sessionUser)\`: \`Optional.ofNullable(sessionUser)\`, trim it, treat blank as empty, \`orElse("guest")\`.
* \`Optional<String> emailOf(String username)\` uses \`map(TestUser::email)\`.
* No \`return null\` and no bare \`Optional.get()\`.`,
  hints: [
    'return USERS.stream().filter(u -> u.username().equals(username)).findFirst();',
    'orElseThrow takes a Supplier: .orElseThrow(() -> new IllegalArgumentException("No test user \'" + username + "\'. Known: " + knownNames()))',
    'Optional.ofNullable(sessionUser).map(String::trim).filter(s -> !s.isEmpty()).orElse("guest")',
  ],
  language: 'java',
  starterCode: `package com.shop.data;

import java.util.List;

public class TestUsers {

    record TestUser(String username, String email, boolean locked) { }

    private static final List<TestUser> USERS = List.of(
            new TestUser("standard_user", "asha.rao@shopeasy.test", false),
            new TestUser("locked_out_user", "lars.lock@shopeasy.test", true),
            new TestUser("visual_user", "vera.visual@shopeasy.test", false));

    public static TestUser find(String username) {
        for (TestUser u : USERS) {
            if (u.username().equals(username)) {
                return u;
            }
        }
        return null;   // the NullPointerException shows up far away from here
    }

    public static String expectedHeaderName(String sessionUser) {
        return sessionUser;   // null when nobody is logged in, but the page shows "guest"
    }

    // TODO: Optional<TestUser> findByUsername(String username)
    // TODO: TestUser require(String username) with orElseThrow and a helpful message
    // TODO: Optional<TestUser> firstUnlockedUser()
    // TODO: Optional<String> emailOf(String username)
    // TODO: expectedHeaderName with Optional.ofNullable(...).orElse("guest")
}
`,
  solution: `package com.shop.data;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

public class TestUsers {

    record TestUser(String username, String email, boolean locked) { }

    // same seed users as the ShopEasy API (scripts/api-server.mjs)
    private static final List<TestUser> USERS = List.of(
            new TestUser("standard_user", "asha.rao@shopeasy.test", false),
            new TestUser("locked_out_user", "lars.lock@shopeasy.test", true),
            new TestUser("visual_user", "vera.visual@shopeasy.test", false));

    /** "Maybe a user": the return type tells the caller to handle the empty case. */
    public static Optional<TestUser> findByUsername(String username) {
        return USERS.stream()
                .filter(u -> u.username().equals(username))
                .findFirst();
    }

    /** "Must be a user": fail HERE with a useful message, not later with an NPE. */
    public static TestUser require(String username) {
        return findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No test user '" + username + "'. Known users: " + knownUsernames()));
    }

    public static Optional<TestUser> firstUnlockedUser() {
        return USERS.stream()
                .filter(u -> !u.locked())
                .findFirst();
    }

    public static Optional<String> emailOf(String username) {
        return findByUsername(username).map(TestUser::email);
    }

    /** What #logged-in-user should show: the session user, or "guest" (as shop.js does). */
    public static String expectedHeaderName(String sessionUser) {
        return Optional.ofNullable(sessionUser)
                .map(String::trim)
                .filter(name -> !name.isEmpty())
                .orElse("guest");
    }

    private static String knownUsernames() {
        return USERS.stream().map(TestUser::username).collect(Collectors.joining(", "));
    }

    public static void main(String[] args) {
        System.out.println(require("standard_user").email());          // asha.rao@shopeasy.test
        System.out.println(firstUnlockedUser().map(TestUser::username).orElse("none"));
        System.out.println(emailOf("nobody").orElse("(no e-mail)"));
        System.out.println(expectedHeaderName(null));                    // guest
        System.out.println(expectedHeaderName("  "));                    // guest
        require("visual_usr");   // IllegalArgumentException: No test user 'visual_usr'. Known users: standard_user, ...
    }
}
`,
  checks: [
    { label: 'findByUsername returns Optional<TestUser>', pattern: 'Optional\\s*<\\s*TestUser\\s*>\\s+findByUsername\\s*\\(', hint: 'public static Optional<TestUser> findByUsername(String username)' },
    { label: 'Uses stream filter + findFirst', pattern: '\\.filter\\s*\\([\\s\\S]*?\\.findFirst\\s*\\(\\s*\\)', hint: 'USERS.stream().filter(u -> ...).findFirst()' },
    { label: 'Fails clearly with orElseThrow', pattern: '\\.orElseThrow\\s*\\(\\s*\\(\\s*\\)\\s*->', hint: '.orElseThrow(() -> new IllegalArgumentException("No test user ..."))' },
    { label: 'Wraps a maybe-null value with Optional.ofNullable', pattern: 'Optional\\.ofNullable\\s*\\(', hint: 'Optional.ofNullable(sessionUser)' },
    { label: 'Provides the "guest" default with orElse', pattern: '\\.orElse\\s*\\(\\s*"guest"\\s*\\)', hint: '.orElse("guest")' },
    { label: 'Transforms the optional value with map', pattern: '\\.map\\s*\\(\\s*(TestUser::email|\\w+\\s*->\\s*\\w+\\.email\\s*\\(\\s*\\))', hint: 'findByUsername(username).map(TestUser::email)' },
    { label: 'No return null', pattern: 'return\\s+null\\s*;', mustNot: true, hint: 'Return Optional.empty() (findFirst does it for you) instead of null.' },
    { label: 'No bare Optional.get()', pattern: '\\.get\\s*\\(\\s*\\)', mustNot: true, hint: 'get() throws NoSuchElementException with no context; use orElseThrow with a message.' },
  ],
  explanation: `\`Optional<T>\` is a box that holds either one value or nothing. Returning it from a lookup puts "this may find nothing" **into the method signature**, so the compiler makes the caller deal with it instead of getting a surprise \`null\`.

The methods you'll use most:

| Method | Use it when |
|---|---|
| \`orElseThrow(() -> new X("..."))\` | absence is a test-setup error: fail here, with context |
| \`orElse(default)\` | there is a sensible default ("guest") |
| \`map(fn)\` | transform the value if present (\`TestUser::email\`) |
| \`filter(pred)\` | keep it only if it passes a check (not blank) |
| \`isPresent()\` / \`isEmpty()\` | assert presence or absence in a test |
| \`Optional.ofNullable(x)\` | wrap a value that may be null (from an old API, a session, a map) |

* \`stream().filter(...).findFirst()\` already returns an \`Optional\`: empty when nothing matched.
* \`require\` turns a typo into \`IllegalArgumentException: No test user 'visual_usr'. Known users: standard_user, locked_out_user, visual_user\` on the line where the mistake happened. Compare that with an NPE 40 lines later.
* \`Optional.get()\` without a check is just a different NullPointerException (\`NoSuchElementException: No value present\`). That's why it's banned here.

Guidelines: use Optional for **return values** of lookups. Don't use it for fields, method parameters or collections (return an empty list instead of \`Optional<List<...>>\`).`,
  mistakes: [
    'Calling optional.get() without checking, which just moves the crash and loses the context.',
    'Writing if (opt.isPresent()) { return opt.get(); } else { return "guest"; } instead of opt.orElse("guest").',
    'Using orElse(expensiveCall()). The argument is always evaluated; use orElseGet(() -> expensiveCall()) for costly defaults.',
    'Returning null from a method declared to return Optional, which defeats the purpose and causes an NPE on .map().',
  ],
  interview: [
    { q: 'What problem does Optional solve?', a: 'It makes "no result" explicit in a method\'s return type, so callers must handle it with orElse, orElseThrow, map or isPresent instead of forgetting a null check. That turns hidden NullPointerExceptions into deliberate decisions.' },
    { q: 'orElse vs orElseGet vs orElseThrow?', a: 'orElse(value) returns the given default, which is always evaluated. orElseGet(supplier) only calls the supplier when the Optional is empty, which suits expensive defaults. orElseThrow(supplier) throws the exception you supply when empty, which is best for "this must exist" test-data lookups.' },
    { q: 'How do you avoid NullPointerException in a test framework?', a: 'Return Optional or empty collections instead of null, validate inputs early (Objects.requireNonNull, custom exceptions with clear messages), put the known value first in comparisons ("expected".equals(actual)), and use findElements().isEmpty() to check that an element is absent.' },
  ],
}
