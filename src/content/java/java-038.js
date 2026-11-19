export default {
  id: 'java-038',
  category: 'java',
  kind: 'quiz',
  title: 'Boolean logic in test conditions: short-circuit, ternary and De Morgan',
  level: 'INTERMEDIATE',
  tags: ['boolean-logic', 'short-circuit', 'ternary', 'operators', 'null-safety', 'interview', 'output-prediction'],
  estMinutes: 12,
  scenario: `The inventory page test has grown conditions like "if the user is not a guest and not on mobile, or the badge is empty...". Last sprint a guard \`if (badge != null & badge.isDisplayed())\` threw NullPointerException on an empty cart (ShopEasy removes \`.shopping-cart-badge\` when the cart is empty), and a "simplified" condition skipped the guest-notice check for every user.
A condition in a test decides **what gets verified**. Get it wrong and the test silently checks less than you think.`,
  description: `Predict each result. Watch for \`&\` vs \`&&\`, operator precedence and how \`!\` spreads over \`&&\` / \`||\`.`,
  questions: [
    {
      q: `The cart is empty, so \`badgeText\` is \`null\`. What happens on each line?
\`\`\`java
String badgeText = null;
boolean a = badgeText != null && !badgeText.isBlank();   // line A
boolean b = badgeText != null & !badgeText.isBlank();    // line B
\`\`\``,
      options: [
        'Both are false',
        'A is false, B throws NullPointerException',
        'Both throw NullPointerException',
        'A throws NullPointerException, B is false',
      ],
      answer: 1,
      why: '`&&` is **short-circuit**: when the left side is false, the right side is never evaluated, so `isBlank()` is not called on null. A single `&` on booleans evaluates **both** sides, so line B calls `null.isBlank()` and throws. Always use `&&` and `||` in conditions; put the null check first.',
    },
    {
      q: `What does this print for a guest user?
\`\`\`java
boolean loggedIn = false;
int items = 2;
String label = loggedIn ? "Checkout" : items > 0 ? "Log in to check out" : "Browse";
System.out.println(label);
\`\`\``,
      options: ['Checkout', 'Log in to check out', 'Browse', 'Compile error: nested ternary'],
      answer: 1,
      why: 'The ternary `cond ? x : y` returns `x` when `cond` is true, otherwise `y`. Nested ternaries group from the right: `loggedIn ? "Checkout" : (items > 0 ? "Log in to check out" : "Browse")`. `loggedIn` is false and `items > 0` is true. It compiles, but more than one level is hard to read; use if/else or a switch for anything bigger.',
    },
    {
      q: `The rule: "show the guest notice unless the user is logged in **or** the page is the login page". Which condition is equivalent to \`!(loggedIn || onLoginPage)\`?`,
      options: [
        '`!loggedIn || !onLoginPage`',
        '`!loggedIn && !onLoginPage`',
        '`loggedIn && onLoginPage`',
        '`!loggedIn && onLoginPage`',
      ],
      answer: 1,
      why: "**De Morgan's law**: `!(a || b)` equals `!a && !b`, and `!(a && b)` equals `!a || !b`. When you push `!` inside the brackets, `||` and `&&` swap. Option A is the classic refactoring bug: it is true for almost every user, which is how the notice check went wrong.",
    },
    {
      q: `What does this print?
\`\`\`java
boolean isAdmin = false;
boolean isQa = true;
boolean featureOn = false;
System.out.println(isAdmin || isQa && featureOn);
\`\`\``,
      options: ['true', 'false', 'Compile error', 'Depends on evaluation order at run time'],
      answer: 1,
      why: '`&&` has **higher precedence** than `||`, so this is `isAdmin || (isQa && featureOn)` = `false || (true && false)` = false. If you meant `(isAdmin || isQa) && featureOn`, write the brackets. Brackets in mixed conditions cost nothing and save a reviewer from guessing.',
    },
    {
      q: 'Which is the cleanest way to write an assertion message that says "badge missing" when the text is null, and shows the text otherwise?',
      options: [
        '`String msg = badgeText == null ? "badge missing" : "badge was " + badgeText;`',
        '`String msg = "badge was " + badgeText.trim();`',
        '`String msg = badgeText.equals(null) ? "badge missing" : badgeText;`',
        '`String msg = (badgeText = null) ? "badge missing" : badgeText;`',
      ],
      answer: 0,
      why: 'A ternary is ideal for picking between two values. B throws NPE on null. C also throws, because you can\'t call `.equals` on null (and `x.equals(null)` is always false anyway). D uses assignment `=` instead of comparison `==` and does not compile, since a String is not a boolean.',
    },
  ],
  hints: [
    '&& and || stop as soon as the answer is known; & and | always evaluate both sides.',
    '&& binds tighter than ||. Pushing ! inside brackets swaps && and ||.',
  ],
  explanation: `* **Short-circuit**: \`a && b\` skips \`b\` when \`a\` is false; \`a || b\` skips \`b\` when \`a\` is true. That is what makes \`x != null && x.isDisplayed()\` safe. \`&\` and \`|\` evaluate both sides.
* **Precedence**: \`!\` first, then \`&&\`, then \`||\`, and \`? :\` last. Add brackets whenever you mix them.
* **De Morgan**: \`!(a || b) == !a && !b\`, \`!(a && b) == !a || !b\`. Use it to simplify conditions, and to check a teammate's simplification.
* **Ternary**: \`condition ? valueIfTrue : valueIfFalse\` is an *expression* that returns a value. Good for one choice (labels, messages, defaults), bad when nested.

For a tester this is boundary analysis on your own code: write down the truth table for the 2–3 inputs and check each row.`,
  mistakes: [
    'Using & or | in a null-guard, so the right side still runs and throws.',
    'Rewriting !(a || b) as !a || !b during a cleanup.',
    'Relying on precedence in a || b && c instead of writing the brackets.',
    'Nesting three ternaries in a step definition that nobody can read during triage.',
  ],
  interview: [
    { q: 'Difference between & and && in Java?', a: '&& is the logical AND with short-circuit: if the left side is false, the right side is not evaluated. & on booleans evaluates both sides (and on integers it is a bitwise AND). Use && in conditions so null checks protect the following call.' },
    { q: 'When would you use a ternary operator?', a: 'To choose between two values in a single expression, such as a default or a message: String env = prop == null ? "qa" : prop. For logic with side effects or more than two branches, if/else or a switch expression is clearer.' },
  ],
}
