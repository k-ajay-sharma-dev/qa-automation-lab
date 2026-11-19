export default {
  id: 'java-037',
  category: 'java',
  kind: 'code',
  title: 'Count products and stock per category with getOrDefault and merge',
  level: 'INTERMEDIATE',
  tags: ['collections', 'map', 'getordefault', 'merge', 'counting', 'api-testing'],
  estMinutes: 20,
  scenario: `The product owner wants a smoke check on \`GET /api/products\`: "clothing should have 3 products and 72 items in stock, every other category 1 product".
A teammate wrote the counting loop with \`containsKey\` / \`get\` / \`put\` in three places, and one copy has a bug that starts every count at 0 instead of 1.
Java's \`Map\` has two methods made for exactly this: \`getOrDefault\` and \`merge\`.`,
  description: `Complete \`CategoryStats\`. The API returns these products (from the seed data):

| name | category | stock |
|---|---|---|
| Trailblazer Backpack | bags | 25 |
| Pulse Bike Light | accessories | 40 |
| Classic Crew T-Shirt | clothing | 60 |
| Storm Fleece Jacket | clothing | 12 |
| Junior Onesie | kids | 30 |
| Retro Red Tee | clothing | 0 |

**Acceptance**
* \`Map<String, Integer> countByCategory(List<Product> products)\` uses \`getOrDefault(category, 0) + 1\`. No \`containsKey\`.
* \`Map<String, Integer> stockByCategory(List<Product> products)\` uses \`merge(category, stock, Integer::sum)\`.
* Both return a \`TreeMap\` (sorted by category, so failure messages are stable).
* \`String report(Map<String, Integer> map)\` loops over \`entrySet()\` and builds lines like \`clothing=3\`.
* Delete the old \`containsKey\` version.`,
  hints: [
    'counts.put(c, counts.getOrDefault(c, 0) + 1);',
    'stock.merge(p.category(), p.stock(), Integer::sum); — puts the value if the key is new, otherwise adds it to the old value.',
    'for (Map.Entry<String, Integer> e : map.entrySet()) { sb.append(e.getKey()).append("=").append(e.getValue()).append("\\n"); }',
  ],
  language: 'java',
  starterCode: `package com.shopeasy.api;

import java.util.*;

public class CategoryStats {

    public record Product(String name, String category, int stock) {}

    // Old version: works, but verbose and easy to get wrong
    public static Map<String, Integer> countOld(List<Product> products) {
        Map<String, Integer> counts = new HashMap<>();
        for (Product p : products) {
            if (counts.containsKey(p.category())) {
                counts.put(p.category(), counts.get(p.category()) + 1);
            } else {
                counts.put(p.category(), 1);
            }
        }
        return counts;
    }

    // TODO: countByCategory with getOrDefault
    // TODO: stockByCategory with merge
    // TODO: report(Map<String, Integer>) using entrySet()
}
`,
  solution: `package com.shopeasy.api;

import java.util.*;

public class CategoryStats {

    public record Product(String name, String category, int stock) {}

    public static Map<String, Integer> countByCategory(List<Product> products) {
        Map<String, Integer> counts = new TreeMap<>();
        for (Product p : products) {
            counts.put(p.category(), counts.getOrDefault(p.category(), 0) + 1);
        }
        return counts;
    }

    public static Map<String, Integer> stockByCategory(List<Product> products) {
        Map<String, Integer> stock = new TreeMap<>();
        for (Product p : products) {
            stock.merge(p.category(), p.stock(), Integer::sum);
        }
        return stock;
    }

    public static String report(Map<String, Integer> map) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, Integer> e : map.entrySet()) {
            sb.append(e.getKey()).append('=').append(e.getValue()).append('\\n');
        }
        return sb.toString();
    }
}

// In the API test:
// Map<String, Integer> counts = CategoryStats.countByCategory(products);
// Assert.assertEquals(counts, Map.of("accessories", 1, "bags", 1, "clothing", 3, "kids", 1),
//         "Products per category:\\n" + CategoryStats.report(counts));
// Assert.assertEquals(CategoryStats.stockByCategory(products).get("clothing"), Integer.valueOf(72));
`,
  checks: [
    { label: 'Counts with getOrDefault(key, 0)', pattern: '\\.getOrDefault\\s*\\([^,]+,\\s*0\\s*\\)\\s*\\+\\s*1', hint: 'counts.put(c, counts.getOrDefault(c, 0) + 1);' },
    { label: 'Sums stock with merge', pattern: '\\.merge\\s*\\([^,]+,[^,]+,\\s*(Integer::sum|\\(\\s*\\w+\\s*,\\s*\\w+\\s*\\)\\s*->)', hint: 'stock.merge(p.category(), p.stock(), Integer::sum);' },
    { label: 'Uses a TreeMap for sorted keys', pattern: 'new\\s+TreeMap\\s*<', hint: 'Map<String, Integer> counts = new TreeMap<>();' },
    { label: 'Iterates entrySet() in report', pattern: '\\.entrySet\\s*\\(\\s*\\)', hint: 'for (Map.Entry<String, Integer> e : map.entrySet())' },
    { label: 'No containsKey/get/put dance', pattern: '\\.containsKey\\s*\\(', mustNot: true, hint: 'getOrDefault replaces the containsKey check.' },
  ],
  explanation: `Counting and summing by key is one of the most common jobs in test code: errors per field, products per category, orders per status.

* **\`getOrDefault(key, 0)\`** returns the stored value, or \`0\` when the key is missing. One line replaces the \`if/else\` and can't start at the wrong number.
* **\`merge(key, value, Integer::sum)\`**: if the key is new, it stores \`value\`; otherwise it calls \`Integer.sum(old, value)\` and stores the result. Perfect for totals (clothing: 60 + 12 + 0 = 72).
* **\`TreeMap\`** keeps keys sorted, so \`report\` always prints accessories, bags, clothing, kids, and a failure message is easy to diff. \`assertEquals\` on maps compares content, so the map type doesn't matter for equality.
* **\`entrySet()\`** gives key and value together without a second lookup.

Streams can do the same (\`Collectors.groupingBy(Product::category, Collectors.counting())\`), but the loop with \`getOrDefault\`/\`merge\` is easier to debug for someone new to Java.`,
  mistakes: [
    'Starting the count with getOrDefault(key, 1) + 1, so every category is one too high.',
    'Using map.get(key) + 1 on a missing key, which unboxes null and throws NullPointerException.',
    'Using HashMap and asserting on report() text, which fails randomly because HashMap has no order.',
    'Writing merge(key, 1, Integer::sum) for stock totals, which counts products instead of summing stock.',
  ],
  interview: [
    { q: 'How do you count occurrences of words or values in Java?', a: 'Loop over the values and use map.merge(value, 1, Integer::sum) or map.put(value, map.getOrDefault(value, 0) + 1). With streams: Collectors.groupingBy(Function.identity(), Collectors.counting()).' },
    { q: 'HashMap vs LinkedHashMap vs TreeMap?', a: 'HashMap has no guaranteed order and is the fastest general choice. LinkedHashMap keeps insertion order. TreeMap keeps keys sorted (natural order or a Comparator) and does not allow null keys.' },
    { q: 'What does computeIfAbsent do?', a: 'It returns the value for a key and, if the key is missing, creates the value with the given function and stores it. It is ideal for grouping: map.computeIfAbsent(category, k -> new ArrayList<>()).add(product).' },
  ],
}
