export default {
  slug: 'java-deep-strings-memory-gc',
  category: 'java',
  order: 13,
  title: 'Deep dive: String internals, the JVM memory model and garbage collection',
  minutes: 30,
  summary: 'Explain how Strings are stored, pooled, folded and concatenated, predict the classic == puzzles, describe the JVM memory areas and how generational garbage collection works, and find and fix the memory leaks and OutOfMemoryErrors that large parallel test suites actually hit.',
  manualAnalogy: `A long manual regression day goes wrong in a familiar way: by afternoon the desk is buried in printouts nobody needs, forty browser tabs are open, and finding anything takes longer than testing. You clean up as you go — close a tab when the case is done, throw away the draft notes, keep only the evidence for failures. The JVM's garbage collector does that cleanup for objects, but only for what nothing references any more; a test framework that keeps "just one more" reference to every driver, page and screenshot is the tester who never closes a tab.`,
  body: `## Where the earlier lessons stop

The *Strings for assertions* lesson (lesson 1) covered \`equals\` vs \`==\` and using \`StringBuilder\`. This lesson goes underneath: **why** \`==\` sometimes works on strings, what the compiler and the JVM do with \`+\`, how a \`String\` is laid out in memory, where every kind of data lives in the JVM, how the garbage collector decides what to free, and how to debug the memory problems that big Selenium/RestAssured suites run into — from a \`ThreadLocal\` that was never removed to an \`OutOfMemoryError\` in a Surefire fork.

Baseline is **Java 17** (OpenJDK/HotSpot); details that are implementation-specific are labelled as OpenJDK behaviour.

## String immutability and why it was chosen

A \`String\` cannot change after construction: the class is \`final\`, its storage array is \`private final\`, and no method writes to it — \`toUpperCase\`, \`replace\`, \`trim\`, \`substring\` all return a **new** object (or \`this\` when nothing changes). The reasons are design decisions, and interviewers want them:

| Reason | What it buys |
|---|---|
| **Pool safety** | identical literals can share one object; if strings were mutable, changing one literal would change it everywhere |
| **Cached hash code** | \`hashCode()\` is computed once and stored in a field, so strings are cheap, stable \`HashMap\` keys |
| **Security** | a class name, file path, URL or SQL fragment cannot change between being validated and being used (time-of-check vs time-of-use) |
| **Thread safety** | immutable objects can be shared across threads with no locking — test data constants used by parallel TestNG threads are safe |
| **Class loading** | class and package names are strings; mutation would break the loader's assumptions |

The flip side: every "modification" allocates, and secrets in strings stay in memory until collected — which is why APIs such as \`Console.readPassword\` and \`KeyStore\` use \`char[]\` that you can overwrite. For test credentials the practical rule is: never log them and never keep them in \`toString\`.

### hashCode caching

\`String.hashCode()\` is \`s[0]*31^(n-1) + s[1]*31^(n-2) + … + s[n-1]\` computed with \`int\` overflow. OpenJDK stores the result in a private \`hash\` field on first use; a string whose hash is genuinely 0 is recomputed each time in older versions (newer OpenJDK versions also remember that case with a separate flag). \`switch\` on a \`String\` compiles to a \`switch\` on \`hashCode()\` followed by an \`equals\` check, which is why it is fast.

## The String constant pool

The pool (OpenJDK's internal \`StringTable\`) is a JVM-wide hash table of **canonical** \`String\` instances.

- Every string **literal** and compile-time constant in a class file refers to the pooled instance. The pooled object is created the first time that constant is resolved and shared by every class that uses the same text.
- \`new String("ab")\` always creates a **new heap object** (its contents shared with or copied from the literal), so it is never \`==\` to the literal.
- \`s.intern()\` returns the pooled instance with the same contents, adding \`s\` to the pool if absent.
- **Where it lives:** since **Java 7** the pool's strings are in the **ordinary heap** (before that, in PermGen, where heavy \`intern()\` use caused \`OutOfMemoryError: PermGen space\`). Interned strings are therefore garbage-collectable like any other object once unreferenced. \`-XX:StringTableSize\` sets the number of buckets; \`-XX:+PrintStringTableStatistics\` prints its stats on exit.

\`\`\`java
public class PoolDemo {
    public static void main(String[] args) {
        String a = "standard_user";                  // pooled literal
        String b = "standard_user";                  // same pooled object
        String c = new String("standard_user");      // new heap object
        String d = c.intern();                       // canonical pooled object

        System.out.println(a == b);          // true
        System.out.println(a == c);          // false
        System.out.println(a == d);          // true
        System.out.println(a.equals(c));     // true — what tests should always use
    }
}
\`\`\`

\`new String("standard_user")\` creates **one or two** objects: the new heap \`String\` always, plus the pooled literal if that literal had not been resolved yet. That is the precise answer to "how many objects does this line create?".

**Should you call \`intern()\` yourself?** Rarely. It can save memory when millions of duplicate strings live long (e.g. status values parsed from a huge CSV), but the table lookup costs time, and G1's \`-XX:+UseStringDeduplication\` deduplicates the *backing arrays* of long-lived strings automatically without changing identity. In test code, interning is almost never the right fix.

## Compile-time constant folding

The compiler evaluates **constant expressions** (JLS 15.29 — literals, \`final\` variables of primitive/String type initialised with a constant expression, and operators on them) and puts the result in the class file as one literal:

\`\`\`java
public class FoldingDemo {
    static final String PREFIX = "add-to-cart-";           // compile-time constant

    public static void main(String[] args) {
        String full = "add-to-cart-pulse-bike-light";

        String folded   = "add-to-cart-" + "pulse-bike-light";   // folded by javac: one literal
        String viaConst = PREFIX + "pulse-bike-light";           // folded: PREFIX is a constant variable

        String part = "pulse-bike-light";                        // NOT final -> not a constant variable
        String runtime  = "add-to-cart-" + part;                 // built at run time: new object

        final String finalPart = "pulse-bike-light";             // final + constant initialiser = constant
        String folded2  = "add-to-cart-" + finalPart;            // folded again

        final String fromMethod = part.trim();                   // final but NOT a constant expression
        String runtime2 = "add-to-cart-" + fromMethod;           // run time

        System.out.println(full == folded);    // true
        System.out.println(full == viaConst);  // true
        System.out.println(full == runtime);   // false
        System.out.println(full == folded2);   // true
        System.out.println(full == runtime2);  // false
        System.out.println(full == runtime.intern()); // true
    }
}
\`\`\`

Step by step:

- \`"add-to-cart-" + "pulse-bike-light"\` never runs at run time; \`javap -c\` shows a single \`ldc "add-to-cart-pulse-bike-light"\`.
- \`final\` alone is not enough — the initialiser must itself be a constant expression. \`final String fromMethod = part.trim()\` is just a final local.
- A senior consequence: \`static final String\` constants are **inlined into other classes** at compile time. If \`TestConstants.BASE_URL\` changes and only \`TestConstants\` is recompiled, classes using it keep the old value until they are recompiled too — a real "but I changed the URL!" bug with incremental builds and shared jars. Load configurable values at run time (\`System.getProperty\`, a config file) instead of \`static final\` literals.

## Compact strings (Java 9+)

Up to Java 8 a \`String\` held a \`char[]\` — 2 bytes per character, even for ASCII. Since **Java 9** (JEP 254, "Compact Strings") OpenJDK stores a \`byte[] value\` plus a \`byte coder\`:

- \`LATIN1\` (coder 0): one byte per character, used when **every** character fits in ISO-8859-1.
- \`UTF16\` (coder 1): two bytes per character, used as soon as **one** character does not fit — \`"Price: ₹499"\` or an emoji makes the whole string UTF-16.

It is transparent to code (\`length()\` and \`charAt()\` behave as before) and roughly halves the memory of ASCII-heavy data such as JSON responses, locators and logs. It can be switched off with \`-XX:-CompactStrings\` (almost never useful). Practical effect for testers: a heap dump of a Java 17 suite shows \`byte[]\` as the top consumer where a Java 8 dump showed \`char[]\` — both are usually "strings".

## Concatenation: +, StringBuilder, StringBuffer, join

### What + compiles to

- Up to Java 8, \`a + b + c\` compiled to \`new StringBuilder().append(a).append(b).append(c).toString()\`.
- Since **Java 9** (JEP 280), javac emits one \`invokedynamic\` call bootstrapped by \`java.lang.invoke.StringConcatFactory\` per concatenation **expression**. The JVM generates an optimised strategy at first call (pre-sizing the exact result length, avoiding intermediate builders). Code does not change; class files are smaller and the runtime can improve the strategy without recompiling.

What JEP 280 does **not** fix: \`+=\` inside a loop is still one new \`String\` per iteration, each copying everything built so far. For \`n\` pieces of similar size, total copying is proportional to 1 + 2 + … + n — **O(n²)**. A \`StringBuilder\` appends into a growable array whose capacity roughly doubles when full (default initial capacity 16), so total copying is **O(n)** amortised.

\`\`\`java
import java.util.List;
import java.util.StringJoiner;
import java.util.stream.Collectors;

public class ConcatDemo {
    record Row(String name, String price) {}

    public static void main(String[] args) {
        List<Row> rows = List.of(new Row("Trailblazer Backpack", "$29.99"),
                                 new Row("Pulse Bike Light", "$9.99"),
                                 new Row("Retro Red Tee", "$15.99"));

        // 1. + in a loop: O(n^2) copying, new String each iteration
        String report1 = "";
        for (Row r : rows) report1 += r.name() + "=" + r.price() + "\\n";

        // 2. StringBuilder: O(n) amortised, single thread
        StringBuilder sb = new StringBuilder(rows.size() * 32);   // optional pre-size avoids regrowth
        for (Row r : rows) sb.append(r.name()).append('=').append(r.price()).append('\\n');
        String report2 = sb.toString();

        // 3. StringBuffer: same API, every method synchronized
        StringBuffer buf = new StringBuffer();
        for (Row r : rows) buf.append(r.name()).append('=').append(r.price()).append('\\n');

        // 4. String.join / StringJoiner: delimiter handling built in
        String names = String.join(", ", rows.stream().map(Row::name).toList());   // toList(): Java 16+
        StringJoiner sj = new StringJoiner(", ", "[", "]");
        rows.forEach(r -> sj.add(r.name()));

        // 5. Collectors.joining: inside a stream pipeline
        String csv = rows.stream().map(r -> r.name() + "," + r.price()).collect(Collectors.joining("\\n", "name,price\\n", ""));

        System.out.println(report1.equals(report2) + " " + names + " " + sj + "\\n" + csv);
    }
}
\`\`\`

| | \`+\` (single expression) | \`+=\` in a loop | \`StringBuilder\` | \`StringBuffer\` | \`String.join\` / \`StringJoiner\` | \`Collectors.joining\` |
|---|---|---|---|---|---|---|
| How it works | one \`invokedynamic\` concat (Java 9+), exact sizing | a new String per iteration | mutable \`byte[]\`, grows ~2× | like StringBuilder, synchronized methods | builder with delimiter/prefix/suffix | collector over a StringBuilder-based joiner |
| Advantages | most readable; fastest for a fixed number of parts | none | linear time; control over capacity | safe for concurrent appends | no "trailing comma" logic | fits stream pipelines |
| Disadvantages | none for fixed parts | quadratic copying, garbage | not thread-safe; verbose | lock overhead, rarely needed | needs a collection/iterable | stream overhead for tiny inputs |
| Performance | best | worst, degrades with n | linear | linear + uncontended lock cost | linear | linear |
| Maintainability | high | looks fine, hides cost | medium | medium | high | high |
| When to use | log lines, messages, assertions | never in hot or long loops | loops, building reports/payloads | legacy APIs; concurrent appends (better: collect per thread then join) | lists of names, CSV rows | when already streaming |

**Benchmark reasoning without fake numbers:** for 3 pieces the difference is invisible next to one WebDriver call (milliseconds of HTTP). For 10,000 table rows in a report, \`+=\` copies on the order of n²/2 characters and creates n garbage strings, which shows up as both CPU and young-GC pressure; the builder copies each character about twice. If you need actual numbers, measure with **JMH**, not a \`System.nanoTime()\` loop — JIT warm-up, dead-code elimination and escape analysis make naive micro-benchmarks lie.

**Recommended:** \`+\` for a fixed number of parts, \`StringBuilder\` in loops, \`String.join\`/\`Collectors.joining\` for delimited lists, \`String.format\`/\`formatted\` (Java 15+) for readable messages where speed is irrelevant. \`StringBuffer\` only when an API requires it.

## Interview == puzzles

\`\`\`java
public class StringPuzzles {
    public static void main(String[] args) {
        String s1 = "Sauce";
        String s2 = "Sau" + "ce";              // folded
        String half = "Sau";
        String s3 = half + "ce";               // runtime
        String s4 = s3.intern();
        String s5 = new String("Sauce");
        StringBuilder sb = new StringBuilder("Sauce");

        System.out.println(s1 == s2);                      // 1: true
        System.out.println(s1 == s3);                      // 2: false
        System.out.println(s1 == s4);                      // 3: true
        System.out.println(s1 == s5);                      // 4: false
        System.out.println(s1.equals(sb));                 // 5: false
        System.out.println(s1.contentEquals(sb));          // 6: true
        System.out.println(1 + 2 + "3" + 4 + 5);           // 7: 3345
        System.out.println('a' + 1 + "b");                 // 8: 98b
        String n = null;
        System.out.println(n + "x");                       // 9: nullx
        s1.toUpperCase();
        System.out.println(s1);                            // 10: Sauce
        System.out.println(s1 == s1.substring(0));         // 11: true
        System.out.println(s1.hashCode() == s5.hashCode()); // 12: true
    }
}
\`\`\`

1. Both are the same compile-time constant → same pooled object.
2. \`half\` is not \`final\`, so \`s3\` is built at run time → new object.
3. \`intern()\` returns the pooled instance.
4. \`new\` always creates a distinct object.
5. \`String.equals\` returns false for anything that is not a \`String\` — a classic bug when comparing to a builder.
6. \`contentEquals(CharSequence)\` compares characters.
7. Left-to-right: \`1 + 2\` is integer \`3\`, then string concatenation: \`"3" + "3" + 4 + 5\`.
8. \`'a' + 1\` is int arithmetic (97 + 1), then \`"b"\` is appended.
9. String conversion of \`null\` is \`"null"\` — no NPE (but \`n.concat("x")\` throws).
10. Strings are immutable; the uppercase result was discarded.
11. \`substring(0)\` returns \`this\` in OpenJDK (an implementation detail — do not rely on it). Since Java 7u6, \`substring\` **copies** the characters; earlier versions shared the parent array, which leaked memory when a small substring kept a huge page source alive.
12. Equal strings must have equal hash codes.

## JVM memory areas

| Area | Per | Holds | Sized by | Failure |
|---|---|---|---|---|
| **Heap** — young (Eden + 2 survivor spaces) and old generation | JVM | all objects and arrays, including pooled strings | \`-Xms\`, \`-Xmx\`, \`-XX:MaxRAMPercentage\` | \`OutOfMemoryError: Java heap space\` |
| **Thread stack** | thread | frames: local variable array (primitives and references), operand stack, return info | \`-Xss\` (commonly 1 MB on 64-bit) | \`StackOverflowError\` (deep recursion); \`OOM: unable to create native thread\` |
| **Metaspace** (Java 8+, replaced PermGen) | JVM, native memory | class metadata, method bytecode, constant pools | \`-XX:MaxMetaspaceSize\` (unlimited by default) | \`OutOfMemoryError: Metaspace\` |
| **Code cache** | JVM, native | JIT-compiled machine code | \`-XX:ReservedCodeCacheSize\` | warning "CodeCache is full. Compiler has been disabled" → slow, not a crash |
| **Direct memory** | JVM, native | \`ByteBuffer.allocateDirect\`, NIO/Netty buffers (HTTP clients) | \`-XX:MaxDirectMemorySize\` | \`OutOfMemoryError: Direct buffer memory\` |
| PC register, native method stack | thread | current instruction, native frames | — | rare |

Key facts:

- **Objects live on the heap; references to them live in stack frames (locals) or in other objects (fields).** Primitive locals live in the frame; primitive fields live inside their object on the heap. With **escape analysis**, the JIT may avoid allocating an object that never escapes a method (scalar replacement) — an optimisation, not a guarantee.
- The default max heap without \`-Xmx\` is a fraction of physical (or container) memory — 1/4 in HotSpot's ergonomics. In containers prefer \`-XX:MaxRAMPercentage=75\` over a fixed \`-Xmx\` so the JVM follows the pod's limit.
- **PermGen → Metaspace (Java 8):** class metadata moved to native memory and is no longer capped by default. That removed most \`PermGen space\` errors but means a class-loader leak now grows the process until the OS or container kills it — set \`MaxMetaspaceSize\` on CI if you want a clear error instead.
- Memory used by the process = heap + metaspace + code cache + thread stacks × threads + direct buffers + GC structures. A JVM with \`-Xmx2g\` routinely uses more than 2 GB of RSS. \`-XX:NativeMemoryTracking=summary\` plus \`jcmd <pid> VM.native_memory summary\` shows the split.

### Object layout and references

In 64-bit HotSpot each object has a header — a **mark word** (8 bytes: hash, GC age, lock state) and a **class pointer** (4 bytes with compressed class pointers) — so 12 bytes before the first field, and objects are aligned to 8 bytes. Arrays add a 4-byte length. **Compressed oops** (32-bit references scaled by 8) are on by default for heaps below roughly 32 GB, which is why going from \`-Xmx31g\` to \`-Xmx33g\` can *reduce* usable space. A short Latin-1 \`String\` such as \`"Pulse Bike Light"\` therefore costs roughly a 24-byte \`String\` object plus a \`byte[]\` of 16 bytes of header + 16 bytes of data — about 56 bytes for 16 characters. Measure rather than guess with **JOL** (\`org.openjdk.jol\`) or a heap dump's "retained size".

## Garbage collection

### Reachability and GC roots

The collector frees objects that are **unreachable** from the **GC roots**. Roots include: local variables and operands in the stack frames of live threads, **static fields** of loaded classes, JNI references, objects used as monitors by threads, and JVM-internal references (system class loader, pooled strings referenced by loaded classes). Reference counting is not used, so cycles (page object ↔ component) are collected fine when nothing outside reaches them.

Consequence for frameworks: **anything reachable from a \`static\` field lives as long as its class** — normally the whole test run. A static \`Map<String, WebDriver>\` is a leak by construction unless entries are removed.

### The generational hypothesis

Most objects die young (request DTOs, \`WebElement\` proxies, temporary strings); the few that survive tend to live long (config, drivers, caches). So the heap is split:

1. New objects are allocated in **Eden**, very cheaply — each thread bumps a pointer in its own *thread-local allocation buffer* (TLAB).
2. When Eden fills, a **minor (young) GC** copies live objects from Eden and the occupied survivor space into the other survivor space, incrementing their age. Dead objects cost nothing — they are simply not copied.
3. Objects surviving enough cycles (age threshold, at most 15) — or too big for the survivor space — are **promoted** to the old generation.
4. When the old generation fills, a **major/full GC** (or, in G1, concurrent marking followed by **mixed** collections) reclaims it — far more expensive.

Old-to-young references are tracked with a **card table**/remembered sets so a minor GC does not need to scan the whole old generation.

**Stop-the-world (STW)**: phases where all application threads are paused at safepoints. Every HotSpot collector has some STW pauses; the modern ones move most work into **concurrent** phases. For a test suite, long STW pauses look like random slowness — a click that "took 4 seconds" while the JVM was in a full GC.

### Collectors

| Collector | Flag | Model | Use |
|---|---|---|---|
| Serial | \`-XX:+UseSerialGC\` | single-threaded, STW, generational | tiny heaps, one CPU; ergonomics may pick it in small containers |
| Parallel | \`-XX:+UseParallelGC\` | multi-threaded STW, throughput-oriented | batch jobs; the default on server-class machines in Java 8 |
| **G1** | \`-XX:+UseG1GC\` | region-based, generational, mostly concurrent marking, pause target (\`-XX:MaxGCPauseMillis\`, default 200 ms) | **default since Java 9** (JEP 248); right for almost every test JVM |
| ZGC | \`-XX:+UseZGC\` | concurrent, very low pauses, large heaps | production since Java 15 (JEP 377); generational mode added in Java 21 (JEP 439) |
| Shenandoah | \`-XX:+UseShenandoahGC\` | concurrent compaction, low pauses | production since Java 15 (JEP 379), in OpenJDK builds that include it |
| Epsilon | \`-XX:+UnlockExperimentalVMOptions -XX:+UseEpsilonGC\` | allocates, never collects | performance experiments only (Java 11, JEP 318) |

CMS was deprecated in Java 9 and removed in Java 14. G1 splits the heap into equal regions; any region can be Eden, survivor, old or **humongous** (objects of half a region or more — think large \`byte[]\` screenshots or a huge JSON response string), and it collects the regions with the most garbage first ("garbage first").

**Recommended for test suites:** keep G1 (the default) and fix the allocation/retention problem; switching collectors almost never fixes a leak. Low-pause collectors matter for latency-sensitive services, not for a suite whose time is spent waiting on browsers.

## Reference types and WeakHashMap

| Type | Cleared when | \`get()\` | Use |
|---|---|---|---|
| Strong (normal) | never while reachable | the object | everything |
| \`SoftReference\` | at the collector's discretion under memory pressure; all cleared before an OOM is thrown | object or null | memory-sensitive caches (often better: a bounded cache) |
| \`WeakReference\` | at the next GC that finds the object only weakly reachable | object or null | canonicalising maps, metadata keyed by an object you do not own |
| \`PhantomReference\` | after the object is finalised/unreachable; always enqueued, never resurrectable | always null | post-mortem cleanup via a \`ReferenceQueue\`; \`java.lang.ref.Cleaner\` (Java 9+) wraps this |

\`finalize()\` is deprecated (Java 9) and deprecated for removal (Java 18, JEP 421); use try-with-resources or a \`Cleaner\`.

\`\`\`java
import java.time.Instant;
import java.util.Collections;
import java.util.Map;
import java.util.WeakHashMap;
import org.openqa.selenium.WebDriver;

public final class SessionMetadata {
    public record Info(String testName, Instant started) {}   // must NOT reference the driver

    // weak keys: an entry disappears after its WebDriver is no longer strongly reachable
    private static final Map<WebDriver, Info> INFO = Collections.synchronizedMap(new WeakHashMap<>());

    public static void started(WebDriver driver, String testName) { INFO.put(driver, new Info(testName, Instant.now())); }
    public static Info of(WebDriver driver) { return INFO.get(driver); }
    public static void finished(WebDriver driver) { INFO.remove(driver); }   // explicit removal is still the primary cleanup
}
\`\`\`

Step by step: \`WeakHashMap\` holds keys through \`WeakReference\`s and purges entries whose keys were collected (on the next map operation). Three traps: (1) if the **value** references the key (e.g. \`Info\` held the driver), the key is strongly reachable through the map itself and never collected; (2) keys that are pooled string literals or cached boxed integers are always reachable, so their entries never go away; (3) it is not thread-safe — wrap it or use explicit removal. Treat weak maps as a **safety net**, not as the cleanup strategy.

## Memory leaks typical in test frameworks

A leak in Java is an object that is **reachable but no longer needed**. In suites, leaks surface as runs that slow down hour by hour, GC log lines getting more frequent, and finally an OOM in test 3,000 that has nothing to do with test 3,000.

| Leak | Why it is retained | Fix |
|---|---|---|
| \`static Map<String, WebDriver>\` / \`static List<BasePage>\` registries | static field = GC root; entries never removed | remove in \`@AfterMethod\`/\`finally\`; prefer per-test objects passed explicitly |
| \`ThreadLocal<WebDriver>\` set but never \`remove()\`d | TestNG/executor threads are pooled and live for the whole run; the thread's \`ThreadLocalMap\` holds the **value strongly** (only the key is weak) | \`try { driver.quit(); } finally { DRIVER.remove(); }\` in teardown — also prevents the next test on that thread from getting a dead driver |
| Listeners/reporters keeping every \`ITestResult\`, screenshot \`byte[]\` or Base64 string | the listener is alive all run; results reference parameters, attributes, exceptions | write evidence to disk immediately and keep only the path; keep failures only; flush reports incrementally |
| Drivers not quit | browser processes and driver sessions (and their client objects) stay alive; on a grid, sessions stay locked | \`quit()\` in \`@AfterMethod(alwaysRun = true)\`; JVM shutdown hook as a last resort |
| Unclosed streams, HTTP responses, DB connections | native buffers, sockets and file handles pinned | try-with-resources; close RestAssured/HTTP client response bodies |
| Logging whole page sources/responses into an in-memory appender | huge strings kept until the run ends | log to file, truncate bodies, log sizes not payloads |
| Inner-class listeners | an anonymous/inner listener keeps its **outer** page or test object alive | static nested classes or lambdas that capture only what they need; unregister listeners |
| Cucumber/DI scenario objects kept in static caches | scenario-scoped objects promoted to "global" | scenario-scoped containers (PicoContainer) and no static state |

\`\`\`java
import org.openqa.selenium.WebDriver;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

public abstract class BaseUiTest {
    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    protected WebDriver driver() { return DRIVER.get(); }

    @BeforeMethod(alwaysRun = true)
    public void startDriver() {
        DRIVER.set(DriverFactory.create(System.getProperty("browser", "chrome")));
    }

    @AfterMethod(alwaysRun = true)
    public void stopDriver() {
        WebDriver d = DRIVER.get();
        try {
            if (d != null) d.quit();          // releases the browser and the remote session
        } finally {
            DRIVER.remove();                  // releases the reference held by the pooled thread
        }
    }
}
\`\`\`

\`alwaysRun = true\` makes teardown run even when the test or a dependent configuration failed; the \`finally\` guarantees \`remove()\` even if \`quit()\` throws because the browser already crashed.

## OutOfMemoryError: types and debugging

| Message | Meaning | Typical cause in a suite | First move |
|---|---|---|---|
| \`Java heap space\` | an allocation could not be satisfied after GC | leak (static registries, listeners) or genuinely large data (huge response read into a String) | heap dump → dominator tree |
| \`GC overhead limit exceeded\` | the JVM spends almost all its time in GC (HotSpot: over 98%) recovering almost nothing (under 2%); reported mainly with the Parallel collector | the heap is effectively full of live objects | same as above; do not disable the check with \`-XX:-UseGCOverheadLimit\` |
| \`Metaspace\` | class metadata exceeded \`MaxMetaspaceSize\` | class-loader leaks in long-lived JVMs (build daemons, repeated dynamic proxies/mocks, script engines) | \`jcmd <pid> VM.metaspace\`, class histogram; check for growing class-loader counts |
| \`unable to create native thread\` (older JDKs: "unable to create new native thread") | the OS refused a new thread | unbounded thread pools, \`parallel=methods\` with a huge thread count, leaked executors | \`jcmd <pid> Thread.print\`; count threads; check \`ulimit -u\`/container pid limits |
| \`Direct buffer memory\` | NIO direct buffers exceeded the limit | HTTP clients/Netty not releasing buffers | close responses; \`-XX:MaxDirectMemorySize\` |
| \`Requested array size exceeds VM limit\` | an array larger than the VM supports | bugs that compute absurd sizes | fix the size calculation |

\`StackOverflowError\` is an \`Error\` but **not** an \`OutOfMemoryError\` — it is a too-deep call stack (often unintended recursion, e.g. a page object method calling itself through an override).

### Tooling

\`\`\`bash
# capture evidence automatically
java -Xmx2g -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=target/heap \\
     -Xlog:gc*:file=target/gc.log:time,uptime,level,tags  ...

jcmd                                   # list JVMs and their pids
jcmd <pid> GC.class_histogram          # live objects per class (quick leak suspect list)
jcmd <pid> GC.heap_dump target/suite.hprof
jcmd <pid> Thread.print                # all thread stacks (thread leaks, deadlocks)
jcmd <pid> VM.flags                    # effective GC and heap flags
jstat -gcutil <pid> 1000               # every second: survivor/eden/old/metaspace %, GC counts and times
jcmd <pid> JFR.start duration=120s filename=target/run.jfr   # Flight Recorder: allocation and GC events
\`\`\`

- **Unified logging (\`-Xlog:gc\`, Java 9+)** replaced \`-XX:+PrintGCDetails\`/\`-Xloggc\`. A line such as \`[12.345s][info][gc] GC(41) Pause Young (Normal) (G1 Evacuation Pause) 812M->95M(2048M) 14.2ms\` reads "before → after (committed heap), pause time". The leak signature is the **floor** after each collection rising over time (95M, 140M, 310M, 650M …) until \`Pause Full\` lines appear and stop freeing much.
- **\`jstat -gcutil\`**: an old-generation column (\`O\`) that climbs after every collection and \`FGC\` (full GC count) increasing means live data is growing.
- **Eclipse MAT** on the \`.hprof\`: *Leak Suspects* report, then the **dominator tree** sorted by retained heap, then *Path to GC Roots (excluding weak/soft references)* on the suspect — that path names the static field or thread that holds it (e.g. \`TestNG-methods-3\` → \`threadLocals\` → \`RemoteWebDriver\`).
- **VisualVM** (separate download since Java 9) for live heap/thread graphs and sampling; **JDK Mission Control** for JFR recordings (allocation pressure by stack trace).

### Maven Surefire memory settings for big suites

Tests run in a **forked JVM** by default, so \`MAVEN_OPTS\` sizes Maven, not your tests. Configure the fork:

\`\`\`xml
<properties>
  <argLine></argLine>   <!-- empty default so @{argLine} resolves when JaCoCo is not active -->
</properties>

<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <version>3.2.5</version>
  <configuration>
    <argLine>@{argLine} -Xms512m -Xmx2g -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=\${project.build.directory}/heapdumps -Xlog:gc*:file=target/gc.log:time,uptime</argLine>
    <forkCount>1</forkCount>
    <reuseForks>true</reuseForks>
  </configuration>
</plugin>
\`\`\`

- \`@{argLine}\` (late replacement) keeps arguments added by other plugins such as the JaCoCo agent; writing \`\${argLine}\` or overwriting it silently drops coverage.
- \`forkCount\` > 1 runs several JVMs in parallel — each gets its own \`-Xmx\`, so 4 forks × 2 GB needs 8 GB plus native overhead on the agent. \`forkCount=1C\` means one per CPU core.
- \`reuseForks=false\` starts a fresh JVM per test class: it hides leaks (each JVM dies before it fills) at the price of start-up time — useful as a stop-gap, not as a fix.
- Running Gradle? The equivalent is \`test { maxHeapSize = "2g"; jvmArgs "-XX:+HeapDumpOnOutOfMemoryError"; maxParallelForks = 2 }\`.

## Common mistakes and debugging

- **Comparing strings with \`==\` and it "works locally"** — both values were compile-time constants or interned; production data from \`getText()\` is not. Use \`equals\`; search the codebase for \`== "\` in reviews.
- **Raising \`-Xmx\` every month** — a leak postponed, not fixed. Take a heap dump at the failure and follow the path to GC roots.
- **\`OutOfMemoryError\` but no dump** — the flag was set in \`MAVEN_OPTS\`, not in Surefire's \`argLine\`. Check the fork's command line in \`target/surefire-reports\` or with \`jcmd <pid> VM.command_line\`.
- **Parallel suite gets slower after a few hundred tests** — read \`gc.log\`: a rising post-GC floor is retention; flat floor with high allocation rate is just garbage (look for \`+=\` in loops, huge string building, Base64 screenshots).
- **\`ThreadLocal\` driver "randomly" already quit at the start of a test** — a previous test on the same pooled thread quit it without \`remove()\`; the stale value was reused.

## Best practices for experienced engineers

- \`equals\` for content, never \`==\`, regardless of what the pool makes "work".
- Builders in loops; \`String.join\`/\`joining\` for lists; plain \`+\` for fixed messages.
- No configurable values as \`static final\` literals that other modules inline.
- Every \`ThreadLocal.set\` paired with \`remove()\` in a \`finally\`; every driver \`quit()\` in \`alwaysRun\` teardown; every stream/response in try-with-resources.
- Evidence (screenshots, page sources, HAR files) goes to disk immediately; keep paths, not bytes.
- CI JVMs run with \`-XX:+HeapDumpOnOutOfMemoryError\` and GC logging so the first failure is diagnosable; archive the dump as a build artifact.
- Keep G1 unless measurements say otherwise; fix retention instead of tuning the collector.

## Interview questions

### Q: Why is String immutable in Java?
**Short answer (30–60 s):** So literals can be shared safely in the pool, the hash code can be cached for fast map keys, values cannot change between validation and use (security), and strings can be shared between threads without locking.

**Detailed answer:** Walk through each reason with an example: the pool (\`"standard_user"\` used in 100 classes is one object), the cached \`hash\` field and \`switch\` on strings, time-of-check/time-of-use for file paths and class names, and thread safety for shared test data. Mention the cost (allocation on every change → use builders) and the \`char[]\` recommendation for secrets.

### Q: Where is the String pool and what does intern() do?
**Short answer (30–60 s):** It is a JVM-wide table of canonical strings; since Java 7 the strings live in the normal heap and can be garbage-collected. \`intern()\` returns the canonical instance with the same content, adding it if missing.

**Detailed answer:** Literals and compile-time constants refer to pooled instances; \`new String\` never does; one or two objects for \`new String("x")\`. PermGen history and \`OOM: PermGen space\`. \`-XX:StringTableSize\`. When interning helps (huge numbers of duplicate long-lived values) versus G1 string deduplication, and why test code should not need it.

### Q: Does "a" + "b" create a new object at run time? What about a + "b"?
**Short answer (30–60 s):** \`"a" + "b"\` is folded by the compiler into the literal \`"ab"\`, no run-time work. \`a + "b"\` with a non-constant \`a\` is built at run time into a new String — unless \`a\` is a \`final\` variable initialised with a constant.

**Detailed answer:** Constant expressions per JLS, \`javap -c\` showing \`ldc\`, the \`final\`-with-method-call counterexample, and the inlining of \`static final\` constants into other classes as a real build bug. Since Java 9 run-time concatenation uses \`invokedynamic\` with \`StringConcatFactory\`.

### Q: StringBuilder vs StringBuffer vs + — which and why?
**Short answer (30–60 s):** \`+\` for a fixed set of parts — it is compiled efficiently. \`StringBuilder\` in loops, because \`+=\` copies everything each iteration (quadratic). \`StringBuffer\` is the synchronized legacy version; it is rarely needed.

**Detailed answer:** The comparison table, amortised doubling growth, pre-sizing, JEP 280 not fixing loops, JMH for measurement, and why per-thread builders joined at the end beat one shared \`StringBuffer\` in parallel code.

### Q: Describe the JVM memory areas.
**Short answer (30–60 s):** Heap (young: Eden and two survivors; old) for objects; a stack per thread for frames with locals and references; metaspace in native memory for class metadata since Java 8; plus code cache for JIT code and direct memory for NIO buffers.

**Detailed answer:** The table with flags and failure modes; heap vs RSS; container sizing with \`MaxRAMPercentage\`; escape analysis; object header and compressed oops; PermGen removal and what it changed for class-loader leaks.

### Q: How does garbage collection decide what to free, and why is it generational?
**Short answer (30–60 s):** It frees objects not reachable from GC roots — thread stacks, static fields, JNI refs. It is generational because most objects die young, so collecting the young generation by copying the few survivors is cheap; long-lived objects are promoted and collected less often.

**Detailed answer:** TLAB allocation, minor GC copying between survivors, age and promotion, card tables, full/mixed collections, STW vs concurrent phases, the collector table with versions (G1 default since 9; ZGC and Shenandoah production in 15; generational ZGC in 21), and that cycles are collected because it is tracing, not reference counting.

### Q: What are soft, weak and phantom references? Give a use in a framework.
**Short answer (30–60 s):** Soft references are cleared under memory pressure (caches), weak ones at the next GC once only weakly reachable (metadata keyed by an object you do not own, \`WeakHashMap\`), phantom ones only signal that an object is gone for cleanup (\`Cleaner\`).

**Detailed answer:** The \`SessionMetadata\` example keyed by \`WebDriver\`, and its traps: value referencing key, pooled keys, thread safety. Weak maps are a safety net; explicit removal in teardown is the real cleanup.

### Q: Your nightly suite dies with OutOfMemoryError after two hours. How do you investigate?
**Short answer (30–60 s):** Make sure the next run produces evidence — heap dump on OOM and GC logs in Surefire's \`argLine\` — then open the dump in MAT, look at the dominator tree and the path to GC roots of the biggest retained set, and fix the reference that keeps it alive.

**Detailed answer:** Identify the OOM type first (heap, metaspace, native thread). Read the GC log for a rising floor. Typical culprits: \`ThreadLocal\` without \`remove()\`, static driver/page maps, listeners storing screenshots, unclosed responses. Verify the fix by comparing post-GC floors between runs, and keep the diagnostic flags permanently on CI.

## Scenario-based questions

**1. A parallel TestNG run (thread-count 8) degrades from 40 to 95 minutes over a week of added tests and occasionally ends in "GC overhead limit exceeded".** I would add \`-Xlog:gc*\` and \`HeapDumpOnOutOfMemoryError\` to Surefire's \`argLine\`, run once, and confirm a rising post-GC floor. In MAT the dominator tree shows a custom reporting listener holding a list of results with Base64 screenshots for every test, passed or failed. Fix: write screenshots to files on failure only, keep paths, flush the report per class. Then I compare the GC floor across two runs to confirm the slope is gone — and I would not raise \`-Xmx\` as the fix.

**2. A colleague "optimises" a reporting utility by replacing \`StringBuilder\` with \`+\` because "Java 9+ compiles + efficiently now".** The utility builds an HTML table of 20,000 rows in a loop. I would explain that JEP 280 optimises each concatenation expression, but a \`+=\` loop still creates and copies a new string per iteration — quadratic work and garbage. I'd keep \`+\` inside each row expression and a \`StringBuilder\` (pre-sized) across rows, and back it with a JMH measurement if there is disagreement.

**3. Tests started failing with "invalid session id" at the start of random tests after moving to a thread pool.** The \`ThreadLocal<WebDriver>\` is quit in teardown but never removed; pooled threads hand the dead driver to the next test. Fix: \`finally { DRIVER.remove(); }\` and create the driver lazily or in \`@BeforeMethod\`. The same change removes a memory leak.

## Tricky follow-ups

- **Is \`String s = "a"; s = s + "b";\` a mutation?** No — a new String is created and the variable is re-pointed; \`"a"\` is unchanged.
- **Are interned strings ever garbage-collected?** Yes, since the pool moved to the heap in Java 7, once nothing references them (literals stay alive as long as the classes that use them).
- **Why is \`Integer a = 127, b = 127; a == b\` true but 128 false?** \`Integer.valueOf\` caches -128..127 (upper bound configurable with \`-XX:AutoBoxCacheMax\`); outside the cache autoboxing creates new objects. Same lesson as strings: use \`equals\`.
- **Does \`System.gc()\` force a collection?** It is only a request; it may be ignored (\`-XX:+DisableExplicitGC\`), and calling it in tests to "fix" memory just adds full-GC pauses.
- **Can a memory leak happen with a garbage collector?** Yes — the GC frees only unreachable objects; a leak is an unneeded object that is still reachable, typically from a static field or a live thread.`,
  keyPoints: [
    'Strings are immutable for pool safety, cached hash codes, security and thread safety; every "change" allocates a new object.',
    'Literals and compile-time constants (including final variables with constant initialisers) share one pooled instance; new String never does; intern() returns the canonical one. The pool lives in the heap since Java 7.',
    'javac folds constant expressions; static final constants are inlined into other classes. Since Java 9, + uses invokedynamic (JEP 280) and strings are compact Latin-1/UTF-16 byte arrays (JEP 254).',
    '+ for fixed parts, StringBuilder in loops (+= is O(n²)), String.join/Collectors.joining for lists, StringBuffer only when synchronisation is required; measure with JMH.',
    'JVM areas: heap (Eden, survivors, old), per-thread stacks, metaspace (Java 8+, native), code cache, direct memory — each with its own flag and OutOfMemoryError message.',
    'GC frees what is unreachable from roots (stacks, statics, JNI); generational copying makes young garbage cheap; G1 is the default since Java 9, ZGC/Shenandoah are low-pause options.',
    'Test-framework leaks: static driver/page maps, ThreadLocal without remove(), listeners keeping screenshots, unclosed drivers/streams, in-memory logs.',
    'Debug with HeapDumpOnOutOfMemoryError, -Xlog:gc, jcmd, jstat and Eclipse MAT (dominator tree, path to GC roots); set memory in Surefire argLine, not MAVEN_OPTS.',
  ],
  mistakes: [
    'Using == on strings because a demo with literals returned true. Fix: equals (or contentEquals for CharSequence); explain constant folding and the pool when a reviewer asks why it "worked".',
    'Building reports or payloads with += in a loop. Fix: StringBuilder (pre-sized when the size is known) or Collectors.joining; confirm with a profiler or JMH rather than guessing.',
    'ThreadLocal<WebDriver> quit but never removed, causing "invalid session id" on reused threads and a leak. Fix: quit() then remove() in a finally block in @AfterMethod(alwaysRun = true).',
    'Answering OutOfMemoryError by raising -Xmx. Fix: add -XX:+HeapDumpOnOutOfMemoryError and -Xlog:gc to Surefire argLine, open the dump in MAT and follow the path to GC roots of the largest retained set.',
    'Putting heap flags in MAVEN_OPTS and wondering why the tests ignore them. Fix: Surefire argLine with @{argLine} to keep JaCoCo; remember forkCount multiplies memory.',
    'Keeping every screenshot and response body in a static list for the final report. Fix: write evidence to disk immediately and keep only paths; capture on failure.',
  ],
  tryIt: `(1) Without running it, write down the 12 outputs of the *StringPuzzles* class above, then run it and explain any you got wrong using the constant-folding and pool rules; run \`javap -c StringPuzzles\` and find the \`ldc\` for the folded literal and the \`invokedynamic makeConcatWithConstants\` for the run-time concatenation. (2) Write a small TestNG class with \`parallel="methods"\` and \`thread-count="4"\` that stores a fake "driver" object (a \`byte[1_000_000]\` wrapper) in a \`static ThreadLocal\` in \`@BeforeMethod\` and forgets \`remove()\`; also add each one to a \`static List\`. Run 2,000 invocations with \`-Xmx128m -XX:+HeapDumpOnOutOfMemoryError -Xlog:gc\` in Surefire's \`argLine\`, open the dump in Eclipse MAT, and find the path to GC roots that names the static list. Fix both leaks and show that the post-GC floor in \`gc.log\` stays flat.`,
  problems: ['java-002', 'java-017', 'java-020', 'java-027'],
}
