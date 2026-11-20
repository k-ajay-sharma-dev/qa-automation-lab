export default {
  slug: 'java-deep-executors-completablefuture',
  category: 'java',
  order: 19,
  title: 'Deep dive: ExecutorService, Futures and CompletableFuture for test tooling',
  minutes: 30,
  summary: 'Build concurrent test tooling the senior way — bounded, named executors, Futures and CompletableFuture pipelines with timeouts and error handling, synchronizers and virtual threads — and explain why a WebDriver session must never be shared between threads.',
  manualAnalogy: `A test lead with 200 regression cases and four testers does not hire 200 people for the afternoon: a fixed team pulls cases from a queue, each tester reports pass or fail with evidence, the lead waits until every case is back (or a deadline passes), and only four people use the shared test environment at once. An \`ExecutorService\` is that team, a \`Future\` is the result slip each tester hands back, and a \`Semaphore\` is the rule "only six people on the Grid at a time".`,
  body: `## Where this lesson starts

The *multithreading* deep dive covered the low level: thread states, the Java Memory Model, locks, atomics and \`ThreadLocal\`. This lesson is about **running work concurrently without managing threads yourself**: the executor framework, \`Future\`, \`CompletableFuture\`, the synchronizers, and when virtual threads (Java 21) change the picture. The examples are tools an SDET actually writes: a concurrent link checker for the ShopEasy practice site, a parallel test-data seeder for the ShopEasy API on port 5181, and a parallel API smoke check with a summary.

Test parallelism itself (many test methods at once) belongs to the **test runner** — TestNG, JUnit 5, Cucumber, Selenium Grid. Executors are for the **tooling around and inside tests**: seeding data, checking hundreds of URLs, polling, fan-out API checks, warming up environments.

## Why not create raw threads

\`new Thread(task).start()\` in a loop looks simple and fails in practice:

| Problem | Effect in a tool or framework |
|---|---|
| **Cost** — each platform thread is an OS thread with its own stack | 2,000 links → 2,000 OS threads, memory spikes, the OS or the server under test refuses connections |
| **No reuse** — a thread runs one task and dies | thread creation dominates short tasks |
| **No bound** — nothing limits concurrency | you DoS your own test environment; rate limits (429) look like app failures |
| **No result handling** — \`run()\` returns \`void\`, cannot throw checked exceptions | results passed through shared lists (races), failures printed to stderr and lost |
| **No lifecycle** — nothing knows when "all done" or how to cancel | \`join()\` loops, orphan threads that keep the JVM alive |

The executor framework separates **what** to run (\`Runnable\`/\`Callable\`) from **how** it runs (pool size, queue, naming, shutdown) and gives every task a handle (\`Future\`) to its result or failure.

## The executor framework

| Type | Role |
|---|---|
| \`Executor\` | one method, \`execute(Runnable)\` — "run this somehow" |
| \`ExecutorService\` | adds lifecycle (\`shutdown\`, \`awaitTermination\`, \`shutdownNow\`, \`close\` in Java 19+) and \`submit\`/\`invokeAll\`/\`invokeAny\` returning \`Future\`s |
| \`ScheduledExecutorService\` | adds \`schedule\`, \`scheduleAtFixedRate\`, \`scheduleWithFixedDelay\` |
| \`ThreadPoolExecutor\` | the main implementation: core/max threads, a work queue, a thread factory, a rejection policy |
| \`ForkJoinPool\` | work-stealing pool behind parallel streams and \`CompletableFuture\`'s default executor |
| \`Executors\` | static factory methods for common configurations |

### Executors factory methods

| Factory | Underlying configuration | Good for | Risk |
|---|---|---|---|
| \`newFixedThreadPool(n)\` | \`ThreadPoolExecutor\`, core = max = n, **unbounded** \`LinkedBlockingQueue\` | bounded concurrency for a known workload | the queue grows without limit if producers outpace workers → memory, long tail latency |
| \`newCachedThreadPool()\` | core 0, max \`Integer.MAX_VALUE\`, idle threads die after 60 s, \`SynchronousQueue\` (no queue: hand-off or new thread) | many short tasks with low concurrency | **unbounded thread creation** under a burst of slow tasks (e.g. 2,000 slow HTTP calls → 2,000 threads) |
| \`newSingleThreadExecutor()\` | one thread, unbounded queue | strict ordering (e.g. a single writer to a report file) | queue growth; one slow task blocks the rest |
| \`newScheduledThreadPool(n)\` | \`ScheduledThreadPoolExecutor\` with n core threads, delay queue | polling, heartbeats, timeouts | periodic task that throws stops silently (see below) |
| \`newWorkStealingPool()\` (Java 8) | \`ForkJoinPool\` sized to available processors | CPU-bound divide-and-conquer | not meant for blocking I/O |
| \`newVirtualThreadPerTaskExecutor()\` (Java 21) | a new **virtual** thread per task, no pool | large numbers of blocking I/O tasks | unbounded concurrency — limit downstream load with a \`Semaphore\` |

### How ThreadPoolExecutor decides (and why teams configure it explicitly)

On each \`execute\`/\`submit\`, \`ThreadPoolExecutor\` does, in order:

1. fewer than **corePoolSize** threads? → start a new thread with this task;
2. otherwise try to **queue** the task;
3. queue full? → start a new thread if fewer than **maximumPoolSize**;
4. otherwise → **reject** with the \`RejectedExecutionHandler\`.

Consequence people miss: with an unbounded queue, step 3 never happens, so \`maximumPoolSize\` is ignored. Threads above core die after \`keepAliveTime\` idle (cores too with \`allowCoreThreadTimeOut(true)\`).

| Rejection policy | When the pool and queue are full |
|---|---|
| \`AbortPolicy\` (default) | throws \`RejectedExecutionException\` |
| \`CallerRunsPolicy\` | the submitting thread runs the task itself — natural back-pressure, slows the producer |
| \`DiscardPolicy\` | silently drops the task (almost never acceptable in testing) |
| \`DiscardOldestPolicy\` | drops the oldest queued task and retries |

Production-grade code (and serious test tooling) usually builds the pool explicitly so that every limit is visible in code review:

\`\`\`java
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public final class Pools {

    private Pools() { }

    /** Bounded pool: fixed size, bounded queue, named threads, back-pressure instead of OOM. */
    public static ThreadPoolExecutor bounded(String name, int threads, int queueCapacity) {
        AtomicInteger seq = new AtomicInteger(1);
        ThreadFactory factory = r -> {
            Thread t = new Thread(r, name + "-" + seq.getAndIncrement());
            t.setDaemon(false);
            t.setUncaughtExceptionHandler((th, ex) ->
                    System.err.println("Uncaught in " + th.getName() + ": " + ex));
            return t;
        };
        return new ThreadPoolExecutor(
                threads, threads,                         // core = max: a fixed pool
                30, TimeUnit.SECONDS,                     // keep-alive (only matters above core, or with allowCoreThreadTimeOut)
                new ArrayBlockingQueue<>(queueCapacity),  // bounded queue
                factory,
                new ThreadPoolExecutor.CallerRunsPolicy()); // queue full -> submitter runs the task = natural throttling
    }

    /** The shutdown idiom from the ExecutorService Javadoc. */
    public static void shutdownAndAwait(ExecutorService pool, long seconds) {
        pool.shutdown();                                   // no new tasks; queued tasks still run
        try {
            if (!pool.awaitTermination(seconds, TimeUnit.SECONDS)) {
                List<Runnable> neverStarted = pool.shutdownNow();   // interrupts running tasks
                System.err.println(neverStarted.size() + " queued tasks dropped");
                if (!pool.awaitTermination(seconds, TimeUnit.SECONDS)) {
                    System.err.println("Pool did not terminate - a task ignores interrupts");
                }
            }
        } catch (InterruptedException e) {
            pool.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
\`\`\`

Step by step:

- **Named threads** (\`seed-1\`, \`links-3\`) make logs and thread dumps readable; \`pool-7-thread-3\` tells you nothing at 2 a.m.
- The **uncaught exception handler** catches failures from \`execute()\` tasks that would otherwise only be printed to stderr.
- **Bounded queue + \`CallerRunsPolicy\`**: when the tool produces work faster than the API can absorb, the producing thread is slowed down instead of queueing 100,000 tasks in memory.
- **Sizing:** for CPU-bound work ≈ number of cores; for blocking I/O the classic estimate is cores × (1 + wait time / compute time), capped by what the **system under test** tolerates — for a shared QA environment the cap usually wins (4–16, agreed with the team that owns it).

## Submitting work: Runnable, Callable, Future

| Method | Accepts | Returns | Exceptions |
|---|---|---|---|
| \`execute(Runnable)\` | \`Runnable\` | nothing | go to the thread's \`UncaughtExceptionHandler\`; the worker dies and is replaced |
| \`submit(Runnable)\` | \`Runnable\` | \`Future<?>\` (result \`null\`) | captured in the \`Future\` |
| \`submit(Callable<T>)\` | \`Callable<T>\` | \`Future<T>\` | captured; \`get()\` throws \`ExecutionException\` |
| \`invokeAll(tasks[, timeout, unit])\` | collection of \`Callable\` | \`List<Future<T>>\` in the same order, all done (or cancelled on timeout) | per future |
| \`invokeAny(tasks[, timeout, unit])\` | collection of \`Callable\` | the result of **one task that completed successfully**; the rest are cancelled | \`ExecutionException\` if none succeeded |

\`Future<T>\` methods: \`get()\` (blocks), \`get(timeout, unit)\` (throws \`TimeoutException\`), \`cancel(mayInterruptIfRunning)\`, \`isDone()\`, \`isCancelled()\`. Java 19 added \`resultNow()\`, \`exceptionNow()\` and \`state()\` for already-completed futures.

\`\`\`java
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class FutureDemo {
    public static void main(String[] args) throws Exception {
        ThreadPoolExecutor pool = Pools.bounded("demo", 2, 10);
        try {
            // execute(): exception goes to the UncaughtExceptionHandler, the worker thread dies and is replaced
            pool.execute(() -> { throw new IllegalStateException("boom in execute"); });

            // submit(): exception is captured in the Future - nobody sees it unless get() is called
            Future<?> silent = pool.submit(() -> { throw new IllegalStateException("boom in submit"); });

            Callable<Integer> price = () -> { Thread.sleep(50); return 2999; };
            Future<Integer> f = pool.submit(price);
            System.out.println("price = " + f.get(2, TimeUnit.SECONDS));

            try {
                silent.get();
            } catch (ExecutionException e) {
                System.out.println("unwrapped cause: " + e.getCause());
            }

            Future<String> slow = pool.submit(() -> { Thread.sleep(5_000); return "late"; });
            try {
                slow.get(200, TimeUnit.MILLISECONDS);
            } catch (TimeoutException e) {
                System.out.println("timed out, cancel -> " + slow.cancel(true) + ", isDone=" + slow.isDone());
            }

            List<Callable<String>> checks = List.of(() -> "health UP", () -> "products 6", () -> "schema ok");
            for (Future<String> r : pool.invokeAll(checks, 5, TimeUnit.SECONDS)) System.out.println(r.get());
            System.out.println("first: " + pool.invokeAny(checks));
        } finally {
            Pools.shutdownAndAwait(pool, 5);
        }
    }
}
\`\`\`

Output on Java 17:

\`\`\`
Uncaught in demo-1: java.lang.IllegalStateException: boom in execute
price = 2999
unwrapped cause: java.lang.IllegalStateException: boom in submit
timed out, cancel -> true, isDone=true
health UP
products 6
schema ok
first: products 6        <- invokeAny: whichever succeeded first, varies run to run
\`\`\`

Key lines:

- The \`execute\` failure reaches our handler with the **thread name**; the \`submit\` failure would have vanished without the \`get()\`. This is the number-one "my background task silently did nothing" bug.
- \`get(2, SECONDS)\` — never call an unbounded \`get()\` in test tooling; a hung HTTP call becomes a hung CI job.
- \`cancel(true)\` interrupts the running task; it only stops if the task responds to interrupts (\`sleep\` does; a blocking socket read without timeout may not). \`isDone()\` is \`true\` after cancellation — "done" means "no longer running", not "succeeded".
- \`ExecutionException.getCause()\` is the real exception. Rethrow it meaningfully (the *Exceptions* lesson and problem java-040 cover chaining) instead of logging "ExecutionException" with the cause buried.

## Shutting down correctly

| Method | Effect |
|---|---|
| \`shutdown()\` | stop accepting tasks; already-queued tasks still run; returns immediately |
| \`awaitTermination(t, unit)\` | block until all tasks finished, timeout, or interrupt; returns \`false\` on timeout |
| \`shutdownNow()\` | interrupt running tasks, **return the never-started tasks**, stop accepting new ones |
| \`close()\` (Java 19+) | \`shutdown()\` then wait for termination; if interrupted while waiting, \`shutdownNow()\` — enables try-with-resources |

A pool of non-daemon threads that is never shut down keeps the JVM alive: the Maven/Gradle test JVM "hangs" after the last test. The \`shutdownAndAwait\` helper above is the idiom from the \`ExecutorService\` Javadoc. On Java 19+ you can write:

\`\`\`java
try (ExecutorService pool = Executors.newFixedThreadPool(8)) {   // Java 19+: ExecutorService is AutoCloseable
    // submit work ...
}   // close(): waits for all submitted tasks
\`\`\`

Use it only when you are sure the project's baseline is 19+ (the team is on 21 LTS, for example) and every task has its own timeout — \`close()\` waits **without a time limit**, so one stuck task blocks the \`try\` block forever. On a Java 17 baseline keep the explicit helper.

## Exceptions inside tasks

| Where the task runs | What happens to an exception |
|---|---|
| \`execute(Runnable)\` on a \`ThreadPoolExecutor\` | thread's \`UncaughtExceptionHandler\` (default: stack trace to stderr); worker replaced |
| \`submit(...)\` | stored in the \`Future\`; \`get()\` throws \`ExecutionException\` with the cause; **never seen if nobody calls \`get()\`** |
| \`ScheduledExecutorService\` periodic task | stored in the \`ScheduledFuture\` and **all later executions are suppressed** — the poller just stops |
| \`CompletableFuture\` stage | completes the stage exceptionally; dependents get a \`CompletionException\` wrapping it; \`join()\` throws \`CompletionException\`, \`get()\` throws \`ExecutionException\` |

Unwrapping helper for test tooling:

\`\`\`java
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;

public final class Causes {
    private Causes() { }

    /** Strips the ExecutionException / CompletionException wrappers to get the real failure. */
    public static Throwable root(Throwable t) {
        Throwable cur = t;
        while ((cur instanceof ExecutionException || cur instanceof CompletionException) && cur.getCause() != null) {
            cur = cur.getCause();
        }
        return cur;
    }
}
\`\`\`

## ScheduledExecutorService for polling and heartbeats

\`scheduleAtFixedRate(task, initialDelay, period, unit)\` aims at a fixed **start** rhythm (if a run takes longer than the period, the next starts late — never concurrently); \`scheduleWithFixedDelay\` waits a fixed delay **after each run ends** — the right choice for polling, because a slow response does not cause back-to-back calls.

A realistic use: wait until the ShopEasy API is up before a suite starts (the CI job starts \`npm run api\` and the tests in parallel):

\`\`\`java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class ApiReadiness {
    private ApiReadiness() { }

    /** Poll /api/health every 500 ms until UP, give up after 30 s. */
    public static CompletableFuture<Void> waitForApi(HttpClient http, ScheduledExecutorService scheduler) {
        CompletableFuture<Void> up = new CompletableFuture<>();
        ScheduledFuture<?> poll = scheduler.scheduleWithFixedDelay(() -> {
            try {
                HttpResponse<String> r = http.send(
                        HttpRequest.newBuilder(URI.create("http://localhost:5181/api/health"))
                                .timeout(Duration.ofSeconds(2)).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                if (r.statusCode() == 200 && r.body().contains("\\"UP\\"")) up.complete(null);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                // ConnectException while the server boots: swallow, otherwise the schedule stops for good
            }
        }, 0, 500, TimeUnit.MILLISECONDS);
        return up.orTimeout(30, TimeUnit.SECONDS)                 // Java 9+
                .whenComplete((v, ex) -> poll.cancel(false));     // stop polling on success or timeout
    }

    public static void main(String[] args) {
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        try {
            waitForApi(HttpClient.newHttpClient(), scheduler).join();
            System.out.println("API is UP");
        } finally {
            scheduler.shutdownNow();
        }
    }
}
\`\`\`

- The \`catch (Exception e)\` inside the task is deliberate: an exception escaping a periodic task cancels all future runs — the most common "my heartbeat stopped after the first error" bug.
- \`GET /api/health\` returns \`{ status: "UP", service, version }\` in the ShopEasy API, so the check is on status **and** body.
- The \`CompletableFuture\` turns the periodic poll into a single awaitable result with a timeout; \`whenComplete\` cancels the schedule either way.

## CompletableFuture in depth

\`Future\` can only be blocked on. \`CompletableFuture<T>\` (Java 8) is a \`Future\` **and** a \`CompletionStage\`: you attach what happens next, combine several, and handle failures declaratively.

### Creating and choosing the executor

\`supplyAsync(supplier)\` / \`runAsync(runnable)\` without an executor run on \`ForkJoinPool.commonPool()\` (if the common pool's parallelism is below 2, a new thread per task is used instead). The common pool is sized for **CPU** work (available processors − 1) and is **shared JVM-wide** with parallel streams and every other library using defaults. Blocking HTTP or WebDriver calls there starve everything else and limit you to a handful of concurrent calls on a CI agent with 2–4 cores. For I/O, always pass your own executor: \`supplyAsync(supplier, pool)\`.

### The core methods

| Method | Input | Use |
|---|---|---|
| \`thenApply(fn)\` | \`T -> U\` | transform a result (parse JSON, map status) |
| \`thenAccept(consumer)\` / \`thenRun(r)\` | \`T -> void\` / nothing | side effect at the end |
| \`thenCompose(fn)\` | \`T -> CompletionStage<U>\` | chain an **async** step that itself returns a future (flatMap) — create user, then fetch it |
| \`thenCombine(other, bifn)\` | two independent futures | combine results of parallel calls (product + cart) |
| \`allOf(cf...)\` | many futures | \`CompletableFuture<Void>\` done when all are done; read results from the originals |
| \`anyOf(cf...)\` | many futures | \`CompletableFuture<Object>\` with the first to complete (success **or** failure) |
| \`*Async\` variants | + optional executor | run the callback on an executor instead of the completing thread |

Non-async callbacks run on whichever thread completes the previous stage (or on the calling thread if it is already complete) — fine for cheap transformations, wrong for blocking work.

### Error handling

| Method | Sees | Can change the result? | Typical use |
|---|---|---|---|
| \`exceptionally(ex -> fallback)\` | failure only | yes — recovers with a value | record a failed check as a FAIL row instead of crashing the batch |
| \`handle((value, ex) -> ...)\` | both | yes — always maps to a new value | normalise every outcome into a result object |
| \`whenComplete((value, ex) -> ...)\` | both | no — observes, passes the original outcome through | logging, metrics, cleanup (cancel a poll) |

Failures inside stages arrive wrapped in \`CompletionException\`; unwrap with \`getCause()\` (the \`Causes.root\` helper above).

### Timeouts and waiting

- \`orTimeout(t, unit)\` (Java 9) — completes exceptionally with \`TimeoutException\` if not done in time.
- \`completeOnTimeout(value, t, unit)\` (Java 9) — completes with a default value instead.
- Neither stops the underlying work. \`cancel(true)\` on a \`CompletableFuture\` does **not interrupt** the running task either (the Javadoc says the flag has no effect). Give the blocking call its own timeout (\`HttpRequest.timeout\`) and/or shut down the pool with \`shutdownNow()\`.
- \`join()\` throws unchecked \`CompletionException\`; \`get()\` throws checked \`ExecutionException\`/\`InterruptedException\` and has a timed variant. \`join()\` reads better in stream pipelines; \`get(timeout)\` when you need the guard. Prefer timeouts on the future (\`orTimeout\`) plus \`join()\`.

## Tool (a): check every ShopEasy link concurrently

The practice site's \`index.html\` links to every page (\`login.html\`, \`inventory.html\`, \`cart.html\`, \`checkout.html\`, \`form.html\`, \`table.html\`, \`waits.html\`, \`alerts.html\`, \`frames.html\`, \`windows.html\`, \`dynamic.html\`) plus \`site.css\`. A link checker fetches the page, extracts \`href\`/\`src\`, and checks all targets with a bounded pool:

\`\`\`java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class LinkChecker {

    record LinkResult(String url, int status, long millis, String error) {       // Java 16+
        boolean ok() { return error == null && status >= 200 && status < 400; }
    }

    private static final Pattern LINK = Pattern.compile("(?:href|src)=\\"([^\\"#]+)\\"");

    private final HttpClient http;
    private final ExecutorService pool;

    LinkChecker(ExecutorService pool) {
        this.pool = pool;
        this.http = HttpClient.newBuilder()                  // java.net.http, Java 11+
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .executor(pool)                      // HttpClient's own async work also runs on our pool
                .build();
    }

    Set<URI> extractLinks(URI page) throws Exception {
        String html = http.send(HttpRequest.newBuilder(page).GET().build(),
                HttpResponse.BodyHandlers.ofString()).body();
        Set<URI> links = new LinkedHashSet<>();
        Matcher m = LINK.matcher(html);
        while (m.find()) {
            String href = m.group(1);
            if (href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
            links.add(page.resolve(href));           // relative "cart.html" -> absolute URL
        }
        return links;
    }

    LinkResult check(URI url) {
        long start = System.nanoTime();
        try {
            HttpRequest req = HttpRequest.newBuilder(url)
                    .timeout(Duration.ofSeconds(10))
                    .GET().build();
            int status = http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
            return new LinkResult(url.toString(), status, elapsed(start), null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new LinkResult(url.toString(), -1, elapsed(start), "interrupted");
        } catch (Exception e) {
            return new LinkResult(url.toString(), -1, elapsed(start), e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    List<LinkResult> checkAll(Set<URI> links) {
        List<CompletableFuture<LinkResult>> futures = links.stream()
                .map(u -> CompletableFuture.supplyAsync(() -> check(u), pool)
                        .orTimeout(15, TimeUnit.SECONDS)                       // Java 9+
                        .exceptionally(ex -> new LinkResult(u.toString(), -1, 15_000, ex.toString())))
                .collect(Collectors.toList());
        CompletableFuture.allOf(futures.toArray(new CompletableFuture<?>[0])).join();
        return futures.stream().map(CompletableFuture::join).collect(Collectors.toList());
    }

    private static long elapsed(long start) { return (System.nanoTime() - start) / 1_000_000; }

    public static void main(String[] args) throws Exception {
        URI start = URI.create(args.length > 0 ? args[0] : "http://localhost:5180/practice-site/index.html");
        ExecutorService pool = Executors.newFixedThreadPool(8);
        long broken;
        try {
            LinkChecker checker = new LinkChecker(pool);
            Set<URI> links = checker.extractLinks(start);
            List<LinkResult> results = checker.checkAll(links);
            results.forEach(r -> System.out.printf("%-4s %4d %5d ms  %s%s%n",
                    r.ok() ? "OK" : "FAIL", r.status(), r.millis(), r.url(),
                    r.error() == null ? "" : "  (" + r.error() + ")"));
            broken = results.stream().filter(r -> !r.ok()).count();
            System.out.printf("%d links checked, %d broken%n", results.size(), broken);
        } finally {
            Pools.shutdownAndAwait(pool, 10);
        }
        if (broken > 0) System.exit(1);               // non-zero exit fails the CI step
    }
}
\`\`\`

Step by step:

- **One \`HttpClient\`** for all requests: it is immutable, thread-safe and pools connections; creating one per request wastes sockets.
- \`check\` **never throws** — it converts every failure into a \`LinkResult\`. In a batch tool you want the full list of broken links, not the first exception.
- \`supplyAsync(..., pool)\` — the blocking \`send\` runs on our 8 threads, not the common pool. 8 is the concurrency cap the target sees.
- \`orTimeout\` + \`exceptionally\` — a link that hangs becomes a FAIL row after 15 s instead of hanging the tool.
- \`allOf(...).join()\` waits for all; then each \`join()\` returns immediately. Results keep the input order because we iterate the original list, not completion order.
- In a real framework replace the regex with a proper HTML parser (jsoup) and add a per-host limit; the concurrency structure stays the same. A UI-based alternative — collecting \`a[href]\` with Selenium and checking with \`HttpClient\` — should read the links from the page **once** on the test thread, then check them concurrently; never call the driver from the pool (see the last section).

## Tool (b): seed test data through the API in parallel

The ShopEasy API registers customers with \`POST /api/users\` (no auth): body \`{ username, password, firstName, lastName, email, phone?, address? }\`, username 3–40 characters of \`[a-z0-9_.-]\`, password at least 8 characters; responses \`201\` with the user and a \`Location\` header, \`400 VALIDATION_FAILED\`, \`409 USERNAME_TAKEN\`, \`422 INVALID_EMAIL\`. \`GET /api/users/{id}\` reads a user back. Seeding 20 users for a parallel suite:

\`\`\`java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class SeedUsers {

    record SeededUser(int id, String username, String password) { }

    static final class SeedException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        SeedException(String msg) { super(msg); }
    }

    private static final String API = "http://localhost:5181/api";
    private static final Pattern ID = Pattern.compile("\\"id\\":(\\\\d+)");

    private final HttpClient http;

    SeedUsers(ExecutorService pool) {
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).executor(pool).build();
    }

    CompletableFuture<SeededUser> createUser(String runId, int n) {
        String username = "seed_" + runId + "_" + n;             // [a-z0-9_.-]{3,40}
        String password = "Passw0rd!" + n;                       // >= 8 chars
        String json = String.format(
                "{\\"username\\":\\"%s\\",\\"password\\":\\"%s\\",\\"firstName\\":\\"Seed\\",\\"lastName\\":\\"User%d\\","
                        + "\\"email\\":\\"%s@shopeasy.test\\",\\"address\\":{\\"city\\":\\"Bengaluru\\",\\"country\\":\\"IN\\"}}",
                username, password, n, username);
        HttpRequest post = HttpRequest.newBuilder(URI.create(API + "/users"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        return http.sendAsync(post, HttpResponse.BodyHandlers.ofString())
                .thenApply(res -> {
                    if (res.statusCode() != 201) {
                        throw new SeedException("POST /api/users for " + username + " -> " + res.statusCode() + " " + res.body());
                    }
                    Matcher m = ID.matcher(res.body());
                    if (!m.find()) throw new SeedException("No id in " + res.body());
                    return new SeededUser(Integer.parseInt(m.group(1)), username, password);
                })
                .thenCompose(this::verify);                       // async step that returns a future -> thenCompose
    }

    CompletableFuture<SeededUser> verify(SeededUser u) {
        HttpRequest get = HttpRequest.newBuilder(URI.create(API + "/users/" + u.id())).GET().build();
        return http.sendAsync(get, HttpResponse.BodyHandlers.ofString())
                .thenApply(res -> {
                    if (res.statusCode() != 200 || !res.body().contains(u.username())) {
                        throw new SeedException("GET /api/users/" + u.id() + " -> " + res.statusCode());
                    }
                    return u;
                });
    }

    List<SeededUser> seed(int count) {
        String runId = Long.toString(System.currentTimeMillis(), 36);
        List<CompletableFuture<SeededUser>> futures = IntStream.rangeClosed(1, count)
                .mapToObj(n -> createUser(runId, n).orTimeout(20, TimeUnit.SECONDS))
                .collect(Collectors.toList());
        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture<?>[0])).join();
        } catch (CompletionException e) {
            // allOf fails if ANY failed; collect every failure for one clear message
            String failures = futures.stream()
                    .filter(CompletableFuture::isCompletedExceptionally)
                    .map(f -> f.handle((ok, ex) -> ex.getCause() != null ? ex.getCause().getMessage() : ex.getMessage()).join())
                    .collect(Collectors.joining("\\n  "));
            throw new SeedException("Seeding failed:\\n  " + failures);
        }
        return futures.stream().map(CompletableFuture::join).collect(Collectors.toList());
    }

    public static void main(String[] args) {
        ExecutorService pool = Executors.newFixedThreadPool(6);
        try {
            List<SeededUser> users = new SeedUsers(pool).seed(20);
            System.out.println("Seeded " + users.size() + " users, ids "
                    + users.get(0).id() + ".." + users.get(users.size() - 1).id());
        } finally {
            pool.shutdown();
        }
    }
}
\`\`\`

What to notice:

- \`sendAsync\` is **non-blocking**: no thread waits per request; the \`HttpClient\` completes the future when the response arrives, and our pool runs the callbacks. Compare with tool (a), which uses blocking \`send\` inside \`supplyAsync\` — both are valid; \`sendAsync\` scales better, blocking code is easier to debug.
- \`thenApply\` for the synchronous parse; \`thenCompose\` for the follow-up \`GET\` because \`verify\` itself returns a future (with \`thenApply\` you would get a \`CompletableFuture<CompletableFuture<SeededUser>>\`).
- Unique usernames per run (\`seed_<base36 time>_<n>\`) avoid \`409 USERNAME_TAKEN\` across reruns without \`POST /api/reset\` — which would wipe data other parallel jobs use.
- \`allOf\` fails fast semantically but we still report **every** failure, which is what you want when 3 of 20 users fail validation.
- In a framework, this runs in \`@BeforeSuite\`, and the resulting accounts go into a \`BlockingQueue\` account pool (multithreading deep dive) that parallel tests borrow from. Use Jackson for JSON in real code; the regex keeps the example dependency-free.

## Tool (c): parallel API smoke checks with a summary

\`\`\`java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;
import java.util.stream.Collectors;

public class SmokeChecks {

    record Check(String name, String path, int expectedStatus, Predicate<String> body) { }
    record Outcome(String name, boolean passed, long millis, String detail) { }

    private static final String API = "http://localhost:5181";

    static final List<Check> CHECKS = List.of(
            new Check("health",          "/api/health",           200, b -> b.contains("\\"status\\":\\"UP\\"")),
            new Check("product list",    "/api/products?size=50", 200, b -> b.contains("\\"total\\":6")),
            new Check("product 4",       "/api/products/4",       200, b -> b.contains("Storm Fleece Jacket")),
            new Check("unknown product", "/api/products/999",     404, b -> b.contains("PRODUCT_NOT_FOUND")),
            new Check("schema",          "/api/schema/product",   200, b -> b.contains("\\"$schema\\"")),
            new Check("user 1",          "/api/users/1",          200, b -> b.contains("standard_user")),
            new Check("slow endpoint",   "/api/slow?ms=1500",     200, b -> b.contains("\\"delayedMs\\":1500")));

    public static void main(String[] args) {
        ExecutorService pool = Executors.newFixedThreadPool(4);
        HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        long start = System.nanoTime();
        try {
            List<CompletableFuture<Outcome>> futures = CHECKS.stream()
                    .map(c -> CompletableFuture.supplyAsync(() -> run(http, c), pool)
                            .completeOnTimeout(new Outcome(c.name(), false, 5_000, "no answer in 5 s"), 5, TimeUnit.SECONDS)
                            .handle((o, ex) -> ex == null ? o : new Outcome(c.name(), false, 0, ex.toString())))
                    .collect(Collectors.toList());

            List<Outcome> outcomes = futures.stream().map(CompletableFuture::join).collect(Collectors.toList());
            outcomes.forEach(o -> System.out.printf("%-4s %-16s %5d ms  %s%n",
                    o.passed() ? "PASS" : "FAIL", o.name(), o.millis(), o.detail()));
            long failed = outcomes.stream().filter(o -> !o.passed()).count();
            System.out.printf("%d/%d passed in %d ms (wall clock)%n",
                    outcomes.size() - failed, outcomes.size(), (System.nanoTime() - start) / 1_000_000);
            if (failed > 0) throw new AssertionError(failed + " smoke check(s) failed");
        } finally {
            pool.shutdownNow();     // completeOnTimeout leaves the slow task running: interrupt it
        }
    }

    static Outcome run(HttpClient http, Check c) {
        long t0 = System.nanoTime();
        try {
            HttpResponse<String> res = http.send(
                    HttpRequest.newBuilder(URI.create(API + c.path())).timeout(Duration.ofSeconds(4)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            long ms = (System.nanoTime() - t0) / 1_000_000;
            boolean ok = res.statusCode() == c.expectedStatus() && c.body().test(res.body());
            return new Outcome(c.name(), ok, ms, "HTTP " + res.statusCode() + (ok ? "" : " body=" + abbreviate(res.body())));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Outcome(c.name(), false, 0, "interrupted");
        } catch (Exception e) {
            return new Outcome(c.name(), false, (System.nanoTime() - t0) / 1_000_000, e.toString());
        }
    }

    static String abbreviate(String s) { return s.length() <= 120 ? s : s.substring(0, 117) + "..."; }
}
\`\`\`

- The checks are **data** (a list of records), so adding one is a one-line change — open/closed in practice.
- With 4 threads and a 1.5 s slow endpoint the wall clock is ≈ the slowest check, not the sum: the reason to parallelise smoke checks in a deployment pipeline.
- \`completeOnTimeout\` turns "no answer" into a FAIL outcome; \`handle\` normalises any unexpected exception; the final \`AssertionError\` makes the job red with the full table printed first.
- Expected values come from the ShopEasy seed (6 products, product 4 = Storm Fleece Jacket, user 1 = \`standard_user\`) — run \`POST /api/reset\` before the smoke check if other jobs may have changed data.

## Synchronizers: CountDownLatch, CyclicBarrier, Semaphore

| | \`CountDownLatch\` | \`CyclicBarrier\` | \`Semaphore\` |
|---|---|---|---|
| Idea | wait until N events happened | N threads wait for each other at a point | at most N holders of a permit at once |
| Reusable | no (one-shot) | yes (resets after each trip), optional barrier action | yes |
| Who counts | any thread calls \`countDown()\` | the waiting threads themselves (\`await()\`) | \`acquire\`/\`release\` — any thread may release |
| Failure mode | waiting forever if a count is missed → always \`await(timeout)\` | one thread times out/interrupted → \`BrokenBarrierException\` for all | forgetting \`release()\` leaks capacity |
| Automation use | "start all requests at the same instant", "wait until N workers are ready" | load-style steps in rounds | **cap concurrent browser sessions to the Grid's capacity**, cap requests to a rate-limited API |

\`Phaser\` generalises both latch and barrier with dynamic parties; rarely needed in test tooling.

### Limit concurrent browser sessions with a Semaphore

\`\`\`java
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

public final class GridGate {
    private final Semaphore slots;

    public GridGate(int capacity) { this.slots = new Semaphore(capacity, true); }   // fair: FIFO for waiting tests

    public <T> T withSession(Supplier<T> work, long waitSeconds) throws InterruptedException, TimeoutException {
        if (!slots.tryAcquire(waitSeconds, TimeUnit.SECONDS)) {
            throw new TimeoutException("No Grid slot free after " + waitSeconds + " s");
        }
        try {
            return work.get();
        } finally {
            slots.release();            // always release, or capacity leaks away test by test
        }
    }
}
\`\`\`

If the Grid has 6 Chrome slots but TestNG runs 4 threads × a parallel data provider (default \`data-provider-thread-count\` 10), more session requests than slots arrive. Selenium Grid 4 queues new-session requests and fails them after its configured request timeout; a client-side \`Semaphore\` sized from config makes the limit explicit, gives a clear error, and lets you log how long tests waited for a slot.

### Start N requests at the same instant with CountDownLatch

A concurrency test for the API: 10 simultaneous registrations with the same username must produce exactly one \`201\` and nine \`409 USERNAME_TAKEN\`:

\`\`\`java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class RegistrationRace {
    private RegistrationRace() { }

    /** Returns status code -> count, e.g. {201=1, 409=9}. */
    public static Map<Integer, Long> fire(HttpClient http, String username, int n) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(n);
        CountDownLatch ready = new CountDownLatch(n);
        CountDownLatch go = new CountDownLatch(1);
        String json = "{\\"username\\":\\"" + username + "\\",\\"password\\":\\"Passw0rd!\\",\\"firstName\\":\\"Race\\","
                + "\\"lastName\\":\\"Test\\",\\"email\\":\\"" + username + "@shopeasy.test\\"}";
        try {
            List<Future<Integer>> results = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                results.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();                         // all threads park here
                    HttpRequest req = HttpRequest.newBuilder(URI.create("http://localhost:5181/api/users"))
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString(json)).build();
                    return http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
                }));
            }
            if (!ready.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("workers not ready");
            go.countDown();                             // release them together
            List<Integer> codes = new ArrayList<>();
            for (Future<Integer> f : results) codes.add(f.get(10, TimeUnit.SECONDS));
            return codes.stream().collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        } finally {
            pool.shutdownNow();
        }
    }
}
\`\`\`

The \`ready\` latch guarantees every worker is parked before \`go\` opens; without it the first threads would send before the last were even started, and the test would rarely exercise a real race. (The Node-based practice API is single-threaded, so it should pass; the same test against a multi-threaded backend is how duplicate-account bugs are found.)

## Parallel streams vs ExecutorService vs CompletableFuture vs virtual threads

The *Functional programming* deep dive explains why parallel streams run on the common pool and do not suit blocking I/O. Virtual threads (Java 21) are the newest option: the JVM mounts a cheap virtual thread on a carrier platform thread and **unmounts it when it blocks** on I/O, so a blocked call no longer holds an OS thread.

\`\`\`java
// Java 21+: one virtual thread per link, concurrency limited by a Semaphore
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;

final class VirtualLinkCheck {                                    // same package as LinkChecker
    private VirtualLinkCheck() { }

    static List<LinkChecker.LinkResult> run(LinkChecker checker, Set<URI> links) throws Exception {
        Semaphore limit = new Semaphore(20);                      // protect the server under test
        try (ExecutorService vt = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<LinkChecker.LinkResult>> fs = links.stream()
                    .map(u -> vt.submit(() -> {
                        limit.acquire();
                        try { return checker.check(u); } finally { limit.release(); }
                    }))
                    .toList();                                    // Java 16+
            List<LinkChecker.LinkResult> out = new ArrayList<>();
            for (Future<LinkChecker.LinkResult> f : fs) out.add(f.get());   // check() never throws
            return out;
        }
    }
}
\`\`\`

Plain blocking code, no callbacks, thousands of concurrent waits for almost no memory. Caveats: virtual threads are never pooled (create one per task) and are **not a concurrency limit** — use a \`Semaphore\`; on Java 21–23 a virtual thread blocking inside \`synchronized\` **pins** its carrier thread (JEP 491 removed most of this pinning in JDK 24); CPU-bound work gains nothing; \`ThreadLocal\`s work but every virtual thread gets its own copy.

| | Parallel stream | ExecutorService | CompletableFuture | Virtual threads (Java 21) |
|---|---|---|---|---|
| How it works | splits a collection over the common ForkJoinPool | tasks queued to a pool you configure | async pipeline on an executor you choose (default common pool) | one cheap JVM-scheduled thread per task |
| Control (pool size, names, queue) | almost none (shared pool) | full | full if you pass an executor | concurrency via \`Semaphore\`; names via \`Thread.ofVirtual().name(...)\` factories |
| Error handling | first exception thrown from the terminal op; others lost | per \`Future\`, \`ExecutionException\` | declarative: \`exceptionally\`/\`handle\`/\`whenComplete\` | per \`Future\`, plain try/catch inside tasks |
| Blocking I/O fit | poor — blocks common-pool threads | good, bounded by pool size | good with a custom executor or \`sendAsync\` | **best** — blocking is cheap |
| Readability | best for CPU-bound data transforms | imperative, verbose | fluent but callback-heavy; stack traces harder | plain sequential code |
| Timeouts | none | \`get(timeout)\`, \`invokeAll(timeout)\` | \`orTimeout\`, \`completeOnTimeout\` | \`get(timeout)\` / structured code |
| When to use | CPU-bound transforms on large in-memory data | general-purpose bounded concurrency, Java 8–17 tools | composing dependent async steps, fan-out/fan-in with fallbacks | many concurrent blocking calls on Java 21+ |

**Recommended:** on a Java 17 baseline, a **bounded, named \`ThreadPoolExecutor\` + \`CompletableFuture\` with an explicit executor** for test tooling, \`HttpClient.sendAsync\` when the number of requests is large; on Java 21+, virtual threads + a \`Semaphore\` for I/O fan-out because the code stays sequential and readable. Parallel streams only for CPU work on in-memory data — never for HTTP or WebDriver calls.

## Never drive one WebDriver from multiple threads

A \`WebDriver\` instance is **not thread-safe**, and the Selenium project has never claimed otherwise. Underneath, each command is an HTTP request to the driver (chromedriver, geckodriver or the Grid) for **one session**, and the browser executes one command at a time against one current window/frame. Sharing one driver between threads gives:

- interleaved commands: thread A switches to an iframe while thread B looks for an element in the main document → \`NoSuchElementException\` that never happens alone;
- no speed-up — the browser serializes the work anyway;
- state corruption in client-side objects (current window handle, implicit-wait settings);
- \`NoSuchSessionException\` when one thread quits while another is mid-command.

So \`elements.parallelStream().map(WebElement::getText)\` or submitting page-object calls to an executor is wrong by design. Parallel UI testing scales by **sessions, not threads per session**: TestNG/JUnit/Cucumber run tests on N threads, each thread owns its own driver (the \`ThreadLocal\` \`DriverManager\` from the multithreading deep dive), and Selenium Grid routes each session to a free browser slot on some node. Within a single test, read data from the page once (\`findElements\` + one pass, or a single \`executeScript\` returning all texts) and do the expensive post-processing — HTTP checks, comparisons, API calls — concurrently **without touching the driver**.

## Common mistakes and debugging

- **\`submit()\` and never \`get()\`** — failures vanish. Symptom: seeded data missing, no error. Fix: keep the \`Future\`s and \`get(timeout)\` them, or use \`CompletableFuture\` with \`exceptionally\`/\`handle\`.
- **Blocking I/O on the common pool** (\`supplyAsync\` without an executor). Symptom: on a 2-core CI agent only one or two calls run at a time, and unrelated parallel streams stall. A thread dump shows \`ForkJoinPool.commonPool-worker-*\` threads in \`socketRead\`. Fix: pass a dedicated executor.
- **Pool never shut down** → the test JVM does not exit after the last test; the dump shows your non-daemon \`pool-N-thread-M\` threads in \`WAITING\` on the queue. Fix: \`shutdownAndAwait\` in a \`finally\` or \`@AfterSuite\`.
- **Pool-induced deadlock** — a task in a 4-thread pool submits subtasks to the same pool and blocks on their \`get()\`; with 4 such parents, every thread waits for subtasks that can never start. Dump: all workers \`WAITING\` in \`FutureTask.get\`. Fix: separate pools per level, \`thenCompose\` instead of blocking, or virtual threads.
- **Periodic task that throws once** → the scheduled poller silently stops. Fix: catch inside the task body; check the \`ScheduledFuture\` in tests.
- **\`orTimeout\` assumed to stop work** — the task keeps running and holding a connection/thread. Fix: timeouts on the underlying call plus \`shutdownNow()\`.

## Best practices for experienced engineers

- Every pool: bounded size, bounded queue (or a deliberate reason not to), named threads, an owner who shuts it down.
- Every wait has a timeout: \`get(t)\`, \`orTimeout\`, \`await(t)\`, \`tryAcquire(t)\`, HTTP timeouts.
- Tasks return results (records) instead of writing to shared collections; failures become data in batch tools.
- Cap concurrency to what the **system under test** and the Grid can serve, from config — not to "as fast as possible".
- One \`HttpClient\` per tool, reused; no WebDriver calls off the test's own thread.
- Prefer \`thenCompose\` over blocking \`join()\` inside stages; join once at the edge.
- On Java 21+, consider virtual threads for I/O-heavy tooling; keep \`synchronized\` blocks around blocking calls out of them (pinning before JDK 24).

## Interview questions

### Q: Why use an ExecutorService instead of creating threads?
**Short answer (30–60 s):** Thread reuse, bounded concurrency, a queue for excess work, results and exceptions through \`Future\`, and a lifecycle with shutdown and timeouts. Raw threads give none of that, and an unbounded number of them can exhaust memory or overload the system under test.

**Detailed answer:** The executor separates the task from the execution policy, so the policy (size, queue, naming, rejection) is configured in one place and visible in code review. \`Executors.newFixedThreadPool\` hides an unbounded queue and \`newCachedThreadPool\` an unbounded thread count, so for anything long-lived I build a \`ThreadPoolExecutor\` explicitly: fixed size from config, \`ArrayBlockingQueue\`, a named \`ThreadFactory\`, \`CallerRunsPolicy\` for back-pressure. For test tooling the size is driven by what the QA environment tolerates, not by CPU count.

### Q: Explain how ThreadPoolExecutor handles a new task.
**Short answer (30–60 s):** Below core size it starts a thread; otherwise it queues; if the queue is full it grows up to max size; beyond that it rejects with the configured policy.

**Detailed answer:** The surprising consequence is that with an unbounded \`LinkedBlockingQueue\` the pool never grows beyond core, so \`max\` is meaningless — exactly the configuration of \`newFixedThreadPool\`. A \`SynchronousQueue\` (cached pool) does the opposite: no queueing, a new thread for every task when none is idle. Rejection policies: Abort (default, exception), CallerRuns (throttles the producer), Discard and DiscardOldest (lose work — rarely acceptable). Threads above core die after keep-alive; \`allowCoreThreadTimeOut(true)\` lets core threads die too, which helps tools that should not keep the JVM alive.

### Q: What happens to an exception thrown inside a task?
**Short answer (30–60 s):** With \`execute\`, it goes to the thread's uncaught exception handler and the worker is replaced. With \`submit\`, it is stored in the \`Future\` and only appears as an \`ExecutionException\` when you call \`get()\`. In a periodic scheduled task it cancels all future runs. In a \`CompletableFuture\` it completes the stage exceptionally and propagates as \`CompletionException\`.

**Detailed answer:** The dangerous case is \`submit\` without \`get\` — the failure is invisible. In tooling I either keep and check all futures (\`invokeAll\` + \`get\`), or use \`CompletableFuture\` and convert failures into result objects with \`handle\`. When rethrowing, unwrap \`ExecutionException\`/\`CompletionException\` to the cause and chain it into a meaningful exception (\`new SeedException("creating user 7 failed", cause)\`) so the report shows the real error.

### Q: thenApply vs thenCompose vs thenCombine?
**Short answer (30–60 s):** \`thenApply\` transforms a value synchronously (\`T -> U\`). \`thenCompose\` chains a step that returns another future (\`T -> CompletableFuture<U>\`), flattening it — like \`flatMap\`. \`thenCombine\` joins two **independent** futures into one result.

**Detailed answer:** Creating a user then fetching it by id is \`thenCompose\`, because the fetch is itself async; using \`thenApply\` there gives a nested \`CompletableFuture<CompletableFuture<User>>\`. Loading product details and the cart at the same time and building a comparison is \`thenCombine\`. For N futures, \`allOf\` plus reading each original future. The non-async versions run the callback on the thread that completed the previous stage; the \`*Async\` versions with an explicit executor are for blocking or heavy callbacks.

\`\`\`java
CompletableFuture<Product> product = api.productAsync(4);
CompletableFuture<Cart> cart = api.cartAsync(token);
CompletableFuture<Boolean> inCart = product.thenCombine(cart, (p, c) -> c.contains(p.id()));
\`\`\`

### Q: Why should blocking I/O not run on the common ForkJoinPool?
**Short answer (30–60 s):** The common pool is sized for CPU work (processors − 1) and shared by the whole JVM — parallel streams, default \`CompletableFuture\` stages, libraries. Blocking calls occupy its few threads, so throughput collapses and unrelated code stalls.

**Detailed answer:** On a 2-vCPU CI container the common pool may have one worker (and with parallelism below 2, \`CompletableFuture\` falls back to a new thread per task, which is unbounded). Either way you lose control. Pass a dedicated, bounded, named executor to \`supplyAsync\`, use \`HttpClient.sendAsync\` (non-blocking), or on Java 21 use virtual threads. \`ForkJoinPool.ManagedBlocker\` exists for library authors but is not what test code should reach for.

### Q: How do you shut down an executor correctly?
**Short answer (30–60 s):** \`shutdown()\`, then \`awaitTermination\` with a timeout; if it times out, \`shutdownNow()\` to interrupt running tasks and await again; if the waiting thread is interrupted, \`shutdownNow()\` and restore the interrupt flag. Do it in \`finally\` or a suite-level teardown.

**Detailed answer:** \`shutdown\` lets queued work finish; \`shutdownNow\` returns the never-started tasks and interrupts the running ones, which only helps if tasks honour interrupts. Since Java 19 \`ExecutorService\` is \`AutoCloseable\`, and \`close()\` does shutdown + wait — but without a time limit, so I only use try-with-resources when the baseline is 19+ and every task has its own timeout. A forgotten pool of non-daemon threads is why a test JVM sometimes never exits.

### Q: CountDownLatch vs CyclicBarrier vs Semaphore — give an automation use for each.
**Short answer (30–60 s):** Latch: one-shot "wait for N events" — release N concurrent API calls at the same instant. Barrier: reusable meeting point for N threads — rounds of a load-style test. Semaphore: N permits — cap concurrent browser sessions to the Grid's capacity or requests to a rate-limited API.

**Detailed answer:** Latches cannot be reset and a missed \`countDown\` hangs a plain \`await()\`, so always use the timed version. A barrier breaks for everyone if one party times out or is interrupted (\`BrokenBarrierException\`), which is the correct behaviour for a coordinated test. Semaphore permits are not owned by threads, so any thread can release — powerful but easy to leak; always \`release()\` in \`finally\`, and use \`tryAcquire(timeout)\` to turn "Grid full" into a clear error.

### Q: Can several threads share one WebDriver to speed up a test?
**Short answer (30–60 s):** No. WebDriver is not thread-safe, one session executes one command at a time against one browser context, and concurrent commands interleave window/frame state. Parallelism comes from multiple sessions — one driver per test thread, distributed by the runner and Selenium Grid.

**Detailed answer:** Within a test, gather what you need from the page on the test thread (ideally in one \`executeScript\` or one \`findElements\` pass), then process concurrently without the driver — e.g. check the extracted links' HTTP status with a bounded executor. Across tests, TestNG/Cucumber threads each own a \`ThreadLocal\` driver; capacity is limited by Grid slots, which a \`Semaphore\` can mirror on the client side.

## Scenario-based questions

**1. A \`@BeforeSuite\` that seeds 200 users through the API takes 4 minutes sequentially. The team asks you to make it fast.** I'd parallelise with \`HttpClient.sendAsync\` or a bounded pool of 8–10 threads (agreed with whoever owns the QA environment), unique usernames per run, \`orTimeout\` per request, and a summary of all failures rather than the first. I'd measure the server's response time at 4, 8 and 16 concurrency and stop where latency degrades — the goal is a fast suite, not a load test of the QA box. Then hand the users to tests through an account pool so parallel tests never share one.

**2. A link-checker job sometimes runs forever on CI.** A thread dump shows pool threads RUNNABLE in \`socketRead\` — some requests have no read timeout and the target never answers. I'd add \`HttpRequest.timeout\`, \`connectTimeout\` on the client, \`orTimeout\` on each future so a hang becomes a FAIL row, and the shutdown helper with \`shutdownNow()\` in \`finally\`. I'd also confirm the job's own CI timeout is lower than the default so a regression is visible quickly.

**3. Someone uses \`CompletableFuture.supplyAsync\` with page-object calls to "run the checkout steps faster".** I'd explain the WebDriver thread-safety problem and show the intermittent \`NoSuchElementException\` it causes when another thread switched frames. The speed-up they want comes from running more tests in parallel (more sessions), from API shortcuts for setup (seed the cart via \`POST /api/cart/items\` instead of clicking), and from removing sleeps — not from threads inside one session.

## Tricky follow-ups

- **Does \`cancel(true)\` on a \`CompletableFuture\` interrupt the running task?** No — the flag has no effect for \`CompletableFuture\`; it just completes the future with a \`CancellationException\`.
- **\`allOf\` returns \`CompletableFuture<Void>\` — how do you get the results?** Keep the original list of futures and \`join()\` each after \`allOf\` completes.
- **Does \`anyOf\` return the first successful result?** No — the first *completed*, which may be an exception. \`invokeAny\` returns the first *successful* one.
- **Why might \`maximumPoolSize\` never be reached?** The queue is unbounded, so tasks are always queued and the pool never grows beyond core size.
- **Are virtual threads faster?** Not per task — they make *blocking* cheap, so you can have many more concurrent waits. CPU-bound work gains nothing.`,
  keyPoints: [
    'Executors separate the task from the execution policy: reuse, bounded concurrency, queues, results and failures via Future, and a shutdown lifecycle — raw threads give none of these.',
    'Executors.newFixedThreadPool hides an unbounded queue and newCachedThreadPool unbounded threads; for long-lived tooling build a ThreadPoolExecutor with a bounded queue, named ThreadFactory and a deliberate rejection policy (CallerRunsPolicy for back-pressure).',
    'execute() sends exceptions to the uncaught handler; submit() hides them in the Future until get(); a throwing periodic task stops all later runs; CompletableFuture wraps failures in CompletionException.',
    'Shut down with shutdown → awaitTermination(timeout) → shutdownNow; ExecutorService.close() (Java 19+) waits without a time limit, so use try-with-resources only on a 19+ baseline with per-task timeouts.',
    'CompletableFuture: always pass a dedicated executor for blocking I/O (the common pool is small and JVM-wide); thenApply transforms, thenCompose chains async steps, thenCombine joins two, allOf/anyOf fan in; exceptionally/handle/whenComplete for errors; orTimeout/completeOnTimeout (Java 9) do not stop the underlying work.',
    'CountDownLatch is one-shot (start N calls together), CyclicBarrier is reusable, Semaphore caps concurrency (Grid slots, rate-limited APIs) and must be released in finally.',
    'Java 21 virtual threads make blocking I/O cheap and keep code sequential, but are not a concurrency limit and pin carriers inside synchronized before JDK 24; parallel streams are for CPU-bound in-memory work only.',
    'A WebDriver session is not thread-safe: parallelise by sessions (one driver per test thread, Selenium Grid), and run only driver-free work such as HTTP checks concurrently inside a test.',
  ],
  mistakes: [
    'Calling submit() and never checking the Future, so seeding or cleanup failures disappear. Fix: keep every Future and get(timeout) it, or use CompletableFuture with handle() and report all failures in one summary.',
    'Running blocking HTTP or WebDriver calls in supplyAsync without an executor. Symptom: only one or two calls in flight on a small CI agent; thread dump shows ForkJoinPool.commonPool-worker threads in socketRead. Fix: pass a bounded, named pool or use HttpClient.sendAsync.',
    'Never shutting down a pool, so the test JVM does not exit after the last test. Diagnose with a thread dump (non-daemon pool-N-thread-M threads WAITING on the queue); fix with the shutdown idiom in finally or @AfterSuite.',
    'Assuming orTimeout or cancel(true) stops a CompletableFuture\'s task. It only completes the future; the work keeps running. Fix: set timeouts on the underlying call (HttpRequest.timeout) and shutdownNow() the pool.',
    'Letting an exception escape a scheduleWithFixedDelay task, which silently stops the poller after the first ConnectException. Fix: catch inside the task body and complete a CompletableFuture to signal success or timeout.',
    'Sharing one WebDriver with an executor or parallel stream to "speed up" a test, causing intermittent NoSuchElementException and NoSuchSessionException. Fix: read the page once on the test thread, process data concurrently without the driver, and scale with more sessions.',
  ],
  tryIt: `Start the practice site and API (\`npm run dev\` and \`npm run api\`), then:

1. Run the \`LinkChecker\` against \`http://localhost:5180/practice-site/index.html\`. Before \`checkAll\`, add \`start.resolve("missing.css")\` to the extracted set and confirm the tool prints a FAIL row and exits with code 1. If a dev server answers an unknown path with 200 and a fallback page, note it: a link checker against a dev server may also need a content-type or body check, not only the status.
2. Run \`SeedUsers\` with 20 users and a pool of 6. Then run it twice with the **same** \`runId\` (hard-code it) and show that the second run reports twenty \`409 USERNAME_TAKEN\` failures in one summary instead of stopping at the first.
3. In \`SmokeChecks\`, change the slow check to \`/api/slow?ms=8000\` and observe \`completeOnTimeout\` turning it into a FAIL after 5 s. Explain why the pool still needs \`shutdownNow()\`.
4. Use \`RegistrationRace.fire(...)\` with 10 threads and a fresh username; assert the result is \`{201=1, 409=9}\`. Remove the \`ready\` latch and explain why the test would then rarely create a real race.
5. Bonus (Java 21): rewrite \`checkAll\` with \`newVirtualThreadPerTaskExecutor()\` and a \`Semaphore(4)\` and compare wall-clock time with the 8-thread pool.`,
  problems: ['java-040', 'java-028', 'java-007'],
}
