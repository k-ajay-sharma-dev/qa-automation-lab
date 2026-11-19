export default {
  id: 'java-034',
  category: 'java',
  kind: 'code',
  title: 'Generic helpers: one duplicates() and one isSortedAscending() for any type',
  level: 'ADVANCED',
  tags: ['generics', 'bounded-types', 'comparable', 'collections', 'utilities'],
  estMinutes: 25,
  scenario: `\`CollectionChecks\` in the ShopEasy framework has grown to four near-identical methods: \`duplicateNames(List<String>)\`, \`duplicatePrices(List<Double>)\`, \`isSortedStrings(List<String>)\` and \`isSortedDoubles(List<Double>)\`. Now the employee directory tests need the same checks for \`List<Integer>\` salaries, and the next copy is one PR away.
You will replace them with **two generic methods** that work for any type.`,
  description: `Rewrite \`CollectionChecks\` with generic methods.

**Acceptance**
* \`public static <T> Set<T> duplicates(Collection<T> items)\`: return every value that appears more than once, in first-seen order (\`LinkedHashSet\`). Use the boolean returned by \`Set.add\`.
* \`public static <T extends Comparable<? super T>> boolean isSortedAscending(List<T> items)\`: compare neighbours with \`compareTo\`; return false on the first pair out of order.
* No type-specific copies left (\`duplicateNames\`, \`duplicatePrices\`, \`isSortedStrings\`, \`isSortedDoubles\`).
* The same methods must work for product names (\`String\`), prices (\`Double\`) and salaries (\`Integer\`).`,
  hints: [
    'Declare the type parameter before the return type: public static <T> Set<T> duplicates(Collection<T> items).',
    'Set.add returns false when the item was already there: if (!seen.add(item)) dups.add(item);',
    'To call compareTo on T, the compiler must know T is Comparable: <T extends Comparable<? super T>>.',
  ],
  language: 'java',
  starterCode: `package com.shop.utils;

import java.util.*;

public final class CollectionChecks {

    private CollectionChecks() { }

    public static Set<String> duplicateNames(List<String> names) {
        Set<String> seen = new HashSet<>();
        Set<String> dups = new LinkedHashSet<>();
        for (String n : names) {
            if (seen.contains(n)) dups.add(n);
            seen.add(n);
        }
        return dups;
    }

    public static Set<Double> duplicatePrices(List<Double> prices) {
        Set<Double> seen = new HashSet<>();
        Set<Double> dups = new LinkedHashSet<>();
        for (Double p : prices) {
            if (seen.contains(p)) dups.add(p);
            seen.add(p);
        }
        return dups;
    }

    public static boolean isSortedStrings(List<String> names) {
        for (int i = 1; i < names.size(); i++) {
            if (names.get(i - 1).compareTo(names.get(i)) > 0) return false;
        }
        return true;
    }

    public static boolean isSortedDoubles(List<Double> prices) {
        for (int i = 1; i < prices.size(); i++) {
            if (prices.get(i - 1) > prices.get(i)) return false;
        }
        return true;
    }

    // TODO: replace the four methods above with two generic ones
}
`,
  solution: `package com.shop.utils;

import java.util.*;

public final class CollectionChecks {

    private CollectionChecks() { }

    /** Every value that occurs more than once, in the order it was first repeated. */
    public static <T> Set<T> duplicates(Collection<T> items) {
        Set<T> seen = new HashSet<>();
        Set<T> dups = new LinkedHashSet<>();
        for (T item : items) {
            if (!seen.add(item)) {          // add() returns false if it was already there
                dups.add(item);
            }
        }
        return dups;
    }

    /** True when every element is <= the next one. Works for String, Double, Integer, LocalDate... */
    public static <T extends Comparable<? super T>> boolean isSortedAscending(List<T> items) {
        for (int i = 1; i < items.size(); i++) {
            if (items.get(i - 1).compareTo(items.get(i)) > 0) {
                return false;
            }
        }
        return true;
    }

    public static void main(String[] args) {
        List<String> names = List.of("Classic Crew T-Shirt", "Junior Onesie", "Retro Red Tee", "Retro Red Tee");
        List<Double> prices = List.of(7.99, 9.99, 15.99, 15.99, 29.99, 49.99);
        List<Integer> salaries = List.of(57000, 58000, 60000, 62000);

        System.out.println(duplicates(names));            // [Retro Red Tee]
        System.out.println(duplicates(prices));           // [15.99]
        System.out.println(isSortedAscending(prices));    // true
        System.out.println(isSortedAscending(salaries));  // true
        System.out.println(isSortedAscending(List.of("za", "az")));  // false
    }
}
`,
  checks: [
    { label: 'Declares a generic method with <T>', pattern: 'static\\s+<\\s*T\\s*>\\s+\\w+', hint: 'public static <T> Set<T> duplicates(Collection<T> items)' },
    { label: 'Takes a Collection<T> or List<T> parameter', pattern: '(Collection|List)\\s*<\\s*T\\s*>\\s+\\w+\\s*\\)', hint: '(Collection<T> items)' },
    { label: 'Uses the boolean returned by Set.add', pattern: '!\\s*\\w+\\.add\\s*\\(', hint: 'if (!seen.add(item)) dups.add(item);' },
    { label: 'Bounds T to Comparable', pattern: '<\\s*T\\s+extends\\s+Comparable\\s*<', hint: '<T extends Comparable<? super T>>' },
    { label: 'Compares neighbours with compareTo', pattern: '\\.compareTo\\s*\\(', hint: 'items.get(i - 1).compareTo(items.get(i)) > 0' },
    { label: 'No type-specific copies left', pattern: '\\b(duplicateNames|duplicatePrices|isSortedStrings|isSortedDoubles)\\b', mustNot: true, hint: 'Delete the String/Double versions.' },
  ],
  explanation: `**Generics** let one method work for many types while the compiler still checks types for you. \`<T>\` before the return type declares a type parameter; Java infers it from the argument (\`duplicates(prices)\` makes \`T = Double\`).

* \`duplicates\` needs nothing special from \`T\`: \`HashSet\` uses the element's own \`equals\`/\`hashCode\`, which String, Double, Integer and records already have.
* \`isSortedAscending\` must call \`compareTo\`, so \`T\` gets a **bound**: \`T extends Comparable<...>\`. Now \`List<WebElement>\` is rejected at compile time instead of failing at runtime.
* \`? super T\` is the flexible form used by the JDK (\`Collections.sort\`). It also accepts a type whose \`compareTo\` is inherited from a parent class.
* \`Set.add\` returning \`false\` for an existing item replaces the separate \`contains\` + \`add\`.
* Returning a \`LinkedHashSet\` keeps the order stable, so failure messages are the same on every run.

Why not \`List<Object>\`? Because you lose the type: the caller would need casts, and \`compareTo\` would not compile.`,
  mistakes: [
    'Writing the type parameter after the return type (public static Set<T> <T> ...), which does not compile.',
    'Calling compareTo on an unbounded T. The compiler only knows T is an Object.',
    'Using List<Object> as a parameter. A List<String> is not a List<Object>, so callers cannot even pass their list.',
    'Returning a HashSet, so the order of reported duplicates changes between runs.',
  ],
  interview: [
    { q: 'What is type erasure?', a: 'Generic type information is checked at compile time and then removed: at runtime List<String> and List<Double> are both just List. That is why you cannot write new T() or check instanceof List<String>.' },
    { q: 'What do extends and super mean in wildcards?', a: 'PECS: Producer Extends, Consumer Super. List<? extends Number> can be read as Numbers (it produces them). Comparable<? super T> accepts something that can consume, that is compare, a T, including a parent type of T.' },
    { q: 'Why is List<String> not a List<Object>?', a: 'If it were, you could add an Integer to it through the List<Object> reference and corrupt the String list. Generics are invariant for safety; use List<?> or List<? extends Object> when you only need to read.' },
  ],
}
