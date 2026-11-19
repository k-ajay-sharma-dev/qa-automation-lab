export default {
  id: 'int-018',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: second-highest price and sorting a Map by value',
  level: 'INTERMEDIATE',
  tags: ['java', 'live-coding', 'bigdecimal', 'comparator', 'map', 'sorting'],
  estMinutes: 20,
  scenario: `The interviewer has read the six ShopEasy inventory prices into Java and asks two classics in a row: *"Find the second-highest price — in one pass, without sorting the list."* and *"Now print the products from most to least expensive."* The data hides two traps: **Classic Crew T-Shirt and Retro Red Tee both cost $15.99**, and a candidate who returns \`new TreeMap<>(prices)\` gets the products sorted alphabetically, not by price.`,
  description: `Implement two static methods in \`PriceUtils\`:

1. \`secondHighest(List<BigDecimal> prices)\` → \`BigDecimal\`
   - \`[29.99, 9.99, 15.99, 49.99, 7.99, 15.99]\` → \`29.99\`
   - \`[49.99, 49.99, 29.99]\` → \`29.99\` (the second **distinct** price, not the second element of a sorted list)
   - fewer than two distinct prices (\`[9.99]\`, \`[9.99, 9.99]\`, \`null\`) → \`IllegalArgumentException\` with a clear message
2. \`sortByPriceDesc(Map<String, BigDecimal> prices)\` → \`Map<String, BigDecimal>\`
   - most expensive first; equal prices ordered by name A→Z
   - \`Storm Fleece Jacket=49.99, Trailblazer Backpack=29.99, Classic Crew T-Shirt=15.99, Retro Red Tee=15.99, Pulse Bike Light=9.99, Junior Onesie=7.99\`

**Rules / Acceptance**
- \`secondHighest\`: a single loop tracking \`highest\` and \`second\`; do **not** sort or modify the caller's list.
- Compare \`BigDecimal\` values with \`compareTo\`, never \`==\` or \`equals\` (\`equals\` says \`15.9\` ≠ \`15.90\`).
- \`sortByPriceDesc\`: sort the entries by value and collect them into a \`LinkedHashMap\` so the order survives.`,
  hints: [
    'If price > highest: second = highest; highest = price. Else if price < highest and (second == null or price > second): second = price.',
    'List<Map.Entry<String, BigDecimal>> entries = new ArrayList<>(prices.entrySet()); then entries.sort(...)',
    'Comparator: compare b.getValue() with a.getValue() for descending; if equal, a.getKey().compareTo(b.getKey()).',
  ],
  language: 'java',
  starterCode: String.raw`import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public class PriceUtils {

    public static BigDecimal secondHighest(List<BigDecimal> prices) {
        Collections.sort(prices);
        return prices.get(prices.size() - 2);
    }

    public static Map<String, BigDecimal> sortByPriceDesc(Map<String, BigDecimal> prices) {
        return new TreeMap<>(prices);
    }
}
`,
  solution: String.raw`import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class PriceUtils {

    public static BigDecimal secondHighest(List<BigDecimal> prices) {
        if (prices == null) {
            throw new IllegalArgumentException("Price list must not be null");
        }
        BigDecimal highest = null;
        BigDecimal second = null;
        for (BigDecimal price : prices) {
            if (highest == null || price.compareTo(highest) > 0) {
                second = highest;
                highest = price;
            } else if (price.compareTo(highest) < 0 && (second == null || price.compareTo(second) > 0)) {
                second = price;
            }
        }
        if (second == null) {
            throw new IllegalArgumentException("Need at least two different prices, got " + prices);
        }
        return second;
    }

    public static Map<String, BigDecimal> sortByPriceDesc(Map<String, BigDecimal> prices) {
        List<Map.Entry<String, BigDecimal>> entries = new ArrayList<>(prices.entrySet());
        entries.sort((a, b) -> {
            int byPrice = b.getValue().compareTo(a.getValue());
            return byPrice != 0 ? byPrice : a.getKey().compareTo(b.getKey());
        });
        Map<String, BigDecimal> sorted = new LinkedHashMap<>();
        for (Map.Entry<String, BigDecimal> entry : entries) {
            sorted.put(entry.getKey(), entry.getValue());
        }
        return sorted;
    }
}
`,
  checks: [
    { label: 'Compares BigDecimal with compareTo', pattern: '\\.compareTo\\s*\\(', hint: 'price.compareTo(highest) > 0 — never == for objects' },
    { label: 'Does not sort or modify the caller\'s price list', pattern: '(Collections\\.sort\\s*\\(\\s*prices|prices\\s*\\.\\s*sort\\s*\\()', mustNot: true, hint: 'One loop with two variables; sorting is O(n log n) and changes the caller\'s list' },
    { label: 'Skips duplicates of the highest price', pattern: '(compareTo\\s*\\([^)]*\\)\\s*<\\s*0|\\.distinct\\s*\\()', hint: 'Only accept a candidate for second when price.compareTo(highest) < 0' },
    { label: 'Fails clearly when there is no second price', pattern: '(IllegalArgumentException|NoSuchElementException)', hint: 'throw new IllegalArgumentException("Need at least two different prices, got " + prices);' },
    { label: 'Sorts entries by value', pattern: '(getValue\\s*\\(\\s*\\)\\s*\\.\\s*compareTo|comparingByValue)', hint: 'b.getValue().compareTo(a.getValue()) for descending' },
    { label: 'Collects the result into a LinkedHashMap', pattern: 'LinkedHashMap', hint: 'TreeMap sorts by key and HashMap forgets the order — use LinkedHashMap' },
  ],
  explanation: `**Second highest — why one pass with two variables:**
- Sorting is O(n log n), mutates the caller's list (a surprise side effect inside a test helper) and \`get(size - 2)\` returns \`49.99\` for \`[49.99, 49.99, 29.99]\` — the duplicate trap.
- Two variables give O(n): when a new maximum arrives, the old maximum becomes \`second\`; a value strictly between \`second\` and \`highest\` replaces \`second\`; a value **equal** to \`highest\` is ignored.
- \`compareTo\` returns negative / 0 / positive. \`BigDecimal.equals\` also compares scale, so \`new BigDecimal("15.9").equals(new BigDecimal("15.90"))\` is **false** — a favourite follow-up.

**Sort a Map by value — the standard recipe:**
1. A \`Map\` has no "sort" method — copy \`entrySet()\` into a \`List\`.
2. Sort the list with a comparator on \`getValue()\` (reversed for descending) and a tie-breaker on the key, so equal prices always come out in the same order (otherwise your expected output is flaky!).
3. Put the entries into a **LinkedHashMap**, which preserves that order.

Java 8 alternative to mention:
\`\`\`java
prices.entrySet().stream()
      .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed()
              .thenComparing(Map.Entry.comparingByKey()))
      .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (x, y) -> x, LinkedHashMap::new));
\`\`\`
Note the fourth argument of \`toMap\` — without \`LinkedHashMap::new\` the result is a HashMap and the sorting is thrown away.

**In a real test:** read \`#inventory-list .item-name\` and \`.item-price\` into a map, then assert that choosing **"Price (high to low)"** in \`#product-sort\` shows the names in the same order as \`sortByPriceDesc(map).keySet()\`.`,
  mistakes: [
    'Sorting the list and taking get(size - 2) — wrong with duplicates and it modifies the input.',
    'Returning new TreeMap<>(prices) — sorted by product name, not by price.',
    'Collecting a sorted stream with Collectors.toMap() without LinkedHashMap::new, losing the order.',
    'Comparing BigDecimal with == or equals instead of compareTo.',
  ],
  interview: [
    { q: 'How do you sort a HashMap by value?', a: 'Copy entrySet into a List, sort it with a comparator on getValue (Map.Entry.comparingByValue, reversed for descending, with a tie-breaker on the key), and put the entries into a LinkedHashMap so the sorted order is kept. A TreeMap only sorts by key.' },
    { q: 'What is the difference between compareTo and equals on BigDecimal?', a: 'equals compares value and scale, so 15.9 and 15.90 are not equal; compareTo compares only the numeric value and returns 0 for them. For money assertions use compareTo, or normalise the scale with setScale(2) before using equals.' },
    { q: 'How would you find the Nth highest price?', a: 'Put the prices into a TreeSet with reverse order to remove duplicates and sort them, then iterate to the Nth element; or keep a min-heap PriorityQueue of size N while streaming the prices, which is O(n log N). For N = 2 the two-variable loop is the simplest.' },
  ],
}
