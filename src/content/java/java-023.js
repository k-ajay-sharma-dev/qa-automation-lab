export default {
  id: 'java-023',
  category: 'java',
  kind: 'code',
  title: 'Comparator: verify "price low to high" with a name tie-breaker',
  level: 'INTERMEDIATE',
  tags: ['comparator', 'sorting', 'collections', 'method-references'],
  estMinutes: 25,
  scenario: `The inventory page has a sort dropdown (\`#product-sort\`). Two ShopEasy products cost the same: **Classic Crew T-Shirt** and **Retro Red Tee**, both \`$15.99\`. Story SHOP-1130 says: "When prices are equal, order products by name A→Z, in **both** price sorts."
The existing check compares prices only, so it can't catch a wrong tie order. It also lives in a 30-line nested loop nobody wants to touch.
You'll describe the expected order with a **Comparator** that sorts by price, then by name.`,
  description: `Complete \`SortOrderCheck\`. The page has already been read into a \`List<Product>\` in page order (\`record Product(String name, double price)\`).

**Acceptance**
* \`static final Comparator<Product> PRICE_LOW_HIGH\`: by price ascending, **then** by name. Use \`Comparator.comparingDouble(Product::price).thenComparing(Product::name)\`.
* \`static final Comparator<Product> PRICE_HIGH_LOW\`: price **descending**, but ties still by name **A→Z**. Reverse only the price part: \`Comparator.comparingDouble(Product::price).reversed().thenComparing(Product::name)\`.
* \`boolean isSortedBy(List<Product> shown, Comparator<Product> order)\`: sort a **copy** with the comparator and compare it with \`shown\` using \`equals\`. Fail fast if \`shown\` is empty.
* No hand-written nested loops.`,
  hints: [
    'Comparator.comparingDouble(Product::price) builds "compare by price". .thenComparing(Product::name) only runs when the prices are equal.',
    'Calling .reversed() at the END would also reverse the names (Z→A). Put it right after the price part.',
    'List<Product> expected = new ArrayList<>(shown); expected.sort(order); return expected.equals(shown);',
  ],
  language: 'java',
  starterCode: `package com.shop.tests;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class SortOrderCheck {

    record Product(String name, double price) { }

    // Only checks prices; the tie order (SHOP-1130) is never verified.
    public static boolean isSortedLowToHigh(List<Product> shown) {
        for (int i = 0; i < shown.size(); i++) {
            for (int j = i + 1; j < shown.size(); j++) {
                if (shown.get(i).price() > shown.get(j).price()) {
                    return false;
                }
            }
        }
        return true;
    }

    // TODO: static final Comparator<Product> PRICE_LOW_HIGH  (price, then name)
    // TODO: static final Comparator<Product> PRICE_HIGH_LOW  (price desc, then name A-Z)
    // TODO: boolean isSortedBy(List<Product> shown, Comparator<Product> order)
}
`,
  solution: `package com.shop.tests;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class SortOrderCheck {

    record Product(String name, double price) { }

    /** "Price (low to high)": cheapest first, equal prices A-Z by name. */
    static final Comparator<Product> PRICE_LOW_HIGH =
            Comparator.comparingDouble(Product::price)
                      .thenComparing(Product::name);

    /** "Price (high to low)": most expensive first, equal prices STILL A-Z by name. */
    static final Comparator<Product> PRICE_HIGH_LOW =
            Comparator.comparingDouble(Product::price).reversed()
                      .thenComparing(Product::name);

    public static boolean isSortedBy(List<Product> shown, Comparator<Product> order) {
        if (shown.isEmpty()) {
            throw new IllegalStateException("No products shown - cannot verify sort order");
        }
        List<Product> expected = new ArrayList<>(shown);   // copy: keep the page order intact
        expected.sort(order);
        return expected.equals(shown);                     // records compare field by field
    }

    public static void main(String[] args) {
        // what the page shows after selecting "lohi" in #product-sort
        List<Product> lowHigh = List.of(
                new Product("Junior Onesie", 7.99),
                new Product("Pulse Bike Light", 9.99),
                new Product("Classic Crew T-Shirt", 15.99),
                new Product("Retro Red Tee", 15.99),
                new Product("Trailblazer Backpack", 29.99),
                new Product("Storm Fleece Jacket", 49.99));

        System.out.println("low->high ok: " + isSortedBy(lowHigh, PRICE_LOW_HIGH));    // true
        System.out.println("as high->low: " + isSortedBy(lowHigh, PRICE_HIGH_LOW));    // false
    }
}
`,
  checks: [
    { label: 'Builds a comparator with Comparator.comparing...', pattern: 'Comparator\\.comparing(Double|Int|Long)?\\s*\\(', hint: 'Comparator.comparingDouble(Product::price)' },
    { label: 'Adds a tie-breaker with thenComparing', pattern: '\\.thenComparing\\s*\\(', hint: '.thenComparing(Product::name)' },
    { label: 'Reverses only the price part', pattern: '\\.reversed\\s*\\(\\s*\\)\\s*\\.thenComparing', hint: 'Comparator.comparingDouble(Product::price).reversed().thenComparing(Product::name)' },
    { label: 'Uses method references or lambdas for the keys', pattern: '(Product::\\w+|\\w+\\s*->\\s*\\w+\\.\\w+\\s*\\(\\s*\\))', hint: 'Product::price is shorthand for p -> p.price()' },
    { label: 'Sorts a copy, not the page list', pattern: '(new\\s+ArrayList\\s*<[^>]*>\\s*\\(\\s*\\w+\\s*\\)|\\.stream\\s*\\(\\s*\\)\\s*\\.sorted\\s*\\(\\s*\\w+)', hint: 'List<Product> expected = new ArrayList<>(shown);' },
    { label: 'Compares expected with shown using equals', pattern: '\\w+\\.equals\\s*\\(\\s*\\w+\\s*\\)', hint: 'return expected.equals(shown);' },
    { label: 'No hand-written nested loops', pattern: 'for\\s*\\([^{]*\\{\\s*for\\s*\\(', mustNot: true, hint: 'Let the Comparator describe the order.' },
  ],
  explanation: `A **Comparator** is an object that answers one question: "which of these two comes first?" You build it from the *keys* you sort by, which reads almost like the acceptance criterion:

\`\`\`java
Comparator.comparingDouble(Product::price)   // first by price
          .thenComparing(Product::name);     // if equal, by name
\`\`\`

* \`comparingDouble(Product::price)\` compares two products by their \`price()\`. Use \`comparingDouble\`/\`comparingInt\` for primitive keys and \`comparing\` for objects like Strings or dates.
* \`thenComparing\` is only consulted when the earlier keys are equal, which is the tie-breaker rule from SHOP-1130.
* **Where you put \`.reversed()\` matters.** \`.reversed()\` reverses the *whole chain built so far*. \`comparingDouble(price).thenComparing(name).reversed()\` would sort ties Z→A, so the descending check would wrongly fail when ShopEasy behaves correctly. Reversing right after the price part keeps the names A→Z.
* Sorting a **copy** and comparing with \`equals\` is the same technique as java-011, now for objects. It works because a **record** gets an \`equals\` that compares all its fields. A plain class without \`equals\` would compare references and never be equal.

Comparators can also be stored as constants and reused for other sorts (e.g. \`Comparator.comparing(Product::name)\` for A→Z).`,
  mistakes: [
    'Calling .reversed() at the end of the chain, which reverses the tie-breaker too.',
    'Sorting only by price, so the test cannot see a wrong order between equal-priced products.',
    'Sorting the list read from the page and then comparing it with itself (always true).',
    'Sorting Strings like "$15.99" instead of numbers, which gives alphabetical order ("$100" < "$20").',
  ],
  interview: [
    { q: 'Comparable vs Comparator?', a: 'Comparable is implemented by the class itself (compareTo) and defines one natural order, e.g. String sorts alphabetically. A Comparator is a separate object, so you can have as many orders as you need (by price, by name, by price then name) without changing the class.' },
    { q: 'How do you sort objects by multiple fields in Java 8+?', a: 'Chain comparators: Comparator.comparing(Product::category).thenComparing(Product::price).thenComparing(Product::name). Use reversed() on the part that should be descending, or Comparator.reverseOrder() as the key comparator in thenComparing.' },
    { q: 'What does compare() return?', a: 'A negative number if the first argument comes first, zero if they are equal for sorting purposes, and a positive number if the second comes first. Builders like comparingDouble handle this for you and avoid subtraction-overflow bugs.' },
  ],
}
