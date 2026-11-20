export default {
  slug: 'java-deep-multithreading-synchronization',
  category: 'java',
  order: 18,
  title: 'Deep dive: multithreading, synchronization and thread safety in parallel test runs',
  minutes: 32,
  summary: 'Explain how Java threads, the Java Memory Model, locks, atomics and ThreadLocal really work, and use them to make a parallel TestNG/Cucumber suite free of race conditions, leaks and deadlocks.',
  manualAnalogy: `When four testers share one test environment, you already prevent "race conditions" by habit: each person uses their own test account, nobody clears the shared cart while someone else is checking out, and a shared spreadsheet of results gets one editor at a time. Parallel automation needs exactly the same rules, written in code: per-thread browsers and accounts (confinement), read-only shared data (immutability), and a lock or atomic counter only where something truly must be shared.`,
  body: `## Why this matters for automation

The *static vs instance* lesson showed the classic trap: one \`static WebDriver\` shared by every test. That is only the most visible case. A suite that goes from \`parallel="none"\` to \`parallel="methods" thread-count="8"\` meets every concurrency problem a backend developer meets: shared counters in a report listener, a "lazy" config singleton loaded twice, a \`SimpleDateFormat\` constant printing 31/02, a cart id stored in a step-definition field that another scenario overwrites, a test account two tests log in with at the same time.

The symptoms are always the same and that is the first thing a senior should recognise:

- **passes alone, fails in the suite**, and the failing test changes from run to run;
- failures disappear when you add logging or a breakpoint (timing changed);
- assertions see **another test's data** (wrong cart count, wrong user name);
- \`NoSuchSessionException: Session ID is null. Using WebDriver after calling quit()?\` — someone else's teardown quit your browser.

Most "flaky tests" that survive retries are not timing issues with the app — they are **race conditions in the test code**. This lesson goes through the mechanism (threads, the Java Memory Model), the tools (locks, atomics, \`ThreadLocal\`, concurrent collections) and how TestNG's parallel modes map onto threads. Executors and \`CompletableFuture\` are the next lesson; \`ConcurrentHashMap\` internals are covered in the *Collections internals* deep dive.

## Threads: what the JVM actually runs

### Platform threads and the OS

A \`java.lang.Thread\` created with \`new Thread(...)\` is a **platform thread**: a thin wrapper around one operating-system thread (1:1). The OS scheduler decides which thread runs on which core; Java has no say beyond priorities, which are hints most schedulers ignore. Each platform thread reserves its own **stack** (the size is set by \`-Xss\`, commonly 1 MB by default on 64-bit platforms — check your JVM), so thousands of threads cost real memory and context-switch time. Java 21 added **virtual threads** (cheap, JVM-scheduled threads mounted on a small pool of carrier platform threads); they matter for I/O-heavy tooling and are covered in the next lesson. Everything in this lesson applies to both kinds.

### Lifecycle states

\`Thread.getState()\` returns one of six \`Thread.State\` values — the same names you see in a thread dump:

| State | Meaning | Typical cause in a test suite |
|---|---|---|
| \`NEW\` | created, \`start()\` not yet called | a thread object built but never started (bug) |
| \`RUNNABLE\` | running **or ready to run** — includes waiting for the OS on socket I/O | a test waiting for the WebDriver HTTP response shows as RUNNABLE in \`socketRead\` |
| \`BLOCKED\` | waiting to enter a \`synchronized\` block/method held by another thread | contention on a synchronized logger/report, or a deadlock |
| \`WAITING\` | waiting indefinitely: \`Object.wait()\`, \`join()\`, \`LockSupport.park()\` (used by \`ReentrantLock\`, \`CountDownLatch\`, \`Future.get()\`) | a test waiting on a latch that is never counted down |
| \`TIMED_WAITING\` | same with a timeout: \`sleep\`, \`wait(ms)\`, \`join(ms)\`, \`parkNanos\` | \`Thread.sleep\` in a polling helper, \`WebDriverWait\` between polls |
| \`TERMINATED\` | \`run()\` returned or threw | finished worker |

Two senior details: a thread blocked on a \`ReentrantLock\` shows as **WAITING (parking)**, not BLOCKED — BLOCKED is only for intrinsic monitors. And RUNNABLE does not mean "using CPU"; a thread stuck forever on a socket read with no timeout is RUNNABLE.

### Thread vs Runnable vs Callable

| | \`extends Thread\` | \`Runnable\` | \`Callable<V>\` |
|---|---|---|---|
| Shape | subclass, override \`run()\` | \`void run()\` | \`V call() throws Exception\` |
| Returns a value | no | no | yes, via a \`Future\` |
| Checked exceptions | no | no | yes |
| Runs on | itself | a \`Thread\` or an executor | an executor (\`submit\`) |
| Use | almost never (mixes task and mechanism) | fire-and-forget task | task with a result or failure you need |

Separating the **task** (\`Runnable\`/\`Callable\`) from the **mechanism** (thread or pool) is the whole reason the executor framework exists; extending \`Thread\` couples them and wastes your single superclass.

### Daemon threads, join and interrupts

- **Daemon threads** do not keep the JVM alive: when only daemon threads remain, the JVM exits without running their \`finally\` blocks. A new thread inherits the daemon flag of its creator; \`setDaemon\` must be called before \`start()\` (otherwise \`IllegalThreadStateException\`). A background "video recorder" or "log shipper" thread in a framework should be a daemon **plus** an explicit shutdown, otherwise the last minutes are lost.
- **\`join()\`** waits for a thread to terminate, and — importantly for the memory model — everything that thread wrote is visible after \`join()\` returns.
- **Interrupts** are a cooperative cancellation request. \`t.interrupt()\` sets a flag. Blocking methods (\`sleep\`, \`wait\`, \`join\`, \`BlockingQueue.take\`, \`Lock.lockInterruptibly\`, \`Future.get\`) notice it, **clear the flag** and throw \`InterruptedException\`. Code that is not blocked must check \`Thread.currentThread().isInterrupted()\` itself. \`Thread.interrupted()\` (static) checks **and clears** — easy to confuse.

The rule: never swallow \`InterruptedException\`. Either rethrow it, or restore the flag so code further up (a pool shutting down, a TestNG timeout) can see it:

\`\`\`java
import java.time.Duration;
import java.time.Instant;
import java.util.function.BooleanSupplier;

public final class Polling {
    private Polling() { }

    public static boolean waitUntil(BooleanSupplier condition, Duration timeout) {
        Instant deadline = Instant.now().plus(timeout);
        while (Instant.now().isBefore(deadline)) {
            if (condition.getAsBoolean()) return true;
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();   // restore the flag for the caller
                return false;                         // and stop: someone asked us to
            }
        }
        return false;
    }
}
\`\`\`

\`catch (InterruptedException e) { }\` is why \`@Test(timeOut = 30000)\` sometimes "does not work": TestNG interrupts the test thread, a helper eats the interrupt, and the test keeps polling.

## The Java Memory Model: visibility, atomicity, ordering

Without synchronization the JVM, the JIT and the CPU are allowed to **cache values in registers and core caches** and **reorder instructions**, as long as a single thread cannot tell the difference. Another thread can. The Java Memory Model (JLS chapter 17) defines exactly when a write by one thread is guaranteed visible to a read by another: when the write **happens-before** the read.

Three separate problems:

| Problem | Example | Fixed by |
|---|---|---|
| **Visibility** | thread B never sees \`stop = true\` written by thread A and loops forever | \`volatile\`, \`synchronized\`, \`Lock\`, atomics, \`final\` (for construction) |
| **Atomicity** | \`count++\` is read, add, write — two threads both read 41 and both write 42 | \`synchronized\`, \`Lock\`, atomics (\`incrementAndGet\`) |
| **Ordering** | another thread sees a reference to an object before its constructor's writes (half-built singleton) | happens-before edges (\`volatile\`, locks, \`final\` fields) |

### Happens-before rules you should be able to list

1. **Program order** — each action in a thread happens-before the later actions in that thread.
2. **Monitor lock** — unlocking a monitor happens-before every later lock of the **same** monitor.
3. **volatile** — a write to a volatile field happens-before every later read of that field.
4. **Thread start** — \`t.start()\` happens-before any action in \`t\` (so data prepared before \`start()\` is visible inside).
5. **Thread termination** — all actions in \`t\` happen-before another thread returns from \`t.join()\` (or sees \`isAlive() == false\`).
6. **Transitivity** — A hb B and B hb C gives A hb C.
7. **final fields** — if \`this\` does not escape the constructor, any thread that sees the object reference sees the correctly initialized \`final\` fields (and what they referenced at the end of construction) without synchronization.

\`java.util.concurrent\` adds its own documented edges ("memory consistency effects" in each Javadoc): submitting a task to an executor happens-before the task runs; the task's actions happen-before \`Future.get()\` returns; \`put\` into a \`ConcurrentHashMap\`/\`BlockingQueue\` happens-before the \`get\`/\`take\` that sees it; \`countDown()\` happens-before a successful \`await()\`.

### volatile gives visibility, not atomicity

\`volatile\` forces every read to see the latest write and forbids reordering around it. It does **not** make a compound operation atomic. This demo runs on Java 17:

\`\`\`java
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.LongAdder;

public class CounterRace {
    static volatile int volatileCount = 0;          // visible, but ++ is still read-modify-write
    static int syncCount = 0;
    static final Object LOCK = new Object();
    static final AtomicInteger atomicCount = new AtomicInteger();
    static final LongAdder adderCount = new LongAdder();

    public static void main(String[] args) throws InterruptedException {
        int threads = 8, perThread = 100_000;
        List<Thread> workers = new ArrayList<>();
        for (int t = 0; t < threads; t++) {
            Thread w = new Thread(() -> {
                for (int i = 0; i < perThread; i++) {
                    volatileCount++;                  // RACE: read, add, write are three steps
                    synchronized (LOCK) { syncCount++; }
                    atomicCount.incrementAndGet();    // one CAS-based atomic step
                    adderCount.increment();           // striped cells, summed on read
                }
            }, "worker-" + t);
            workers.add(w);
            w.start();
        }
        for (Thread w : workers) w.join();            // join = happens-before: we see all their writes
        int expected = threads * perThread;
        System.out.printf("expected     %d%n", expected);
        System.out.printf("volatile ++  %d  (lost %d updates)%n", volatileCount, expected - volatileCount);
        System.out.printf("synchronized %d%n", syncCount);
        System.out.printf("AtomicInteger %d%n", atomicCount.get());
        System.out.printf("LongAdder    %d%n", adderCount.sum());
    }
}
\`\`\`

A run on an 8-core laptop printed:

\`\`\`
expected     800000
volatile ++  786790  (lost 13210 updates)
synchronized 800000
AtomicInteger 800000
LongAdder    800000
\`\`\`

Step by step:

- \`volatileCount++\` compiles to *get field, add 1, put field*. Two threads can read the same value between another thread's read and write; one increment is lost. \`volatile\` only guarantees each of those reads sees *some* recent write.
- \`synchronized (LOCK)\` makes the three steps one critical section **and** publishes the result to the next thread that locks \`LOCK\`.
- \`incrementAndGet()\` uses a hardware compare-and-swap loop — no lock, no lost update.
- \`w.join()\` is why \`main\` can read the plain \`syncCount\` safely afterwards.
- The lost number changes every run and can be zero on a lucky run — which is exactly why such bugs survive code review "because I ran it and it was fine".

**When \`volatile\` is enough:** one writer and many readers of a single value whose new value does not depend on the old one — a \`stop\` flag, a "current environment" switch, a reference to an immutable config object that is replaced as a whole.

## Race conditions and check-then-act

A race condition is any result that depends on thread interleaving. The commonest shape in test code is **check-then-act** (or read-modify-write):

\`\`\`java
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

import java.text.SimpleDateFormat;
import java.util.Date;

// three classic races found in real frameworks - do NOT copy
public final class Races {
    private static WebDriver driver;                               // 1. lazy init race
    public static WebDriver driver() {
        if (driver == null) driver = new ChromeDriver();           // two threads both see null -> two browsers,
        return driver;                                             // one leaks, both tests then share the survivor
    }

    private static int passed;                                     // 2. shared counter in a listener
    public static void onTestSuccess() { passed++; }               // lost updates -> "47 passed" of 50 green tests

    private static final SimpleDateFormat FMT = new SimpleDateFormat("dd/MM/yyyy");   // 3. shared formatter
    public static String today() { return FMT.format(new Date()); }                   // internal Calendar is mutated:
}                                                                                     // garbage dates, NumberFormatException
\`\`\`

\`SimpleDateFormat\` keeps its working \`Calendar\` in an instance field, so concurrent \`format\`/\`parse\` calls corrupt each other — wrong dates, \`NumberFormatException\`, \`ArrayIndexOutOfBoundsException\` from deep inside \`java.text\`. The fix is not a lock; it is \`java.time.format.DateTimeFormatter\`, which is **immutable and thread-safe** (see the *Regex and dates* lesson). If legacy code forces \`SimpleDateFormat\`, use \`ThreadLocal.withInitial(() -> new SimpleDateFormat("dd/MM/yyyy"))\`.

Another check-then-act that is easy to miss: \`if (!map.containsKey(k)) map.put(k, create())\` on a \`ConcurrentHashMap\`. Each call is thread-safe; the **pair** is not. Use \`computeIfAbsent\` (atomic per key in \`ConcurrentHashMap\`).

## synchronized: intrinsic locks

Every object has an **intrinsic lock (monitor)**. \`synchronized\` acquires it on entry and releases it on exit — including exit by exception — and creates the happens-before edge for the next locker.

| Form | Lock object |
|---|---|
| \`synchronized void m()\` | \`this\` |
| \`static synchronized void m()\` | the \`Class\` object (\`Foo.class\`) |
| \`synchronized (lock) { ... }\` | \`lock\` — prefer a \`private final Object lock = new Object()\` |

Points interviewers probe:

- **Reentrancy:** a thread that holds a monitor can enter it again (the JVM keeps a hold count). A synchronized method calling another synchronized method on the same object does not deadlock itself.
- **Lock on what?** Two threads are only mutually excluded if they lock the **same object**. \`synchronized\` instance methods on two different page-object instances protect nothing shared between them. Never lock on a \`String\` literal (interned — shared JVM-wide), on a boxed \`Integer\`, or on a field that gets reassigned. Locking on \`this\` lets outside code lock your object too; a private lock object avoids that.
- **Method vs block:** a block lets you hold the lock only around the shared-state access, not around slow I/O. Never hold a lock while calling WebDriver or HTTP — every other thread queues behind a 2-second page load.
- **Cost:** uncontended locking is cheap in HotSpot (a CAS on the object header, the "thin/lightweight lock"); under contention the monitor is inflated and threads park. Biased locking, an old optimisation for single-thread locking, was disabled by default in JDK 15 (JEP 374). The real cost is **contention and serialization**, not the instruction.
- \`wait()\`/\`notify()\` must be called while holding the monitor (otherwise \`IllegalMonitorStateException\`) and \`wait\` must be in a \`while\` loop (spurious wake-ups). In modern code you reach for \`CountDownLatch\`, \`BlockingQueue\` or \`Condition\` instead.

## ReentrantLock and ReadWriteLock

\`java.util.concurrent.locks.ReentrantLock\` does what \`synchronized\` does, plus:

| Feature | \`synchronized\` | \`ReentrantLock\` |
|---|---|---|
| Release | automatic on block exit | **manual** — \`unlock()\` in \`finally\`, always |
| Try without blocking | no | \`tryLock()\` |
| Timeout | no | \`tryLock(500, TimeUnit.MILLISECONDS)\` |
| Interruptible wait | no | \`lockInterruptibly()\` |
| Fairness | no (barging) | \`new ReentrantLock(true)\` — FIFO-ish, lower throughput; note untimed \`tryLock()\` barges even on a fair lock |
| Multiple wait sets | one (\`wait\`/\`notify\`) | \`newCondition()\` as many as needed (\`await\`/\`signal\`) |
| Thread-dump visibility | "locked <0x...>" / BLOCKED | "parking to wait for <0x...> (a ReentrantLock$NonfairSync)" / WAITING |

\`\`\`java
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

public final class TwoLocks {
    private TwoLocks() { }

    /** Takes both locks or neither: returns false instead of waiting forever. */
    public static boolean withBoth(ReentrantLock first, ReentrantLock second, Runnable work) throws InterruptedException {
        if (!first.tryLock(500, TimeUnit.MILLISECONDS)) return false;     // give up instead of deadlocking
        try {
            if (!second.tryLock(500, TimeUnit.MILLISECONDS)) return false;
            try {
                work.run();               // both held: do the work
                return true;
            } finally {
                second.unlock();
            }
        } finally {
            first.unlock();               // unlock in finally, always
        }
    }
}
\`\`\`

Use \`ReentrantLock\` when you need one of the extra features — timeouts in particular. Otherwise \`synchronized\` is shorter, cannot be forgotten in a \`finally\`, and is just as fast in current JVMs.

**ReadWriteLock** (\`ReentrantReadWriteLock\`) allows many concurrent readers or one writer — a fit for a shared token or config cache read by every test and refreshed rarely. A reader cannot upgrade to a write lock (it deadlocks waiting for itself); downgrading write→read is allowed. For simple key/value caches a \`ConcurrentHashMap\` is usually the better choice; \`StampedLock\` (Java 8) adds optimistic reads but is not reentrant and is rarely worth it in test code.

## Atomics and CAS

\`AtomicInteger\`, \`AtomicLong\`, \`AtomicBoolean\` and \`AtomicReference<V>\` wrap a volatile value and offer atomic compound operations built on **compare-and-swap (CAS)**: "set to *new* only if the value is still *expected*", done by one CPU instruction. On failure the operation retries with the fresh value — optimistic, lock-free, no thread is ever parked.

| Method | Does |
|---|---|
| \`incrementAndGet()\`, \`addAndGet(n)\` | atomic arithmetic |
| \`compareAndSet(expect, update)\` | the CAS primitive; returns whether it won |
| \`updateAndGet(fn)\`, \`accumulateAndGet(x, fn)\` | CAS loop around a **side-effect-free** function (it may run more than once) |
| \`LongAdder.increment()\` / \`sum()\` | per-thread-ish cells, summed on read — far less contention for hot counters; \`sum()\` is not an atomic snapshot |

A realistic use: a shared API token refreshed when it expires, without a lock and without two threads both logging in "forever":

\`\`\`java
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

record Token(String value, Instant expiresAt) {                     // record: Java 16+
    boolean expired() { return Instant.now().isAfter(expiresAt.minusSeconds(30)); }
}

final class TokenHolder {
    private final AtomicReference<Token> current = new AtomicReference<>();
    private final Supplier<Token> login;                            // e.g. POST /api/auth/login (expiresIn 3600)
    TokenHolder(Supplier<Token> login) { this.login = login; }

    String value() {
        Token t = current.get();
        while (t == null || t.expired()) {
            Token fresh = login.get();
            if (current.compareAndSet(t, fresh)) return fresh.value();
            t = current.get();          // another thread won the race: re-read and re-check
        }
        return t.value();
    }
}
\`\`\`

Two threads may both call \`login\` at the moment of expiry (harmless — the loser's token is discarded); what they can never do is overwrite a newer token with an older one. If "login exactly once" were required, you would use a lock instead. **ABA:** CAS only compares references/values, so A→B→A looks unchanged; \`AtomicStampedReference\` adds a version counter when that matters (rare in test tooling).

## Thread-safe singletons compared

Config readers, report managers and API clients are often singletons. Four correct lazy-or-eager approaches (the unsafe \`if (instance == null) instance = new ...\` is shown in *Races* above):

\`\`\`java
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Properties;

// 1. synchronized getter: correct, every call takes the lock
final class SyncConfig {
    private static SyncConfig instance;
    private final Properties props;
    private SyncConfig() { props = ConfigLoader.load(); }
    static synchronized SyncConfig get() {
        if (instance == null) instance = new SyncConfig();
        return instance;
    }
    String value(String key) { return props.getProperty(key); }
}

// 2. double-checked locking: volatile is mandatory
final class DclConfig {
    private static volatile DclConfig instance;
    private final Properties props;
    private DclConfig() { props = ConfigLoader.load(); }
    static DclConfig get() {
        DclConfig local = instance;               // one volatile read on the fast path
        if (local == null) {
            synchronized (DclConfig.class) {
                local = instance;
                if (local == null) instance = local = new DclConfig();
            }
        }
        return local;
    }
    String value(String key) { return props.getProperty(key); }
}

// 3. initialization-on-demand holder: lazy, lock-free after init
final class HolderConfig {
    private final Properties props;
    private HolderConfig() { props = ConfigLoader.load(); }
    private static final class Holder {
        static final HolderConfig INSTANCE = new HolderConfig();   // runs on first access to Holder
    }
    static HolderConfig get() { return Holder.INSTANCE; }
    String value(String key) { return props.getProperty(key); }
}

// 4. enum singleton
enum EnumConfig {
    INSTANCE;
    private final Properties props = ConfigLoader.load();
    String value(String key) { return props.getProperty(key); }
}

final class ConfigLoader {
    static Properties load() {
        Properties p = new Properties();
        try (InputStream in = ConfigLoader.class.getResourceAsStream("/config.properties")) {
            if (in != null) p.load(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read config.properties", e);
        }
        p.putIfAbsent("baseUrl", "http://localhost:5180/practice-site/");
        return p;
    }
}
\`\`\`

How each one works:

- **Synchronized getter** — the monitor makes check-then-act atomic and publishes the instance. Correct but every \`get()\` from every thread contends on one lock.
- **Double-checked locking** — the fast path is an unlocked read. Without \`volatile\`, another thread can see a non-null reference **before** the constructor's writes (the JIT may publish the reference first) and read a \`null\` \`props\`. Since Java 5 (JSR-133), \`volatile\` forbids that reordering. The local variable avoids a second volatile read.
- **Holder idiom** — the JVM initializes a class lazily on first use and the JLS guarantees class initialization is done exactly once under an internal lock, with the result visible to all threads. \`Holder\` is loaded only when \`get()\` first touches it.
- **Enum** — the JVM creates \`INSTANCE\` during enum class initialization (same guarantee), serialization returns the same constant, and reflection cannot call an enum constructor.

| Approach | How it works | Advantages | Disadvantages | Performance | Maintainability | When to use |
|---|---|---|---|---|---|---|
| synchronized getter | lock around check-then-act | obvious, correct | lock on every call | contended under parallel load | high | low-traffic, or as a quick fix |
| DCL + volatile | unlocked fast path, locked slow path | lazy, fast | easy to get wrong (forgotten \`volatile\`, double read) | one volatile read | low — reviewers must know the JMM | when the instance needs runtime arguments and must be lazy |
| Holder class | JVM class-init lock | lazy, no explicit sync, short | cannot take constructor arguments; an exception in init gives \`NoClassDefFoundError\` on later calls | plain static read | high | **default for lazy singletons** |
| enum | JVM class-init + enum rules | shortest; serialization/reflection safe | eager on first enum use; cannot extend a class; feels odd to some teams | plain static read | high | stateless services, config, registries |

**Recommended:** the holder idiom (or an enum) for read-only singletons like \`ConfigReader\`. Better still, ask whether it needs to be a singleton: a value created once in the suite's composition root and passed in (see the *OOP and SOLID* deep dive, dependency inversion) is easier to test. And remember that a singleton is only thread-safe to **create** by these idioms — its **state** must be immutable or itself synchronized. A singleton \`WebDriver\` is wrong no matter how safely it is created.

## The best strategy: immutability and confinement

Locks are the last resort. The two strategies that remove whole classes of bugs:

- **Immutability** — an object whose state cannot change after construction (all fields \`final\`, no setters, defensive copies, e.g. records with \`List.copyOf\`) can be shared freely; the final-field rule even makes publication safe. Test data (\`User\`, \`Product\`, expected cart rows), config snapshots and \`DateTimeFormatter\` belong here.
- **Thread confinement** — mutable state that only one thread ever touches needs no synchronization: local variables, objects created inside the test method, step-definition instances that PicoContainer creates per scenario, and anything held in a \`ThreadLocal\`. A WebDriver session is the textbook case: mutable, not thread-safe, so it must be confined to one thread.

The design rule to say aloud: *share only immutable things; confine mutable things; synchronize the small remainder (counters, caches, reporters) with the narrowest tool.*

## ThreadLocal in depth

### How it works

\`ThreadLocal<T>\` does not store values itself. Each \`Thread\` object has a field \`threadLocals\` holding a \`ThreadLocal.ThreadLocalMap\`; the \`ThreadLocal\` instance is the **key**. \`tl.get()\` is effectively \`Thread.currentThread().threadLocals.get(tl)\`, so two threads calling the same static \`ThreadLocal\` read two different maps — no locking needed, because each map is confined to its thread.

In OpenJDK's implementation:

- \`ThreadLocalMap\` is a hand-written open-addressing hash table (linear probing, initial capacity 16), not a \`HashMap\`; each \`ThreadLocal\` gets a hash from a global counter advanced by \`0x61c88647\` so consecutive instances spread evenly.
- Each entry **extends \`WeakReference<ThreadLocal<?>>\`**: the key is weak, the **value is strong**. If the \`ThreadLocal\` object itself becomes unreachable, its key is cleared by GC, leaving a "stale" entry whose value is still reachable from the thread. Stale entries are expunged opportunistically during later \`get\`/\`set\`/\`remove\` calls on that map — not promptly.
- \`withInitial(supplier)\` (Java 8) creates the value lazily on the first \`get()\` in each thread.

### The ThreadLocal WebDriver pattern

\`\`\`java
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

import java.util.Objects;

public final class DriverManager {

    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    private DriverManager() { }

    /** Called from @BeforeMethod: one browser per test thread. */
    public static void start() {
        if (DRIVER.get() != null) {
            throw new IllegalStateException("Driver already started on " + Thread.currentThread().getName()
                    + " - a previous test did not call DriverManager.stop()");
        }
        ChromeOptions options = new ChromeOptions().addArguments("--headless=new");
        DRIVER.set(new ChromeDriver(options));
    }

    /** Used by page objects and steps. Fails loudly instead of returning null. */
    public static WebDriver driver() {
        return Objects.requireNonNull(DRIVER.get(),
                () -> "No driver for thread " + Thread.currentThread().getName() + " - was start() called?");
    }

    /** Called from @AfterMethod(alwaysRun = true). */
    public static void stop() {
        WebDriver d = DRIVER.get();
        try {
            if (d != null) d.quit();
        } finally {
            DRIVER.remove();      // pooled TestNG threads are reused: without remove() the next test sees a dead driver
        }
    }
}
\`\`\`

\`\`\`java
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

public abstract class BaseTest {
    @BeforeMethod(alwaysRun = true)
    public void startBrowser() {
        DriverManager.start();
        DriverManager.driver().get("http://localhost:5180/practice-site/login.html");
    }

    @AfterMethod(alwaysRun = true)
    public void stopBrowser() {
        DriverManager.stop();
    }
}
\`\`\`

Why each line is there:

- \`static final ThreadLocal\` — one *key* for the JVM, one *value* per thread. A static \`WebDriver\` is one value for the JVM.
- \`start()\` refuses a second start on the same thread: it turns "previous teardown did not run" into a clear message instead of a leaked browser.
- \`driver()\` fails with the **thread name** — the first thing you need when a page object is called from a thread that never started a browser (for example code in \`@BeforeClass\`, see the TestNG section below).
- \`@BeforeMethod\`/\`@AfterMethod\` run on the **same thread as the test method** in TestNG, which is what makes the pattern work. \`alwaysRun = true\` makes teardown run even when the test or a group dependency failed.
- \`quit()\` in \`try\`, \`remove()\` in \`finally\`: if \`quit()\` throws (browser already crashed), the slot is still cleared.

Page objects then take the driver in their constructor (\`new LoginPage(DriverManager.driver())\`) rather than calling the static accessor everywhere — the *OOP and SOLID* deep dive shows the same idea behind a \`DriverProvider\` interface.

### Memory leaks and stale values with thread pools

TestNG, Cucumber and every executor **reuse** threads. A value set and never removed lives as long as the thread — typically the whole suite:

- a quit \`WebDriver\` left in the slot → the next test on that thread gets \`NoSuchSessionException\`, or, with a \`get()\`-or-create accessor, silently reuses a dead or dirty session;
- per-test data (\`ScenarioContext\`, the logged-in user, a soft-assert collector) leaks into the next test on that thread — a **wrong-data bug**, worse than a leak;
- in app servers and long-lived tools, values whose classes came from a redeployed class loader keep that loader alive (the famous PermGen/Metaspace leak).

The weak key does **not** save you: a \`static final ThreadLocal\` is always strongly reachable, so its entries are never stale. Always pair \`set()\` with \`remove()\` in a \`finally\` or an always-run teardown.

### InheritableThreadLocal caveat

\`InheritableThreadLocal\` copies the parent's values into a child **when the child \`Thread\` is constructed**. With pools, threads are created once — by whichever thread first submitted work — so tasks see the value of that long-gone creator, not of the current submitter. Do not use it to pass the "current test" into an executor; pass the value explicitly into the task (or copy it into the task's own \`ThreadLocal\` at the start and remove it at the end).

## Deadlocks, livelock and starvation

A **deadlock** needs four conditions at once: mutual exclusion, hold-and-wait, no preemption, and a **circular wait**. Two threads that take the same two locks in opposite order are enough:

\`\`\`java
public class Deadlock {
    static final Object CART = new Object();
    static final Object INVENTORY = new Object();

    public static void main(String[] args) throws Exception {
        Thread a = new Thread(() -> {
            synchronized (CART) { pause(); synchronized (INVENTORY) { System.out.println("A done"); } }
        }, "checkout-thread");
        Thread b = new Thread(() -> {
            synchronized (INVENTORY) { pause(); synchronized (CART) { System.out.println("B done"); } }
        }, "restock-thread");
        a.start(); b.start();
        a.join(1000);
        System.out.println(a.getState() + " / " + b.getState());   // BLOCKED / BLOCKED - and the JVM never exits
    }

    static void pause() {
        try { Thread.sleep(100); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
\`\`\`

**Detecting it.** Take a thread dump of the hung JVM: \`jstack <pid>\` or \`jcmd <pid> Thread.print\` (find the pid with \`jps -l\`; in a console on Windows Ctrl+Break, on Linux \`kill -3 <pid>\`, prints to stdout). HotSpot detects monitor and \`java.util.concurrent\` lock cycles and prints a section like:

\`\`\`
Found one Java-level deadlock:
=============================
"checkout-thread":
  waiting to lock monitor 0x... (object 0x..., a java.lang.Object),
  which is held by "restock-thread"
"restock-thread":
  waiting to lock monitor 0x... (object 0x..., a java.lang.Object),
  which is held by "checkout-thread"
\`\`\`

Programmatically, \`ManagementFactory.getThreadMXBean().findDeadlockedThreads()\` returns the ids — a CI watchdog can dump and fail the build instead of letting the job hang until its global timeout.

**Fixes:** a global **lock order** (always CART before INVENTORY), hold one lock at a time, \`tryLock\` with timeouts (above), never call foreign code (listeners, WebDriver, HTTP) while holding a lock, and prefer designs without shared locks at all.

- **Livelock** — threads are not blocked but keep reacting to each other and make no progress (two retry loops that both back off and retry in lock-step). Fix with randomized back-off (jitter).
- **Starvation** — a thread never gets the resource: a low-priority or unlucky thread on an unfair lock, or a pool whose threads are all blocked waiting for tasks queued behind them (pool-induced deadlock — the next lesson shows it).

## Thread-safe collections: which one when

The internals of \`ConcurrentHashMap\` (CAS on empty bins, per-bin locking, no null keys/values, weakly consistent iterators) are in the *Collections internals* deep dive. Choosing between the options:

| Need | Use | Why / trade-off |
|---|---|---|
| shared map, many readers and writers | \`ConcurrentHashMap\` | fine-grained locking, atomic \`computeIfAbsent\`/\`merge\`; compound sequences of calls are still not atomic |
| shared set | \`ConcurrentHashMap.newKeySet()\` | same characteristics |
| list read often, written rarely (listeners, registered reporters) | \`CopyOnWriteArrayList\` | every write copies the array (O(n)); iteration is a lock-free **snapshot**, never \`ConcurrentModificationException\` |
| producer/consumer, hand-off between threads, resource pools | \`BlockingQueue\` (\`ArrayBlockingQueue\` bounded, \`LinkedBlockingQueue\` optionally bounded) | \`put\`/\`take\` block; \`offer\`/\`poll\` with timeouts |
| non-blocking queue | \`ConcurrentLinkedQueue\` | lock-free; \`size()\` is O(n) |
| sorted concurrent map | \`ConcurrentSkipListMap\` | O(log n), sorted, concurrent |
| legacy wrapper | \`Collections.synchronizedList(...)\` | one lock for everything; **iteration must be manually synchronized** on the list |

A \`BlockingQueue\` is the cleanest fix for "two parallel tests logged in with the same test account":

\`\`\`java
import java.time.Duration;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

public final class AccountPool {
    public record Account(String username, String password) { }    // Java 16+

    private final BlockingQueue<Account> free;

    public AccountPool(List<Account> accounts) {
        this.free = new ArrayBlockingQueue<>(accounts.size(), true, accounts);
    }

    public Account borrow(Duration wait) throws InterruptedException {
        Account a = free.poll(wait.toMillis(), TimeUnit.MILLISECONDS);
        if (a == null) throw new IllegalStateException("No free test account after " + wait + " - pool too small for thread-count?");
        return a;
    }

    public void giveBack(Account a) { free.offer(a); }             // in @AfterMethod(alwaysRun = true)
}
\`\`\`

Each thread borrows an exclusive account (for ShopEasy, accounts created through \`POST /api/users\` in a \`@BeforeSuite\`; the seeded \`standard_user\` alone is not enough for 8 threads that each modify a cart), and returns it in teardown. If the pool is smaller than \`thread-count\`, tests wait instead of corrupting each other's carts.

## TestNG parallel modes mapped to threads

| \`parallel=\` | What runs concurrently | Threads per unit | What is shared between concurrent threads |
|---|---|---|---|
| \`methods\` | every \`@Test\` method, independently | any method on any pool thread | **the test class instance** — instance fields are shared across methods running at the same time |
| \`classes\` | each class on its own thread; methods of one class run sequentially on that thread | one thread per class | static state; anything shared across classes |
| \`instances\` | each test class **instance** (e.g. from a \`@Factory\`) on its own thread | one per instance | static state |
| \`tests\` | each \`<test>\` tag of \`testng.xml\` on its own thread | one per \`<test>\` | static state, suite-level objects |
| \`none\` (default) | nothing | one | — |

- \`thread-count\` sets the pool size (TestNG's default is 5).
- \`@DataProvider(parallel = true)\` runs data rows concurrently on a **separate** pool sized by \`data-provider-thread-count\` (default 10) — so with \`parallel="methods" thread-count="4"\` and a parallel data provider you can have more browsers than you planned. Cucumber's \`AbstractTestNGCucumberTests\` uses exactly this: override \`scenarios()\` with \`@DataProvider(parallel = true)\` to run scenarios in parallel.
- \`@Test(threadPoolSize = 3, invocationCount = 30)\` runs one method many times on its own pool — useful for **reproducing a race** on purpose.

What must be per-thread (ThreadLocal or created inside the test): the \`WebDriver\`, page objects, scenario/test context, the logged-in user/account, soft-assert collectors, per-test log context. What may be shared: immutable config, immutable test data, thread-safe clients (\`java.net.http.HttpClient\`, a configured RestAssured \`RequestSpecification\` built once and not mutated afterwards), thread-safe reporters.

Two TestNG traps worth knowing:

1. With \`parallel="methods"\`, a driver created in \`@BeforeClass\` lives on the thread that ran \`@BeforeClass\`; test methods on other pool threads find an empty \`ThreadLocal\`. Create per-test resources in \`@BeforeMethod\`.
2. Instance fields in a test class (\`private String orderId;\`) are shared by concurrently running methods of that class under \`parallel="methods"\`. Use local variables, or switch that class to \`classes\` mode.

Report listeners (\`ITestListener\`) are called from all test threads concurrently — their counters need \`AtomicInteger\`/\`LongAdder\` and their result lists a concurrent collection; ExtentReports' \`ExtentTest\` per test is typically kept in a \`ThreadLocal\` for the same reason.

## Debugging a race in a test suite

1. **Recognise the pattern.** Failures that move between tests, pass on rerun, appear only above a certain \`thread-count\`, and show another test's data or \`NoSuchSessionException\` are concurrency bugs until proven otherwise.
2. **Put the thread in every log line.** Logback/Log4j2 pattern \`%d{HH:mm:ss.SSS} [%thread] %-5level %logger - %msg\` (Log4j2: \`%t\`), plus the test name in the MDC set in \`@BeforeMethod\`. Then grep the log of a failed test for its thread: you will see a second test's lines on the same browser or the same account.
3. **Check what is shared.** Search for \`static\` non-final fields, \`static\` collections, instance fields in test classes run with \`parallel="methods"\`, \`SimpleDateFormat\`, lazy singletons, and \`ThreadLocal.set\` without \`remove\`.
4. **Thread dumps for hangs.** \`jcmd <pid> Thread.print\` two or three times a few seconds apart: threads stuck in the same frame are your suspects (BLOCKED on a monitor, WAITING on a latch, RUNNABLE in \`socketRead\` with no timeout). Named threads (\`TestNG-methods-3\`, your own pool names) make this readable.
5. **Reproduce deliberately.** Raise \`thread-count\` beyond the core count, use \`invocationCount\` + \`threadPoolSize\` on the suspect test, add a short random sleep between the check and the act in the suspect code to widen the window. A race that reproduces 1 in 50 runs often reproduces 1 in 3 with 16 threads.
6. **Fix the design, not the symptom.** Confine (ThreadLocal, per-test objects) or make immutable first; add a lock only for genuinely shared state. "Run it with \`parallel="none"\`" or "add \`retryAnalyzer\`" hides the bug and costs the time savings that parallelism was supposed to buy.

For library-level code (a custom cache, a counter) the OpenJDK **jcstress** harness exists to test concurrency correctness; for test frameworks the steps above are usually enough.

## Common mistakes and debugging

- **\`volatile int\` counter in a listener** → totals slightly off under parallel runs. Use \`AtomicInteger\` / \`LongAdder\`.
- **DCL without \`volatile\`** → works on your laptop, rare \`NullPointerException\` from a half-initialised object on CI. Add \`volatile\` or switch to the holder idiom.
- **\`synchronized\` on the wrong object** — an instance method on per-test objects protecting a \`static\` list. The lock must be the same object for all threads touching the data: a \`static final\` lock or a concurrent collection.
- **Holding a lock around WebDriver/HTTP calls** → the suite runs at the speed of one thread. Thread dump shows many BLOCKED threads waiting for one RUNNABLE in \`socketRead\`. Shrink the critical section.
- **\`ThreadLocal\` without \`remove()\`** → second test on a thread gets a quit driver: \`NoSuchSessionException: Session ID is null. Using WebDriver after calling quit()?\` Remove in a \`finally\`/always-run teardown.
- **Swallowed \`InterruptedException\`** → pool shutdowns and \`@Test(timeOut)\` hang. Restore the flag.

## Best practices for experienced engineers

- Design for parallel from day one: no mutable statics, per-thread driver and context, immutable test data, unique test data per test (generated usernames, own accounts).
- Prefer, in this order: immutability → confinement → concurrent collections/atomics → locks.
- Name every thread you create; include the thread name and test name in logs.
- Every blocking call has a timeout (\`poll(timeout)\`, \`tryLock(timeout)\`, \`Future.get(timeout)\`, socket timeouts).
- Keep critical sections tiny and free of I/O; one lock at a time, or a documented lock order.
- \`set\`/\`remove\` symmetry for every \`ThreadLocal\`; fail loudly when the value is missing.
- Make parallelism a configuration knob (\`-Dthreads=8\` feeding \`thread-count\`) and run a nightly job at a higher count than PR builds to surface races early.

## Interview questions

### Q: What is the difference between volatile and synchronized?
**Short answer (30–60 s):** \`volatile\` guarantees visibility and ordering for one variable: every read sees the latest write and no reordering across it. It gives no mutual exclusion, so compound operations like \`count++\` still race. \`synchronized\` gives mutual exclusion **and** visibility: only one thread runs the block, and its writes are visible to the next thread taking the same lock.

**Detailed answer:** In JMM terms, a volatile write happens-before every later read of that variable; an unlock happens-before every later lock of the same monitor. \`volatile\` fits a single-writer flag or a reference to an immutable object replaced as a whole (for example a \`stop\` flag on a background log-shipper). Anything of the form read-check-write needs atomicity: \`synchronized\`, a \`Lock\`, or an atomic class whose CAS makes the compound step atomic. Cost: a volatile read is close to a normal read on x86; a contended lock parks threads. In test frameworks the commonest misuse is a \`volatile\` pass/fail counter in a TestNG listener.

### Q: Explain happens-before. Which rules do you rely on in a test framework?
**Short answer (30–60 s):** Happens-before is the JMM's guarantee that the effects of one action are visible to another. Without such an edge, another thread may see stale or reordered values. The main rules: program order, unlock→lock of the same monitor, volatile write→read, \`start()\`→thread body, thread body→\`join()\`, final fields after construction, and transitivity.

**Detailed answer:** Frameworks lean on the \`java.util.concurrent\` edges most: submitting a task happens-before it runs (so data built before \`submit\` is visible inside), task completion happens-before \`Future.get()\` returns, a \`put\` into a \`BlockingQueue\`/\`ConcurrentHashMap\` happens-before the read that sees it, \`countDown()\` happens-before \`await()\` returns. TestNG itself relies on these when it hands a test to a pool thread, which is why data prepared in \`@BeforeSuite\` is visible to tests on worker threads — as long as nobody mutates it afterwards.

### Q: How do you make a lazy singleton thread-safe? Which approach do you prefer?
**Short answer (30–60 s):** Four correct options: a \`synchronized\` getter, double-checked locking with a \`volatile\` field, the initialization-on-demand holder class, or an enum. I default to the holder idiom or an enum because the JVM's class-initialization guarantees do the work with no explicit synchronization.

**Detailed answer:** The synchronized getter is correct but contends on every call. DCL is fast but needs \`volatile\` to stop another thread seeing a reference to a half-constructed object; without it the bug is rare and hardware-dependent. The holder class is lazy (initialized on first \`get()\`), lock-free afterwards, and short — its limits are no constructor arguments and that a failure in the static initializer turns into \`NoClassDefFoundError\` on later calls. The enum is also serialization- and reflection-safe. I also question the singleton: a config object created in the composition root and injected is easier to test. And thread-safe **creation** says nothing about thread-safe **state** — the singleton's fields must be immutable or guarded.

\`\`\`java
final class ConfigReader {
    private ConfigReader() { }
    private static final class Holder { static final ConfigReader INSTANCE = new ConfigReader(); }
    static ConfigReader get() { return Holder.INSTANCE; }
}
\`\`\`

### Q: How does ThreadLocal work internally, and how can it leak?
**Short answer (30–60 s):** Each \`Thread\` has its own \`ThreadLocalMap\`; the \`ThreadLocal\` object is the key, so each thread sees its own value without locking. Entries have weak keys but strong values. With pooled threads that live for the whole run, a value set and never removed stays forever and is seen by the next task on that thread.

**Detailed answer:** In OpenJDK the map is an open-addressing table whose entries extend \`WeakReference<ThreadLocal<?>>\`. If a \`ThreadLocal\` becomes unreachable, the key is collected but the value stays until the map expunges stale entries during a later \`get\`/\`set\`/\`remove\`. In test frameworks the usual \`ThreadLocal\` is \`static final\`, so the key never goes away — the problem is not GC but **stale state**: a quit driver, a previous scenario's context or user. The fix is strict \`set\` in setup, \`remove()\` in an always-run teardown inside \`finally\`. \`InheritableThreadLocal\` does not help with pools because it copies values only when a thread is created.

### Q: TestNG runs with parallel="methods" thread-count="4". What must be thread-local, and what breaks if you create the driver in @BeforeClass?
**Short answer (30–60 s):** Anything mutable per test: the driver, page objects, scenario context, logged-in account, soft-assert collector. \`@BeforeClass\` runs once on one thread, so a \`ThreadLocal\` driver set there exists only for that thread; methods scheduled on the other three threads find no driver.

**Detailed answer:** In \`methods\` mode the class instance is shared by methods running concurrently, so even instance fields are shared state. \`@BeforeMethod\`/\`@AfterMethod\` run on the same thread as their test, so per-test resources belong there, with \`alwaysRun = true\` on teardown. A parallel data provider adds a second pool (\`data-provider-thread-count\`, default 10), so the real browser count can exceed \`thread-count\`; cap it with a \`Semaphore\` or Grid capacity. Shared but safe: immutable config, \`HttpClient\`, immutable request specifications.

### Q: How do you find and fix a deadlock in a hung CI job?
**Short answer (30–60 s):** Take a thread dump (\`jcmd <pid> Thread.print\` or \`jstack <pid>\`). HotSpot prints "Found one Java-level deadlock" with which thread holds which lock and waits for which. Fix by imposing a consistent lock order, holding one lock at a time, or using \`tryLock\` with a timeout.

**Detailed answer:** Several dumps a few seconds apart distinguish a deadlock (same threads, same frames, BLOCKED or WAITING on each other) from slowness. Named threads make the dump readable. For \`ReentrantLock\` the dump shows "parking to wait for <0x…> (a java.util.concurrent.locks.ReentrantLock$NonfairSync)" and the owner in "Locked ownable synchronizers" (\`jstack -l\`). A CI watchdog can call \`ThreadMXBean.findDeadlockedThreads()\` and dump threads before the job's global timeout kills the evidence. Most deadlocks in frameworks come from calling listener/reporter code while holding a lock — the fix is to collect data under the lock and call out after releasing it.

### Q: AtomicInteger vs LongAdder vs synchronized counter?
**Short answer (30–60 s):** All three are correct. \`AtomicInteger\` uses one CAS-updated value — great at low to moderate contention and gives an exact current value. \`LongAdder\` spreads updates over cells and sums on read — much faster under heavy contention, but \`sum()\` is not an atomic snapshot. A \`synchronized\` counter is fine when the increment is part of a larger critical section.

**Detailed answer:** CAS retries under contention, so many threads hammering one \`AtomicInteger\` waste cycles; \`LongAdder\` (Java 8) lets each thread mostly hit its own cell. For a test-result listener with 8 threads either works; for a load-generation tool counting millions of requests, \`LongAdder\`. If you need "increment and check a limit" atomically, you need \`compareAndSet\`/\`updateAndGet\` on an atomic, or a lock — not a \`LongAdder\`.

## Scenario-based questions

**1. After switching to \`parallel="methods"\` with 6 threads, about 3% of checkout tests fail with "expected 1 item in cart but found 2", always different tests.** Different tests failing with plausible but wrong data points to shared state, not the app. I'd add \`[%thread]\` and the test name to the log pattern, then look at the failing test's thread: two tests used the same account. All checkout tests log in as \`standard_user\`, so their server-side carts collide. The fix is unique data per test — an \`AccountPool\` (a \`BlockingQueue\` of accounts created via \`POST /api/users\` at suite start) or a fresh user per test — not \`synchronized\` around the tests, which would remove the parallelism.

**2. A nightly suite hangs until the 3-hour CI timeout.** I'd configure the job to take thread dumps when it exceeds its normal duration (\`jcmd <pid> Thread.print\` from a watchdog step). If the dump shows "Found one Java-level deadlock" between a report listener and a screenshot helper, it is lock ordering; if all \`TestNG-methods-*\` threads are RUNNABLE in \`socketRead\`, it is missing HTTP/WebDriver timeouts; if they are WAITING on a latch or \`Future.get()\` without timeout, it is a missing timeout in our tooling. Each has a different fix, which is why I get evidence before changing anything.

**3. A teammate proposes making every method of \`DriverFactory\` \`synchronized\` "to fix flaky parallel runs".** I'd ask what state is shared. If the factory only creates drivers, creating two at once is not a problem — the shared state is wherever the result is stored. Synchronizing would serialize browser startup (several seconds each) and hide the real bug. I'd move the driver into a \`ThreadLocal\` with \`remove()\` on teardown, make the factory stateless, and verify with \`thread-count\` raised to 10 and \`invocationCount\` on a smoke test.

## Tricky follow-ups

- **Does making a field \`volatile\` make \`count++\` safe?** No — visibility only; \`++\` is read-modify-write. Use \`AtomicInteger\`.
- **Is a \`static synchronized\` method and an instance \`synchronized\` method of the same class mutually exclusive?** No — one locks \`Foo.class\`, the other \`this\`.
- **Can a thread deadlock itself with \`synchronized\`?** Not by re-entering the same monitor (it is reentrant). It can with a non-reentrant lock, or by upgrading a \`ReentrantReadWriteLock\` read lock to a write lock.
- **Is \`Collections.synchronizedList\` safe to iterate while other threads add?** Only if you hold the list's lock during iteration (\`synchronized (list) { for (...) }\`); otherwise \`ConcurrentModificationException\`.
- **Does a weak key mean ThreadLocal values never leak?** No — the value is strongly referenced by the thread's map, and a \`static final ThreadLocal\` key never becomes weakly reachable anyway. Call \`remove()\`.`,
  keyPoints: [
    'Most flaky tests that only fail in parallel are race conditions in test code: shared statics, shared test accounts, instance fields under parallel="methods", lazy singletons, SimpleDateFormat.',
    'The Java Memory Model separates visibility, atomicity and ordering; a write is only guaranteed visible to another thread through a happens-before edge (lock, volatile, start/join, final fields, java.util.concurrent hand-offs).',
    'volatile gives visibility and ordering but not atomicity: count++ on a volatile field loses updates; use AtomicInteger, LongAdder or a lock.',
    'synchronized is reentrant and only excludes threads that lock the same object; ReentrantLock adds tryLock with timeouts, interruptible waits, fairness and Conditions but must be unlocked in finally.',
    'For lazy singletons prefer the initialization-on-demand holder or an enum; double-checked locking needs a volatile field. Safe creation does not make the singleton\'s state thread-safe.',
    'Prefer immutability and thread confinement over locks; ThreadLocal confines a WebDriver per thread, but pooled threads are reused, so every set() needs a remove() in an always-run teardown.',
    'Deadlocks come from circular lock waits; detect them with jstack/jcmd Thread.print ("Found one Java-level deadlock") and prevent them with a lock order, one lock at a time, or tryLock timeouts.',
    'TestNG: methods mode shares the test class instance across threads, @BeforeClass runs on a single thread, parallel data providers use their own pool (data-provider-thread-count, default 10) — keep driver, pages, context and accounts per thread.',
  ],
  mistakes: [
    'Counting results in a TestNG listener with a volatile int or a plain static int, so totals are slightly wrong under parallel runs. Fix: AtomicInteger or LongAdder; verify by running the suite with thread-count raised to 16 and comparing totals with the TestNG report.',
    'Double-checked locking without volatile on the instance field. Fix: add volatile or switch to the holder idiom; such bugs rarely reproduce locally, so review for the pattern rather than waiting for a failure.',
    'Storing the driver in a ThreadLocal but never calling remove(), so the next test on a pooled thread gets "NoSuchSessionException: Session ID is null. Using WebDriver after calling quit()?". Fix: quit in try, remove() in finally, in @AfterMethod(alwaysRun = true); make start() fail if a driver is already present.',
    'Creating the ThreadLocal driver in @BeforeClass with parallel="methods": tests on other threads get null. Fix: create per-test resources in @BeforeMethod; log Thread.currentThread().getName() in the accessor\'s error message to see the mismatch immediately.',
    'Wrapping WebDriver or HTTP calls inside synchronized blocks to "fix" flakiness, turning the parallel run into a serial one. Diagnose with a thread dump (many BLOCKED threads, one RUNNABLE in socketRead); fix by confining state per thread instead of locking.',
    'Catching InterruptedException and doing nothing, so @Test(timeOut) and executor shutdowns cannot stop a polling helper. Fix: Thread.currentThread().interrupt() and return, or rethrow.',
  ],
  tryIt: `1. Run \`CounterRace\` from this lesson three times with 2, 8 and 32 threads and note how many updates the \`volatile\` counter loses; then replace the loop body with \`updateAndGet(x -> x + 1)\` on an \`AtomicInteger\` and explain why the function must have no side effects.
2. Build a tiny TestNG suite (\`parallel="methods" thread-count="4"\`, 8 test methods) whose tests open \`http://localhost:5180/practice-site/login.html\`, log in and read the inventory page title. First use a \`static WebDriver\` and record what fails; then switch to the \`DriverManager\` from this lesson. Add \`[%thread]\` to your log pattern and show from the log that each test used its own browser.
3. Remove the \`DRIVER.remove()\` line, set \`thread-count="2"\` with 6 tests, and read the exception the third test gets. Put the line back.
4. Start the \`Deadlock\` example, run \`jps -l\` and \`jcmd <pid> Thread.print\`, and find the "Found one Java-level deadlock" section. Fix it with a consistent lock order and with the \`TwoLocks.withBoth\` helper, and say which you would keep in a framework.`,
  problems: ['java-007', 'java-008', 'java-021', 'java-025', 'java-029'],
}
