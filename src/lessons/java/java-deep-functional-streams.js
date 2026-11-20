export default {
  slug: 'java-deep-functional-streams',
  category: 'java',
  order: 15,
  title: 'Deep dive: Java 8+ functional programming — lambdas, functional interfaces and Streams',
  minutes: 30,
  summary: 'Explain how lambdas are compiled and linked (target typing, invokedynamic, capture rules), compose functional interfaces into test helpers such as retry and waitUntil, and use the Stream pipeline and collectors deliberately — laziness, short-circuiting, stateful operations, toMap/groupingBy/teeing, parallel streams and Optional — with clear trade-offs against plain loops.',
  manualAnalogy: `A good test lead does not tell a colleague "here are 40 numbers"; they hand over a rule — "for every row, take the price, keep the ones under $20, group them by category". The rule can be written once and applied to the UI table, the API response and the database export. Lambdas are those rules as values, functional interfaces are the agreed shape of a rule, and a stream is the checklist run that applies a chain of rules to every item — only as far as needed to answer the question.`,
  body: `## Where the earlier lessons stop

The *Lambdas, streams and generic methods* lesson introduced lambda syntax, the four core functional interfaces and the \`filter/map/collect\` pipeline. The *Records, Optional and CSV test data* lesson introduced \`Optional\` with \`orElseThrow\`. This lesson explains what the compiler and JVM actually do with a lambda, how to design functional test utilities, how a stream pipeline executes element by element, which collectors to reach for, where parallel streams and \`Optional\` go wrong — and when a plain loop is the better engineering choice. Examples use the ShopEasy API products (\`GET http://localhost:5181/api/products\`: \`id\`, \`name\`, \`price\`, \`category\`, \`stock\`), the employee table on \`table.html\` and the inventory page.

\`\`\`java
// used throughout
import java.math.BigDecimal;
public record Product(int id, String name, BigDecimal price, String category, int stock) {
    public boolean inStock() { return stock > 0; }
}
// API data: Trailblazer Backpack 29.99 bags 25 · Pulse Bike Light 9.99 accessories 40 ·
// Classic Crew T-Shirt 15.99 clothing 60 · Storm Fleece Jacket 49.99 clothing 12 ·
// Junior Onesie 7.99 kids 30 · Retro Red Tee 15.99 clothing 0
\`\`\`

## How lambdas work

### Target typing and functional interfaces

A lambda has **no type of its own**. The compiler infers it from the **target type** — the variable, parameter or return type it is assigned to — which must be a **functional interface**: an interface with exactly **one abstract method** (default and static methods, and methods inherited from \`Object\` such as \`equals\`, do not count).

\`\`\`java
Predicate<Product> cheap = p -> p.price().compareTo(new BigDecimal("20")) < 0;
Function<Product, String> label = p -> p.name() + " (" + p.category() + ")";
// Object o = p -> p.name();   // does not compile: Object is not a functional interface
\`\`\`

The same lambda text can be a \`Predicate<Product>\` in one place and a custom \`ProductRule\` in another. \`@FunctionalInterface\` is optional; it makes the compiler **reject** a second abstract method, protecting your helper interfaces from a teammate "just adding one more method".

### Capture: effectively final

A lambda may read local variables of the enclosing method only if they are **final or effectively final** (never reassigned). It captures the **value**, not the variable — locals live on the stack frame that may be gone when the lambda runs (e.g. inside a WebDriverWait poll). Fields are different: the lambda captures \`this\` and reads the field each time.

\`\`\`java
int attempts = 0;
// wait.until(d -> { attempts++; return d.findElement(By.id("orders-loaded")).isDisplayed(); }); // compile error
AtomicInteger polls = new AtomicInteger();                // a final reference to a mutable holder
wait.until(d -> { polls.incrementAndGet(); return d.findElement(By.id("orders-loaded")).isDisplayed(); });
\`\`\`

The holder trick is fine for a counter in one thread; do not use it to accumulate results across a parallel stream (use a collector).

### Compilation: invokedynamic and LambdaMetafactory

| | Anonymous inner class | Lambda |
|---|---|---|
| Class file | \`Outer$1.class\` generated at compile time | **none** — javac emits a private synthetic method \`lambda$methodName$0\` holding the body |
| Creation | \`new Outer$1(...)\` every time | an \`invokedynamic\` call site; on first execution the bootstrap method \`LambdaMetafactory.metafactory\` spins an implementation class at runtime and links the call site |
| Later calls | constructor each time | linked call site; a **non-capturing** lambda typically returns the same cached instance, a capturing one creates a small object holding the captured values |
| \`this\` | the anonymous instance | the **enclosing** instance (lexical scope) |
| Shadowing | may redeclare enclosing locals | may **not** redeclare a local of the enclosing scope |
| State | can have fields | none of its own |

The runtime-generated classes are an implementation detail (in recent JDKs they are hidden classes); you only see them in stack traces and heap dumps. The practical consequences: lambdas are cheap to create, startup pays a small one-time linkage cost per call site, and \`this\` inside a lambda in a page object is the page object — which is usually what you want for \`this.driver\`.

\`\`\`java
public class InventoryPage {
    private final WebDriver driver;
    public InventoryPage(WebDriver driver) { this.driver = driver; }

    public Runnable sortBy(String value) {
        return () -> new Select(driver.findElement(By.id("product-sort"))).selectByValue(value); // this = InventoryPage
    }
}
\`\`\`

### Method references — four kinds

| Kind | Syntax | Equivalent lambda | Reads better when |
|---|---|---|---|
| Static | \`Integer::parseInt\` | \`s -> Integer.parseInt(s)\` | a pure conversion/utility |
| Bound instance (specific object) | \`driver::findElement\`, \`System.out::println\` | \`by -> driver.findElement(by)\` | calling one method on an object you already have |
| Unbound instance (arbitrary object of a type) | \`String::trim\`, \`WebElement::getText\`, \`Product::price\` | \`s -> s.trim()\` | the first parameter is the receiver — extractors in \`map\`/\`comparing\` |
| Constructor | \`ArrayList::new\`, \`Product[]::new\` | \`() -> new ArrayList<>()\` | factories in \`toCollection\`, \`groupingBy\`, \`toArray\` |

Prefer a method reference when it is **shorter and names the intent** (\`map(WebElement::getText)\`). Prefer a lambda when the reference is ambiguous (overloads such as \`Integer::toString\` can fail to compile), when it needs extra arguments, or when the reference hides what is going on (\`this::process\` from five classes away). Subtle difference: a **bound** reference evaluates its receiver **when the reference is created** — \`driver::getTitle\` throws \`NullPointerException\` immediately if \`driver\` is null, while \`() -> driver.getTitle()\` fails only when called, and reads the field's current value then.

## Built-in functional interfaces

| Interface | Method | Shape | Automation example |
|---|---|---|---|
| \`Function<T,R>\` | \`apply\` | T → R | \`WebElement::getText\`, parse a price |
| \`BiFunction<T,U,R>\` | \`apply\` | (T, U) → R | \`(driver, locator) -> driver.findElements(locator)\` |
| \`Supplier<T>\` | \`get\` | () → T | lazy test data, \`() -> driver.getCurrentUrl()\` |
| \`Consumer<T>\` | \`accept\` | T → void | \`WebElement::click\`, log a response |
| \`BiConsumer<T,U>\` | \`accept\` | (T, U) → void | \`map.forEach((k, v) -> ...)\` |
| \`Predicate<T>\` | \`test\` | T → boolean | \`Product::inStock\` |
| \`BiPredicate<T,U>\` | \`test\` | (T, U) → boolean | expected vs actual comparison rule |
| \`UnaryOperator<T>\` | \`apply\` | T → T | \`String::trim\`, normalise text |
| \`BinaryOperator<T>\` | \`apply\` | (T, T) → T | \`BigDecimal::add\` in \`reduce\`, merge functions |
| \`Runnable\` / \`Callable<V>\` | \`run\` / \`call\` | () → void / () → V **throws Exception** | executor tasks |

**Primitive specialisations** avoid boxing: \`IntPredicate\`, \`IntFunction<R>\`, \`ToIntFunction<T>\`, \`ToDoubleFunction<T>\`, \`IntUnaryOperator\`, \`IntBinaryOperator\`, \`IntSupplier\`, \`BooleanSupplier\`, \`ObjIntConsumer<T>\`, and the \`Long\`/\`Double\` variants. \`Comparator.comparingInt(Product::stock)\` uses \`ToIntFunction\` for this reason.

### Composition

\`\`\`java
Function<String, String> clean = String::trim;
Function<String, BigDecimal> parsePrice = clean.andThen(s -> s.replace("$", "")).andThen(BigDecimal::new);
// f.compose(g) = f(g(x)) — g runs FIRST; f.andThen(g) = g(f(x)) — f runs first

Predicate<Product> inStock = Product::inStock;
Predicate<Product> clothing = p -> p.category().equals("clothing");
Predicate<Product> sellableClothing = inStock.and(clothing);
Predicate<Product> notClothing = clothing.negate();          // or Predicate.not(clothing) — Java 11+
Predicate<Product> clothingOrCheap = clothing.or(p -> p.price().compareTo(BigDecimal.TEN) < 0);
\`\`\`

\`and\`/\`or\` short-circuit like \`&&\`/\`||\`. Composed predicates are great for **named, reusable filters** in a test-data layer: \`products(where(inStock.and(clothing)))\` reads like the test case.

## Custom functional interfaces for test helpers

The JDK interfaces cannot throw checked exceptions — \`Supplier.get()\` declares none. Test code calls APIs that do (\`IOException\` from \`HttpClient.send\`, \`InterruptedException\`). Wrapping each call in try/catch defeats the point, so define your own:

\`\`\`java
@FunctionalInterface
public interface ThrowingSupplier<T> {
    T get() throws Exception;
}
\`\`\`

### Complete example: retry and waitUntil helpers

\`\`\`java
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Predicate;
import java.util.function.Supplier;

public final class Retry {
    private Retry() { }

    @FunctionalInterface
    public interface ThrowingSupplier<T> {
        T get() throws Exception;
    }

    /** Runs action up to 'attempts' times; retries only exceptions the caller declares retryable. */
    public static <T> T retry(ThrowingSupplier<? extends T> action,
                              int attempts,
                              Duration delay,
                              Predicate<? super Exception> retryable) {
        if (attempts < 1) throw new IllegalArgumentException("attempts must be >= 1");
        Objects.requireNonNull(action, "action");
        Exception last = null;
        for (int i = 1; i <= attempts; i++) {
            try {
                return action.get();
            } catch (Exception e) {
                if (!retryable.test(e)) {
                    throw new IllegalStateException("Non-retryable failure on attempt " + i, e);
                }
                last = e;
                if (i < attempts) sleep(delay);
            }
        }
        throw new IllegalStateException("Failed after " + attempts + " attempts", last);
    }

    /** Polls a condition until true or timeout; returns how long it took. */
    public static Duration waitUntil(BooleanSupplier condition, Duration timeout, Duration poll,
                                     Supplier<String> describe) {
        Instant start = Instant.now();
        Instant deadline = start.plus(timeout);
        while (true) {
            if (condition.getAsBoolean()) return Duration.between(start, Instant.now());
            if (Instant.now().isAfter(deadline)) {
                throw new AssertionError("Timed out after " + timeout.toMillis() + " ms waiting for: " + describe.get());
            }
            sleep(poll);
        }
    }

    private static void sleep(Duration d) {
        try {
            Thread.sleep(d.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();                  // restore the flag, then stop
            throw new IllegalStateException("Interrupted while waiting", e);
        }
    }
}
\`\`\`

Usage in an API test:

\`\`\`java
HttpResponse<String> res = Retry.retry(
        () -> client.send(HttpRequest.newBuilder(URI.create("http://localhost:5181/api/products?sort=lohi")).build(),
                          HttpResponse.BodyHandlers.ofString()),           // throws IOException, InterruptedException
        3, Duration.ofMillis(500),
        e -> e instanceof java.net.ConnectException);                          // retry only "server not up yet"

Retry.waitUntil(() -> cartBadgeCount() == 1, Duration.ofSeconds(5), Duration.ofMillis(200),
                () -> "cart badge = 1, was " + cartBadgeCount());
\`\`\`

**Step by step:**
- \`ThrowingSupplier<? extends T>\` — lets a \`ThrowingSupplier<HttpResponse<String>>\` satisfy \`T = HttpResponse<String>\` and allows the lambda to throw checked exceptions.
- \`Predicate<? super Exception> retryable\` — the caller states **what** is transient. Blindly retrying \`AssertionError\` or \`NoSuchElementException\` caused by a wrong locator turns a 1-second failure into a 30-second one and hides bugs.
- The last exception is chained as the **cause**, so the report shows the real root failure (see the *Exceptions* lesson).
- \`BooleanSupplier\` instead of \`Supplier<Boolean>\` — no boxing and no possible \`null\` (a \`Supplier<Boolean>\` returning null would throw NPE on unboxing in \`if\`).
- \`Supplier<String> describe\` — the message is built **lazily**, only on failure, and can include the current value.
- \`InterruptedException\` restores the interrupt flag — essential when TestNG's \`timeOut\` interrupts the thread.

### Approaches to waiting/retrying compared

| | Hand-written \`retry\`/\`waitUntil\` | Selenium \`WebDriverWait\`/\`FluentWait\` | Awaitility | Failsafe / Resilience4j |
|---|---|---|---|---|
| How it works | loop + functional interfaces | polls a \`Function<WebDriver, T>\` (\`ExpectedCondition\` extends it in Selenium 4) | fluent DSL over a \`Callable\`/condition | policies (retry, backoff, circuit breaker) |
| Advantages | no dependency, fully understood | built-in, ignores listed exceptions, good messages | rich: \`atMost\`, \`pollInterval\`, \`untilAsserted\` | production-grade backoff/jitter |
| Disadvantages | you own edge cases (interrupts, messages) | tied to a driver | another dependency | heavy for test code |
| Maintainability | good if small and tested | good | very good | good |
| When to use | API/DB polling in a small framework | UI conditions | async back-end checks (queues, emails, DB rows) | client libraries, not tests |

**Recommended:** \`WebDriverWait\` for UI state, Awaitility (or one small, unit-tested \`waitUntil\`) for non-UI polling, and a retry helper only for **known transient** failures with an explicit retryable predicate.

## Streams internals

### Source → lazy intermediate ops → terminal op

A stream pipeline is a linked chain of stages. Intermediate operations (\`filter\`, \`map\`, \`sorted\`) only **describe** work; nothing runs until a terminal operation (\`collect\`, \`forEach\`, \`count\`, \`findFirst\`, \`anyMatch\`, \`reduce\`) pulls elements through. Stages are **fused**: each element travels through the whole chain before the next element starts (vertical processing), not stage by stage over the whole list.

\`\`\`java
List<String> firstTwoCheap = products.stream()
        .peek(p -> System.out.println("source  " + p.name()))
        .filter(p -> p.price().compareTo(new BigDecimal("20")) < 0)
        .peek(p -> System.out.println("passed  " + p.name()))
        .map(Product::name)
        .limit(2)
        .toList();
// source  Trailblazer Backpack
// source  Pulse Bike Light
// passed  Pulse Bike Light
// source  Classic Crew T-Shirt
// passed  Classic Crew T-Shirt          <- limit reached: Storm, Junior, Retro are never read
\`\`\`

- **Short-circuiting** ops — \`limit\`, \`findFirst\`, \`findAny\`, \`anyMatch\`, \`allMatch\`, \`noneMatch\`, \`takeWhile\` (Java 9+) — stop pulling once the answer is known. \`anyMatch\` on an empty stream is \`false\`; \`allMatch\` on an empty stream is **\`true\`** (vacuous truth) — an empty product list "passes" an all-in-stock check. Always assert the size first.
- **Stateless** ops (\`filter\`, \`map\`, \`flatMap\`, \`peek\`) handle each element independently. **Stateful** ops need to see other elements: \`distinct\` keeps a seen-set (O(n) memory), \`sorted\` is a **full barrier** — it buffers everything, sorts, then emits. \`sorted().findFirst()\` still sorts the whole stream (use \`min(comparator)\` instead, O(n)).
- **One use only**: a stream is consumed by its terminal op. Reusing it throws \`IllegalStateException: stream has already been operated upon or closed\`. Keep a \`Supplier<Stream<T>>\` or, better, the source collection.
- **Non-interference**: never modify the source collection inside the pipeline — undefined behaviour or \`ConcurrentModificationException\`.

### Syntax overview

| Group | Operations |
|---|---|
| Sources | \`collection.stream()\`, \`Stream.of\`, \`Arrays.stream\`, \`IntStream.range\`, \`Files.lines\` (close it!), \`Stream.iterate(seed, hasNext, next)\` (Java 9+), \`Pattern.splitAsStream\` |
| Intermediate | \`filter\`, \`map\`, \`mapToInt/Double/Obj\`, \`flatMap\`, \`mapMulti\` (Java 16+), \`distinct\`, \`sorted\`, \`peek\`, \`limit\`, \`skip\`, \`takeWhile\`/\`dropWhile\` (Java 9+), \`boxed\` |
| Terminal | \`collect\`, \`toList()\` (Java 16+), \`forEach\`, \`reduce\`, \`count\`, \`min\`/\`max\`, \`findFirst\`/\`findAny\`, \`anyMatch\`/\`allMatch\`/\`noneMatch\`, \`toArray\`, \`sum\`/\`average\`/\`summaryStatistics\` (primitive streams) |

## Collectors in depth

### toList variants

| | Mutability | Nulls | Version |
|---|---|---|---|
| \`collect(Collectors.toList())\` | **no guarantee** (an \`ArrayList\` in practice — mutable) | allowed | Java 8 |
| \`collect(Collectors.toUnmodifiableList())\` | unmodifiable | **NPE** on null | Java 10+ |
| \`stream.toList()\` | unmodifiable | allowed | Java 16+ |
| \`collect(Collectors.toCollection(ArrayList::new))\` | explicitly mutable \`ArrayList\` | allowed | Java 8 |

If you need to mutate the result, say so with \`toCollection\`; otherwise prefer \`toList()\`. Migrating \`collect(Collectors.toList())\` to \`toList()\` blindly can break code that later calls \`add\` on the result.

### Complete example: product analytics for assertions

\`\`\`java
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

import static java.util.stream.Collectors.*;

public class ProductStats {
    public static void main(String[] args) {
        List<Product> products = List.of(
            new Product(1, "Trailblazer Backpack", new BigDecimal("29.99"), "bags", 25),
            new Product(2, "Pulse Bike Light",     new BigDecimal("9.99"),  "accessories", 40),
            new Product(3, "Classic Crew T-Shirt", new BigDecimal("15.99"), "clothing", 60),
            new Product(4, "Storm Fleece Jacket",  new BigDecimal("49.99"), "clothing", 12),
            new Product(5, "Junior Onesie",        new BigDecimal("7.99"),  "kids", 30),
            new Product(6, "Retro Red Tee",        new BigDecimal("15.99"), "clothing", 0));

        // 1. count per category, sorted keys for a stable report
        Map<String, Long> countByCategory = products.stream()
            .collect(groupingBy(Product::category, TreeMap::new, counting()));
        // {accessories=1, bags=1, clothing=3, kids=1}

        // 2. names per category (downstream mapping)
        Map<String, List<String>> namesByCategory = products.stream()
            .collect(groupingBy(Product::category, mapping(Product::name, toList())));

        // 3. stock per category (int sum, no floating point)
        Map<String, Integer> stockByCategory = products.stream()
            .collect(groupingBy(Product::category, summingInt(Product::stock)));
        // clothing = 72

        // 4. inventory value per category with BigDecimal (summingDouble would introduce rounding error)
        Map<String, BigDecimal> valueByCategory = products.stream()
            .collect(groupingBy(Product::category,
                     reducing(BigDecimal.ZERO, (Product p) -> p.price().multiply(BigDecimal.valueOf(p.stock())), BigDecimal::add)));

        // 5. in stock vs out of stock - always both keys
        Map<Boolean, List<String>> byAvailability = products.stream()
            .collect(partitioningBy(Product::inStock, mapping(Product::name, toList())));
        // {false=[Retro Red Tee], true=[...5 names]}

        // 6. lookup by name; duplicate names would throw, so state the merge rule
        Map<String, BigDecimal> priceByName = products.stream()
            .collect(toMap(Product::name, Product::price, (a, b) -> {
                throw new IllegalStateException("Duplicate product name with prices " + a + " and " + b);
            }, LinkedHashMap::new));

        // 7. one price per category, keeping the cheapest
        Map<String, BigDecimal> cheapestByCategory = products.stream()
            .collect(toMap(Product::category, Product::price, BigDecimal::min));

        // 8. a report line
        String csv = products.stream().map(Product::name).collect(joining(", ", "[", "]"));

        // 9. two results in one pass: min and max price (Java 12+)
        record Range(BigDecimal min, BigDecimal max) { }
        Range range = products.stream().map(Product::price)
            .collect(teeing(minBy(Comparator.<BigDecimal>naturalOrder()), maxBy(Comparator.<BigDecimal>naturalOrder()),
                            (mn, mx) -> new Range(mn.orElseThrow(), mx.orElseThrow())));

        System.out.println(countByCategory + "\\n" + namesByCategory + "\\n" + stockByCategory + "\\n"
            + valueByCategory + "\\n" + byAvailability + "\\n" + priceByName + "\\n"
            + cheapestByCategory + "\\n" + csv + "\\n" + range);
    }
}
\`\`\`

**Step by step:**
- \`groupingBy(classifier, mapFactory, downstream)\` — the default map is a \`HashMap\` with **no order**; \`TreeMap::new\` makes reports and assertions deterministic. The default downstream is \`toList()\`.
- \`mapping\`, \`counting\`, \`summingInt\`, \`reducing\` are **downstream collectors** applied within each group. \`counting()\` yields \`Long\`. (\`Collectors.filtering\` and \`flatMapping\`, Java 9+, filter/flatten inside a group.)
- **Money**: \`summingDouble\`/\`averagingDouble\` on prices produce values like \`41.959999999999994\`. Use \`BigDecimal\` with \`reducing\`/\`reduce\`, or sum integer cents.
- \`partitioningBy\` always returns both \`true\` and \`false\` keys — better than \`groupingBy(p -> p.inStock())\` when you assert on "the out-of-stock list is exactly [Retro Red Tee]".
- \`toMap\` **without** a merge function throws on duplicate keys: \`IllegalStateException: Duplicate key clothing (attempted merging values 15.99 and 49.99)\` (message format of Java 9+). It also throws \`NullPointerException\` if a **value** is null, because it is built on \`Map.merge\`. In tests, a duplicate is often a **bug to report**, so an explicit throwing merge function with a clear message is better than silently keeping one.
- \`teeing\` (Java 12+) feeds every element to two collectors and merges their results — one pass instead of streaming twice.

### flatMap, reduce vs collect

\`\`\`java
// flatMap: one-to-many. All order line names across several API cart responses:
List<String> allItems = carts.stream()
        .flatMap(cart -> cart.items().stream())
        .map(Item::name)
        .distinct()
        .toList();

// reduce: combine IMMUTABLE values
BigDecimal total = products.stream().map(Product::price).reduce(BigDecimal.ZERO, BigDecimal::add);

// collect: accumulate into a MUTABLE container
StringBuilder sb = products.stream().map(Product::name)
        .collect(StringBuilder::new, (b, s) -> b.append(s).append('|'), StringBuilder::append);
\`\`\`

\`reduce(identity, accumulator)\` creates a new value per step — ideal for \`BigDecimal\`, \`Integer\`, \`String\` concatenation of few items. Using \`reduce\` to add into a mutable \`ArrayList\` is wrong (and breaks in parallel); that is what \`collect\` is for. The identity must be a true identity for the combiner (\`ZERO\` for add) or parallel results will be wrong.

### Primitive streams and boxing cost

\`Stream<Integer>\` holds \`Integer\` objects; \`IntStream\` holds \`int\`s. \`products.stream().map(Product::stock).reduce(0, Integer::sum)\` boxes and unboxes each value; \`mapToInt(Product::stock).sum()\` does not. For 6 products it is irrelevant; for 1 million log lines or response times it is a large difference in allocation and GC. Primitive streams also give \`sum()\`, \`average()\` (returns \`OptionalDouble\`) and \`summaryStatistics()\` (count/min/max/avg in one pass — handy for response-time assertions). \`boxed()\` converts back when you need a \`List<Integer>\`.

### Real-time scenario: table rows from table.html

\`\`\`java
record Employee(String name, String department, int salary, String status) { }

List<Employee> rows = driver.findElements(By.cssSelector("#employee-table tbody tr")).stream()
        .map(tr -> tr.findElements(By.tagName("td")))
        .filter(tds -> tds.size() >= 4)                                      // skip "No employees match" row
        .map(tds -> new Employee(tds.get(0).getText(), tds.get(1).getText(),
                                 Integer.parseInt(tds.get(2).getText().replaceAll("[$,]", "")),
                                 tds.get(3).getText()))
        .toList();

Map<String, IntSummaryStatistics> salaryByDept = rows.stream()
        .collect(Collectors.groupingBy(Employee::department, TreeMap::new,
                                       Collectors.summarizingInt(Employee::salary)));

List<Employee> offenders = rows.stream()
        .filter(e -> !e.status().matches("Active|Inactive|On Leave"))
        .toList();
assertTrue(offenders.isEmpty(), "Unexpected status values: " + offenders);
\`\`\`

The UI is paginated (5 rows per page), so this reads **one page**; reading all pages is a loop around \`#next-page\` — imperative by nature, then streams on the collected data. Note the pattern: **read the DOM once into records, then compute on plain data** — fast, no stale elements, and the same assertions work on API data.

## Parallel streams

\`parallelStream()\` / \`.parallel()\` splits the source with a \`Spliterator\` and runs chunks on the **ForkJoinPool common pool** (default parallelism = available processors − 1, plus the calling thread). Results are combined with the collector's combiner.

| Helps when | Hurts when |
|---|---|
| large data (100k+ elements), CPU-bound per-element work | small collections — split/merge overhead dominates |
| source splits well (\`ArrayList\`, arrays, \`IntStream.range\`) | poor splitting (\`LinkedList\`, \`Stream.iterate\`, I/O lines) |
| stateless, independent operations, associative reduce | stateful ops (\`sorted\`, \`distinct\`, \`limit\` with ordering) or shared mutable state |
| | **blocking I/O** — it occupies common-pool threads every other parallel stream and \`CompletableFuture\` default tasks share |

**Why not with WebDriver:** a \`WebDriver\` session is not thread-safe and the browser executes one command at a time, so \`elements.parallelStream().map(WebElement::getText)\` sends concurrent commands to one session (errors or no speed-up), blocks common-pool threads on HTTP calls to the driver, and makes failures non-deterministic. Parallelise at the **test runner** level (TestNG \`parallel="methods"\` with one driver per thread via \`ThreadLocal\`), or read the DOM once with a single \`executeScript\` that returns all texts.

Also: \`forEach\` on a parallel stream has **no order**; use \`forEachOrdered\` if order matters (which removes most of the benefit). Collecting into a shared \`ArrayList\` from a parallel \`forEach\` loses elements or throws \`ArrayIndexOutOfBoundsException\` — always \`collect\`.

## Optional best practices

\`\`\`java
public Optional<Product> findByName(List<Product> all, String name) {
    return all.stream().filter(p -> p.name().equals(name)).findFirst();
}

BigDecimal price = findByName(all, "Retro Red Tee")
        .map(Product::price)
        .orElseThrow(() -> new AssertionError("Retro Red Tee missing from API response"));

String category = findByName(all, "Gift Card")
        .map(Product::category)
        .orElse("unknown");                               // eager: argument always evaluated
Product fallback = findByName(all, "Gift Card")
        .orElseGet(() -> loadFromDb("Gift Card"));       // lazy: only on empty
\`\`\`

| Do | Don't |
|---|---|
| Return \`Optional<T>\` from lookups that may legitimately find nothing | use it for fields, method parameters or collection elements (not \`Serializable\`, adds allocation, forces callers to wrap) |
| \`map\`/\`flatMap\`/\`filter\` to transform, \`flatMap\` when the mapper itself returns \`Optional\` | \`opt.isPresent() ? opt.get() : null\` — that is null with extra steps |
| \`orElseThrow(...)\` with a descriptive error in tests; \`orElseThrow()\` (Java 10+) as the named replacement for \`get()\` | \`Optional.get()\` without a check — fails with "No value present" and no context |
| \`orElseGet(supplier)\` when the default is expensive | \`orElse(expensiveCall())\` — runs the call even when a value exists |
| return an empty collection, not \`Optional<List<T>>\` | \`Optional.of(x)\` when \`x\` may be null — use \`ofNullable\` |
| \`ifPresentOrElse\`, \`or\`, \`stream()\` (Java 9+), \`isEmpty()\` (Java 11+) | compare Optionals with \`==\` |

## Loops vs streams

\`\`\`java
// Loop
BigDecimal total = BigDecimal.ZERO;
for (Product p : products) {
    if (p.inStock() && p.category().equals("clothing")) total = total.add(p.price());
}
// Stream
BigDecimal total2 = products.stream()
        .filter(Product::inStock).filter(p -> p.category().equals("clothing"))
        .map(Product::price).reduce(BigDecimal.ZERO, BigDecimal::add);
\`\`\`

| | Loop | Stream |
|---|---|---|
| Readability | best for multi-step logic with branches, early \`return\`, \`break\`, index access, try/catch | best for declarative "filter → transform → aggregate", grouping, joining |
| Checked exceptions | natural | awkward — wrapping or custom interfaces needed |
| Performance | slightly faster for tiny collections; no lambda/pipeline overhead | similar for typical sizes; primitive streams avoid boxing; parallelism possible (rarely appropriate in tests) |
| Debugging | step through, inspect locals easily | breakpoints inside lambdas, \`peek\`, IntelliJ stream trace; deeper stack traces |
| Mutation | can modify outer state | should be side-effect free |
| Maintainability | grows into long methods | composes small named predicates/functions |
| Scalability | manual | \`groupingBy\`/\`teeing\` express complex aggregations concisely |

**Recommended:** streams for **data transformation and aggregation** on collected data (API responses, table rows, test-data sets); loops for **interaction sequences** (paginating, clicking, waiting, retrying) and anything with checked exceptions or early exits. Mixed is normal: loop over pages to collect rows, stream over rows to assert. A senior answer is "whichever reads like the requirement", not "streams are modern".

## Debugging streams

- **\`peek\`** — exists "mainly to support debugging". It runs only for elements that actually flow (laziness), and may not run at all: since Java 9, \`count()\` can skip the pipeline when the size is known from the source (\`List.of(...).stream().peek(...).count()\` prints nothing). Never put logic in \`peek\`.
- **IntelliJ Stream Trace** — in the debugger, stop on a stream line and use *Trace Current Stream Chain*: it shows each stage's elements side by side (flat or split mode).
- **Breakpoints in lambdas** — IntelliJ asks whether to stop on the line or inside a lambda on that line; choose the lambda.
- **Stack traces** show the synthetic method and pipeline plumbing:

\`\`\`
java.lang.NumberFormatException: Character $ is neither a decimal digit number, ...
    at java.base/java.math.BigDecimal.<init>(BigDecimal.java:...)
    at ProductPage.lambda$prices$0(ProductPage.java:42)          <- your lambda, line 42
    at java.base/java.util.stream.ReferencePipeline$3$1.accept(ReferencePipeline.java:...)
    at java.base/java.util.ArrayList$ArrayListSpliterator.forEachRemaining(...)
    ...
    at ProductPage.prices(ProductPage.java:44)                    <- the terminal operation
\`\`\`

Read it as: \`lambda$prices$0\` = first lambda in method \`prices\`; the frame line number points at the lambda body; the last "your code" frame is the terminal op. Extracting complex lambdas into **named private methods** (\`map(this::parsePrice)\`) gives readable frames and unit-testable logic.

## Common mistakes and debugging

- **\`IllegalStateException: stream has already been operated upon or closed\`** — a stream stored in a field or variable and consumed twice. Store the collection; create a new stream per use.
- **\`IllegalStateException: Duplicate key …\`** from \`toMap\` — two elements share a key; decide whether that is a data bug (assert) or needs a merge function.
- **\`UnsupportedOperationException\` after migrating to \`.toList()\`** — downstream code mutates the result; use \`toCollection(ArrayList::new)\`.
- **A filter that "never runs"** — no terminal operation; or side effects in \`peek\`/\`map\` that you expected to happen.
- **\`allMatch\` passes on an empty page** — vacuous truth; assert non-empty first, and prefer "collect offenders and assert empty" for useful messages.
- **Checked exception inside a lambda won't compile** — use a \`ThrowingSupplier\`/\`ThrowingFunction\` adapter that wraps into an unchecked exception **with the cause**, or a loop.
- **Flaky results with \`parallelStream\`** — shared mutable state or WebDriver calls; remove \`parallel\` and check for side effects.

## Best practices for experienced engineers

- Keep lambdas short; promote anything over ~3 lines to a named method and use a method reference.
- Pipelines should be **side-effect free**: no writes to external lists, no WebDriver clicks inside \`map\`.
- Name reusable predicates/functions in the test-data layer (\`IN_STOCK\`, \`CLOTHING\`) and compose them.
- Use \`BooleanSupplier\`/primitive streams to avoid boxing and nulls; \`BigDecimal\` with \`reduce\` for money.
- Make the order of results explicit (\`TreeMap::new\`, \`LinkedHashMap::new\`, \`sorted\`) whenever the result is asserted or reported.
- \`Optional\` only as a return type; fail fast in tests with \`orElseThrow\` and a message.
- Parallelism belongs in the test runner, not in streams over browser elements.

## Interview questions

### Q: How is a lambda different from an anonymous inner class under the hood?
**Short answer (30–60 s):** An anonymous class compiles to its own class file and is instantiated with \`new\`. A lambda's body becomes a private synthetic method in the enclosing class, and the lambda expression compiles to an \`invokedynamic\` instruction; on first execution \`LambdaMetafactory\` generates an implementation of the functional interface at runtime and links the call site. Also, \`this\` in a lambda is the enclosing instance.

**Detailed answer:** Non-capturing lambdas can be cached as a single instance; capturing ones allocate a small object with the captured values. Lambdas cannot shadow enclosing locals and have no state. This design lets the JVM change the translation strategy without recompiling code. In stack traces they appear as \`lambda$method$N\`.

### Q: Why must captured local variables be effectively final?
**Short answer (30–60 s):** The lambda copies the value; it may run later or on another thread after the method's stack frame is gone. Allowing reassignment would make the copy and the variable diverge silently and invite data races, so Java forbids it.

**Detailed answer:** Fields are read through \`this\` and can change — which is exactly why shared mutable fields in parallel code are dangerous. The \`AtomicInteger\`/array-holder workaround compiles but is a code smell in pipelines; use collectors or return values.

### Q: Explain lazy evaluation and short-circuiting in streams, with an example where it matters.
**Short answer (30–60 s):** Intermediate operations only build the pipeline; the terminal op pulls elements one by one through all fused stages. \`filter(...).findFirst()\` stops at the first match, so expensive mapping (e.g. parsing every row) is done only as far as needed.

**Detailed answer:** Show the \`peek\` output with \`limit(2)\`. Contrast with \`sorted\`, a stateful barrier that consumes everything first; \`sorted().findFirst()\` vs \`min()\`. Mention \`allMatch\` on empty = true, and that \`count()\` may skip the pipeline on Java 9+.

### Q: \`Collectors.toList()\` vs \`toUnmodifiableList()\` vs \`Stream.toList()\`?
**Short answer (30–60 s):** \`Collectors.toList()\` makes no mutability guarantee (an ArrayList in practice); \`toUnmodifiableList()\` (Java 10+) is unmodifiable and rejects nulls; \`Stream.toList()\` (Java 16+) is unmodifiable and allows nulls.

**Detailed answer:** Prefer \`toList()\` for results you assert on; use \`toCollection(ArrayList::new)\` when you intend to mutate. Migrating blindly can introduce \`UnsupportedOperationException\` at runtime.

### Q: What happens with duplicate keys in \`Collectors.toMap\`, and how do you design for it?
**Short answer (30–60 s):** It throws \`IllegalStateException: Duplicate key\`. Pass a merge function (e.g. \`BigDecimal::min\`, \`(a, b) -> a\`) if duplicates are legitimate, or keep the exception — with a clear message — if a duplicate means bad data.

**Detailed answer:** Also mention null values cause NPE, the fourth argument for a map factory (\`LinkedHashMap::new\`, \`TreeMap::new\`), and that \`groupingBy\` is the right tool when you want all values per key.

### Q: When would you use a parallel stream in a test framework?
**Short answer (30–60 s):** Rarely: only for CPU-bound processing of large in-memory data, e.g. validating a 500k-line export or comparing large datasets. Never for WebDriver calls or blocking I/O, because they share the ForkJoin common pool, WebDriver sessions are not thread-safe, and the bottleneck is the browser anyway.

**Detailed answer:** Explain splitting, the common pool (processors − 1), ordering costs (\`forEachOrdered\`), stateful ops, measuring before/after, and that test-level parallelism (TestNG/JUnit with per-thread drivers) gives the real speed-up.

### Q: What are the Optional best practices you enforce in code review?
**Short answer (30–60 s):** Return type only for "may be absent" lookups; never fields or parameters; no bare \`get()\`; \`orElseThrow\` with a message in tests; \`orElseGet\` for expensive defaults; \`map/flatMap\` for chaining; empty collections instead of \`Optional<List>\`.

**Detailed answer:** Explain the \`orElse\` eager-evaluation trap with a DB or API call, \`Optional.of\` vs \`ofNullable\`, and that Optional is not a general null-replacement — the goal is an honest API signature.

### Q: Design a retry helper using functional interfaces. What would you be careful about?
**Short answer (30–60 s):** A generic \`<T> T retry(ThrowingSupplier<T>, attempts, delay, Predicate<Exception> retryable)\`: loop, return on success, retry only declared transient exceptions, sleep between attempts, and throw with the last exception as the cause.

**Detailed answer:** Custom interface for checked exceptions; restore the interrupt flag; don't retry assertion failures or wrong-locator errors; log attempts; bound total time; prefer the framework's mechanisms (WebDriverWait, Awaitility) for waiting on state; and unit-test the helper itself (succeeds on attempt 3, non-retryable fails fast, cause preserved).

## Scenario-based questions

**1. A teammate replaced all loops in the checkout page object with streams; reviews are slower and a failure trace now shows only \`lambda$fillForm$3\`.** I'd keep streams where they transform data (reading the order summary into records) and revert interaction sequences (fill field, wait, click) to plain loops or straight-line code — they have side effects, checked exceptions and need clear step-by-step traces. Long lambdas become named methods so traces read \`fillAddress\` instead of \`lambda$fillForm$3\`.

**2. A nightly data check on 2 million exported order lines takes 40 minutes; someone proposes \`parallelStream()\` everywhere.** I'd profile first: if the time is in parsing (CPU-bound) and the source is a list or array, \`parallel()\` on that one pipeline may help; if it is in reading the file or DB, parallel streams won't help and will tie up the common pool. Use \`mapToDouble\`/\`IntStream\` to avoid boxing, \`groupingByConcurrent\` or proper collectors (never shared lists), and measure before and after.

**3. An API test uses \`toMap(Product::name, Product::price)\` and starts failing with "Duplicate key" after a catalogue release.** That is the test doing its job: two products now share a name. I'd check whether duplicate names are allowed by the product rules. If not, it's a bug — keep the failure, improve the message. If yes, the test's key was wrong: key by \`id\` or \`slug\`, or group with \`groupingBy(name)\`.

## Tricky follow-ups

- **Does \`List.of(1, 2, 3).stream().peek(System.out::println).count()\` print anything?** Not on Java 9+ — \`count()\` can compute the size from the source and skip the pipeline.
- **Can a lambda throw a checked exception?** Only if the functional interface's method declares it (\`Callable.call() throws Exception\`, or your own \`ThrowingSupplier\`).
- **Is \`Supplier<Boolean>\` the same as \`BooleanSupplier\`?** No — the first boxes and can return null (NPE when unboxed); the second returns a primitive.
- **What does \`f.compose(g)\` do?** Runs \`g\` first, then \`f\`: \`f(g(x))\`. \`andThen\` is the reverse order.
- **Is \`driver::getTitle\` identical to \`() -> driver.getTitle()\`?** Not quite: the bound reference evaluates \`driver\` immediately (NPE now if null, and later reassignments of the field are not seen); the lambda reads it each call.`,
  keyPoints: [
    'A lambda gets its type from the target functional interface (one abstract method); captured locals must be effectively final; this means the enclosing instance.',
    'Lambdas compile to a private synthetic method plus an invokedynamic call site linked by LambdaMetafactory at first use — no class file per lambda, unlike anonymous classes.',
    'Know the java.util.function families and primitive specialisations; compose with andThen/compose and Predicate.and/or/negate; define ThrowingSupplier-style interfaces for checked exceptions in helpers.',
    'Streams are lazy and fused: the terminal op pulls each element through all stages; short-circuiting ops stop early; sorted/distinct are stateful; a stream is single-use.',
    'Collectors: groupingBy with a map factory and downstream (counting, mapping, summingInt, reducing), partitioningBy for two-way splits, toMap needs a merge function for duplicates and rejects null values, teeing (Java 12+) for two results in one pass; BigDecimal for money.',
    'Stream.toList() (Java 16+) is unmodifiable and allows nulls; Collectors.toList() has no mutability guarantee; toUnmodifiableList() (Java 10+) rejects nulls.',
    'Parallel streams use the shared ForkJoin common pool — only for large CPU-bound in-memory work, never for WebDriver or blocking I/O.',
    'Optional is a return type for absent-able lookups: orElseThrow with a message, orElseGet for expensive defaults, never get() unchecked, never fields/params. Use streams for data, loops for interaction sequences.',
  ],
  mistakes: [
    'Blind retry helpers that catch every exception, turning a wrong-locator failure into a 30-second retry loop. Fix: pass a retryable predicate (e.g. only ConnectException or StaleElementReferenceException), chain the last exception as the cause, and unit-test the helper.',
    'Using parallelStream() over List<WebElement> to "speed up" getText. Fix: read all texts with one executeScript call or a sequential stream; parallelise at the TestNG level with one driver per thread.',
    'Summing prices with summingDouble/mapToDouble and asserting equality with the cart subtotal. Fix: map to BigDecimal and reduce(BigDecimal.ZERO, BigDecimal::add), or work in integer cents; compare with compareTo.',
    'Asserting allMatch(Product::inStock) on a list that came back empty after a failed load. Fix: assert the expected size first and collect offenders into a list asserted empty, so the message names them.',
    'Calling Optional.get() or orElse(expensiveApiCall()) in test utilities. Fix: orElseThrow(() -> new AssertionError("…what was missing…")) and orElseGet for lazy defaults.',
    'Storing a Stream in a field and consuming it twice ("stream has already been operated upon or closed"). Fix: keep the source collection (or a Supplier<Stream<T>>) and create a fresh stream per use.',
  ],
  tryIt: `Call \`GET http://localhost:5181/api/products?size=50\` and map the JSON into \`List<Product>\` (record with \`BigDecimal price\`). Using streams only: (1) \`Map<String, Long>\` of products per category in a \`TreeMap\`; (2) \`Map<Boolean, List<String>>\` of names partitioned by \`stock > 0\` and assert the false side is exactly \`[Retro Red Tee]\`; (3) inventory value per category with \`BigDecimal\`; (4) min and max price in one pass with \`teeing\`; (5) \`toMap(Product::price, Product::name)\` — observe the duplicate-key failure for 15.99 and fix it twice (merge function, then \`groupingBy\`). Finally write \`waitUntil(BooleanSupplier, timeout, poll, Supplier<String>)\` and unit-test it with a condition that becomes true on the 3rd poll and one that never does, checking the failure message.`,
  problems: ['java-015', 'java-026', 'java-032', 'java-034', 'java-037'],
}
