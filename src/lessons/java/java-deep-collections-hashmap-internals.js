export default {
  slug: 'java-deep-collections-hashmap-internals',
  category: 'java',
  order: 14,
  title: 'Deep dive: Collections internals — HashMap, ConcurrentHashMap, Comparable vs Comparator',
  minutes: 30,
  summary: 'Explain how the main collection implementations work underneath — ArrayList growth, HashMap hashing, buckets, treeification and resize, fail-fast iterators, ConcurrentHashMap\'s CAS-plus-bin-lock design — and choose collections, comparators and immutable views for test frameworks with clear Big-O and thread-safety trade-offs.',
  manualAnalogy: `When you keep a defect log you instinctively pick the shape: a numbered list for steps, a lookup sheet keyed by ticket id, a register that refuses duplicate entries, and a shared tracker that several testers edit at once without overwriting each other. You also know that "sort by priority, then by date" is a different report from "sort by date" — and that changing a ticket's id after filing it makes it impossible to find. Java collections are exactly those choices, made explicit, with costs you can reason about.`,
  body: `## Where the earlier lessons stop

The *Collections* lesson covered the three shapes (List, Map, Set), sorting a copy, \`thenComparing\` and \`List.of\`. The *Records, Optional and CSV test data* lesson explained why \`equals\` and \`hashCode\` belong together. This lesson goes underneath: **how** the implementations store data, what each operation costs, why a mutable key "disappears" from a HashMap, why a for-each loop throws \`ConcurrentModificationException\`, how \`ConcurrentHashMap\` stays correct under parallel TestNG, and how to write sort-order assertions that survive ties. Internals described here are **OpenJDK's implementation** (Java 17 baseline) — the \`java.util\` interfaces only promise the contracts, not the data structures.

## The framework hierarchy

\`\`\`
Iterable<T>
 └─ Collection<E>
     ├─ List<E>        ArrayList, LinkedList, CopyOnWriteArrayList, (Vector)
     ├─ Set<E>         HashSet, LinkedHashSet
     │   └─ SortedSet → NavigableSet       TreeSet, ConcurrentSkipListSet
     └─ Queue<E>       PriorityQueue, ConcurrentLinkedQueue, BlockingQueue impls
         └─ Deque<E>   ArrayDeque, LinkedList, ConcurrentLinkedDeque

Map<K,V>               (NOT a Collection — no iterator() of its own)
 ├─ HashMap → LinkedHashMap
 ├─ SortedMap → NavigableMap   TreeMap, ConcurrentSkipListMap
 ├─ ConcurrentMap              ConcurrentHashMap
 └─ Hashtable (legacy), IdentityHashMap, WeakHashMap, EnumMap
\`\`\`

\`Map\` is deliberately outside \`Collection\`: a map is a set of **entries**, and you iterate one of its three views — \`keySet()\`, \`values()\`, \`entrySet()\`. Those views are **live**: removing from \`map.keySet()\` removes the mapping.

**Java 21** adds *sequenced collections* (\`SequencedCollection\`, \`SequencedSet\`, \`SequencedMap\`): a common interface for anything with a defined encounter order, with \`getFirst()\`, \`getLast()\`, \`reversed()\`, \`putFirst\`/\`putLast\`. \`List\`, \`Deque\`, \`LinkedHashSet\`, \`SortedSet\`, \`LinkedHashMap\` and \`SortedMap\` implement them. In a Java 21 framework, \`products.getLast()\` replaces \`products.get(products.size() - 1)\`.

### Lists and deques

| | ArrayList | LinkedList | ArrayDeque |
|---|---|---|---|
| Structure | resizable \`Object[]\` | doubly-linked nodes | circular resizable array |
| \`get(i)\` | O(1) | O(n) (walks from nearer end) | n/a |
| add at end | amortised O(1) | O(1) | O(1) amortised (both ends) |
| add/remove in middle | O(n) (\`System.arraycopy\`) | O(n) to find + O(1) to unlink | n/a |
| remove from front | O(n) | O(1) | O(1) |
| iterate | fast — contiguous, cache-friendly | slow — pointer chasing, cache misses | fast |
| nulls | allowed | allowed | **not** allowed |
| memory per element | one reference | a node object (object header + 3 refs, ~24 bytes with compressed oops) plus the reference | one reference |
| thread-safe | no | no | no |

### Sets and maps

| | Ordering | null | Thread-safe | get / put / remove | Iterate |
|---|---|---|---|---|---|
| \`HashSet\` / \`HashMap\` | none (bucket order, can change after resize) | one null key, null values | no | O(1) average, O(log n) worst in a treeified bin | O(capacity + n) |
| \`LinkedHashSet\` / \`LinkedHashMap\` | insertion (or access, for the map) | as HashMap | no | O(1) average | O(n) via the linked list |
| \`TreeSet\` / \`TreeMap\` | sorted by \`compareTo\` / Comparator | no null key with natural ordering (NPE); values may be null | no | O(log n) (red-black tree) | O(n), sorted |
| \`Hashtable\` | none | **no** nulls | yes — every method \`synchronized\` | O(1) average, one lock for all | O(n), enumeration/fail-fast iterator |
| \`ConcurrentHashMap\` | none | **no** null keys or values | yes — lock-free reads, per-bin locking | O(1) average | weakly consistent |
| \`ConcurrentSkipListMap\` | sorted | no nulls | yes | O(log n) expected | weakly consistent |

Note HashMap iteration cost: it walks the **whole table**, so a map with capacity 1,048,576 and 10 entries is slow to iterate. That is why "pre-size huge then iterate often" is a bad combination.

## ArrayList internals

An \`ArrayList\` is an \`Object[] elementData\` plus an \`int size\`. In OpenJDK:

- \`new ArrayList<>()\` starts with a shared **empty** array; the first \`add\` allocates capacity **10**.
- When full, it grows to roughly **old + old/2** (\`oldCapacity >> 1\`), i.e. about **1.5x**, and copies with \`Arrays.copyOf\`. That copy is O(n), but it happens rarely enough that \`add\` is **amortised O(1)**.
- \`remove(i)\` shifts the tail left with \`System.arraycopy\`: O(n - i). Removing from the front of a 100k list in a loop is O(n²).
- \`ensureCapacity(n)\` or \`new ArrayList<>(n)\` pre-sizes when you know the size (e.g. 5,000 API rows), avoiding repeated copies. \`trimToSize()\` releases slack.

### LinkedList reality

The textbook says "LinkedList is better for inserts". In practice you rarely insert at a known node; you first **find** the position, which is O(n) pointer chasing with a cache miss per node. ArrayList's \`arraycopy\` moves contiguous memory that the CPU prefetches. Benchmarks almost always favour ArrayList — and **ArrayDeque** for queue/stack use (BFS over a category tree, a work queue of URLs to crawl in a link-checker). Joshua Bloch, who wrote LinkedList, has said publicly that he does not use it. Use \`LinkedList\` only if you genuinely need \`ListIterator.add/remove\` mid-iteration on a huge list — almost never in test code.

## HashMap internals in depth

### From key to bucket

\`\`\`java
// OpenJDK HashMap (simplified)
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
// index in a table of length n (always a power of two):
int index = (n - 1) & hash;
\`\`\`

1. **\`hashCode()\`** — your key's 32-bit hash.
2. **Spreading: \`h ^ (h >>> 16)\`** — XORs the high 16 bits into the low 16. Because the index uses only the **low bits** (\`n - 1\` is a mask like \`0b1111\` for 16 buckets), keys whose hashes differ only in high bits (e.g. \`Float\` keys, or poorly written hashCodes) would all collide without this.
3. **Index: \`(n - 1) & hash\`** — equivalent to \`hash % n\` for a power-of-two \`n\` and non-negative result, but a single AND instruction. This is **why capacity is always a power of two**: \`new HashMap<>(100)\` actually gets 128 (\`tableSizeFor\`).
4. **null key** — \`hash(null)\` is 0, so the null key lives in **bucket 0**. HashMap allows one null key; Hashtable and ConcurrentHashMap do not.

### Buckets, collisions, treeification

The table is an array of \`Node<K,V>\` (\`hash\`, \`key\`, \`value\`, \`next\`). Keys with the same index form a **singly-linked list** in that bucket. \`get\` goes: compute hash → index → walk the bucket comparing **\`hash ==\` first, then \`key == k || key.equals(k)\`**. The cached hash comparison is cheap and skips most \`equals\` calls.

If a bucket gets long, lookups degrade to O(n). Java 8 added **treeification**:

| Constant (OpenJDK) | Value | Meaning |
|---|---|---|
| \`DEFAULT_INITIAL_CAPACITY\` | 16 | table length on first put (the table is allocated lazily) |
| \`DEFAULT_LOAD_FACTOR\` | 0.75 | resize when \`size > capacity * loadFactor\` (16 × 0.75 = 12) |
| \`TREEIFY_THRESHOLD\` | 8 | a bin that grows beyond 8 nodes is converted to a red-black tree… |
| \`MIN_TREEIFY_CAPACITY\` | 64 | …but only if the table has at least 64 buckets; otherwise the table is **resized** instead |
| \`UNTREEIFY_THRESHOLD\` | 6 | a tree bin that shrinks to 6 or fewer nodes during a resize split becomes a list again |

A treeified bin (\`TreeNode\`) makes the worst case O(log n) instead of O(n). Tree nodes are ordered by hash, then by \`compareTo\` if the keys are \`Comparable\` of the same class, then by a tie-break on identity hash. The gap between 8 and 6 is **hysteresis** — it stops a bin flip-flopping between list and tree. With a decent hash function a bin of 8 is statistically extremely rare (the source comment cites a Poisson distribution); treeification is a defence against bad hashCodes and hash-flooding attacks, not a normal path.

### Resize: doubling and the split trick

When \`++size > threshold\`, the table doubles. Every node must move to a new index, but since \`n\` doubled, the new index is either **the same \`i\`** or **\`i + oldCap\`** — decided by one bit, \`(hash & oldCap) == 0\`. OpenJDK splits each bucket into a "lo" and a "hi" list while preserving relative order, without recomputing hashes. That is O(n) work at each resize, amortised over the inserts.

**Pre-sizing:** to hold \`N\` entries without any resize you need capacity ≥ \`N / 0.75\`. \`new HashMap<>(N)\` is **not** enough (for N = 1000 it gives 1024 buckets, threshold 768 → one resize). **Java 19+** added \`HashMap.newHashMap(int numMappings)\` that does the math for you; on Java 17 write \`new HashMap<>((int) (n / 0.75f) + 1)\`.

### Complexity summary

| Operation | Average | Worst (Java 8+) |
|---|---|---|
| \`get\`, \`put\`, \`remove\`, \`containsKey\` | O(1) | O(log n) per treeified bin (O(n) if keys are not Comparable and all collide) |
| \`containsValue\` | O(capacity + n) | — it scans every bucket |
| iteration | O(capacity + n) | |
| resize | O(n) | amortised O(1) per put |

### equals/hashCode contract — and why mutable keys break lookups

1. Equal objects **must** have equal hash codes.
2. Unequal objects **may** collide (it costs only performance).
3. \`hashCode\` must be **stable** while the object is in a hash-based collection.

\`\`\`java
import java.util.*;

public class MutableKeyDemo {
    static final class ProductKey {                     // BAD: mutable key
        String sku;
        ProductKey(String sku) { this.sku = sku; }
        @Override public boolean equals(Object o) {
            return o instanceof ProductKey p && p.sku.equals(sku);   // pattern matching: Java 16+
        }
        @Override public int hashCode() { return sku.hashCode(); }
    }

    public static void main(String[] args) {
        Map<ProductKey, Integer> stockBySku = new HashMap<>();
        ProductKey key = new ProductKey("classic-crew-t-shirt");
        stockBySku.put(key, 60);

        key.sku = "retro-red-tee";                                     // mutate AFTER inserting

        System.out.println(stockBySku.get(key));                         // null  - wrong bucket now
        System.out.println(stockBySku.get(new ProductKey("classic-crew-t-shirt"))); // null - right bucket, equals fails
        System.out.println(stockBySku.size());                           // 1     - the entry is "lost" but still there
        System.out.println(stockBySku.containsValue(60));                // true  - full scan finds it
    }
}
\`\`\`

**Step by step:**
- \`put\` stored the node in the bucket for \`hash("classic-crew-t-shirt")\` and **cached that hash** in the node.
- After mutation, \`get(key)\` computes the hash of \`"retro-red-tee"\` → a different bucket (or the same bucket but a different cached hash) → not found.
- Looking up with a fresh "classic" key lands in the right bucket and the cached hash matches, but \`equals\` compares against the mutated \`sku\` → false.
- The entry is a **memory leak** that only a full scan sees. The same applies to \`HashSet\` (it is a HashMap with a dummy value).

**Fix:** make keys immutable — a \`record ProductKey(String sku)\`, a \`String\`, an \`enum\`, or a class with \`final\` fields. Never use a \`WebElement\`, a page object or a mutable DTO as a map key.

Related trap (problem *java-033*): overriding \`equals\` but not \`hashCode\` — equal objects go to different buckets and \`HashSet\` lets "duplicates" in. \`BigDecimal\` is the opposite trap: \`new BigDecimal("15.99")\` and \`new BigDecimal("15.990")\` are **not** \`equals\` (scale differs) but \`compareTo\` returns 0 — a \`HashSet\` keeps both, a \`TreeSet\` keeps one.

## LinkedHashMap: insertion order and a 10-line LRU cache

\`LinkedHashMap\` is a HashMap whose entries are also linked in a **doubly-linked list**. Constructor \`LinkedHashMap(initialCapacity, loadFactor, accessOrder)\`: with \`accessOrder = true\`, every \`get\`/\`put\` moves the entry to the tail, so the head is the least recently used. Overriding \`removeEldestEntry\` evicts it after each insert:

\`\`\`java
import java.util.LinkedHashMap;
import java.util.Map;

/** Small LRU cache, e.g. for parsed JSON schemas or auth tokens per test user. NOT thread-safe. */
public class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int maxEntries;

    public LruCache(int maxEntries) {
        super(16, 0.75f, true);          // true = access order
        this.maxEntries = maxEntries;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > maxEntries;      // called by put/putAll after inserting
    }

    public static void main(String[] args) {
        LruCache<String, String> tokens = new LruCache<>(2);
        tokens.put("standard_user", "t1");
        tokens.put("visual_user", "t2");
        tokens.get("standard_user");               // touch -> most recent
        tokens.put("problem_user", "t3");          // evicts visual_user (least recent)
        System.out.println(tokens.keySet());       // [standard_user, problem_user]
    }
}
\`\`\`

- \`super(16, 0.75f, true)\` — the third argument switches from insertion to access order.
- \`removeEldestEntry\` is a hook HashMap calls after insertion; returning \`true\` removes the head.
- Even a \`get\` **modifies** an access-ordered map (it relinks the entry), so iterating while calling \`get\` throws \`ConcurrentModificationException\`, and sharing it across threads needs external locking (or a library cache such as Caffeine).

## TreeMap and NavigableMap: ranges and nearest keys

\`TreeMap\` is a **red-black tree**: O(log n) for get/put/remove, keys always sorted. Its \`NavigableMap\` API answers range questions that a HashMap cannot:

\`\`\`java
import java.math.BigDecimal;
import java.util.*;

public class PriceBands {
    public static void main(String[] args) {
        NavigableMap<BigDecimal, List<String>> byPrice = new TreeMap<>();
        add(byPrice, "29.99", "Trailblazer Backpack");
        add(byPrice, "9.99",  "Pulse Bike Light");
        add(byPrice, "15.99", "Classic Crew T-Shirt");
        add(byPrice, "49.99", "Storm Fleece Jacket");
        add(byPrice, "7.99",  "Junior Onesie");
        add(byPrice, "15.99", "Retro Red Tee");

        BigDecimal budget = new BigDecimal("20.00");
        System.out.println(byPrice.floorKey(budget));                   // 15.99 - most expensive affordable price
        System.out.println(byPrice.headMap(budget, true));              // everything <= 20.00
        System.out.println(byPrice.subMap(new BigDecimal("10"), true,
                                          new BigDecimal("30"), true)); // 10..30 band
        System.out.println(byPrice.lastEntry());                        // 49.99=[Storm Fleece Jacket]
        System.out.println(byPrice.descendingMap().firstKey());         // 49.99
    }

    static void add(NavigableMap<BigDecimal, List<String>> m, String price, String name) {
        m.computeIfAbsent(new BigDecimal(price), k -> new ArrayList<>()).add(name);
    }
}
\`\`\`

Automation use: verifying a price filter (problem *java-003*'s idea at scale), bucketing API response times into SLA bands with \`floorEntry\`, or picking "the cheapest product above X" for a test-data builder. \`headMap\`/\`subMap\` return **views** backed by the tree (O(log n) to create), not copies.

## Fail-fast iterators and ConcurrentModificationException

Every non-concurrent collection keeps an \`int modCount\`, incremented on **structural** changes (add/remove, not \`set\`). The iterator records \`expectedModCount\` at creation and checks it in \`next()\`:

\`\`\`java
List<String> names = new ArrayList<>(List.of("Retro Red Tee", "Pulse Bike Light", "Junior Onesie"));
for (String n : names) {                    // for-each = Iterator under the hood
    if (n.contains("Tee")) names.remove(n); // modCount++ -> next() throws
}
\`\`\`

\`\`\`
Exception in thread "main" java.util.ConcurrentModificationException
    at java.base/java.util.ArrayList$Itr.checkForComodification(ArrayList.java:...)
    at java.base/java.util.ArrayList$Itr.next(ArrayList.java:...)
    at ShopTest.removeTees(ShopTest.java:14)
\`\`\`

"Concurrent" is misleading: **one thread** caused it. The check is best-effort (not synchronized), so across threads you may also get silent corruption instead.

### Safe removal — approaches compared

\`\`\`java
// 1. Iterator.remove - keeps expectedModCount in sync
for (Iterator<String> it = names.iterator(); it.hasNext(); ) {
    if (it.next().contains("Tee")) it.remove();
}
// 2. removeIf (Java 8+) - ArrayList implements it in one pass
names.removeIf(n -> n.contains("Tee"));
// 3. Build a new list (non-mutating)
List<String> kept = names.stream().filter(n -> !n.contains("Tee")).toList();   // Java 16+
// 4. Iterate a copy, mutate the original
for (String n : new ArrayList<>(names)) if (n.contains("Tee")) names.remove(n);
\`\`\`

| Approach | How it works | Advantages | Disadvantages | Performance | When to use |
|---|---|---|---|---|---|
| \`Iterator.remove\` | iterator updates modCount itself | works on any collection, can combine with other logic | verbose | O(n²) worst on ArrayList (each remove shifts) | complex per-element logic |
| \`removeIf\` | bulk op, ArrayList marks then compacts once | one line, intent clear | predicate only | **O(n)** on ArrayList | default for in-place filtering |
| new list via stream | no mutation | immutable result, no aliasing surprises | allocates | O(n) | test data you then assert on |
| iterate a copy | copy first | easy to understand | copy + O(n²) removes | worst | never preferred |

**Recommended:** \`removeIf\` for in-place, a stream for a new result. For maps: \`map.entrySet().removeIf(e -> e.getValue() == 0)\` (drops out-of-stock entries).

### Fail-safe / weakly consistent iterators

- **\`CopyOnWriteArrayList\`** — iterator works on a **snapshot**; never throws CME, never sees later writes. Every write copies the array: good for rarely-written, often-read lists (TestNG listeners registered at start-up), terrible for frequent writes.
- **\`ConcurrentHashMap\`, \`ConcurrentLinkedQueue\`, \`ConcurrentSkipListMap\`** — **weakly consistent**: never throw CME, traverse elements as they existed at some point, may or may not reflect concurrent updates.

## ConcurrentHashMap internals (Java 8+)

Java 7's CHM used 16 **Segments** (each a mini locked hashtable). Java 8 rewrote it:

- One \`Node[]\` table like HashMap, fields \`volatile\` where needed.
- **Reads (\`get\`) take no lock** — volatile reads of the table slot and node fields.
- **Insert into an empty bin**: a **CAS** (compare-and-swap) installs the first node — no lock.
- **Insert into a non-empty bin**: \`synchronized\` on the **first node of that bin** only. Contention is per bucket, so many threads write in parallel.
- Long bins treeify into \`TreeBin\` (same thresholds idea as HashMap).
- **Resize** is cooperative: threads that see a \`ForwardingNode\` help transfer bins.
- **Size**: a \`baseCount\` plus striped \`CounterCell\`s (the LongAdder idea) to avoid contention on one counter. \`size()\` and \`mappingCount()\` are therefore **estimates** while writers are active — fine for metrics, never for coordination. Prefer \`mappingCount()\` (returns \`long\`).
- The \`concurrencyLevel\` constructor argument survives only as a sizing hint for compatibility.

### Why no null keys or values

In a concurrent map, \`get(k) == null\` must mean "absent". If null values were allowed, you could not distinguish "absent" from "mapped to null" without a second call (\`containsKey\`) — and between the two calls another thread may change the map. HashMap can afford the ambiguity because it is single-threaded. CHM throws \`NullPointerException\` on \`put(k, null)\`.

### Atomic compound operations vs check-then-act

\`\`\`java
// RACE: two threads both see "absent" and both put - one result is lost
if (!results.containsKey(testName)) {
    results.put(testName, new ArrayList<>());
}
results.get(testName).add(outcome);         // and ArrayList itself is not thread-safe

// ATOMIC: one call, per-key atomicity
results.computeIfAbsent(testName, k -> new CopyOnWriteArrayList<>()).add(outcome);
failuresByClass.merge(className, 1, Integer::sum);          // atomic counter per key
\`\`\`

- \`computeIfAbsent\`, \`compute\`, \`merge\`, \`putIfAbsent\` run **atomically per key** — the mapping function runs at most once per absent key while the bin is locked.
- Keep the function **short** and **never modify the same map inside it**: recursive updates can deadlock or (Java 9+) throw \`IllegalStateException: Recursive update\`.
- Atomic per call ≠ atomic across calls: \`get\` then \`put\` is still a race. Express the whole update as one \`compute\`/\`merge\`.

### Complete example: a shared test-run registry for parallel TestNG

\`\`\`java
import org.testng.ITestListener;
import org.testng.ITestResult;
import org.testng.ISuite;
import org.testng.ISuiteListener;

import java.util.Map;
import java.util.Queue;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.LongAdder;

/** Registered in testng.xml; tests run with parallel="methods" thread-count="8". */
public class RunRegistryListener implements ITestListener, ISuiteListener {

    private static final ConcurrentHashMap<String, LongAdder> STATUS_COUNTS = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, Queue<String>> FAILURES_BY_CLASS = new ConcurrentHashMap<>();

    @Override public void onTestSuccess(ITestResult r) { count("PASS"); }
    @Override public void onTestSkipped(ITestResult r) { count("SKIP"); }

    @Override
    public void onTestFailure(ITestResult r) {
        count("FAIL");
        FAILURES_BY_CLASS
            .computeIfAbsent(r.getTestClass().getName(), k -> new ConcurrentLinkedQueue<>())
            .add(r.getMethod().getMethodName() + ": " + r.getThrowable());
    }

    private static void count(String status) {
        STATUS_COUNTS.computeIfAbsent(status, k -> new LongAdder()).increment();
    }

    @Override
    public void onFinish(ISuite suite) {                 // single-threaded by now
        Map<String, Long> summary = new TreeMap<>();
        STATUS_COUNTS.forEach((k, v) -> summary.put(k, v.sum()));
        System.out.println("Run summary " + summary);
        FAILURES_BY_CLASS.forEach((cls, msgs) -> System.out.println(cls + " -> " + msgs.size() + " failure(s)"));
    }
}
\`\`\`

**Step by step:**
- \`ConcurrentHashMap<String, LongAdder>\` — the map handles concurrent key creation; \`LongAdder\` handles high-contention increments better than \`AtomicLong\`. \`merge(status, 1, Integer::sum)\` on a \`ConcurrentHashMap<String, Integer>\` is an equally valid, simpler alternative for moderate rates.
- \`computeIfAbsent(..., k -> new ConcurrentLinkedQueue<>())\` — the **value** must be thread-safe too: CHM protects the mapping, not the object you get back. A plain \`ArrayList\` value would be a data race.
- \`onFinish\` copies into a \`TreeMap\` for a sorted, stable report.
- \`static\` is acceptable here because TestNG creates one listener instance per registration and the registry is truly run-scoped; for per-test state (the WebDriver) use \`ThreadLocal\` instead (see the *static vs instance* lesson).

### Thread-safe maps — approaches compared

| | \`Hashtable\` | \`Collections.synchronizedMap(new HashMap<>())\` | \`ConcurrentHashMap\` |
|---|---|---|---|
| How it works | every method \`synchronized\` on the table | wrapper; every method synchronized on one mutex | CAS + per-bin \`synchronized\`, lock-free reads |
| Nulls | no | yes (as the backing map) | no |
| Read scalability | one lock — serialised | one lock — serialised | reads never block |
| Iteration | fail-fast; you must lock manually | fail-fast; **must** \`synchronized (map) { … }\` around iteration | weakly consistent, no lock needed |
| Compound ops | none atomic | \`compute\`/\`merge\` are atomic (synchronized) but block everyone | atomic per key, concurrent across keys |
| Maintainability | legacy API (\`Enumeration\`) | easy to forget the iteration lock | clear |
| When to use | never in new code | wrapping a \`TreeMap\`/\`LinkedHashMap\` when you need its ordering and low contention | default for shared maps |

**Recommended:** \`ConcurrentHashMap\` for shared mutable maps; \`ConcurrentSkipListMap\` if you need sorted + concurrent; better still, **avoid shared mutable state** — give each thread its own data (ThreadLocal, per-test objects) and merge at the end.

## Comparable vs Comparator at depth

| | \`Comparable<T>\` | \`Comparator<T>\` |
|---|---|---|
| Method | \`int compareTo(T o)\` — in the class itself | \`int compare(T a, T b)\` — separate object |
| Number of orders | one **natural** order | any number |
| Used by | \`Collections.sort(list)\`, \`TreeMap\` without comparator, \`sorted()\` | \`list.sort(c)\`, \`new TreeMap<>(c)\`, \`sorted(c)\` |
| Typical | \`String\`, \`Integer\`, \`BigDecimal\`, \`LocalDate\`, enums (by declaration order) | sort options on a page: name A-Z, price low-high |

The contract: sign-consistent (\`sgn(a.compareTo(b)) == -sgn(b.compareTo(a))\`), **transitive**, and \`compareTo == 0\` implies same sign against any third value. Violate it (e.g. comparing doubles with \`(int) (a - b)\`, or a comparator using random/mutable state) and TimSort may throw:

\`\`\`
java.lang.IllegalArgumentException: Comparison method violates its general contract!
    at java.base/java.util.TimSort.mergeHi(TimSort.java:...)
\`\`\`

…intermittently, only for some input sizes. Fix: use \`Comparator.comparing\` / \`Double.compare\` / \`BigDecimal::compareTo\`, never subtraction.

**Consistent with equals:** natural ordering is "consistent with equals" when \`compareTo == 0\` exactly when \`equals\` is true. \`BigDecimal\` is the famous exception (\`2.0\` vs \`2.00\`). Sorted collections use **only** \`compareTo\`, so a \`TreeSet<BigDecimal>\` dedups by numeric value while \`HashSet\` keeps both. A comparator that sorts products by price only, used in a \`TreeSet\`, silently **drops** the second $15.99 product — a classic test-data bug.

### Building comparators

\`\`\`java
Comparator<Product> byPrice = Comparator.comparing(Product::price);               // BigDecimal is Comparable
Comparator<Product> byPriceThenName = byPrice.thenComparing(Product::name);
Comparator<Product> byPriceDesc = Comparator.comparing(Product::price).reversed();
Comparator<Product> nullSafeName = Comparator.comparing(Product::name,
        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
Comparator<Product> byStock = Comparator.comparingInt(Product::stock);              // no boxing
\`\`\`

Two type-inference gotchas: \`Comparator.comparing(p -> p.price()).reversed()\` fails to compile when \`p\` is a lambda parameter (the target type is lost at \`.reversed()\`) — use a method reference or \`Comparator.<Product, BigDecimal>comparing(p -> p.price())\`. And \`.reversed()\` reverses **the whole chain before it**.

### Sorting stability

\`List.sort\`, \`Collections.sort\` and \`Arrays.sort(Object[])\` use **TimSort** (a merge/insertion hybrid, O(n log n) worst, O(n) on already-sorted data) and are **stable**: equal elements keep their original relative order. \`Arrays.sort(int[])\` uses dual-pivot quicksort (not stable, but stability is meaningless for primitives). Stability matters in tests: if you sort the expected list by price only, the two $15.99 tees stay in **input** order — which may or may not match what the page does.

### Real-time scenario: sort assertions on ShopEasy, including the $15.99 tie

The inventory page (\`inventory.html\`, \`#product-sort\`) sorts:
- \`lohi\`: price ascending, **ties by name ascending**
- \`hilo\`: price descending, **ties still by name ascending** (not reversed!)

The API \`GET /api/products?sort=lohi\` breaks ties by **id** instead. Classic Crew T-Shirt (id 3) and Retro Red Tee (id 6) are both $15.99; with this data both rules happen to give the same order — a test that does not state the tie-break rule passes by accident and breaks when a product is added.

\`\`\`java
import java.math.BigDecimal;
import java.util.*;
import static org.testng.Assert.assertEquals;

record Product(int id, String name, BigDecimal price) { }

public class SortOrderAssertions {

    static final Comparator<Product> LOHI =
            Comparator.comparing(Product::price).thenComparing(Product::name);

    static final Comparator<Product> HILO =
            Comparator.comparing(Product::price).reversed()       // reverse ONLY the price key
                      .thenComparing(Product::name);               // tie stays A-Z

    static void assertSorted(List<Product> shown, Comparator<Product> rule) {
        List<Product> expected = new ArrayList<>(shown);
        expected.sort(rule);
        assertEquals(names(shown), names(expected), "page order differs from rule");
    }

    static List<String> names(List<Product> ps) { return ps.stream().map(Product::name).toList(); }
}
\`\`\`

Common wrong version: \`Comparator.comparing(Product::price).thenComparing(Product::name).reversed()\` — it reverses the tie-break too and expects Retro before Classic. Writing the HILO comparator forces the team to **decide** the tie rule; that is a requirement question to raise, not a coding detail.

### Approaches to a sort assertion

\`\`\`java
// A. Sort a copy with the full comparator and compare lists (above)
// B. Pairwise check: every adjacent pair is in order (no copy, reports the first offending pair)
static <T> void assertPairwise(List<T> items, Comparator<? super T> rule) {
    for (int i = 1; i < items.size(); i++) {
        if (rule.compare(items.get(i - 1), items.get(i)) > 0) {
            throw new AssertionError("Out of order at " + i + ": " + items.get(i - 1) + " > " + items.get(i));
        }
    }
}
// C. Compare against a hard-coded expected list
assertEquals(names, List.of("Junior Onesie", "Pulse Bike Light", "Classic Crew T-Shirt",
                            "Retro Red Tee", "Trailblazer Backpack", "Storm Fleece Jacket"));
// D. Price-only check: sort just the List<BigDecimal> of prices
\`\`\`

| | A. sort a copy | B. pairwise | C. hard-coded | D. prices only |
|---|---|---|---|---|
| How it works | expected = sorted(actual) | compare neighbours | literal list | ignores names |
| Advantages | full order incl. ties, readable diff | O(n), points at first violation | exact, catches missing items | simple |
| Disadvantages | O(n log n), a wrong comparator hides bugs | does not check content/count | breaks when catalogue changes | **misses tie-order bugs** |
| Scalability | good | best | poor | good |
| When to use | default UI sort check | large lists (API pages of 50) | smoke test on fixed seed data | only when ties are unspecified |

**Recommended:** A or B with a comparator that encodes the **documented** tie-break, plus a count/content check (an empty or truncated list is "sorted"). Use C only against seeded, versioned test data.

## Immutable collections

| | Mutability | Nulls | Backed by original? | Version |
|---|---|---|---|---|
| \`List.of(...)\`, \`Set.of\`, \`Map.of\` | unmodifiable | **NPE on null** | n/a | Java 9+ |
| \`List.copyOf(c)\`, \`Set.copyOf\`, \`Map.copyOf\` | unmodifiable copy (returns the argument itself if already an unmodifiable \`List.of\`-style list) | NPE on null | **no** | Java 10+ |
| \`Collections.unmodifiableList(list)\` | read-only **view** | allowed | **yes** — changes to the original show through | Java 1.2 |
| \`stream.toList()\` | unmodifiable | allowed | no | Java 16+ |

\`\`\`java
List<String> source = new ArrayList<>(List.of("Junior Onesie"));
List<String> view = Collections.unmodifiableList(source);
List<String> copy = List.copyOf(source);
source.add("Retro Red Tee");
System.out.println(view);  // [Junior Onesie, Retro Red Tee] - view sees the change
System.out.println(copy);  // [Junior Onesie]                - true snapshot
\`\`\`

Also: \`Set.of\` and \`Map.of\` **reject duplicates** at creation (\`IllegalArgumentException\`) and have **randomised iteration order** that varies between JVM runs — never assert on their order. Immutability is shallow: \`List.of(product)\` cannot be resized, but a mutable \`product\` inside can still change. For expected-data fixtures shared across parallel tests, unmodifiable collections of records are ideal: no defensive copies, no cross-test pollution.

## Common mistakes and debugging

- **\`ConcurrentModificationException\` in a for-each** — the top stack frame is \`checkForComodification\`; find the line in **your** frame that mutates the collection being iterated (it can be inside a called method). Fix with \`removeIf\`/\`Iterator.remove\`.
- **CME thrown from a parallel test, not reproducible** — a shared \`ArrayList\`/\`HashMap\` touched by several threads. Search for \`static\` collections in listeners, base classes and data providers; replace with concurrent types or per-thread state.
- **\`map.get(key)\` returns null though you "just put it"** — mutable key, missing \`hashCode\`, or a different key type (\`Integer 1\` vs \`Long 1L\` — not equal!). Print \`key.hashCode()\` at put and get time.
- **HashMap iteration order changed after a JDK upgrade or after adding entries** — HashMap never guaranteed order. Use \`LinkedHashMap\` or \`TreeMap\`.
- **\`UnsupportedOperationException\` from \`add\`** — the list came from \`List.of\`, \`Arrays.asList\` (fixed size: \`set\` works, \`add\`/\`remove\` do not), \`stream.toList()\` or a \`Collections.unmodifiable*\` view.
- **\`NullPointerException\` from \`List.of\`/\`Map.of\`/\`ConcurrentHashMap.put\`** — they reject nulls by design; decide what a missing value means instead.
- **TreeSet "loses" a product** — the comparator returns 0 for distinct objects; add a unique tie-breaker (id).

## Best practices for experienced engineers

- Declare by interface (\`List\`, \`Map\`, \`NavigableMap\` when you need range ops), choose the implementation for ordering + complexity + thread-safety.
- Default to \`ArrayList\`, \`HashMap\`, \`ArrayDeque\`; \`LinkedHashMap\` when order matters; \`TreeMap\` for ranges; \`ConcurrentHashMap\` for shared state. Never \`Vector\`, \`Hashtable\`, \`Stack\` in new code.
- Map keys: immutable — String, enum, record.
- Express shared updates as **one** atomic call (\`merge\`, \`compute\`); make the value type thread-safe too.
- Comparators: build with \`comparing/thenComparing\`, always end with a unique tie-breaker when sorting into a Set or asserting order; never subtract.
- Return unmodifiable collections from page objects and data providers (\`List.copyOf\`, \`toList()\`) so callers cannot corrupt shared fixtures.
- Pre-size large collections built from API data; don't micro-optimise small ones.

## Interview questions

### Q: Walk me through what happens in \`HashMap.put(key, value)\`.
**Short answer (30–60 s):** Compute \`key.hashCode()\`, spread it with \`h ^ (h >>> 16)\`, index with \`(n - 1) & hash\`. If the bucket is empty, store a new node. Otherwise walk the bucket comparing hash then \`equals\`; replace the value on a match or append. If the bin exceeds 8 nodes it treeifies (if the table is at least 64), and if size exceeds capacity × 0.75 the table doubles.

**Detailed answer:** Mention lazy table allocation (16 on first put), \`tableSizeFor\` rounding to a power of two, the null key in bucket 0, \`putVal\` returning the old value, \`modCount++\` only on structural insertion, resize splitting each bucket into lo/hi by \`hash & oldCap\` with order preserved, and untreeify at 6. Average O(1), worst O(log n) per treeified bin.

### Q: Why is HashMap capacity always a power of two?
**Short answer (30–60 s):** So the bucket index can be computed with a bitmask \`(n - 1) & hash\` instead of a modulo, and so a resize can split each bucket into "stay at i" or "move to i + oldCap" using one bit.

**Detailed answer:** The downside is that only the low bits pick the bucket, which is why HashMap spreads the hash by XOR-ing the high half into the low half. Pre-sizing: \`new HashMap<>(100)\` yields 128; to avoid resizes for N entries use \`N / 0.75 + 1\` or \`HashMap.newHashMap(N)\` on Java 19+.

### Q: What breaks if a key's hashCode changes after insertion?
**Short answer (30–60 s):** The entry stays in the bucket for the old hash with the old cached hash, so \`get\` with the same object looks in the wrong place and returns null, and \`remove\` fails — the entry leaks.

**Detailed answer:** Show the mutable-key demo; \`containsValue\` and iteration still see it. Fix: immutable keys (records, enums, String). Same applies to \`HashSet\` elements and to \`TreeMap\` keys whose compared fields change.

### Q: Explain fail-fast vs fail-safe (weakly consistent) iterators.
**Short answer (30–60 s):** Fail-fast iterators check \`modCount\` and throw \`ConcurrentModificationException\` on structural change outside the iterator; it's best-effort, not a thread-safety guarantee. Fail-safe/weakly consistent iterators (CopyOnWriteArrayList snapshot, ConcurrentHashMap traversal) never throw, but may not reflect concurrent changes.

**Detailed answer:** The check is in \`next()\`, which is why removing the second-to-last element inside a for-each finishes silently (\`hasNext\` returns false before \`next\` checks). Safe removal: \`Iterator.remove\`, \`removeIf\`. Snapshot iterators cost a full copy per write.

### Q: How does ConcurrentHashMap achieve thread safety in Java 8+, and why are nulls forbidden?
**Short answer (30–60 s):** No segments: reads are lock-free volatile reads; inserting into an empty bin is a CAS; updating a non-empty bin synchronizes on that bin's first node. Nulls are forbidden because \`get\` returning null must unambiguously mean "absent" — with concurrency you cannot follow it with a safe \`containsKey\`.

**Detailed answer:** Cover treeified bins, cooperative resizing with forwarding nodes, \`size()\` as an estimate from counter cells (\`mappingCount\`), per-key atomic \`compute\`/\`merge\`/\`computeIfAbsent\`, the "keep the function short, don't touch the map" rule and \`IllegalStateException: Recursive update\`. Contrast with Hashtable / synchronizedMap (single lock, manual iteration locking).

### Q: Comparable vs Comparator — and what does "consistent with equals" mean?
**Short answer (30–60 s):** Comparable defines a class's single natural order inside the class; Comparator is an external, composable order — many per class. Consistent with equals means compareTo returns 0 exactly when equals is true; sorted collections use only compareTo, so inconsistency changes Set/Map semantics.

**Detailed answer:** BigDecimal \`2.0\` vs \`2.00\`; a price-only comparator in a TreeSet drops one of the $15.99 tees. Build comparators with \`comparing().thenComparing()\`, \`nullsFirst\`, \`comparingInt\` to avoid boxing, and remember \`.reversed()\` reverses the whole chain before it.

### Q: ArrayList vs LinkedList — which would you use for a list of 50,000 API records you filter and sort?
**Short answer (30–60 s):** ArrayList. Indexed access O(1), cache-friendly iteration, sort works on the backing array. LinkedList's theoretical O(1) insert needs an O(n) walk to find the node and every node is a separate object with poor locality.

**Detailed answer:** Pre-size with the known count, filter with \`removeIf\` (single compaction pass) or a stream, and if you need a queue use \`ArrayDeque\`. Growth is ~1.5x with amortised O(1) add.

### Q: \`Collections.unmodifiableList\` vs \`List.copyOf\` vs \`List.of\`?
**Short answer (30–60 s):** \`unmodifiableList\` is a read-only **view** — changes to the source show through. \`List.copyOf\` (Java 10+) is an unmodifiable **snapshot**. \`List.of\` (Java 9+) creates an unmodifiable list from literals. Both \`of\` and \`copyOf\` reject nulls.

**Detailed answer:** For page objects returning data, return \`List.copyOf\` or \`stream.toList()\`; for exposing an internal list that you keep updating, a view may be intended. All are shallow.

## Scenario-based questions

**1. A parallel TestNG suite (thread-count 8) sometimes reports 297 results for 300 tests and once threw \`ConcurrentModificationException\` in the report listener.** The listener collects into a \`static List<ITestResult>\` and a \`static HashMap<String,Integer>\`. Lost updates come from \`ArrayList.add\` races (size++ is not atomic) and from \`get\`-then-\`put\` counting. I'd switch to \`ConcurrentLinkedQueue\` for results and \`ConcurrentHashMap.merge(key, 1, Integer::sum)\` for counts, make the report step iterate only after the suite finishes, and add a unit test that hammers the listener from 16 threads to prove the count.

**2. The "sort by price high to low" test passed for months, then failed after the catalogue team added a $15.99 product.** The expected list was built with a price-only comparator, so the tie order was input order (stable TimSort) and matched by luck. I'd confirm the business rule for ties (the page breaks ties by name A-Z even in \`hilo\`; the API uses id), encode it explicitly in the comparator, and mention to the team that the UI and API disagree on the tie rule — that is worth a conversation, since a UI rendering API results without re-sorting would differ.

**3. Memory grows during a long data-driven run and the heap dump shows a huge \`HashMap\` of cached responses keyed by a request object.** The request DTO is mutable and the framework sets headers after caching it, so lookups miss and new entries are added every time. I'd key by an immutable record (method + URL + body hash), bound the cache with an LRU \`LinkedHashMap\` (or a library cache with size limits), and add a metric for cache hit rate.

## Tricky follow-ups

- **Can a HashMap have a null key? Where is it stored?** Yes, one; its hash is 0, so bucket 0. Hashtable and ConcurrentHashMap reject it.
- **Removing the second-to-last element in a for-each over an ArrayList — exception?** No: after the removal \`size\` equals the cursor, \`hasNext()\` returns false and the loop ends silently — the last element is never visited. The bug hides.
- **Is \`map.put(k, v)\` on a \`Collections.synchronizedMap\` plus iteration safe?** \`put\` is; iteration is not unless you hold \`synchronized (map)\` for the whole loop.
- **\`new TreeSet<>(List.of(new BigDecimal("15.99"), new BigDecimal("15.990"))).size()\`?** 1 — TreeSet uses \`compareTo\`. A HashSet would give 2.
- **Does \`LinkedHashMap.get\` modify the map?** In access-order mode, yes — it moves the entry, increments \`modCount\` and can trigger CME during iteration.`,
  keyPoints: [
    'Map is not a Collection; choose implementations by ordering, null policy, thread-safety and Big-O — ArrayList/HashMap/ArrayDeque by default, LinkedHashMap for order, TreeMap for ranges, ConcurrentHashMap for shared state.',
    'HashMap (OpenJDK): hashCode → h ^ (h >>> 16) → (n - 1) & hash; default capacity 16, load factor 0.75, power-of-two tables, resize doubles and splits by one bit; bins treeify above 8 nodes when capacity ≥ 64 and untreeify at 6.',
    'Keys must be immutable with consistent equals/hashCode — a mutated key lands in the wrong bucket and leaks.',
    'Fail-fast iterators check modCount in next(); remove with Iterator.remove or removeIf. Concurrent collections have weakly consistent or snapshot iterators.',
    'ConcurrentHashMap (Java 8+): lock-free reads, CAS for empty bins, synchronized on the bin head otherwise; no nulls; use computeIfAbsent/merge for atomic per-key updates and make the values thread-safe too.',
    'Comparators: comparing().thenComparing(), comparingInt to avoid boxing, nullsFirst/Last; .reversed() reverses the whole chain before it; never subtract. TimSort is stable.',
    'Sort assertions must encode the documented tie-break (ShopEasy UI: name A-Z for both lohi and hilo; API: id) and also check count/content.',
    'Collections.unmodifiableList is a live view; List.copyOf / stream.toList() are snapshots; List.of/copyOf reject nulls; immutability is shallow.',
  ],
  mistakes: [
    'Using a mutable DTO or page object as a HashMap key and getting null back. Fix: key by a record/String/enum; debug by printing key.hashCode() at put and get time.',
    'Counting results in a static HashMap with get-then-put from parallel tests. Fix: ConcurrentHashMap.merge(key, 1, Integer::sum) or LongAdder values; confirm with a multi-threaded unit test of the listener.',
    'Assuming ConcurrentHashMap makes the values thread-safe (computeIfAbsent(k, x -> new ArrayList<>()).add(...)). Fix: use a concurrent value type (ConcurrentLinkedQueue, CopyOnWriteArrayList) or do the whole update inside compute.',
    'Writing a "high to low" comparator as comparing(price).thenComparing(name).reversed(), which also reverses the tie-break. Fix: reverse only the price key — comparing(price).reversed().thenComparing(name) — and confirm the tie rule with the product owner.',
    'Putting products into a TreeSet with a price-only comparator and losing the second $15.99 item. Fix: always add a unique tie-breaker (id) when compareTo == 0 must mean "same object".',
    'Asserting on the iteration order of HashMap, Set.of or Map.of. Fix: use LinkedHashMap/TreeMap or compare as sets; Set.of/Map.of order is randomised per JVM run.',
  ],
  tryIt: `Fetch \`GET http://localhost:5181/api/products?sort=hilo&size=50\` (RestAssured or \`java.net.http.HttpClient\`) into a \`List<Product>\` record with \`BigDecimal price\`. (1) Write \`assertPairwise(list, comparator)\` and check the API order with a comparator that breaks ties by **id**; then check the UI order on \`inventory.html\` (\`#product-sort\` = \`hilo\`) with one that breaks ties by **name** — and write down whether the two rules could ever disagree for this data. (2) Build a \`TreeMap<BigDecimal, List<String>>\` of price → names and print \`floorKey(new BigDecimal("20"))\` and \`headMap(new BigDecimal("16"), true)\`. (3) Write a 20-thread test that calls \`merge(category, 1, Integer::sum)\` on a \`HashMap\` and on a \`ConcurrentHashMap\` 10,000 times each and compare the totals.`,
  problems: ['java-012', 'java-023', 'java-027', 'java-033', 'java-037'],
}
