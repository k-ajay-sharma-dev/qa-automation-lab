export default {
  slug: 'java-deep-coding-interview-problems',
  category: 'java',
  order: 20,
  title: 'Deep dive: Java coding interview problems for SDETs — multiple approaches and complexity',
  minutes: 45,
  summary: 'Run a senior live-coding round end to end — clarify, brute force, improve, state Big-O, test — across 14 hashing, sliding-window, interval, heap, binary-search, design, string, recursion and log-parsing problems, each solved two or three ways in verified Java 17 code with a recommendation of which version to present.',
  manualAnalogy: `Before you test a feature by hand you ask what the inputs can be, write a few examples including the nasty boundary ones, try the obvious path first and then the clever paths, and finally check your results against what you expected. A live-coding round is graded on exactly that habit: clarify, give the obvious correct solution, improve it, and prove it with your own edge cases. The algorithms are new vocabulary; the discipline is the one you already use every day.`,
  body: `## Why this lesson exists

The *Live coding rounds* lesson and the int-0xx live-coding problems cover the "warm-up" layer: reversing strings, counting characters, duplicates, sort checks, second-highest price, balanced brackets, missing number, min/max in one pass, de-duplicating while keeping order. At 5–8 years the interviewer expects those in five minutes and then moves on to **the problems in this lesson** — hashing, sliding windows, intervals, heaps, binary search, a small data-structure design, and at least one "real" automation task such as parsing a log or diffing UI against API data.

What separates a senior answer is not knowing an exotic trick. It is **process**: clarify, give a correct brute force, improve it with a named technique, state the Big-O of both, test with your own examples, and explain why you would ship one version over another. Every problem below is written that way, with two or three approaches in full Java 17 code. Every program in this lesson was compiled with \`javac --release 17\` and run on JDK 17.0.7; the output blocks are the real output.

The internals of the collections used here (hashing, treeification, TimSort, \`LinkedHashMap\` access order) are explained in the *Collections internals* deep dive and the stream collectors in the *Functional programming and Streams* deep dive; this lesson uses them as tools.

## How seniors run a live-coding round

### The six moves

| Step | What you say / do | Why it scores |
|---|---|---|
| 1. Clarify | Restate the problem; ask about input size, duplicates, empty/null, case sensitivity, ties, sorted or not, what to return when nothing matches | Shows you think like a tester; a wrong assumption costs more than a slow algorithm |
| 2. Examples | Write 2–3 tiny examples *including one edge case* before any code | Gives you test cases for step 6 and catches misunderstandings early |
| 3. Brute force | "The obvious way is to try every pair, O(n²). It is correct, so I have a fallback." | A correct slow answer beats an unfinished fast one |
| 4. Improve | Name the bottleneck ("the inner loop is a lookup") and the technique that removes it ("a HashMap makes that O(1)") | Interviewers grade the reasoning, not memorised code |
| 5. Code | Small methods, real names, talk while typing ("I check the complement before inserting so an element cannot pair with itself") | Silence is the most common reason a good candidate scores "unclear" |
| 6. Test | Walk your examples through the code by hand, then edge cases; state time and space | Finding your own bug is a plus; the interviewer finding it is a minus |

### A 45-minute timeline

| Minutes | Activity |
|---|---|
| 0–5 | Clarify, examples, constraints (n = 100 or n = 10 million?) |
| 5–10 | Brute force + its Big-O, out loud; optionally code it if it is short |
| 10–30 | Optimal approach, coded cleanly |
| 30–38 | Dry-run, edge cases, fix |
| 38–45 | Follow-ups: scale, concurrency, streams version, how you would test it in the framework |

### The edge-case checklist to say out loud

Empty input · one element · all elements equal · duplicates · already sorted / reverse sorted · negative numbers and zero · very large values (overflow) · \`null\` elements · case and whitespace differences (UI text!) · Unicode beyond ASCII · ties in ranking. For an SDET this list *is* the interview: it is the same muscle as boundary-value analysis.

### Phrases that help

* "Before I optimise, let me get a correct version so we have a baseline."
* "This is O(n log n) because of the sort; the scan after it is linear."
* "I am trading O(n) extra memory for O(n) time. If memory were tight I would sort in place instead."
* "In a test framework I would pick the clearer version; n is a few hundred products, so the Big-O difference is invisible."

That last sentence matters. In automation code readability usually wins, but you must show you *know* the cost before you choose to ignore it.

---

## Part 1 — Hashing

### Problem 1: two products that use up a gift card exactly (pair with target sum)

**Problem.** A ShopEasy promotion test needs two *different* catalog products whose prices add up exactly to a gift-card value. Return their positions in the catalog, or nothing.

**Clarify / edge cases.** Prices are money — work in **integer cents** (or \`BigDecimal\`), never \`double\`, or \`0.1 + 0.2 != 0.3\` breaks equality. Can the same product be used twice? (No — two *positions*.) Two different products with the same price (Classic Crew T-Shirt and Retro Red Tee are both 15.99)? Must work. Several valid pairs? Return any one unless asked. Empty catalog → empty result. Overflow: two \`int\` cents values cannot overflow for real prices, but mention it.

\`\`\`java
import java.util.*;
import java.util.stream.IntStream;

public class PairWithTargetPrice {

    record Product(String name, int cents) {}          // record: Java 16+

    // Approach 1 - brute force: try every pair. O(n^2) time, O(1) space
    static int[] bruteForce(int[] cents, int target) {
        for (int i = 0; i < cents.length; i++) {
            for (int j = i + 1; j < cents.length; j++) {
                if (cents[i] + cents[j] == target) return new int[] {i, j};
            }
        }
        return new int[0];
    }

    // Approach 2 - one pass with a HashMap of "price -> first index seen". O(n) time, O(n) space
    static int[] hashMap(int[] cents, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < cents.length; i++) {
            Integer j = seen.get(target - cents[i]);      // look up the complement BEFORE inserting
            if (j != null) return new int[] {j, i};
            seen.putIfAbsent(cents[i], i);
        }
        return new int[0];
    }

    // Approach 3 - sort (indices) + two pointers. O(n log n) time, O(n) space for the index array
    static int[] sortTwoPointers(int[] cents, int target) {
        Integer[] idx = IntStream.range(0, cents.length).boxed().toArray(Integer[]::new);
        Arrays.sort(idx, Comparator.comparingInt(i -> cents[i]));
        int lo = 0, hi = idx.length - 1;
        while (lo < hi) {
            int sum = cents[idx[lo]] + cents[idx[hi]];
            if (sum == target) {
                return new int[] {Math.min(idx[lo], idx[hi]), Math.max(idx[lo], idx[hi])};
            }
            if (sum < target) lo++; else hi--;
        }
        return new int[0];
    }

    static String names(List<Product> catalog, int[] pair) {
        return pair.length == 0 ? "no pair"
                : catalog.get(pair[0]).name() + " + " + catalog.get(pair[1]).name();
    }

    public static void main(String[] args) {
        List<Product> catalog = List.of(
                new Product("Trailblazer Backpack", 2999), new Product("Pulse Bike Light", 999),
                new Product("Classic Crew T-Shirt", 1599), new Product("Storm Fleece Jacket", 4999),
                new Product("Junior Onesie", 799), new Product("Retro Red Tee", 1599));
        int[] cents = catalog.stream().mapToInt(Product::cents).toArray();

        for (int target : new int[] {1798, 3198, 5000}) {
            System.out.printf("target %d: brute=%s map=%s twoPointers=%s -> %s%n", target,
                    Arrays.toString(bruteForce(cents, target)),
                    Arrays.toString(hashMap(cents, target)),
                    Arrays.toString(sortTwoPointers(cents, target)),
                    names(catalog, hashMap(cents, target)));
        }
        System.out.println("empty catalog: " + Arrays.toString(hashMap(new int[0], 100)));
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
target 1798: brute=[1, 4] map=[1, 4] twoPointers=[1, 4] -> Pulse Bike Light + Junior Onesie
target 3198: brute=[2, 5] map=[2, 5] twoPointers=[2, 5] -> Classic Crew T-Shirt + Retro Red Tee
target 5000: brute=[] map=[] twoPointers=[] -> no pair
empty catalog: []
\`\`\`

**Key lines.** In approach 2 the complement lookup happens *before* inserting the current price, so a product can never pair with itself, and 1599 + 1599 still works because the first 1599 is already in the map when the second arrives. \`putIfAbsent\` keeps the earliest index. Approach 3 sorts an array of *indices* rather than the prices so the original positions survive the sort.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Brute force | O(n²) | O(1) | Trivial, no allocation | Quadratic |
| HashMap complement | O(n) average | O(n) | Single pass, keeps original indices | Memory; hash worst case |
| Sort + two pointers | O(n log n) | O(n) (O(1) if you may sort values in place and do not need indices) | No hashing; extends naturally to 3-sum and "all pairs" | Sort cost; loses order unless you sort indices |

**Which to present.** Say the brute force, code the HashMap version. If the input is *already sorted* (a price column sorted ascending), two pointers is O(n) time and O(1) space and is the better answer — saying that unprompted is a senior signal.

**Likely follow-up.** "Return *all* distinct pairs" (two pointers, skipping equal neighbours) or "three products for a bundle price" (sort, then for each i run two pointers on the rest: O(n²)).

### Problem 2: group coupon codes that are anagrams of each other

**Problem.** A fraud-rule test generated coupon codes. Codes that are permutations of each other (\`SAVE10\`, \`EVAS01\`) must be flagged. Group the codes so that each group holds mutual anagrams, keeping first-seen order. (The int-016 problem checks whether *two* strings are anagrams; grouping *n* strings is the harder, more common senior version.)

**Clarify / edge cases.** Case-sensitive? Characters only ASCII letters and digits? Empty string is an anagram of empty string. Output order — does it matter? (Use \`LinkedHashMap\` so the answer is deterministic and testable.)

\`\`\`java
import java.util.*;
import java.util.stream.Collectors;

public class GroupAnagramCodes {

    // Approach 1 - brute force: compare each code with the first member of every group so far.
    // O(n * g * k log k) time (g groups, k = code length) -> O(n^2 k log k) worst case, O(n k) space
    static List<List<String>> bruteForce(List<String> codes) {
        List<List<String>> groups = new ArrayList<>();
        for (String code : codes) {
            List<String> home = null;
            for (List<String> g : groups) {
                if (isAnagram(g.get(0), code)) { home = g; break; }
            }
            if (home == null) { home = new ArrayList<>(); groups.add(home); }
            home.add(code);
        }
        return groups;
    }

    static boolean isAnagram(String a, String b) {
        if (a.length() != b.length()) return false;
        char[] x = a.toCharArray(), y = b.toCharArray();
        Arrays.sort(x);
        Arrays.sort(y);
        return Arrays.equals(x, y);
    }

    // Approach 2 - canonical key = sorted characters. O(n k log k) time, O(n k) space
    static Collection<List<String>> sortedKey(List<String> codes) {
        Map<String, List<String>> groups = new LinkedHashMap<>();   // keeps first-seen group order
        for (String code : codes) {
            char[] chars = code.toCharArray();
            Arrays.sort(chars);
            groups.computeIfAbsent(new String(chars), k -> new ArrayList<>()).add(code);
        }
        return groups.values();
    }

    // Same idea as a stream
    static Collection<List<String>> sortedKeyStream(List<String> codes) {
        return codes.stream().collect(Collectors.groupingBy(
                code -> code.chars().sorted()
                        .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
                        .toString(),
                LinkedHashMap::new,
                Collectors.toList())).values();
    }

    // Approach 3 - canonical key = character counts (no per-code sort). O(n (k + A)) time, A = alphabet (128)
    static Collection<List<String>> countKey(List<String> codes) {
        Map<String, List<String>> groups = new LinkedHashMap<>();
        for (String code : codes) {
            int[] counts = new int[128];                 // assumes ASCII - say so in the interview
            for (char c : code.toCharArray()) counts[c]++;
            StringBuilder key = new StringBuilder();
            for (int c = 0; c < counts.length; c++) {
                if (counts[c] > 0) key.append((char) c).append(counts[c]).append('#'); // '#' avoids "0"+"11" vs "01"+"1" clashes
            }
            groups.computeIfAbsent(key.toString(), k -> new ArrayList<>()).add(code);
        }
        return groups.values();
    }

    public static void main(String[] args) {
        List<String> coupons = List.of("SAVE10", "EVAS01", "FREESHIP", "10SAVE", "SHIPFREE", "WELCOME", "PIHSEERF");
        System.out.println("brute:      " + bruteForce(coupons));
        System.out.println("sortedKey:  " + sortedKey(coupons));
        System.out.println("stream:     " + sortedKeyStream(coupons));
        System.out.println("countKey:   " + countKey(coupons));
        System.out.println("suspicious: " + sortedKey(coupons).stream().filter(g -> g.size() > 1).toList());
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
brute:      [[SAVE10, EVAS01, 10SAVE], [FREESHIP, SHIPFREE, PIHSEERF], [WELCOME]]
sortedKey:  [[SAVE10, EVAS01, 10SAVE], [FREESHIP, SHIPFREE, PIHSEERF], [WELCOME]]
stream:     [[SAVE10, EVAS01, 10SAVE], [FREESHIP, SHIPFREE, PIHSEERF], [WELCOME]]
countKey:   [[SAVE10, EVAS01, 10SAVE], [FREESHIP, SHIPFREE, PIHSEERF], [WELCOME]]
suspicious: [[SAVE10, EVAS01, 10SAVE], [FREESHIP, SHIPFREE, PIHSEERF]]
\`\`\`

**Key lines.** Both fast approaches are the same idea: map every code to a **canonical key** that is equal for all anagrams, then group by the key with \`computeIfAbsent\`. The sorted-characters key costs O(k log k) per code; the count key costs O(k + A). The \`'#'\` separator in the count key is not decoration: without it, one \`0\` plus one \`1\` builds \`"01" + "11" = "0111"\`, exactly the key of a code made of 111 zeros. Whenever you build a composite key by concatenation, use a separator or a record.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Brute force vs group leaders | O(n · g · k log k), O(n² k log k) worst | O(nk) | Obvious | Quadratic in number of groups |
| Sorted-chars key (loop or \`groupingBy\`) | O(n · k log k) | O(nk) | Short, works for any characters | Sort per word |
| Count key | O(n · (k + A)) | O(nk) | Linear in total characters | Alphabet assumption (here 128); \`char > 127\` throws \`ArrayIndexOutOfBoundsException\` |

**Which to present.** Sorted key. It is correct for any \`char\`, and for codes of length ≤ 20 the log factor is irrelevant. Mention the count key as the optimisation when words are long and the alphabet is small. The stream version is a nice one-liner to show *after* the loop works.

**Likely follow-up.** "What if the input is 50 GB of codes?" — stream the file, map each code to its key, and either use an external sort on the key or hash-partition by key into files so each partition fits in memory.

### Problem 3: does the UI product list match the API, ignoring order?

**Problem.** The inventory page shows product names in display order; \`GET /api/products\` returns the same products in id order. Assert they contain exactly the same names *with the same multiplicities*, and when they do not, produce a diff a human can read in the report.

**Clarify / edge cases.** Duplicates matter (a product rendered twice is a bug). Whitespace and case from \`getText()\` — normalise in one place. Different sizes. Do we need a boolean or a diff? (In a test you always want the diff.)

\`\`\`java
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

public class UiVsApiProducts {

    // Anti-pattern seen in many frameworks: ignores how many times each name occurs
    static boolean containsAllBothWays(List<String> ui, List<String> api) {
        return ui.size() == api.size() && ui.containsAll(api) && api.containsAll(ui);
    }

    // Approach 1 - sort copies, compare. O(n log n) time, O(n) space (copies; never sort the caller's list)
    static boolean sortAndCompare(List<String> ui, List<String> api) {
        if (ui.size() != api.size()) return false;
        List<String> a = new ArrayList<>(ui), b = new ArrayList<>(api);
        Collections.sort(a);
        Collections.sort(b);
        return a.equals(b);
    }

    // Approach 2 - one balance map: +1 per API name, -1 per UI name. O(n) time (O(n log n) with TreeMap), O(d) space
    // Positive = missing from the UI, negative = extra on the UI. Empty map = equal.
    static Map<String, Integer> diff(List<String> ui, List<String> api) {
        Map<String, Integer> balance = new TreeMap<>();                      // sorted report; HashMap for pure O(n)
        for (String p : api) balance.merge(p, 1, UiVsApiProducts::sumOrRemove);
        for (String p : ui) balance.merge(p, -1, UiVsApiProducts::sumOrRemove);
        return balance;
    }

    private static Integer sumOrRemove(Integer a, Integer b) {
        int sum = a + b;
        return sum == 0 ? null : sum;      // merge() removes the key when the function returns null
    }

    // Approach 3 - idiomatic: compare two count maps. O(n) time, O(d) space
    static boolean sameMultiset(List<String> ui, List<String> api) {
        return counts(ui).equals(counts(api));
    }

    static Map<String, Long> counts(List<String> names) {
        return names.stream()
                .map(String::strip)                             // normalise UI text once, in one place
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
    }

    public static void main(String[] args) {
        List<String> api = List.of("Trailblazer Backpack", "Pulse Bike Light", "Classic Crew T-Shirt",
                "Storm Fleece Jacket", "Junior Onesie", "Retro Red Tee");
        List<String> ui = List.of("Pulse Bike Light", "Trailblazer Backpack", "Classic Crew T-Shirt",
                "Classic Crew T-Shirt", "Storm Fleece Jacket", "Junior Onesie ");

        System.out.println("sortAndCompare: " + sortAndCompare(ui, api));
        System.out.println("sameMultiset:   " + sameMultiset(ui, api));
        System.out.println("diff (raw):     " + diff(ui, api));
        System.out.println("diff (strip):   " + diff(ui.stream().map(String::strip).toList(), api));

        List<String> a = List.of("Junior Onesie", "Junior Onesie", "Retro Red Tee");
        List<String> b = List.of("Junior Onesie", "Retro Red Tee", "Retro Red Tee");
        System.out.println("containsAll trap: " + containsAllBothWays(a, b) + ", multiset: " + sameMultiset(a, b));
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
sortAndCompare: false
sameMultiset:   false
diff (raw):     {Classic Crew T-Shirt=-1, Junior Onesie=1, Junior Onesie =-1, Retro Red Tee=1}
diff (strip):   {Classic Crew T-Shirt=-1, Retro Red Tee=1}
containsAll trap: true, multiset: false
\`\`\`

**Key lines.** \`containsAll\` in both directions plus a size check *looks* complete but treats lists as sets: \`[Onesie, Onesie, Tee]\` and \`[Onesie, Tee, Tee]\` pass. The diff map uses \`Map.merge\`'s documented rule that a remapping function returning \`null\` **removes** the key, so balanced names disappear and an empty map means equal. The raw diff shows \`Junior Onesie\` and \`Junior Onesie \` (trailing space) as two different names — the classic reason UI-vs-API comparisons fail; normalising with \`strip()\` (Java 11+) once fixes it.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| \`containsAll\` both ways | O(n²) for lists | O(1) | — | **Wrong** with duplicates |
| Sort copies + \`equals\` | O(n log n) | O(n) | Simple; AssertJ/TestNG print both lists on failure | No direct diff; must copy (never sort the caller's list) |
| Balance map / count maps | O(n) average | O(d) distinct | Gives "missing" and "extra" directly | Slightly more code |

**Which to present.** The balance-map diff: linear, and the failure message *is* the bug report. In real framework code AssertJ's \`containsExactlyInAnyOrderElementsOf\` does the multiset check and prints the missing/unexpected elements — say you would use it, then show you can write it.

**Likely follow-up.** "Compare objects, not names (name + price + stock)?" — use a record as the key (its \`equals\`/\`hashCode\` cover all components) and convert prices to cents/\`BigDecimal\` before comparing.

---

## Part 2 — Two pointers and sliding windows

### Problem 4: longest stretch of a session with no repeated page

**Problem.** A click-stream analyser encodes each page visit as one letter (H home, S search, P product, C cart, K checkout, O order confirmation). Find the longest contiguous part of the session in which no page repeats — the classic "longest substring without repeating characters".

**Clarify / edge cases.** Return the length or the substring? Empty string → 0. All the same → 1. Characters outside ASCII (use \`Map\`, not \`int[128]\`). The \`"abba"\` case catches the most common sliding-window bug (see below).

\`\`\`java
import java.util.*;

public class LongestDistinctWindow {

    // Approach 1 - brute force: from every start, extend until a character repeats. O(n^2) time, O(k) space
    static int bruteForce(String s) {
        int best = 0;
        for (int i = 0; i < s.length(); i++) {
            Set<Character> seen = new HashSet<>();
            for (int j = i; j < s.length() && seen.add(s.charAt(j)); j++) {
                best = Math.max(best, j - i + 1);
            }
        }
        return best;
    }

    // Approach 2 - sliding window with a HashSet; left moves one step at a time. O(n) time (each char added/removed once)
    static int slidingSet(String s) {
        Set<Character> window = new HashSet<>();
        int best = 0, left = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            while (!window.add(c)) {                 // shrink until c is no longer in the window
                window.remove(s.charAt(left++));
            }
            best = Math.max(best, right - left + 1);
        }
        return best;
    }

    // Approach 3 - last-seen index: left jumps straight past the previous occurrence. O(n) time, O(k) space
    static String lastSeen(String s) {
        Map<Character, Integer> last = new HashMap<>();
        int left = 0, bestStart = 0, bestLen = 0;
        for (int right = 0; right < s.length(); right++) {
            Integer prev = last.put(s.charAt(right), right);
            if (prev != null && prev >= left) left = prev + 1;   // ignore occurrences already left behind
            if (right - left + 1 > bestLen) {
                bestLen = right - left + 1;
                bestStart = left;
            }
        }
        return s.substring(bestStart, bestStart + bestLen);
    }

    public static void main(String[] args) {
        // H=home P=product C=cart K=checkout O=order-confirmation S=search
        for (String s : List.of("abcabcbb", "bbbb", "", "pwwkew", "HSPCHPCKO", "abba")) {
            System.out.printf("%-10s brute=%d set=%d lastSeen=\\"%s\\"%n",
                    "\\"" + s + "\\"", bruteForce(s), slidingSet(s), lastSeen(s));
        }
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
"abcabcbb" brute=3 set=3 lastSeen="abc"
"bbbb"     brute=1 set=1 lastSeen="b"
""         brute=0 set=0 lastSeen=""
"pwwkew"   brute=3 set=3 lastSeen="wke"
"HSPCHPCKO" brute=5 set=5 lastSeen="HPCKO"
"abba"     brute=2 set=2 lastSeen="ab"
\`\`\`

**Key lines.** The window \`[left, right]\` always contains distinct characters. In approach 2, when \`add\` fails, the left edge advances one step at a time removing characters until the duplicate is gone — every character enters and leaves the set at most once, so the total work is O(n) even though there is a nested \`while\`. Approach 3 jumps \`left\` directly to \`prev + 1\`; the guard \`prev >= left\` is essential: in \`"abba"\`, when the final \`a\` arrives, its previous index 0 is already *outside* the window (left is 2), and without the guard \`left\` would move **backwards** to 1, giving a wrong answer of 3.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Brute force from every start | O(n²) (with early stop; O(n³) if you check every substring) | O(k) | Easy to reason about | Quadratic |
| Sliding window + set | O(n) | O(k) | Classic, easy to explain | Up to 2n set operations |
| Last-seen index map | O(n) | O(k) | One pass, returns the substring | The \`prev >= left\` guard is easy to forget |

**Which to present.** Approach 2 first (easiest to explain the invariant), then mention approach 3 as the one-pass refinement. If the alphabet is known (ASCII), replace the map with \`int[128]\` filled with -1 for a constant-factor win.

**Likely follow-up.** "Longest window with at most K distinct pages" — same window, but a \`Map<Character, Integer>\` of counts; shrink while \`map.size() > K\`.

### Problem 5: move out-of-stock items to the end, keeping the order

**Problem.** The product list should show in-stock items first in their original order, then out-of-stock items (stock 0). This is "move zeros" — a **stable partition**.

**Clarify / edge cases.** Must the order of non-zeros be preserved? (Yes — that is what makes it "stable".) In place or new list? Objects or primitives? All zero / none zero / empty.

\`\`\`java
import java.util.*;
import java.util.stream.Collectors;

public class MoveOutOfStockToEnd {

    record Item(String name, int stock) {}

    // Approach 1 - extra array: copy non-zeros, the tail stays 0. O(n) time, O(n) space
    static int[] extraArray(int[] stock) {
        int[] out = new int[stock.length];
        int w = 0;
        for (int s : stock) if (s != 0) out[w++] = s;
        return out;
    }

    // Approach 2 - in place with a write pointer and swaps. O(n) time, O(1) space; non-zeros keep their order
    static void inPlace(int[] stock) {
        int w = 0;                                   // next slot for a non-zero
        for (int r = 0; r < stock.length; r++) {
            if (stock[r] != 0) {
                int tmp = stock[w];
                stock[w] = stock[r];
                stock[r] = tmp;
                w++;
            }
        }
    }

    // Approach 3a - objects: partitioningBy keeps encounter order inside each partition. O(n) time, O(n) space
    static List<Item> partition(List<Item> items) {
        Map<Boolean, List<Item>> parts = items.stream()
                .collect(Collectors.partitioningBy(i -> i.stock() > 0));
        List<Item> out = new ArrayList<>(parts.get(true));
        out.addAll(parts.get(false));
        return out;
    }

    // Approach 3b - stable sort on a boolean key (false sorts before true). O(n log n) time
    static List<Item> stableSort(List<Item> items) {
        List<Item> copy = new ArrayList<>(items);
        copy.sort(Comparator.comparing(i -> i.stock() == 0));   // List.sort is guaranteed stable
        return copy;
    }

    public static void main(String[] args) {
        int[] stock = {25, 0, 60, 12, 0, 30};
        System.out.println("extraArray: " + Arrays.toString(extraArray(stock)));
        int[] copy = stock.clone();
        inPlace(copy);
        System.out.println("inPlace:    " + Arrays.toString(copy));

        List<Item> items = List.of(new Item("Trailblazer Backpack", 25), new Item("Retro Red Tee", 0),
                new Item("Classic Crew T-Shirt", 60), new Item("Storm Fleece Jacket", 12),
                new Item("Desert Sun Hat", 0), new Item("Junior Onesie", 30));
        System.out.println("partition:  " + partition(items).stream().map(Item::name).toList());
        System.out.println("stableSort: " + stableSort(items).stream().map(Item::name).toList());
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
extraArray: [25, 60, 12, 30, 0, 0]
inPlace:    [25, 60, 12, 30, 0, 0]
partition:  [Trailblazer Backpack, Classic Crew T-Shirt, Storm Fleece Jacket, Junior Onesie, Retro Red Tee, Desert Sun Hat]
stableSort: [Trailblazer Backpack, Classic Crew T-Shirt, Storm Fleece Jacket, Junior Onesie, Retro Red Tee, Desert Sun Hat]
\`\`\`

**Key lines.** The write pointer \`w\` marks where the next non-zero goes; everything before \`w\` is final. Swapping (rather than overwriting and zero-filling afterwards) means one pass and no second loop. \`Collectors.partitioningBy\` preserves encounter order within each partition. \`Comparator.comparing(i -> i.stock() == 0)\` sorts \`false\` before \`true\` (\`Boolean\` implements \`Comparable\`), and sorting an \`ArrayList\` delegates to \`Arrays.sort(T[], Comparator)\`, which is documented as stable, so equal keys keep their original order — that guarantee is what makes the one-liner correct.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Extra array | O(n) | O(n) | Simplest | Allocation; for objects the tail is \`null\` |
| In-place write pointer | O(n) | O(1) | Optimal; the expected interview answer | Mutates input |
| \`partitioningBy\` | O(n) | O(n) | Readable, works on records | Allocates two lists |
| Stable sort on boolean key | O(n log n) | O(n) | One line | Slower; relies on stability, which you must state |

**Which to present.** In-place write pointer for an array question; \`partitioningBy\` for a list of objects in framework code.

**Likely follow-up.** "Now verify that the UI did this correctly" — check that once you see the first out-of-stock item, no in-stock item follows (one pass with a boolean flag), and that the in-stock subsequence equals the API order filtered to stock > 0.

### Problem 6: is the carousel showing a rotation of the expected order?

**Problem.** A product carousel shows four items; each click on *Next* rotates them by one. After two clicks, verify that the displayed order is a rotation of the expected order and report by how many positions. This combines "check if one string is a rotation of another" and "rotate an array".

**Clarify / edge cases.** Same size required. Duplicated names (rotation becomes ambiguous — return the smallest shift). Empty list (shift 0). When using string tricks, names that contain each other (\`"Bag"\` inside \`"Tote Bag"\`).

\`\`\`java
import java.util.*;

public class CarouselRotation {

    // Approach 1 - brute force: try every shift k. O(n^2) time, O(1) space
    // Returns k such that shown[i] == expected[(i + k) % n], or -1.
    static int bruteShift(List<String> expected, List<String> shown) {
        int n = expected.size();
        if (n != shown.size()) return -1;
        if (n == 0) return 0;
        for (int k = 0; k < n; k++) {
            boolean ok = true;
            for (int i = 0; i < n && ok; i++) {
                ok = expected.get((i + k) % n).equals(shown.get(i));
            }
            if (ok) return k;
        }
        return -1;
    }

    // Approach 2 - doubled list: every rotation of expected is a contiguous sub-list of expected+expected.
    // Collections.indexOfSubList is a naive search: O(n^2) worst case, O(n) typical; O(n) extra space
    static int doubledList(List<String> expected, List<String> shown) {
        if (expected.size() != shown.size()) return -1;
        List<String> doubled = new ArrayList<>(expected);
        doubled.addAll(expected);
        return Collections.indexOfSubList(doubled, shown);
    }

    // Approach 3 - strings: (a + a).contains(b), with delimiters on BOTH sides of every name
    static boolean isRotation(List<String> expected, List<String> shown) {
        if (expected.size() != shown.size()) return false;
        String a = String.join("|", expected), b = String.join("|", shown);
        return ("|" + a + "|" + a + "|").contains("|" + b + "|");
    }

    // Follow-up: produce the expected order after k clicks on "Next" - reversal algorithm, O(n) time, O(1) space
    static void rotateLeft(String[] a, int k) {
        int n = a.length;
        if (n == 0) return;
        k = ((k % n) + n) % n;                 // handles k > n and negative k
        reverse(a, 0, k - 1);
        reverse(a, k, n - 1);
        reverse(a, 0, n - 1);
    }

    private static void reverse(String[] a, int i, int j) {
        while (i < j) { String t = a[i]; a[i++] = a[j]; a[j--] = t; }
    }

    public static void main(String[] args) {
        List<String> expected = List.of("Trailblazer Backpack", "Pulse Bike Light", "Storm Fleece Jacket", "Junior Onesie");
        List<String> afterTwoClicks = List.of("Storm Fleece Jacket", "Junior Onesie", "Trailblazer Backpack", "Pulse Bike Light");
        List<String> broken = List.of("Storm Fleece Jacket", "Trailblazer Backpack", "Junior Onesie", "Pulse Bike Light");

        System.out.println("brute:   " + bruteShift(expected, afterTwoClicks) + " / " + bruteShift(expected, broken));
        System.out.println("doubled: " + doubledList(expected, afterTwoClicks) + " / " + doubledList(expected, broken));
        System.out.println("strings: " + isRotation(expected, afterTwoClicks) + " / " + isRotation(expected, broken));

        // why the outer delimiters matter: "Bag" is a suffix of "Tote Bag"
        System.out.println("naive join: " + (String.join("|", List.of("Tote Bag", "Hat")).repeat(2))
                .contains(String.join("|", List.of("Bag", "Hat"))));
        System.out.println("delimited:  " + isRotation(List.of("Tote Bag", "Hat"), List.of("Bag", "Hat")));

        String[] arr = expected.toArray(String[]::new);
        rotateLeft(arr, 2);
        System.out.println("rotateLeft(2):         " + Arrays.toString(arr));
        List<String> list = new ArrayList<>(expected);
        Collections.rotate(list, -2);           // negative distance = rotate left
        System.out.println("Collections.rotate(-2): " + list);
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
brute:   2 / -1
doubled: 2 / -1
strings: true / false
naive join: true
delimited:  false
rotateLeft(2):         [Storm Fleece Jacket, Junior Onesie, Trailblazer Backpack, Pulse Bike Light]
Collections.rotate(-2): [Storm Fleece Jacket, Junior Onesie, Trailblazer Backpack, Pulse Bike Light]
\`\`\`

**Key lines.** Every rotation of \`a\` is a contiguous piece of \`a + a\` — that single observation turns an O(n²) search into one sub-list search. With strings, joining with a delimiter is not enough: \`"Tote Bag|Hat|Tote Bag|Hat"\` contains \`"Bag|Hat"\`, a false positive. Putting the delimiter on **both** sides of the haystack and the needle forces matches to start and end on name boundaries. The reversal algorithm rotates left by k with three in-place reversals; \`k = ((k % n) + n) % n\` normalises k larger than n and negative k. \`Collections.rotate(list, distance)\` moves the element at index i to \`(i + distance) mod size\`, so a negative distance rotates left.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Try every shift | O(n²) | O(1) | Returns the shift, no allocation | Quadratic |
| Doubled list + \`indexOfSubList\` | O(n²) worst, ~O(n) typical | O(n) | Short; returns the shift | Naive search inside the JDK |
| Delimited string \`contains\` | O(n·m) worst, fast in practice | O(total chars) | Shortest | Delimiter must not occur in names; no shift |

**Which to present.** The doubled-list idea, explained, with the shift as the return value; say that for guaranteed linear time you would run KMP on the doubled sequence. Never claim \`String.contains\` is O(n): OpenJDK's \`indexOf\` is a naive search (vectorised by intrinsics, but O(n·m) in the worst case).

**Likely follow-up.** "Rotate in place without extra memory" — the reversal algorithm above, O(n) time, O(1) space; or "the carousel loops infinitely and you can only read the visible 3 items" — collect until you see the first item again, then compare.

---

## Part 3 — Sorting and intervals

### Problem 7: merge overlapping maintenance windows

**Problem.** The nightly regression run must avoid maintenance windows from several teams (payments, search, inventory). Windows overlap and arrive unsorted. Merge them into the minimal set of blocked periods, then answer "is time t blocked?".

**Clarify / edge cases.** Closed or half-open intervals? Do *touching* windows (01:30–03:00 and 03:00–03:15) merge? (For "downtime" yes — there is no gap to run in.) Windows crossing midnight (split them into two). Zero-length windows. Invalid windows (start after end) — reject at construction.

\`\`\`java
import java.util.*;

public class MergeMaintenanceWindows {

    /** Minutes since midnight, half-open [start, end). */
    record Window(int start, int end) {
        Window {
            if (start < 0 || end > 24 * 60 || start > end) {
                throw new IllegalArgumentException("bad window " + start + "-" + end);
            }
        }
        static Window of(String from, String to) { return new Window(minutes(from), minutes(to)); }
        static int minutes(String hhmm) {
            String[] p = hhmm.split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        }
        @Override public String toString() { return fmt(start) + "-" + fmt(end); }
        private static String fmt(int m) { return String.format("%02d:%02d", m / 60, m % 60); }
    }

    // Approach 1 - timeline bitmap over a bounded domain (1440 minutes). O(n * L + D) time, O(D) space
    static List<Window> timeline(List<Window> windows) {
        final int day = 24 * 60;
        boolean[] busy = new boolean[day];
        for (Window w : windows) {
            for (int m = w.start(); m < w.end(); m++) busy[m] = true;
        }
        List<Window> out = new ArrayList<>();
        int m = 0;
        while (m < day) {
            if (!busy[m]) { m++; continue; }
            int start = m;
            while (m < day && busy[m]) m++;
            out.add(new Window(start, m));
        }
        return out;
    }

    // Approach 2 - sort by start, then one sweep. O(n log n) time, O(n) space for the sorted copy/result
    static List<Window> sortAndMerge(List<Window> windows) {
        List<Window> sorted = new ArrayList<>(windows);
        sorted.sort(Comparator.comparingInt(Window::start));
        List<Window> out = new ArrayList<>();
        for (Window w : sorted) {
            int lastIdx = out.size() - 1;
            if (lastIdx >= 0 && w.start() <= out.get(lastIdx).end()) {     // '<=' merges touching windows
                Window last = out.get(lastIdx);
                out.set(lastIdx, new Window(last.start(), Math.max(last.end(), w.end())));
            } else {
                out.add(w);
            }
        }
        return out;
    }

    // Follow-up: "is the nightly run at time t blocked?" - TreeMap.floorEntry over merged windows, O(log n)
    static boolean isBlocked(List<Window> merged, int t) {
        TreeMap<Integer, Window> byStart = new TreeMap<>();
        for (Window w : merged) byStart.put(w.start(), w);
        Map.Entry<Integer, Window> e = byStart.floorEntry(t);
        return e != null && t < e.getValue().end();
    }

    public static void main(String[] args) {
        List<Window> windows = List.of(
                Window.of("05:00", "05:30"), Window.of("01:00", "02:00"), Window.of("03:00", "03:15"),
                Window.of("01:30", "03:00"), Window.of("04:00", "04:10"), Window.of("04:05", "04:06"));
        System.out.println("timeline:     " + timeline(windows));
        List<Window> merged = sortAndMerge(windows);
        System.out.println("sortAndMerge: " + merged);
        System.out.println("02:59 blocked? " + isBlocked(merged, Window.minutes("02:59"))
                + ", 03:15 blocked? " + isBlocked(merged, Window.minutes("03:15")));
        System.out.println("empty input:  " + sortAndMerge(List.of()));
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
timeline:     [01:00-03:15, 04:00-04:10, 05:00-05:30]
sortAndMerge: [01:00-03:15, 04:00-04:10, 05:00-05:30]
02:59 blocked? true, 03:15 blocked? false
empty input:  []
\`\`\`

**Key lines.** The record's compact constructor validates every window once, so the algorithms never see garbage. After sorting by start, a window can only overlap the **last** merged window: if it overlapped an earlier one it would also overlap the last, because starts are non-decreasing. \`w.start() <= last.end()\` with \`<=\` merges touching windows; with \`<\` they stay separate — that single character is the clarifying question from above. \`Math.max\` handles a window fully inside the previous one (04:05–04:06 inside 04:00–04:10). The timeline approach merges touching windows automatically and drops zero-length ones.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Repeated pairwise merging (brute force, not shown) | O(n³) worst | O(n) | Obvious | Very slow, fiddly loop |
| Timeline bitmap | O(n · L + D), L = window length, D = 1,440 | O(D) | Trivially correct for small bounded domains | Useless for timestamps in milliseconds or years |
| Sort + sweep | O(n log n) | O(n) | General, standard answer | Must get the merge condition right |

**Which to present.** Sort + sweep. Mentioning the bitmap for a bounded domain shows range; the "is t blocked?" follow-up with \`TreeMap.floorEntry\` in O(log n) shows you know \`NavigableMap\`.

**Likely follow-up.** "Find free slots of at least 30 minutes for the run" — walk the merged list and emit the gaps \`[prev.end, next.start)\` whose length is ≥ 30, plus the gap before the first and after the last window.

---

## Part 4 — Heaps and selection

### Problem 8: k-th most expensive product

**Problem.** For a "premium products" banner test, find the k-th highest price in the catalog. (int-018 covers *second* highest with a single pass; the general-k version is where heaps and quickselect come in.)

**Clarify / edge cases.** Does a duplicate price count twice? (\`{4999, 2999, 1599, 1599}\`: the 4th largest is 1599 *with* duplicates; the 4th largest *distinct* is 999.) k outside 1..n → fail loudly. Input must not be mutated.

\`\`\`java
import java.util.*;

public class KthLargestPrice {

    static void check(int[] a, int k) {
        if (k < 1 || k > a.length) throw new IllegalArgumentException("k=" + k + " but n=" + a.length);
    }

    // Approach 1 - sort a copy. O(n log n) time, O(n) space for the copy
    static int bySort(int[] cents, int k) {
        check(cents, k);
        int[] c = cents.clone();
        Arrays.sort(c);                          // dual-pivot quicksort for primitives
        return c[c.length - k];
    }

    // Approach 2 - min-heap holding the k largest seen so far. O(n log k) time, O(k) space
    static int byHeap(int[] cents, int k) {
        check(cents, k);
        PriorityQueue<Integer> heap = new PriorityQueue<>(k);   // natural order = min-heap
        for (int c : cents) {
            heap.offer(c);
            if (heap.size() > k) heap.poll();                  // drop the smallest
        }
        return heap.peek();
    }

    // Approach 3 - quickselect with a random pivot. O(n) average, O(n^2) worst; O(1) extra besides the copy
    static int quickselect(int[] cents, int k) {
        check(cents, k);
        int[] a = cents.clone();
        int target = a.length - k;               // index of the answer in ascending order
        int lo = 0, hi = a.length - 1;
        Random rnd = new Random(42);
        while (true) {
            int p = partition(a, lo, hi, lo + rnd.nextInt(hi - lo + 1));
            if (p == target) return a[p];
            if (p < target) lo = p + 1; else hi = p - 1;
        }
    }

    // Lomuto partition: everything < pivot ends up left of the returned index
    private static int partition(int[] a, int lo, int hi, int pivotIdx) {
        int pivot = a[pivotIdx];
        swap(a, pivotIdx, hi);
        int store = lo;
        for (int i = lo; i < hi; i++) {
            if (a[i] < pivot) swap(a, i, store++);
        }
        swap(a, store, hi);
        return store;
    }

    private static void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }

    // Variant: k-th largest DISTINCT price
    static int distinct(int[] cents, int k) {
        TreeSet<Integer> set = new TreeSet<>(Comparator.reverseOrder());
        for (int c : cents) set.add(c);
        if (k < 1 || k > set.size()) throw new IllegalArgumentException("only " + set.size() + " distinct prices");
        return set.stream().skip(k - 1).findFirst().orElseThrow();
    }

    public static void main(String[] args) {
        int[] cents = {2999, 999, 1599, 4999, 799, 1599};
        for (int k = 1; k <= 4; k++) {
            System.out.printf("k=%d sort=%d heap=%d quickselect=%d%n", k,
                    bySort(cents, k), byHeap(cents, k), quickselect(cents, k));
        }
        System.out.println("4th largest distinct = " + distinct(cents, 4));
        try {
            bySort(cents, 7);
        } catch (IllegalArgumentException e) {
            System.out.println("k=7 -> " + e.getMessage());
        }
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
k=1 sort=4999 heap=4999 quickselect=4999
k=2 sort=2999 heap=2999 quickselect=2999
k=3 sort=1599 heap=1599 quickselect=1599
k=4 sort=1599 heap=1599 quickselect=1599
4th largest distinct = 999
k=7 -> k=7 but n=6
\`\`\`

**Key lines.** The heap keeps the k largest prices seen so far with the *smallest of them* on top; when it grows past k the smallest is evicted, so at the end the top is the k-th largest. \`PriorityQueue\` with natural ordering is a min-heap; for a max-heap pass \`Comparator.reverseOrder()\`. Quickselect is quicksort that recurses into only one side: after partitioning, the pivot is at its final sorted index \`p\`; if \`p\` is the target index we are done. The random pivot makes the O(n²) worst case (already-sorted input with a fixed pivot) unlikely, but many duplicates still hurt Lomuto partitioning — a three-way (Dutch national flag) partition fixes that.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Sort a copy | O(n log n) | O(n) | Obvious, robust | Sorts everything to find one element |
| Min-heap of size k | O(n log k) | O(k) | Works on a **stream** (prices arriving page by page) | Boxing \`Integer\` |
| Quickselect | O(n) average, O(n²) worst | O(1) beyond the copy | Fastest on average | Easy to get partition bugs; mutates its array |

**Which to present.** The heap: it is short, correct, and scales to data that does not fit in memory, which is the senior trade-off to say out loud. Offer quickselect if the interviewer asks for better than O(n log k).

**Likely follow-up.** "Prices come from 200 paginated API calls" — the heap version processes each page as it arrives with O(k) memory; the sort version needs every page first.

### Problem 9: top-K most frequent error codes in a service log

**Problem.** After a failed nightly run, list the K most frequent \`ERROR\` codes from the application log so the triage note can say "PAY-502 ×3, AUTH-401 ×3". Ties must be broken deterministically (alphabetically) so the report does not change between runs. (int-017 counts word frequencies; here the focus is *selecting the top K with ties*.)

**Clarify / edge cases.** Line format (timestamp, level, code, message)? Malformed lines — skip and count them. K larger than the number of codes → return all. Ties — specify the rule. Empty log.

\`\`\`java
import java.util.*;

public class TopKErrorCodes {

    static final List<String> LOG = List.of(
            "2026-11-20T10:00:01Z ERROR PAY-502 Payment gateway timeout",
            "2026-11-20T10:00:02Z INFO  ORD-201 Order created",
            "2026-11-20T10:00:03Z ERROR AUTH-401 Token expired",
            "2026-11-20T10:00:04Z ERROR INV-409 Stock conflict for SKU retro-red-tee",
            "2026-11-20T10:00:05Z ERROR PAY-502 Payment gateway timeout",
            "2026-11-20T10:00:06Z WARN  SRCH-299 Slow search query",
            "2026-11-20T10:00:07Z ERROR AUTH-401 Token expired",
            "2026-11-20T10:00:08Z ERROR SRCH-500 Search index unavailable",
            "2026-11-20T10:00:09Z ERROR INV-409 Stock conflict for SKU storm-fleece-jacket",
            "2026-11-20T10:00:10Z ERROR AUTH-401 Token expired",
            "2026-11-20T10:00:11Z ERROR PAY-502 Payment gateway timeout",
            "garbled line");

    static Map<String, Integer> countErrors(List<String> lines) {
        Map<String, Integer> counts = new HashMap<>();
        for (String line : lines) {
            String[] parts = line.split("\\\\s+", 4);           // timestamp, level, code, message
            if (parts.length >= 3 && parts[1].equals("ERROR")) counts.merge(parts[2], 1, Integer::sum);
        }
        return counts;
    }

    // Ranking: higher count first, then code alphabetically (deterministic ties!)
    static final Comparator<Map.Entry<String, Integer>> RANK =
            Map.Entry.<String, Integer>comparingByValue().reversed()
                    .thenComparing(Map.Entry.comparingByKey());

    // Approach 1 - sort all m distinct codes. O(n + m log m) time, O(m) space
    static List<String> bySort(Map<String, Integer> counts, int k) {
        return counts.entrySet().stream().sorted(RANK).limit(k).map(Map.Entry::getKey).toList();
    }

    // Approach 2 - heap of size k whose head is the WORST of the current top k. O(n + m log k) time, O(m + k) space
    static List<String> byHeap(Map<String, Integer> counts, int k) {
        PriorityQueue<Map.Entry<String, Integer>> heap = new PriorityQueue<>(RANK.reversed());
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            heap.offer(e);
            if (heap.size() > k) heap.poll();
        }
        List<String> out = new ArrayList<>();
        while (!heap.isEmpty()) out.add(heap.poll().getKey());
        Collections.reverse(out);                          // heap gives worst-first
        return out;
    }

    // Approach 3 - bucket sort by frequency (count <= number of lines). O(n + m) time + tie sorting, O(n + m) space
    static List<String> byBuckets(Map<String, Integer> counts, int k) {
        if (counts.isEmpty()) return List.of();
        int max = Collections.max(counts.values());
        List<List<String>> buckets = new ArrayList<>();
        for (int i = 0; i <= max; i++) buckets.add(new ArrayList<>());
        counts.forEach((code, n) -> buckets.get(n).add(code));
        List<String> out = new ArrayList<>();
        for (int f = max; f > 0 && out.size() < k; f--) {
            List<String> bucket = buckets.get(f);
            Collections.sort(bucket);                          // tie-break by code
            for (String code : bucket) {
                if (out.size() == k) break;
                out.add(code);
            }
        }
        return out;
    }

    public static void main(String[] args) {
        Map<String, Integer> counts = countErrors(LOG);
        System.out.println("counts:  " + new TreeMap<>(counts));
        for (int k : new int[] {2, 3}) {
            System.out.printf("k=%d sort=%s heap=%s buckets=%s%n", k,
                    bySort(counts, k), byHeap(counts, k), byBuckets(counts, k));
        }
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
counts:  {AUTH-401=3, INV-409=2, PAY-502=3, SRCH-500=1}
k=2 sort=[AUTH-401, PAY-502] heap=[AUTH-401, PAY-502] buckets=[AUTH-401, PAY-502]
k=3 sort=[AUTH-401, PAY-502, INV-409] heap=[AUTH-401, PAY-502, INV-409] buckets=[AUTH-401, PAY-502, INV-409]
\`\`\`

**Key lines.** \`split("\\\\s+", 4)\` with a limit stops after four fields, so spaces inside the message do not create extra parts, and a short garbage line simply fails the \`length\` check. \`RANK\` is the *report* order (count descending, then code ascending). The heap must evict the **worst** entry, so its comparator is \`RANK.reversed()\`; polling the heap therefore yields worst-first and the result is reversed at the end. Getting this inversion wrong is the most common top-K bug. The explicit type witness \`Map.Entry.<String, Integer>comparingByValue()\` is needed because \`.reversed()\` is called on the result before the compiler has a target type.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Count + sort all | O(n + m log m) | O(m) | One stream pipeline; clearest | Sorts every distinct code |
| Count + heap of size k | O(n + m log k) | O(m + k) | Best when m ≫ k | Comparator inversion is error-prone |
| Count + buckets by frequency | O(n + m) plus tie sorting | O(n + m) | Linear when there are few ties | More code; the tie sort can dominate |

(n = log lines, m = distinct codes.)

**Which to present.** Count + sort for a log of a few thousand lines — say so explicitly. Then show the heap as the answer to "what if there are millions of distinct keys and you need the top 10?".

**Likely follow-up.** "The log is 20 GB" — read with \`Files.lines\` in try-with-resources (lazy, constant memory per line), count into a map; if even the distinct codes do not fit, use a count-min sketch or a pre-aggregating log tool. In practice: point Kibana/Loki at it, but show you could write it.

---

## Part 5 — Binary search

### Problem 10: first and last position of a price in a sorted price list

**Problem.** The price-filter test has the full catalog's prices sorted ascending. Find the first and last index of a given price, and then count how many products a "$10 to $30" filter should return — which is the same two boundary searches.

**Clarify / edge cases.** Price absent → \`[-1, -1]\`. All equal. Empty array. Range with min > max → 0. Integer cents again.

\`\`\`java
import java.util.*;

public class PriceRangeInSortedList {

    // Approach 1 - linear scan. O(n) time, O(1) space
    static int[] linear(int[] sorted, int price) {
        int first = -1, last = -1;
        for (int i = 0; i < sorted.length; i++) {
            if (sorted[i] == price) {
                if (first < 0) first = i;
                last = i;
            } else if (sorted[i] > price) {
                break;                                   // sorted: nothing further can match
            }
        }
        return new int[] {first, last};
    }

    // Approach 2 - Arrays.binarySearch, then walk outwards. O(log n + d) time; O(n) when most values are equal
    static int[] binaryThenExpand(int[] sorted, int price) {
        int i = Arrays.binarySearch(sorted, price);      // returns ANY matching index, or -(insertionPoint) - 1
        if (i < 0) return new int[] {-1, -1};
        int first = i, last = i;
        while (first > 0 && sorted[first - 1] == price) first--;
        while (last < sorted.length - 1 && sorted[last + 1] == price) last++;
        return new int[] {first, last};
    }

    // Approach 3 - two boundary searches. O(log n) time, O(1) space
    /** First index whose value is >= x (a.length if none). */
    static int lowerBound(int[] a, int x) {
        int lo = 0, hi = a.length;                       // search space [lo, hi)
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;                   // unsigned shift: no overflow
            if (a[mid] < x) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    /** First index whose value is > x (a.length if none). */
    static int upperBound(int[] a, int x) {
        int lo = 0, hi = a.length;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (a[mid] <= x) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    static int[] twoBounds(int[] sorted, int price) {
        int first = lowerBound(sorted, price);
        if (first == sorted.length || sorted[first] != price) return new int[] {-1, -1};
        return new int[] {first, upperBound(sorted, price) - 1};
    }

    // Practical follow-up: how many products should a "$10 to $30" filter show? O(log n)
    static int countInRange(int[] sorted, int minCents, int maxCents) {
        return Math.max(0, upperBound(sorted, maxCents) - lowerBound(sorted, minCents));
    }

    public static void main(String[] args) {
        int[] prices = {799, 999, 1599, 1599, 1599, 2499, 2999, 4999};
        for (int p : new int[] {1599, 2999, 1000, 9999}) {
            System.out.printf("%d: linear=%s expand=%s bounds=%s%n", p,
                    Arrays.toString(linear(prices, p)),
                    Arrays.toString(binaryThenExpand(prices, p)),
                    Arrays.toString(twoBounds(prices, p)));
        }
        System.out.println("binarySearch(1000) raw = " + Arrays.binarySearch(prices, 1000));
        System.out.println("products in $10.00-$30.00: " + countInRange(prices, 1000, 3000));
        System.out.println("empty array: " + Arrays.toString(twoBounds(new int[0], 1599)));
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
1599: linear=[2, 4] expand=[2, 4] bounds=[2, 4]
2999: linear=[6, 6] expand=[6, 6] bounds=[6, 6]
1000: linear=[-1, -1] expand=[-1, -1] bounds=[-1, -1]
9999: linear=[-1, -1] expand=[-1, -1] bounds=[-1, -1]
binarySearch(1000) raw = -3
products in $10.00-$30.00: 5
empty array: [-1, -1]
\`\`\`

**Key lines.** \`Arrays.binarySearch\` returns **some** matching index when there are duplicates — the Javadoc explicitly makes no guarantee which — and \`-(insertionPoint) - 1\` when absent (\`-3\` for 1000: it would be inserted at index 2). That is why approach 2 has to walk outwards, which degrades to O(n) when one price dominates. \`lowerBound\` and \`upperBound\` use a half-open search space \`[lo, hi)\` and never compare for equality, so they always converge to a boundary; \`(lo + hi) >>> 1\` avoids the overflow of \`(lo + hi) / 2\` on huge arrays. The range count is \`upperBound(max) - lowerBound(min)\` — no scan at all.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Linear scan | O(n) | O(1) | Obviously correct | Ignores sortedness |
| \`binarySearch\` + expand | O(log n + d) → O(n) worst | O(1) | Reuses the JDK | Duplicate-heavy data makes it linear |
| Lower/upper bound | O(log n) | O(1) | Optimal; gives range counts for free | Off-by-one risk; write the invariant down |

**Which to present.** Lower/upper bound, with the invariant spoken aloud ("everything left of \`lo\` is < x, everything from \`hi\` on is ≥ x"). In framework code a \`TreeMap<Integer, Integer>\` of price → count with \`subMap(min, true, max, true)\` gives the same answer with zero index arithmetic.

**Likely follow-up.** "Search in a rotated sorted array" (a carousel again!) — at each step one half is sorted; decide which half the target can be in by comparing with that half's ends.

---

## Part 6 — Design a data structure

### Problem 11: LRU cache for a test-data service

**Problem.** A test-data helper fetches product JSON from \`GET /api/products/{id}\`. Cache up to N products; when full, evict the **least recently used** one. \`get\` and \`put\` should be O(1). The *Collections internals* deep dive shows the ten-line \`LinkedHashMap\` version; interviewers almost always follow with "now without \`LinkedHashMap\`", so this problem focuses on building it by hand.

**Clarify / edge cases.** Does \`put\` on an existing key count as a use? (Usually yes.) Capacity 0 or negative → reject. \`null\` keys/values? Thread safety? (Ask; the default answer is "single-threaded, I will discuss concurrency after".)

\`\`\`java
import java.util.*;

public class LruCacheDemo {

    // Approach 1 - HashMap + ArrayList of keys (oldest first). get/put O(n) because of List.remove(Object)
    static class ListLru<K, V> {
        private final int capacity;
        private final Map<K, V> values = new HashMap<>();
        private final List<K> order = new ArrayList<>();

        ListLru(int capacity) {
            if (capacity <= 0) throw new IllegalArgumentException("capacity must be > 0");
            this.capacity = capacity;
        }

        V get(K key) {
            if (!values.containsKey(key)) return null;
            order.remove(key);                   // K is a type variable, so this is remove(Object), O(n)
            order.add(key);
            return values.get(key);
        }

        void put(K key, V value) {
            if (values.containsKey(key)) order.remove(key);
            else if (values.size() == capacity) values.remove(order.remove(0));   // evict oldest
            values.put(key, value);
            order.add(key);
        }

        @Override public String toString() { return order.toString(); }
    }

    // Approach 2 - LinkedHashMap in access order + removeEldestEntry. O(1) get/put
    static class LinkedLru<K, V> extends LinkedHashMap<K, V> {
        private final int capacity;

        LinkedLru(int capacity) {
            super(16, 0.75f, true);              // true = access order: get() moves the entry to the end
            this.capacity = capacity;
        }

        @Override
        protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
            return size() > capacity;            // called by put/putAll after inserting
        }
    }

    // Approach 3 - hand-rolled: HashMap<K, Node> + doubly linked list with sentinels. O(1) get/put
    static class HandRolledLru<K, V> {
        private final class Node {
            final K key;
            V value;
            Node prev, next;
            Node(K key, V value) { this.key = key; this.value = value; }
        }

        private final int capacity;
        private final Map<K, Node> index = new HashMap<>();
        private final Node head = new Node(null, null);   // head.next = most recently used
        private final Node tail = new Node(null, null);   // tail.prev = least recently used

        HandRolledLru(int capacity) {
            if (capacity <= 0) throw new IllegalArgumentException("capacity must be > 0");
            this.capacity = capacity;
            head.next = tail;
            tail.prev = head;
        }

        V get(K key) {
            Node n = index.get(key);
            if (n == null) return null;
            moveToFront(n);
            return n.value;
        }

        void put(K key, V value) {
            Node n = index.get(key);
            if (n != null) {                      // update counts as a "use"
                n.value = value;
                moveToFront(n);
                return;
            }
            if (index.size() == capacity) {
                Node lru = tail.prev;
                unlink(lru);
                index.remove(lru.key);            // this is why the node stores its key
            }
            n = new Node(key, value);
            index.put(key, n);
            addFirst(n);
        }

        private void moveToFront(Node n) { unlink(n); addFirst(n); }

        private void unlink(Node n) {
            n.prev.next = n.next;
            n.next.prev = n.prev;
        }

        private void addFirst(Node n) {
            n.next = head.next;
            n.prev = head;
            head.next.prev = n;
            head.next = n;
        }

        @Override public String toString() {        // least recent first, to match the other two
            List<K> keys = new ArrayList<>();
            for (Node n = tail.prev; n != head; n = n.prev) keys.add(n.key);
            return keys.toString();
        }
    }

    public static void main(String[] args) {
        ListLru<Integer, String> a = new ListLru<>(2);
        LinkedLru<Integer, String> b = new LinkedLru<>(2);
        HandRolledLru<Integer, String> c = new HandRolledLru<>(2);

        // product id -> cached product JSON in a test-data service
        a.put(1, "Trailblazer Backpack"); b.put(1, "Trailblazer Backpack"); c.put(1, "Trailblazer Backpack");
        a.put(2, "Pulse Bike Light");     b.put(2, "Pulse Bike Light");     c.put(2, "Pulse Bike Light");
        a.get(1);                         b.get(1);                         c.get(1);
        a.put(3, "Classic Crew T-Shirt"); b.put(3, "Classic Crew T-Shirt"); c.put(3, "Classic Crew T-Shirt");

        System.out.println("list:       " + a + " get(2)=" + a.get(2));
        System.out.println("linked:     " + b.keySet() + " get(2)=" + b.get(2));
        System.out.println("handRolled: " + c + " get(2)=" + c.get(2));
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
list:       [1, 3] get(2)=null
linked:     [1, 3] get(2)=null
handRolled: [1, 3] get(2)=null
\`\`\`

**Key lines.** The hash map gives O(1) *lookup* of a node; the doubly linked list gives O(1) *reordering* and *eviction* — neither structure alone can do both. Sentinel \`head\`/\`tail\` nodes remove every \`null\` check from \`unlink\` and \`addFirst\`. Each node stores its key so that evicting \`tail.prev\` can also remove the map entry. In \`LinkedLru\`, the third constructor argument \`true\` switches \`LinkedHashMap\` to access order, and \`removeEldestEntry\` is a hook called after each insertion. In \`ListLru\`, \`order.remove(key)\` resolves to \`remove(Object)\` because \`K\` is a type variable — on a concrete \`List<Integer>\`, \`remove(1)\` would call \`remove(int index)\` instead, a classic trap.

| Approach | get / put | Space | Strength | Weakness |
|---|---|---|---|---|
| HashMap + ArrayList of keys | O(n) / O(n) | O(n) | Easy to get right | Linear reordering |
| \`LinkedHashMap\` access order | O(1) / O(1) | O(n) | Ten lines, battle-tested | Not thread-safe; "too easy" for the interviewer |
| HashMap + doubly linked list | O(1) / O(1) | O(n) | What the question is really testing | More code, pointer bugs |

**Which to present.** Mention \`LinkedHashMap\` first ("in production code I would use this"), then write the hand-rolled version when asked. Draw the list on the whiteboard before you code \`unlink\`/\`addFirst\`.

**Likely follow-up.** "Make it thread-safe for a parallel TestNG run" — simplest: \`synchronized\` on \`get\`/\`put\` (note that \`get\` *mutates* the list, so a read-write lock does not help); at scale use Caffeine. Wrapping a \`LinkedHashMap\` in \`Collections.synchronizedMap\` works for single calls but not for check-then-act sequences.

---

## Part 7 — Strings and regex

### Problem 12: run-length encode a test's pass/fail history

**Problem.** A flakiness dashboard stores each test's last builds as \`P\`/\`F\` characters. Compress \`PPPPFFPPPF\` to \`P4F2P3F1\` (run-length encoding), and decode it back.

**Clarify / edge cases.** Count always written, even for 1? (Here yes; the LeetCode variant omits 1 and returns the original if compression is not shorter.) Empty string. Can the symbols be digits? (Then decoding is ambiguous — reject or use a separator.) Runs longer than 9 (multi-digit counts).

\`\`\`java
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class RunLengthHistory {

    // Approach 1 - String concatenation in a loop. O(n^2) worst case (each += copies the whole result)
    static String naive(String s) {
        String out = "";
        int i = 0;
        while (i < s.length()) {
            char c = s.charAt(i);
            int j = i;
            while (j < s.length() && s.charAt(j) == c) j++;
            out += c + String.valueOf(j - i);      // NOT c + (j - i): char + int is int arithmetic
            i = j;
        }
        return out;
    }

    // Approach 2 - StringBuilder with run detection. O(n) time, O(n) space for the output
    static String builder(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        int i = 0;
        while (i < s.length()) {
            char c = s.charAt(i);
            int j = i;
            while (j < s.length() && s.charAt(j) == c) j++;
            sb.append(c).append(j - i);            // append(int) appends digits
            i = j;
        }
        return sb.toString();
    }

    // Approach 3 - regex back-reference: (.)\\1* matches one run. O(n) time, more constant overhead
    private static final Pattern RUN = Pattern.compile("(.)\\\\1*", Pattern.DOTALL);

    static String regex(String s) {
        return RUN.matcher(s).results()                                   // Matcher.results(): Java 9+
                .map(r -> r.group(1) + r.group().length())
                .collect(Collectors.joining());
    }

    // Follow-up: decode "P4F2" -> "PPPPFF" (assumes the symbols themselves are never digits)
    private static final Pattern TOKEN = Pattern.compile("(\\\\D)(\\\\d+)");

    static String decode(String encoded) {
        StringBuilder sb = new StringBuilder();
        Matcher m = TOKEN.matcher(encoded);
        int expectedStart = 0;
        while (m.find()) {
            if (m.start() != expectedStart) throw new IllegalArgumentException("bad input at " + expectedStart);
            sb.append(m.group(1).repeat(Integer.parseInt(m.group(2))));   // String.repeat: Java 11+
            expectedStart = m.end();
        }
        if (expectedStart != encoded.length()) throw new IllegalArgumentException("bad input at " + expectedStart);
        return sb.toString();
    }

    public static void main(String[] args) {
        String history = "PPPPFFPPPF";           // pass/fail of one test over the last 10 builds
        System.out.println("naive:   " + naive(history));
        System.out.println("builder: " + builder(history));
        System.out.println("regex:   " + regex(history));
        System.out.println("decode:  " + decode(builder(history)));
        System.out.println("empty:   \\"" + builder("") + "\\"");
        char c = 'P';
        System.out.println("trap:    " + (c + 4) + " vs " + c + 4);
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
naive:   P4F2P3F1
builder: P4F2P3F1
regex:   P4F2P3F1
decode:  PPPPFFPPPF
empty:   ""
trap:    84 vs P4
\`\`\`

**Key lines.** \`out += c + String.valueOf(j - i)\` is deliberate: \`c + (j - i)\` would add the char's code (80 for \`P\`) to the count — the last output line shows \`'P' + 4\` printing \`84\`. In a loop, \`+=\` on a \`String\` copies the whole result each time (the compiler's \`StringBuilder\`/\`invokedynamic\` concatenation applies *per expression*, not across iterations), hence O(n²). \`(.)\\1*\` captures one character and then matches any repeats of the same capture — a run. \`Pattern.DOTALL\` lets \`.\` match newlines too. The decoder checks that tokens are contiguous so \`"P4xF2"\` fails instead of silently skipping \`x\`.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| \`String +=\` | O(n²) worst | O(n) per copy | — | Quadratic copying; char + int trap |
| \`StringBuilder\` | O(n) | O(n) | Fast, explicit | Slightly more code |
| Regex back-reference | O(n) | O(n) | Compact, expressive | Regex engine overhead; harder to debug |

**Which to present.** \`StringBuilder\` with the two-index run loop. Mention the regex as a one-liner alternative and why you would not use \`+=\` in a loop.

**Likely follow-up.** "Find the longest failing streak" — the same run loop, tracking the maximum run of \`F\`.

---

## Part 8 — Recursion versus an explicit stack

### Problem 13: flatten a nested category menu

**Problem.** An untyped JSON array of categories parsed by Jackson into \`List<Object>\` contains strings and nested lists to any depth. Flatten it to a single list of category names in left-to-right order, to compare against the visible menu.

**Clarify / edge cases.** Unbounded depth? (Then recursion can overflow the stack.) Empty sub-lists (contribute nothing). \`null\` elements? Cycles (a list containing itself) — would loop forever; track visited lists with an identity set if possible. Element types other than \`String\`.

\`\`\`java
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class FlattenNested {

    // Approach 1 - recursion. O(N) time (N = all elements and lists), O(depth) call stack
    static List<Object> recursive(List<?> input) {
        List<Object> out = new ArrayList<>();
        flattenInto(input, out);
        return out;
    }

    private static void flattenInto(List<?> in, List<Object> out) {
        for (Object o : in) {
            if (o instanceof List<?> nested) flattenInto(nested, out);   // pattern matching: Java 16+
            else out.add(o);
        }
    }

    // Approach 2 - iterative with an explicit stack of iterators (keeps left-to-right order). O(N) time, O(depth) heap
    static List<Object> iterative(List<?> input) {
        List<Object> out = new ArrayList<>();
        Deque<Iterator<?>> stack = new ArrayDeque<>();
        stack.push(input.iterator());
        while (!stack.isEmpty()) {
            Iterator<?> it = stack.peek();
            if (!it.hasNext()) { stack.pop(); continue; }
            Object o = it.next();
            if (o instanceof List<?> nested) stack.push(nested.iterator());
            else out.add(o);
        }
        return out;
    }

    // Approach 3 - recursive flatMap. O(N) time, O(depth) stack plus per-level stream overhead
    static Stream<Object> flat(Object o) {
        return o instanceof List<?> nested
                ? nested.stream().flatMap(FlattenNested::flat)
                : Stream.of(o);
    }

    public static void main(String[] args) {
        // category menu as Jackson would give it for an untyped JSON array
        List<Object> menu = List.of("Bags",
                List.of("Clothing", List.of("T-Shirts", "Jackets")),
                List.of(),
                "Kids",
                List.of(List.of(List.of("Accessories"))));

        System.out.println("recursive: " + recursive(menu));
        System.out.println("iterative: " + iterative(menu));
        System.out.println("stream:    " + flat(menu).collect(Collectors.toList()));

        // 100,000 levels deep: [[[[ ... "leaf" ... ]]]]
        List<Object> deep = new ArrayList<>(List.of("leaf"));
        for (int i = 0; i < 100_000; i++) deep = new ArrayList<>(List.of(deep));
        System.out.println("deep iterative: " + iterative(deep));
        try {
            recursive(deep);
        } catch (StackOverflowError e) {
            System.out.println("deep recursive: StackOverflowError");
        }
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
recursive: [Bags, Clothing, T-Shirts, Jackets, Kids, Accessories]
iterative: [Bags, Clothing, T-Shirts, Jackets, Kids, Accessories]
stream:    [Bags, Clothing, T-Shirts, Jackets, Kids, Accessories]
deep iterative: [leaf]
deep recursive: StackOverflowError
\`\`\`

**Key lines.** The recursive version uses the JVM call stack as its stack; each nesting level costs one frame, so at 100,000 levels (default thread stack size, JDK 17 on a desktop) it throws \`StackOverflowError\` (an \`Error\`, not an \`Exception\` — it is caught here only for the demo). The iterative version moves the same stack to the heap as a \`Deque<Iterator<?>>\`; pushing *iterators* rather than elements keeps the original left-to-right order without reversing anything. The stream version is elegant but creates a stream per nested list and is recursive too.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| Recursion | O(N) | O(depth) call stack | Shortest, mirrors the data | \`StackOverflowError\` on deep input |
| Explicit stack of iterators | O(N) | O(depth) heap | Survives any depth | Slightly harder to read |
| Recursive \`flatMap\` | O(N) | O(depth) stack + stream objects | Declarative | Recursion limits plus overhead |

(N = elements plus nested lists.)

**Which to present.** Recursion first — it is what the interviewer expects and the depth of real menus is tiny. Then volunteer the iterative version as the answer to "what if the depth is unbounded?". That trade-off, said unprompted, is the senior point.

**Likely follow-up.** "Make it an \`Iterator\` that flattens lazily" — the explicit-stack version is already the core of \`hasNext\`/\`next\`; you just pre-fetch the next leaf.

---

## Part 9 — A practical automation problem

### Problem 14: per-status counts and p95 latency from an API access log

**Problem.** A performance smoke test hits the ShopEasy API and the server writes access logs like \`2026-11-20T10:15:02Z GET /api/products 200 123ms\`. Produce: requests per status code, the overall p95 latency, the p95 per endpoint, and the number of unparseable lines.

**Clarify / edge cases.** Percentile definition — nearest-rank (a real sample) or interpolated? (State which; here nearest-rank: rank = ⌈p/100 · n⌉.) Malformed lines (log rotation markers, stack traces) — skip and *report the count*, never silently. Empty input → fail clearly, since p95 of nothing is undefined. One sample: p95 is that sample.

\`\`\`java
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class AccessLogStats {

    record Entry(String method, String path, int status, long millis) {}

    private static final Pattern LINE =
            Pattern.compile("^\\\\S+ (GET|POST|PUT|PATCH|DELETE) (\\\\S+) (\\\\d{3}) (\\\\d+)ms$");

    static Optional<Entry> parse(String line) {
        Matcher m = LINE.matcher(line.strip());
        if (!m.matches()) return Optional.empty();
        return Optional.of(new Entry(m.group(1), m.group(2),
                Integer.parseInt(m.group(3)), Long.parseLong(m.group(4))));
    }

    /** Nearest-rank percentile: the smallest value with at least p% of samples <= it. O(n log n). */
    static long percentile(List<Long> samples, double p) {
        if (samples.isEmpty()) throw new IllegalArgumentException("no samples");
        List<Long> sorted = new ArrayList<>(samples);
        Collections.sort(sorted);
        int rank = (int) Math.ceil(p / 100.0 * sorted.size());     // 1-based
        return sorted.get(Math.max(rank, 1) - 1);
    }

    // Approach 1 - one imperative pass. O(n) parse + O(n log n) for the percentile sort
    static String loop(List<String> lines) {
        Map<Integer, Integer> byStatus = new TreeMap<>();
        List<Long> latencies = new ArrayList<>();
        int skipped = 0;
        for (String line : lines) {
            Optional<Entry> parsed = parse(line);
            if (parsed.isEmpty()) { skipped++; continue; }       // Optional.isEmpty: Java 11+
            Entry e = parsed.get();
            byStatus.merge(e.status(), 1, Integer::sum);
            latencies.add(e.millis());
        }
        return "status=" + byStatus + " p95=" + percentile(latencies, 95) + "ms skipped=" + skipped;
    }

    // Approach 2 - streams: parse once into records, then several small collectors. Same Big-O, more passes
    static String streams(List<String> lines) {
        List<Entry> entries = lines.stream()
                .map(AccessLogStats::parse)
                .flatMap(Optional::stream)                           // Optional.stream: Java 9+
                .toList();                                           // Stream.toList: Java 16+
        Map<Integer, Long> byStatus = entries.stream()
                .collect(Collectors.groupingBy(Entry::status, TreeMap::new, Collectors.counting()));
        long p95 = percentile(entries.stream().map(Entry::millis).toList(), 95);
        Map<String, Long> p95ByPath = entries.stream()
                .collect(Collectors.groupingBy(Entry::path, TreeMap::new,
                        Collectors.collectingAndThen(
                                Collectors.mapping(Entry::millis, Collectors.toList()),
                                l -> percentile(l, 95))));
        return "status=" + byStatus + " p95=" + p95 + "ms skipped=" + (lines.size() - entries.size())
                + "\\n         p95ByPath=" + p95ByPath;
    }

    public static void main(String[] args) {
        List<String> lines = List.of(
                "2026-11-20T10:15:01Z GET /api/products 200 120ms",
                "2026-11-20T10:15:01Z GET /api/products/2 200 45ms",
                "2026-11-20T10:15:02Z POST /api/auth/login 200 210ms",
                "2026-11-20T10:15:02Z GET /api/cart 401 12ms",
                "2026-11-20T10:15:03Z POST /api/cart/items 201 95ms",
                "2026-11-20T10:15:03Z GET /api/products 200 135ms",
                "2026-11-20T10:15:04Z GET /api/products/99 404 18ms",
                "2026-11-20T10:15:04Z POST /api/orders 201 640ms",
                "2026-11-20T10:15:05Z GET /api/products 200 110ms",
                "2026-11-20T10:15:05Z GET /api/products 500 2050ms",
                "2026-11-20T10:15:06Z GET /api/orders 200 88ms",
                "2026-11-20T10:15:06Z POST /api/orders 400 30ms",
                "2026-11-20T10:15:07Z GET /api/products 200 140ms",
                "2026-11-20T10:15:07Z GET /api/health 200 3ms",
                "2026-11-20T10:15:08Z POST /api/auth/login 200 190ms",
                "2026-11-20T10:15:08Z GET /api/products/1 200 40ms",
                "2026-11-20T10:15:09Z POST /api/orders 201 720ms",
                "2026-11-20T10:15:09Z GET /api/products 200 125ms",
                "2026-11-20T10:15:10Z GET /api/cart 200 60ms",
                "2026-11-20T10:15:10Z GET /api/products 200 150ms",
                "-- log rotated --");
        System.out.println("loop:    " + loop(lines));
        System.out.println("streams: " + streams(lines));
    }
}
\`\`\`

Output (JDK 17):

\`\`\`text
loop:    status={200=13, 201=3, 400=1, 401=1, 404=1, 500=1} p95=720ms skipped=1
streams: status={200=13, 201=3, 400=1, 401=1, 404=1, 500=1} p95=720ms skipped=1
         p95ByPath={/api/auth/login=210, /api/cart=60, /api/cart/items=95, /api/health=3, /api/orders=720, /api/products=2050, /api/products/1=40, /api/products/2=45, /api/products/99=18}
\`\`\`

**Key lines.** A single anchored regex both validates and extracts, so a malformed line produces \`Optional.empty()\` instead of an \`ArrayIndexOutOfBoundsException\` from \`split\`. With 20 valid samples, the nearest rank for p95 is ⌈0.95 × 20⌉ = 19, the 19th smallest value: 720 ms — the single 2,050 ms outlier (the 500 error) is above p95, which is exactly why p95 rather than max is the alerting metric. \`TreeMap\` in \`groupingBy(…, TreeMap::new, …)\` makes the report sorted and stable. \`collectingAndThen(mapping(…, toList()), …)\` computes a per-group percentile in one collector.

| Approach | Time | Space | Strength | Weakness |
|---|---|---|---|---|
| One imperative loop | O(n) + O(n log n) percentile | O(n) latencies | One pass over the lines; easy to add counters | Grows into a long method |
| Streams + collectors | O(n log n), several passes | O(n) records | Each metric is one declarative expression | Several passes; harder to debug mid-pipeline |
| Streaming histogram / quickselect (not shown) | O(n) | O(buckets) | Constant memory for huge logs | Approximate (histogram) or mutating (quickselect) |

**Which to present.** Either of the first two — say which you chose and why. A strong answer: "I parse once into records (so parsing is tested in one place), then use collectors for the report; if the log were gigabytes I would read it with \`Files.lines\` and keep a fixed-bucket latency histogram instead of a list".

**Likely follow-up.** "Fail the build if p95 of \`/api/products\` exceeds 500 ms" — compute \`p95ByPath\`, filter entries above the SLA, and assert the filtered map is empty so the failure message lists every offending endpoint at once.

---

## Big-O cheat sheet for the Java operations used above

| Operation | Time | Notes |
|---|---|---|
| \`ArrayList.get/set\` | O(1) | Backed by an array |
| \`ArrayList.add(e)\` | O(1) amortised | Occasional grow-and-copy |
| \`ArrayList.add(i, e)\` / \`remove(i)\` / \`remove(Object)\` / \`contains\` / \`indexOf\` | O(n) | Shift or linear search |
| \`ArrayDeque.push/pop/peek/offer/poll\` | O(1) amortised | Use it for stacks and queues instead of \`Stack\`/\`LinkedList\`; no \`null\` elements |
| \`LinkedList.get(i)\` | O(n) | Walks from the nearer end |
| \`HashMap/HashSet\` \`get/put/remove/contains\`, \`merge\`, \`computeIfAbsent\` | O(1) average | Collisions degrade a bin to a list, then (OpenJDK, Java 8+) to a tree: O(log n) worst, best with \`Comparable\` keys; iteration is O(capacity + n) |
| \`LinkedHashMap\` same as above, plus access-order move | O(1) | Predictable iteration order |
| \`TreeMap/TreeSet\` \`get/put/remove/floorEntry/ceiling/first\` | O(log n) | Red-black tree; sorted iteration |
| \`TreeMap.subMap\` view creation | O(log n) to locate; iterating it is O(k) | Range queries |
| \`PriorityQueue.offer/poll\` | O(log n) | Binary heap |
| \`PriorityQueue.peek\` | O(1) | Head only |
| \`PriorityQueue.remove(Object)/contains\` | O(n) | Linear scan; iteration order is **not** sorted |
| \`Arrays.sort(int[])\` | O(n log n) | Dual-pivot quicksort; not stable (irrelevant for primitives) |
| \`Arrays.sort(Object[])\`, \`List.sort\`, \`Collections.sort\` | O(n log n), O(n) on sorted input | TimSort, **stable** |
| \`Arrays.binarySearch\`, \`Collections.binarySearch\` (RandomAccess) | O(log n) | Any match among duplicates |
| \`Collections.indexOfSubList\` | O(n · m) | Naive search |
| \`Collections.rotate\` / \`reverse\` | O(n) | In place |
| \`String.charAt\`, \`length\` | O(1) | |
| \`String.indexOf/contains(String)\` | O(n · m) worst | Naive search, intrinsified |
| \`String +=\` in a loop | O(n²) total | Copy per iteration |
| \`StringBuilder.append\` | O(1) amortised | Pre-size when the length is known |
| \`String.split(regex)\` | O(n) | Compiles the regex on every call except OpenJDK's fast path for a one-character literal; precompile hot patterns |
| Stream \`sorted()\` | O(n log n) | Buffers the whole stream |
| \`Collectors.groupingBy\` / \`counting\` / \`partitioningBy\` | O(n) | HashMap by default; TreeMap supplier makes it O(n log g) |

## Interview questions

### Q: How do you decide which approach to present first in a live-coding round?

**Short answer (30–60 s):** I state the brute force with its Big-O in one or two sentences so there is a correct baseline, then identify the bottleneck and code the improved version. If the brute force is very short and I am unsure about the optimal approach, I code it first so I have something that works.

**Detailed answer:** The interviewer is grading problem decomposition, communication, correctness and complexity analysis — roughly in that order. A correct O(n²) solution with a clear explanation of how to reach O(n) scores better than a half-finished O(n). The improvement is almost always one of a small set of moves: replace an inner lookup with a hash structure; sort and use two pointers or binary search; keep a sliding window instead of recomputing; keep a heap of size k instead of sorting everything; turn recursion into an explicit stack. Naming the move ("the inner loop is a membership test, so a \`HashSet\` makes it O(1)") is what shows seniority. Finally, I say what I would ship in a framework: usually the most readable version, because n is small — but I make the cost explicit.

### Q: HashMap lookups are "O(1)". When is that not true, and when would you choose sorting instead?

**Short answer (30–60 s):** O(1) is the *average* with a good \`hashCode\` and a resized table. With many collisions a bin becomes a list or, in OpenJDK since Java 8, a red-black tree, so the worst case is O(log n) per lookup. I choose sorting when the data is already sorted, when I need ordered output or ranges anyway, when memory is tight, or when keys have a poor or mutable \`hashCode\`.

**Detailed answer:** The hash approach trades O(n) extra memory for linear time and also pays boxing (\`Integer\` keys) and hashing costs, which for small n can make it slower than a sort. Correctness depends on \`equals\`/\`hashCode\` being consistent and on keys not being mutated while in the map — a mutable key whose hash changes is silently "lost". Sorting gives O(n log n), works with a \`Comparator\` (no hashing contract), handles "all pairs" and range questions, and on primitives \`Arrays.sort\` is very cache-friendly. In the pair-sum problem: unsorted input and indices needed → HashMap; sorted input → two pointers in O(n) time and O(1) space.

### Q: For top-K, when do you use a heap, a full sort, or quickselect?

**Short answer (30–60 s):** Full sort when the data is small or I need the full ranking anyway — it is the clearest. Heap of size k when m ≫ k or data arrives as a stream: O(m log k) time, O(k) memory. Quickselect when I need the single k-th element as fast as possible in memory: O(n) average, but O(n²) worst and it mutates the array.

**Detailed answer:** The heap's head must be the *worst* element of the current top k, so for "largest" you use a min-heap — inverting the comparator is the commonest bug, and ties need a deterministic secondary key or the output changes between runs. Quickselect's worst case is mitigated with a random pivot and three-way partitioning for duplicates; the JDK has no public quickselect, so it is hand-written code that needs its own tests. Bucket sort by frequency is linear when the maximum count is bounded (≤ n lines). In an SDET context, the data is rarely big enough for the difference to matter — I would write the sort version and mention the heap as the scaling answer.

### Q: Streams or loops in a live-coding interview?

**Short answer (30–60 s):** Loops for algorithmic problems where indices, early exit or mutable state matter (two pointers, sliding window, quickselect). Streams for transform-and-aggregate problems (grouping, counting, partitioning, mapping a log to a report). I often write the loop first and offer the stream version afterwards.

**Detailed answer:** Streams are declarative and make aggregations short (\`groupingBy\` + \`counting\`), but they hide complexity (\`sorted()\` buffers everything; several pipelines mean several passes), make stepping through in a debugger harder, and fit poorly with index arithmetic. A sliding window written as a stream is a red flag rather than a show of skill. Conversely, a 15-line imperative grouping loop where \`groupingBy\` would do signals unfamiliarity with Java 8+. Interviewers also like candidates who know specific Java 16+ details such as \`Stream.toList()\` returning an unmodifiable list, unlike \`Collectors.toList()\`, which makes no guarantee about mutability.

### Q: Why does stability of a sort matter in test automation?

**Short answer (30–60 s):** A stable sort keeps equal elements in their original order. Tests that sort by one key and then assert the full order, or rely on sorting by a boolean to partition, are only correct with a stable sort. \`Collections.sort\`, \`Arrays.sort(Object[])\` and therefore \`ArrayList.sort\` are documented as stable (TimSort); \`Arrays.sort\` on primitives is not, but for primitives stability is unobservable.

**Detailed answer:** If the UI sorts products by price and two products cost 15.99, the expected order for the tie depends on the app's secondary rule (often the id or insertion order). When your test builds the expected list with a stable sort over API data in id order, ties stay in id order — which matches an app that also uses a stable sort or an explicit tie-breaker. If the app uses an unstable sort, the order of ties is undefined and the test must either compare ties as a set or demand a tie-breaker from the developers. Knowing this turns a "flaky sort test" into a precise bug report.

### Q: How do you test your own solution before saying "done"?

**Short answer (30–60 s):** I dry-run my written examples line by line, then the edge-case checklist: empty, one element, all equal, duplicates, boundaries, overflow, and the specific trap for the technique (for a sliding window, \`"abba"\`; for binary search, absent value below and above the range; for intervals, touching and nested).

**Detailed answer:** I also state the invariant of every loop ("everything before \`w\` is non-zero and in original order") because a correct invariant plus correct initialisation and termination *is* the proof. When the interviewer allows running code, I add a tiny \`main\` with asserts or print statements comparing against the brute force on random input — a "differential test". That technique is directly what an SDET does at work: the brute force becomes the test oracle for the optimised implementation.

## Scenario-based questions

### Scenario 1: "Nice — now do it without LinkedHashMap"

You wrote the \`LinkedHashMap\` LRU in a minute. The interviewer asks for O(1) without it. **Reasoning:** say what each operation needs (O(1) find → hash map; O(1) move-to-front and evict-oldest → doubly linked list), draw the list with head and tail sentinels, then code \`unlink\` and \`addFirst\` first, because \`get\`/\`put\` are just compositions of them. Talk through eviction: "the node stores its key so I can remove it from the map". Test with capacity 2: put 1, put 2, get 1, put 3 → key 2 evicted. Then pre-empt the follow-up: \`get\` mutates the list, so thread safety needs a lock around both methods, not a read-write lock.

### Scenario 2: your log-stats utility runs out of memory in CI

The p95 helper you wrote for a smoke suite is reused by a soak test whose log is 6 GB; the build fails with \`java.lang.OutOfMemoryError: Java heap space\`. **Reasoning:** the code reads all lines into a \`List<String>\` and stores every latency. Fix in order: stream lines with \`Files.lines\` in try-with-resources so lines are not retained; count statuses in a map (tiny); replace the latency list with a fixed-bucket histogram (e.g. 1 ms buckets up to 10 s plus an overflow bucket) and compute p95 by walking cumulative counts — O(1) memory, exact to the bucket width. Say explicitly that the result is now bucket-approximate and document the bucket size in the report. Add a unit test that compares histogram p95 with exact p95 on a small sample.

### Scenario 3: ten minutes left and the optimal idea is not coming

You are on "merge intervals" and keep getting the merge condition wrong. **Reasoning:** stop, say so, and secure a correct answer: "Let me finish the sort + merge with a simple condition and test it on the touching case." Write the examples first (overlapping, nested, touching, disjoint), run them through by hand, and fix the condition (\`<=\` vs \`<\`). If time is still short, state the complexity and the remaining risk honestly ("I have not handled windows crossing midnight; I would split them in the input"). Interviewers consistently rate composure and a verified partial solution above a rushed, untested one.

## Tricky follow-ups

* **Q: What does \`System.out.println('P' + 4)\` print?** A: \`84\` — \`char + int\` is numeric promotion. \`"" + 'P' + 4\` or \`String.valueOf\` gives \`P4\`.
* **Q: \`list.remove(1)\` on a \`List<Integer>\` containing \`[5, 7, 1]\`?** A: It removes \`7\` — the element at **index** 1 — because \`remove(int)\` matches without boxing, so it wins overload resolution over \`remove(Object)\`. To remove the value use \`list.remove(Integer.valueOf(1))\`.
* **Q: You print a \`PriorityQueue\` after adding 5, 1, 3 and see \`[1, 5, 3]\`. Bug?** A: No — \`toString\` and iteration follow the internal heap array, which is only partially ordered. Only repeated \`poll()\` yields sorted order.
* **Q: \`Arrays.asList(new int[] {3, 1, 2})\` — what is its size?** A: 1. It is a \`List<int[]>\` containing one array; use \`Arrays.stream(arr).boxed().toList()\` or an \`Integer[]\`.
* **Q: Why write \`(lo + hi) >>> 1\` instead of \`(lo + hi) / 2\`?** A: \`lo + hi\` can overflow \`int\` for very large arrays and become negative; the unsigned shift treats the overflowed sum as unsigned and still gives the correct midpoint. \`lo + (hi - lo) / 2\` is the other common fix.`,
  keyPoints: [
    'Process scores more than tricks: clarify, examples, brute force with Big-O, named improvement, clean code while talking, dry-run with edge cases.',
    'Most optimisations are one of five moves: hash lookup instead of an inner loop, sort plus two pointers or binary search, sliding window, heap of size k, explicit stack instead of recursion.',
    'Always state time AND space, and the trade-off you are making (e.g. O(n) memory for O(n) time); say which version you would ship in a framework and why.',
    'Money is integer cents or BigDecimal; composite keys need a separator or a record; ranking needs a deterministic tie-breaker.',
    'Know the JDK contracts you lean on: Map.merge removes on null, Arrays.binarySearch returns any match, PriorityQueue iteration is not sorted, object sorts are stable, Collections.indexOfSubList and String.indexOf are naive searches.',
    'Automation-flavoured problems (UI vs API diff, log stats, carousel order) are judged on the failure message: return a readable diff, count skipped lines, never fail silently.',
    'Use the brute force as a test oracle: a differential test against the optimised version is the SDET way to prove correctness.',
  ],
  mistakes: [
    'Coding before clarifying duplicates, ties, case/whitespace or empty input, then rewriting halfway. Fix: spend the first five minutes on questions and two or three written examples, one of them an edge case.',
    'Comparing UI and API lists with containsAll in both directions. It passes [A, A, B] vs [A, B, B]. Fix: compare count maps (groupingBy + counting) or AssertJ containsExactlyInAnyOrderElementsOf, and print the missing/extra diff.',
    'Inverting the top-K heap comparator so the heap evicts the best element instead of the worst — the output looks plausible but is wrong. Fix: the heap head must be the worst of the current top k (min-heap for "largest"); test with a tie and with k = 1.',
    'Using HashMap iteration order as the answer (or printing a PriorityQueue) and getting different output on another JDK or after a resize. Fix: LinkedHashMap for first-seen order, TreeMap for sorted order, or an explicit sort with a tie-breaker.',
    'Writing a recursive solution for data of unbounded depth and getting java.lang.StackOverflowError with a stack trace of thousands of identical frames. Fix: recognise the repeated frame in the trace, then switch to an explicit ArrayDeque-based stack.',
    'Claiming "O(1)" or "O(n)" for JDK calls that are not: String.contains, Collections.indexOfSubList and List.remove(Object) are linear or worse. Fix: learn the cheat-sheet table and say "average" for hash operations.',
  ],
  tryIt: `Solve the problem this lesson deliberately left out: **duplicate order ids across paginated results**. You page through an order history (a paginated UI table or a paginated API) and collect a \`List<List<String>>\` such as \`[["ORD-1001","ORD-1002","ORD-1003"], ["ORD-1003","ORD-1004"], ["ORD-1001","ORD-1005"]]\`. Write \`Map<String, List<Integer>> duplicates(List<List<String>> pages)\` that returns every id seen more than once with the (1-based) pages it appeared on, **in first-seen order** — expected \`{ORD-1001=[1, 3], ORD-1003=[1, 2]}\`. Do it twice: (1) brute force comparing every id with every earlier id, O(n²); (2) one pass with a \`LinkedHashMap<String, List<Integer>>\` and \`computeIfAbsent\`, then filter lists of size > 1 — O(n). State the time and space of both, add a test for an empty page and for the same id twice on one page, and write the TestNG assertion message you would want to read when this bug (pagination over a non-unique sort key) appears in CI.`,
  problems: ['java-011', 'java-012', 'java-015', 'java-023', 'java-034', 'java-037'],
}
