export default {
  id: 'int-030',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: remove duplicates from "Recently viewed" and keep the order',
  level: 'INTERMEDIATE',
  tags: ['java', 'live-coding', 'collections', 'linkedhashset', 'set'],
  estMinutes: 15,
  scenario: `ShopEasy is adding a **Recently viewed** strip. The raw click log for a session is \`["Trailblazer Backpack", "Pulse Bike Light", "Trailblazer Backpack", "Junior Onesie", "pulse bike light"]\`. The interviewer asks: *"Remove the duplicates but keep the order in which the user first viewed each product. Then do it again, ignoring case."* Finding duplicates is a common warm-up; removing them **without losing order** is where people reach for a \`HashSet\` and fail.`,
  description: `Implement two methods in \`RecentlyViewed\`:

1. \`distinct(List<String> views)\` — exact duplicates removed, first-seen order kept.
   → \`[Trailblazer Backpack, Pulse Bike Light, Junior Onesie, pulse bike light]\`
2. \`distinctIgnoreCase(List<String> views)\` — "Pulse Bike Light" and "pulse bike light" count as the same product; keep the **first spelling** seen.
   → \`[Trailblazer Backpack, Pulse Bike Light, Junior Onesie]\`

**Rules / Acceptance**
- Use a \`LinkedHashSet\` for \`distinct\` — a \`HashSet\` loses the order.
- For the case-insensitive version, track the lower-cased keys you have seen and add the original string to the result.
- Return a \`List<String>\`; never modify the input list.
- \`null\` input returns an empty list.`,
  hints: [
    'new ArrayList<>(new LinkedHashSet<>(views)) is the whole of method 1.',
    'Method 2: Set<String> seen = new HashSet<>(); for each view, if (seen.add(view.toLowerCase())) result.add(view);',
    'Set.add returns false when the element is already there — no separate contains() call needed.',
  ],
  language: 'java',
  starterCode: String.raw`import java.util.*;

public class RecentlyViewed {

    public static List<String> distinct(List<String> views) {
        // TODO: remove duplicates, keep first-seen order
        return views;
    }

    public static List<String> distinctIgnoreCase(List<String> views) {
        // TODO: same, but "Pulse Bike Light" == "pulse bike light"
        return views;
    }

    public static void main(String[] args) {
        List<String> log = List.of("Trailblazer Backpack", "Pulse Bike Light",
                "Trailblazer Backpack", "Junior Onesie", "pulse bike light");
        System.out.println(distinct(log));
        System.out.println(distinctIgnoreCase(log));
    }
}
`,
  solution: String.raw`import java.util.*;

public class RecentlyViewed {

    public static List<String> distinct(List<String> views) {
        if (views == null) {
            return new ArrayList<>();
        }
        return new ArrayList<>(new LinkedHashSet<>(views));
    }

    public static List<String> distinctIgnoreCase(List<String> views) {
        List<String> result = new ArrayList<>();
        if (views == null) {
            return result;
        }
        Set<String> seen = new HashSet<>();
        for (String view : views) {
            if (seen.add(view.toLowerCase())) {   // add() is false for a repeat
                result.add(view);                 // keep the first spelling
            }
        }
        return result;
    }

    public static void main(String[] args) {
        List<String> log = List.of("Trailblazer Backpack", "Pulse Bike Light",
                "Trailblazer Backpack", "Junior Onesie", "pulse bike light");
        System.out.println(distinct(log));
        // [Trailblazer Backpack, Pulse Bike Light, Junior Onesie, pulse bike light]
        System.out.println(distinctIgnoreCase(log));
        // [Trailblazer Backpack, Pulse Bike Light, Junior Onesie]
    }
}
`,
  checks: [
    { label: 'Uses a LinkedHashSet to keep insertion order', pattern: 'new\\s+LinkedHashSet\\s*<', hint: 'new ArrayList<>(new LinkedHashSet<>(views))' },
    { label: 'Returns a new List built from the set / result', pattern: 'new\\s+ArrayList\\s*<', hint: 'Wrap the set: new ArrayList<>(set)' },
    { label: 'Normalises case for the second method', pattern: '\\.to(Lower|Upper)Case\\s*\\(|equalsIgnoreCase', hint: 'seen.add(view.toLowerCase())' },
    { label: 'Uses Set.add / contains to detect repeats', pattern: 'seen\\.add\\s*\\(|\\.contains\\s*\\(|distinct\\s*\\(\\s*\\)', hint: 'if (seen.add(key)) result.add(view);' },
    { label: 'Handles null input', pattern: '==\\s*null|null\\s*==|Objects\\.isNull', hint: 'if (views == null) return new ArrayList<>();' },
    { label: 'Does not just return the input list', pattern: 'return\\s+views\\s*;', mustNot: true, hint: 'Build and return a new list' },
  ],
  explanation: `**Why LinkedHashSet:** a \`Set\` rejects duplicates; \`HashSet\` orders by hash (looks random), \`TreeSet\` sorts alphabetically, \`LinkedHashSet\` keeps **insertion order**. For "first-seen order" it is the only one that fits — and the whole method is one line.

**Case-insensitive version:** the set stores a **normalised key** (\`toLowerCase()\`) while the result list stores the **original** value. \`Set.add\` returns \`false\` for a key already present, so one call both checks and records. This "seen-set + result-list" pattern is worth memorising — it solves dedupe-by-any-rule (by id, by trimmed name, by SKU).

**Streams alternative:** \`views.stream().distinct().collect(Collectors.toList())\` also keeps encounter order for a list — mention it after the loop, and know that \`distinct()\` uses \`equals\`, so it cannot ignore case by itself.

**Complexity:** O(n) time, O(n) extra space. The nested-loop version (\`for i\`, \`for j\`, \`remove\`) is O(n²) and easy to break with index shifting — say why you avoided it.

**In automation:** de-duplicating product names read from a page before comparing to an expected list, collecting unique error messages from a form, unique order ids from an API response.`,
  mistakes: [
    'Using HashSet and getting the products back in a different order than the user viewed them.',
    'Calling list.remove(i) inside a forward for-loop — indexes shift and elements are skipped (or ConcurrentModificationException in a for-each).',
    'Storing the lower-cased value in the result, so the UI text no longer matches the original spelling.',
    'Modifying the caller\'s list (List.of is immutable and throws UnsupportedOperationException).',
  ],
  interview: [
    { q: 'HashSet vs LinkedHashSet vs TreeSet?', a: 'All reject duplicates. HashSet has no guaranteed order and is the fastest; LinkedHashSet keeps insertion order at a small memory cost; TreeSet keeps elements sorted (natural order or a Comparator) with O(log n) operations.' },
    { q: 'How would you remove duplicate products by id from a List<Product>?', a: 'Either make equals and hashCode use the id and use a LinkedHashSet, or keep a Set<Integer> of seen ids and add a product to the result only when seen.add(product.getId()) returns true. The second avoids changing the class.' },
    { q: 'Why not remove items from the list while looping over it?', a: 'In a for-each loop it throws ConcurrentModificationException; in an index loop the elements shift left and you skip the next one. Use an Iterator with iterator.remove(), removeIf, or build a new list.' },
  ],
}
