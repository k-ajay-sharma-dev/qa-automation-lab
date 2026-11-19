export default {
  id: 'java-030',
  category: 'java',
  kind: 'code',
  title: 'Varargs: one assertInCart(...) instead of three overloads',
  level: 'BEGINNER',
  tags: ['varargs', 'methods', 'assertions', 'cart'],
  estMinutes: 15,
  scenario: `The ShopEasy cart tests have \`assertInCart(cart, a)\`, \`assertInCart(cart, a, b)\` and \`assertInCart(cart, a, b, c)\`. Now a new test adds four products (Trailblazer Backpack, Pulse Bike Light, Retro Red Tee, Junior Onesie) and someone is about to write a fourth copy.
Each copy also stops at the first missing item, so a failed run never tells you everything that was missing. You will replace all of them with one **varargs** method.`,
  description: `Rewrite \`CartAssertions\`. The cart item names have already been read from the page into \`List<String> cartNames\`.

**Acceptance**
* One method \`public static void assertInCart(List<String> cartNames, String... expectedNames)\`.
* If no expected names were passed, throw \`IllegalArgumentException\`. A check that checks nothing should not pass.
* Loop over \`expectedNames\` with a for-each loop and collect **every** missing name in a list.
* If anything is missing, throw one \`AssertionError\` that lists all missing names and the actual cart.
* Delete the fixed-size overloads.`,
  hints: [
    'String... expectedNames is received inside the method as a String[] array.',
    'Check expectedNames.length == 0 first.',
    'List<String> missing = new ArrayList<>(); then missing.add(name) when !cartNames.contains(name).',
  ],
  language: 'java',
  starterCode: `package com.shop.tests;

import java.util.List;

public class CartAssertions {

    public static void assertInCart(List<String> cartNames, String first) {
        if (!cartNames.contains(first)) {
            throw new AssertionError("Missing: " + first);
        }
    }

    public static void assertInCart(List<String> cartNames, String first, String second) {
        assertInCart(cartNames, first);
        assertInCart(cartNames, second);   // never reached if first is missing
    }

    public static void assertInCart(List<String> cartNames, String first, String second, String third) {
        assertInCart(cartNames, first, second);
        assertInCart(cartNames, third);
    }

    // TODO: replace all three with ONE varargs method
}
`,
  solution: `package com.shop.tests;

import java.util.ArrayList;
import java.util.List;

public final class CartAssertions {

    private CartAssertions() { }

    /** Fails once, listing EVERY expected product that is not in the cart. */
    public static void assertInCart(List<String> cartNames, String... expectedNames) {
        if (expectedNames.length == 0) {
            throw new IllegalArgumentException("assertInCart needs at least one expected product name");
        }
        List<String> missing = new ArrayList<>();
        for (String name : expectedNames) {
            if (!cartNames.contains(name)) {
                missing.add(name);
            }
        }
        if (!missing.isEmpty()) {
            throw new AssertionError("Missing from cart: " + missing + " | cart was: " + cartNames);
        }
    }

    public static void main(String[] args) {
        List<String> cart = List.of("Trailblazer Backpack", "Pulse Bike Light", "Retro Red Tee");

        assertInCart(cart, "Trailblazer Backpack");                       // 1 name
        assertInCart(cart, "Pulse Bike Light", "Retro Red Tee");          // 2 names
        assertInCart(cart, "Trailblazer Backpack", "Pulse Bike Light",
                "Retro Red Tee", "Junior Onesie");                        // fails: lists Junior Onesie
    }
}
`,
  checks: [
    { label: 'Declares a varargs parameter', pattern: 'String\\s*\\.\\.\\.\\s*\\w+', hint: 'public static void assertInCart(List<String> cartNames, String... expectedNames)' },
    { label: 'Rejects a call with no expected names', pattern: '\\.length\\s*(==\\s*0|<\\s*1)', hint: 'if (expectedNames.length == 0) throw new IllegalArgumentException(...)' },
    { label: 'Loops over the varargs with for-each', pattern: 'for\\s*\\(\\s*String\\s+\\w+\\s*:\\s*\\w+\\s*\\)', hint: 'for (String name : expectedNames)' },
    { label: 'Collects all missing names', pattern: '\\w+\\.add\\s*\\(\\s*\\w+\\s*\\)', hint: 'missing.add(name);' },
    { label: 'Fails with an AssertionError', pattern: 'throw\\s+new\\s+AssertionError', hint: 'throw new AssertionError("Missing from cart: " + missing)' },
    { label: 'No fixed-size overloads left', pattern: 'assertInCart\\s*\\([^)]*String\\s+\\w+\\s*,\\s*String\\s+\\w+', mustNot: true, hint: 'Delete the (String first, String second, ...) versions.' },
  ],
  explanation: `**Varargs** (\`String... names\`) lets a method accept zero or more arguments of one type. The caller writes them as normal arguments, and inside the method they arrive as an array (\`String[]\`), so \`.length\` and for-each work.

* One method now handles 1, 2 or 10 products. No more copies to keep in sync.
* Rules: only **one** varargs parameter, and it must be **last** (\`assertInCart(List<String> cart, String... names)\`).
* Zero arguments is legal for the compiler, so guard against it. Otherwise \`assertInCart(cart)\` passes while checking nothing.
* Collecting all missing items before failing is a soft-assert idea: one red run tells you everything that is wrong.

You already use varargs every day: \`String.format("%s %d", a, b)\`, \`List.of(a, b, c)\` and \`Arrays.asList(...)\` are all varargs methods.`,
  mistakes: [
    'Putting the varargs parameter first, e.g. (String... names, List<String> cart), which does not compile.',
    'Not guarding against zero arguments, so an empty call silently passes.',
    'Throwing on the first missing item, which hides the rest of the failures.',
  ],
  interview: [
    { q: 'How does Java receive varargs inside the method?', a: 'As an array of the declared type. String... names is a String[] inside the method, so you can use names.length, index it, or loop over it. Callers may also pass an existing array directly.' },
    { q: 'Can a method have two varargs parameters?', a: 'No. Only one varargs parameter is allowed and it must be the last one, otherwise the compiler could not tell where one list ends and the next begins.' },
    { q: 'Name some varargs methods you use in automation.', a: 'String.format, List.of, Arrays.asList, Selenium Actions.sendKeys(CharSequence...), and TestNG/AssertJ methods like containsExactly(...).' },
  ],
}
