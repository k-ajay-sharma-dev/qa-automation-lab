export default {
  slug: 'restassured-deep-database-testing-jdbc',
  category: 'restassured',
  order: 18,
  title: 'Deep dive: database testing in automation — JDBC, connection pools, test data and UI/API/DB validation',
  minutes: 30,
  summary: 'Decide when a database check is worth its coupling, build a read-only, parallel-safe JDBC helper with HikariCP, validate an order across API, database and UI, choose a test data strategy (API, SQL, migrations, Testcontainers), do the same in Playwright with pg, and debug the failures database tests really have.',
  manualAnalogy: `When you tested by hand, you sometimes asked a DBA to run one query because the screen could not prove that the order was really stored. You did not ask for every check, only for facts no screen showed. Database automation is the same habit with rules: your own read-only key, your own records, and one exact question.`,
  body: `## Scope, and one honest fact about ShopEasy

\`restassured-deep-sql-for-testers\` defined the schema (users, products, carts/cart_items, orders, order_items, payments), the seed and the queries. This lesson puts those queries into a framework: when a database check is worth its cost, how JDBC and pools work, a small read-only helper, parallel safety, test data, Testcontainers, and the same idea in TypeScript.

**ShopEasy itself has no database**: the practice API keeps everything in memory, its web shop keeps the cart in \`sessionStorage\`, it has no order-history page, and placing an order does not change stock. Everything below that touches tables is therefore **a typical real app** that exposes ShopEasy's API contract on top of PostgreSQL. The API calls, fields and totals are ShopEasy's real ones.

Not repeated here: \`ApiConfig\`, clients and builders (\`restassured-deep-api-framework-architecture\`), money matchers (\`restassured-deep-assertions-json-contracts\`), Awaitility basics and WireMock (\`restassured-deep-advanced-api-testing\`), injection probes through the API (\`restassured-deep-auth-security-testing\`), try-with-resources and suppressed exceptions (\`java-deep-exception-design\`), thread pools (\`java-deep-executors-completablefuture\`).

## 1. What to validate in the database — and when not to

| Validate in the DB | Why only there |
|---|---|
| Side effects no API exposes: audit rows, outbox/event rows, soft-delete flags, password hash is not plain text | no other observation point |
| Derived data: totals, stock, balances computed by jobs or triggers | the API may recompute and hide a bad stored value |
| Constraints and concurrency: exactly one row after N parallel requests | the API answers 201/409; only rows prove it |
| Migrations, ETL, batch jobs | the database *is* the product |
| Data-integrity suites over the whole table | the API shows one record at a time |

| Do **not** validate in the DB | Better |
|---|---|
| A field the public API already returns | \`GET\` it back — that is what clients use |
| Business rules (validation, permissions) | API tests: fast, and they survive a schema refactor |
| Every column after every test | one persistence check per operation |
| Another team's tables | their API or contract tests |

**The cost is coupling.** A schema is an implementation detail: split \`orders\` into two tables and the API contract does not move, but 200 SQL assertions break. A microservice that owns its data may not even be reachable. So the rule is: **arrange through the API, act through UI/API, assert at the highest level that can observe the fact, and go to the database only for facts nothing else shows.** Keep all SQL behind a few query classes so a schema change touches one file.

A direct read also sees uncached truth: if the API serves a cache, API and DB can legitimately differ for a while. Know which one your requirement talks about.

## 2. How JDBC works

| Piece | Role | Senior detail |
|---|---|---|
| Driver (\`org.postgresql.Driver\`) | speaks the database's wire protocol | JDBC 4 drivers register through \`ServiceLoader\` (\`META-INF/services/java.sql.Driver\`); \`Class.forName(...)\` has not been needed since Java 6. It may still appear where class loaders hide the jar (old web containers) |
| \`DriverManager\` | \`getConnection(url, user, pw)\` opens a **new physical connection** | TCP + TLS + authentication + a server process in PostgreSQL: tens of milliseconds and real server memory |
| \`DataSource\` | factory interface; a pool implements it | depend on this type, not on DriverManager |
| \`Connection\` | a session with its transaction state | **not** for sharing between threads |
| \`Statement\` | SQL text sent as is | no parameters: injection risk |
| \`PreparedStatement\` | SQL with \`?\`; values sent separately | parsed separately from data; can be cached by the server |
| \`CallableStatement\` | stored procedures \`{call proc(?)}\` | OUT parameters |
| \`ResultSet\` | cursor over rows, starts **before** row 1 | dies with its Statement/Connection |

Four defaults that cause most surprises:

* **Autocommit is on** for a new connection: each statement is its own transaction. Turn it off to group statements, and then you must commit or roll back.
* **Fetch size.** The PostgreSQL driver reads the *whole* result into memory unless autocommit is off, the result set is forward-only, the statement is a single query, and \`setFetchSize(n)\` is set. Miss one condition and it silently loads everything.
* **Timeouts.** Without a query timeout a blocked query waits forever, and so does your build. There are several layers: pool wait (\`connectionTimeout\`), socket connect/read (driver properties), statement (\`setQueryTimeout\` or the server's \`statement_timeout\`).
* **NULL in primitives.** \`rs.getLong("x")\` returns \`0\` for NULL; only \`rs.wasNull()\` immediately afterwards tells you.

### SQL injection and PreparedStatement

\`\`\`java
// WRONG: the value becomes SQL. name = "x' OR '1'='1" returns every user.
try (Statement st = con.createStatement();
     ResultSet rs = st.executeQuery("SELECT id FROM users WHERE username = '" + name + "'")) { /* ... */ }

// RIGHT: the statement is parsed with a placeholder; the value can never become syntax.
try (PreparedStatement ps = con.prepareStatement("SELECT id FROM users WHERE username = ?")) {
    ps.setString(1, name);
    try (ResultSet rs = ps.executeQuery()) { /* ... */ }
}
\`\`\`

In test code "nobody attacks us" is not the argument; correctness is: a customer called *O'Brien* breaks concatenated SQL, dates get formatted per locale, and reviewers copy what they see. Placeholders stand for **values only** — table names, column names and \`ASC/DESC\` cannot be bound, so choose them from a fixed whitelist. For \`IN\` lists, PostgreSQL accepts an array: \`WHERE id = ANY (?)\` with \`ps.setArray(1, con.createArrayOf("integer", ids))\`. A stored procedure that concatenates its parameter into dynamic SQL is still injectable, PreparedStatement or not.

### Why a pool

A pool keeps physical connections open and lends them: \`getConnection()\` borrows, \`close()\` **returns** (the object is a proxy). Benefits: microseconds instead of milliseconds, and an upper bound on connections. HikariCP facts from its README: \`maximumPoolSize\` defaults to 10, \`connectionTimeout\` (how long a borrower waits) to 30 s, \`maxLifetime\` to 30 minutes, \`autoCommit\` to true, and \`leakDetectionThreshold\` is off (minimum value to enable: 2000 ms). Pool size should follow **concurrent borrowers**, so roughly the number of test threads — and it multiplies by JVM: 4 Surefire forks × 10 connections = 40 sessions against a PostgreSQL whose default \`max_connections\` is 100.

## 3. Dependencies and configuration

\`\`\`xml
<dependencies>
  <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId>
    <version>\${postgresql.version}</version><scope>test</scope></dependency>
  <dependency><groupId>com.zaxxer</groupId><artifactId>HikariCP</artifactId>
    <version>\${hikaricp.version}</version><scope>test</scope></dependency>
  <dependency><groupId>org.awaitility</groupId><artifactId>awaitility</artifactId>
    <version>\${awaitility.version}</version><scope>test</scope></dependency>
  <dependency><groupId>org.assertj</groupId><artifactId>assertj-core</artifactId>
    <version>\${assertj.version}</version><scope>test</scope></dependency>
  <dependency><groupId>org.testcontainers</groupId><artifactId>testcontainers-postgresql</artifactId>
    <version>\${testcontainers.version}</version><scope>test</scope></dependency>
</dependencies>
\`\`\`

Pin the versions as properties and let a bot update them. Current HikariCP 7.x needs Java 11+. **Testcontainers 2.x renamed modules** (\`testcontainers-postgresql\`; in 1.x it was \`postgresql\`) and has a non-generic class \`org.testcontainers.postgresql.PostgreSQLContainer\`. If the helper lives in \`src/main/java\` of a shared module, use \`compile\` scope for HikariCP and \`runtime\` for the driver (scopes: \`framework-deep-maven-build-internals\`).

| Setting | Local / container | Shared QA / staging | Production |
|---|---|---|---|
| Account | container owner | \`qa_ro\`: \`SELECT\` on needed tables or views only | none by default; approved, audited, read-only replica |
| Secret source | generated by Testcontainers | CI secret store → env variable; short-lived credentials if the platform offers them | vault, per-person |
| Write access | yes, throwaway | separate \`qa_fixture\` account, used only by set-up code | never |
| Personal data | synthetic | masked copies | stays there |

\`\`\`sql
CREATE ROLE qa_ro LOGIN PASSWORD 'set-by-your-dba';
GRANT USAGE ON SCHEMA public TO qa_ro;
GRANT SELECT ON users, products, orders, order_items, payments TO qa_ro;
ALTER ROLE qa_ro SET default_transaction_read_only = on;   -- belt and braces; the missing grants are the real guard
ALTER ROLE qa_ro SET statement_timeout = '10s';
\`\`\`

The account is the control that matters. \`setReadOnly(true)\` is a hint, a naming convention is a wish; a missing grant is a fact.

## 4. A read-only \`Db\` helper in Java 17

\`\`\`java
package com.shopeasy.db;

import java.util.Objects;

/** Where and how to connect. Values come from the environment; the password never appears in toString(). */
public record DbConfig(String jdbcUrl, String user, String password, int poolSize) {

    public DbConfig {
        Objects.requireNonNull(jdbcUrl, "DB_URL");
        Objects.requireNonNull(user, "DB_USER");
        Objects.requireNonNull(password, "DB_PASSWORD");
        if (poolSize < 1 || poolSize > 20) throw new IllegalArgumentException("poolSize must be 1..20, was " + poolSize);
        if (jdbcUrl.contains("password=")) throw new IllegalArgumentException("keep the password out of the JDBC URL");
    }

    public static DbConfig fromEnvironment() {
        return new DbConfig(System.getenv("DB_URL"), System.getenv("DB_USER"), System.getenv("DB_PASSWORD"),
                Integer.getInteger("db.poolSize", 4));
    }

    @Override public String toString() { return "DbConfig[" + jdbcUrl + ", user=" + user + ", pool=" + poolSize + "]"; }
}
\`\`\`

\`\`\`java
package com.shopeasy.db;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;

/** The current row, read by column name, with correct NULL and java.time handling. */
public final class Row {

    private final ResultSet rs;

    Row(ResultSet rs) { this.rs = rs; }

    public long longValue(String column) throws SQLException {
        long value = rs.getLong(column);
        if (rs.wasNull()) throw new IllegalStateException("column " + column + " is NULL");   // 0 would lie
        return value;
    }

    public int intValue(String column) throws SQLException { return Math.toIntExact(longValue(column)); }

    public Long nullableLong(String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    public boolean bool(String column) throws SQLException {
        boolean value = rs.getBoolean(column);
        if (rs.wasNull()) throw new IllegalStateException("column " + column + " is NULL");
        return value;
    }

    public String text(String column) throws SQLException { return rs.getString(column); }

    public BigDecimal decimal(String column) throws SQLException { return rs.getBigDecimal(column); }  // never getDouble

    /** TIMESTAMPTZ. The PostgreSQL driver supports OffsetDateTime here, but not Instant. */
    public Instant instant(String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }
}

@FunctionalInterface
interface RowMapper<T> {          // public, in its own file
    T map(Row row) throws SQLException;
}

class DbException extends RuntimeException {          // public, in its own file
    DbException(String sql, SQLException cause) {
        super("SQLState " + cause.getSQLState() + ": " + cause.getMessage() + "\\nSQL: " + sql, cause);
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/** Read-only access for assertions. Thread-safe: create one per JVM and share it. */
public final class Db implements AutoCloseable {

    private static final int QUERY_TIMEOUT_SECONDS = 10;
    private final HikariDataSource dataSource;

    public Db(DbConfig config) {
        HikariConfig h = new HikariConfig();
        h.setPoolName("qa-ro");
        h.setJdbcUrl(config.jdbcUrl());
        h.setUsername(config.user());
        h.setPassword(config.password());
        h.setMaximumPoolSize(config.poolSize());
        h.setMinimumIdle(0);                                  // no idle sessions held on a shared database
        h.setConnectionTimeout(5_000);                        // fail fast when the pool is exhausted
        h.setLeakDetectionThreshold(30_000);                  // logs the stack trace of a forgotten close()
        h.setAutoCommit(false);                               // needed for READ ONLY transactions and for fetch size
        h.setReadOnly(true);
        h.addDataSourceProperty("ApplicationName", "qa-automation");   // visible in pg_stat_activity
        h.addDataSourceProperty("connectTimeout", "5");                // seconds
        h.addDataSourceProperty("socketTimeout", "30");                // seconds
        this.dataSource = new HikariDataSource(h);
    }

    public <T> List<T> list(String sql, RowMapper<T> mapper, Object... params) {
        try (Connection con = dataSource.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            ps.setFetchSize(500);
            bind(ps, params);
            try (ResultSet rs = ps.executeQuery()) {
                Row row = new Row(rs);
                List<T> result = new ArrayList<>();
                while (rs.next()) result.add(mapper.map(row));
                return Collections.unmodifiableList(result);  // fully read: nothing lazy leaves this method
            }
        } catch (SQLException e) {
            throw new DbException(sql, e);
        }
    }

    public <T> Optional<T> find(String sql, RowMapper<T> mapper, Object... params) {
        List<T> rows = list(sql, mapper, params);
        if (rows.size() > 1) throw new IllegalStateException("expected at most 1 row, got " + rows.size() + ": " + sql);
        return rows.stream().findFirst();
    }

    public <T> T one(String sql, RowMapper<T> mapper, Object... params) {
        return find(sql, mapper, params).orElseThrow(() -> new IllegalStateException("no row: " + sql));
    }

    private static void bind(PreparedStatement ps, Object... params) throws SQLException {
        for (int i = 0; i < params.length; i++) {
            Object p = params[i];
            if (p instanceof Instant instant) p = instant.atOffset(ZoneOffset.UTC);
            if (p instanceof Enum<?> e)       p = e.name();
            ps.setObject(i + 1, p);
        }
    }

    @Override public void close() { dataSource.close(); }
}
\`\`\`

\`\`\`java
package com.shopeasy.db;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** All SQL about orders lives here. A schema change touches this file, not the tests. */
public final class OrderQueries {

    public record OrderRow(long id, long userId, String status, int itemCount,
                           BigDecimal subtotal, BigDecimal tax, BigDecimal total, Instant createdAt) {
        static OrderRow from(Row r) throws SQLException {
            return new OrderRow(r.longValue("id"), r.longValue("user_id"), r.text("status"), r.intValue("item_count"),
                    r.decimal("subtotal"), r.decimal("tax"), r.decimal("total"), r.instant("created_at"));
        }
    }

    public record ItemRow(long productId, BigDecimal price, int quantity, BigDecimal lineTotal) {
        static ItemRow from(Row r) throws SQLException {
            return new ItemRow(r.longValue("product_id"), r.decimal("price"), r.intValue("quantity"), r.decimal("line_total"));
        }
    }

    private final Db db;

    public OrderQueries(Db db) { this.db = db; }

    public Optional<OrderRow> byId(long id) {
        return db.find("""
                SELECT id, user_id, status, item_count, subtotal, tax, total, created_at
                FROM   orders
                WHERE  id = ?
                """, OrderRow::from, id);
    }

    public List<ItemRow> items(long orderId) {
        return db.list("""
                SELECT product_id, price, quantity, line_total
                FROM   order_items
                WHERE  order_id = ?
                ORDER  BY product_id
                """, ItemRow::from, orderId);
    }

    public int stock(long productId) {
        return db.one("SELECT stock FROM products WHERE id = ?", r -> r.intValue("stock"), productId);
    }
}
\`\`\`

**Step by step.**

1. Four resources, all closed in reverse order by try-with-resources, even when mapping fails. \`con.close()\` returns the connection; HikariCP rolls back an open transaction at that point, so every query starts clean.
2. \`autoCommit=false\` has two effects in PostgreSQL: with \`readOnly\` the driver starts \`BEGIN READ ONLY\` (its default \`readOnlyMode=transaction\` does nothing in autocommit mode), so an accidental UPDATE fails with SQLState 25006; and fetch size really streams.
3. Rows are mapped **by name** to immutable records. \`SELECT *\` plus positional getters breaks when someone adds a column.
4. Money is \`BigDecimal\`, time is \`Instant\`. \`getTimestamp()\` + \`LocalDateTime\` without a zone is how tests pass in Pune and fail on a UTC agent.
5. \`find\` fails on two rows: "first row wins" hides duplicates.
6. \`DbException\` carries SQLState and SQL text. It deliberately omits parameter values, which may be personal data.
7. \`Db\` has no static state: it is created once (suite set-up) and injected.

## 5. Parallel execution safety

| Object | Share between threads? |
|---|---|
| \`HikariDataSource\` / \`Db\` / \`OrderQueries\` (stateless) | yes, one per JVM |
| \`Connection\`, \`Statement\`, \`ResultSet\` | **no** — borrow per call |
| A \`static Connection\` in \`BaseTest\` | no: two threads interleave on one session; one thread's \`close()\` gives the other "This connection has been closed" |
| \`ThreadLocal<Connection>\` | works, but holds a connection per thread for the whole run and needs clean-up; the pool does this better |

A pool does not make **data** safe. "Count of orders is 1" is wrong while other tests place orders; "the order with *my* id" is right. Stock is shared by nature: assert a stock change only on a product this test created or exclusively reserved.

Pool exhaustion deadlock: a method that borrows a second connection while holding the first can block every thread when the pool is as large as the thread count. The helper above never does: it reads everything, returns the connection, then runs your code.

## 6. Rollback for isolation — and why it usually fails in end-to-end tests

For code tested **in the same transaction** (DAO, stored procedure, trigger), begin → arrange → act → assert → rollback is elegant: nothing to clean.

\`\`\`java
@Test
public void quantityElevenIsRejectedByTheDatabase() throws SQLException {
    try (Connection con = writerDataSource.getConnection()) {           // throwaway database, see section 10
        con.setAutoCommit(false);
        try (PreparedStatement ps = con.prepareStatement(
                "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)")) {
            ps.setInt(1, 1); ps.setInt(2, 2); ps.setInt(3, 11);
            assertThatThrownBy(ps::executeUpdate)
                .isInstanceOfSatisfying(SQLException.class,
                        e -> assertThat(e.getSQLState()).isEqualTo("23514"));   // check_violation
        } finally {
            con.rollback();
        }
    }
}
\`\`\`

In an API or UI test the application uses **its own connections**:

\`\`\`
test connection          application connection
BEGIN
INSERT user 900
                         GET /api/users/900  -> 404   (uncommitted rows are invisible, READ COMMITTED and above)
                         POST /api/users, same username -> WAITS on the unique index entry of the open transaction
... test waits for the HTTP response, the app waits for the test's commit ...   -> timeout
ROLLBACK
\`\`\`

The second half is nasty: it is a deadlock the database cannot detect, because one edge of the cycle is an HTTP call. And nothing you roll back touches what the *application* committed. \`@Transactional\` in Spring tests has the same limit: with \`webEnvironment = RANDOM_PORT\` the server runs on other threads and other connections.

**So:** rollback isolation for in-process database code; committed, uniquely owned data for everything that crosses a process.

## 7. JDBC, JdbcTemplate, JDBI, DbUtils or an ORM

\`\`\`java
// Spring JdbcTemplate (no Spring context needed). DataClassRowMapper maps records, snake_case -> camelCase.
JdbcTemplate jdbc = new JdbcTemplate(dataSource);
List<OrderRow> rows = jdbc.query("SELECT * FROM orders WHERE user_id = ?", DataClassRowMapper.newInstance(OrderRow.class), 1);

// JDBI 3: named parameters, constructor mapping
Jdbi jdbi = Jdbi.create(dataSource);
OrderRow row = jdbi.withHandle(h -> h.createQuery("SELECT * FROM orders WHERE id = :id")
        .bind("id", 1001).map(ConstructorMapper.of(OrderRow.class)).one());

// Apache Commons DbUtils: thin; maps to Map or to JavaBeans with setters
List<Map<String, Object>> maps = new QueryRunner(dataSource)
        .query("SELECT * FROM orders WHERE user_id = ?", new MapListHandler(), 1);
\`\`\`

| | Plain JDBC + helper | JdbcTemplate | JDBI | DbUtils | ORM (JPA/Hibernate) |
|---|---|---|---|---|---|
| How it works | your 100 lines | template closes resources, translates exceptions | fluent API, plugins, declarative SQL objects | tiny wrapper | entities, generated SQL |
| Advantages | no dependency, full control, teaches JDBC | mature, records via DataClassRowMapper, named parameters | modern, immutable friendly | very small | none of the SQL to write |
| Disadvantages | you maintain it | brings spring-jdbc/-tx/-core | extra library to learn | dated; beans only | caches, lazy loading, **reuses the app's mapping** |
| Performance | best | same | same | same | hidden extra queries |
| Maintainability | good if kept small | high | high | medium | low for assertions |
| Scalability (many queries) | medium | high | high | low | — |
| Use when | few checks, or no dependencies allowed | Spring shops, 30+ queries | non-Spring, 30+ queries | legacy suites | do not assert through it |

**Recommended:** the small helper for a handful of checks; JdbcTemplate (or \`JdbcClient\`, Spring 6.1+) when the team already knows Spring; JDBI otherwise. Avoid asserting through the application's own entities: a wrong column mapping then reads its own mistake back, and the first-level cache may return the object you just saved without touching the database.

## 8. End to end: API → DB → UI

Story: a customer orders one Trailblazer Backpack (29.99) and two Pulse Bike Lights (9.99). Expected by the 8% rule: subtotal 49.97, tax 4.00 (3.9976 rounded), total 53.97.

\`\`\`java
package com.shopeasy.e2e;

import com.shopeasy.api.clients.CustomerSession;
import com.shopeasy.api.models.*;
import com.shopeasy.db.OrderQueries;
import com.shopeasy.db.OrderQueries.ItemRow;
import com.shopeasy.db.OrderQueries.OrderRow;
import org.testng.annotations.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.awaitility.Awaitility.await;

public class OrderPersistenceTest extends BaseE2eTest {          // typical real app; gives me(), db(), driver()

    private static final int BACKPACK = 1, BIKE_LIGHT = 2;

    @Test
    public void placedOrderIsStoredCompletelyAndShownInTheHistory() {
        OrderQueries orders = new OrderQueries(db());
        CustomerSession customer = me();                         // a new customer for this test
        Instant before = Instant.now();

        // 1. act through the API
        Order placed = customer.orders().place(OrderRequest.withItems(
                new Customer("Mia", "Tester", "560001"),
                List.of(new AddItem(BACKPACK, 1), new AddItem(BIKE_LIGHT, 2))));

        // 2. the row may be written by an asynchronous consumer: poll, never sleep
        OrderRow row = await("order " + placed.id() + " stored")
                .atMost(Duration.ofSeconds(10)).pollInterval(Duration.ofMillis(250))
                .until(() -> orders.byId(placed.id()), Optional::isPresent)
                .orElseThrow();

        // 3. header: owner, status, money recomputed by the test, time window
        assertThat(row.userId()).isEqualTo(customer.user().id());
        assertThat(row.status()).isEqualTo("PLACED");
        assertThat(row.itemCount()).isEqualTo(3);
        assertThat(row.subtotal()).isEqualByComparingTo("49.97");
        assertThat(row.tax()).isEqualByComparingTo("4.00");
        assertThat(row.total()).isEqualByComparingTo("53.97");
        assertThat(row.createdAt()).isCloseTo(before, within(60, java.time.temporal.ChronoUnit.SECONDS));

        // 4. lines: exactly two, price copied at purchase time
        assertThat(orders.items(placed.id()))
                .usingRecursiveFieldByFieldElementComparator(
                        org.assertj.core.api.recursive.comparison.RecursiveComparisonConfiguration.builder()
                                .withComparatorForType(BigDecimal::compareTo, BigDecimal.class).build())
                .containsExactly(
                        new ItemRow(BACKPACK, new BigDecimal("29.99"), 1, new BigDecimal("29.99")),
                        new ItemRow(BIKE_LIGHT, new BigDecimal("9.99"), 2, new BigDecimal("19.98")));

        // 5. the UI shows the same order (page object of the typical real app; ShopEasy has no such page)
        OrderHistoryPage history = new OrderHistoryPage(driver()).openAs(customer);
        assertThat(history.totalOf(placed.id())).isEqualTo("$53.97");
    }

    @Test
    public void orderReducesTheStockOfAProductOnlyThisTestUses() {
        OrderQueries orders = new OrderQueries(db());
        long productId = productFixture().createWithStock(5);    // admin API or fixture account; see section 9
        me().orders().place(OrderRequest.withItems(
                new Customer("Mia", "Tester", "560001"), List.of(new AddItem((int) productId, 2))));

        await("stock of " + productId).atMost(Duration.ofSeconds(10))
                .untilAsserted(() -> assertThat(orders.stock(productId)).isEqualTo(3));
    }
}
\`\`\`

**Step by step.** (1) The API creates the data, so the test survives schema changes in everything it does not assert. (2) \`until(supplier, predicate)\` returns the row, so there is one read path; a timeout message names the order. If the write is synchronous by contract, **do not poll** — polling would hide a regression to asynchronous. (3) Expected money comes from the requirement, not from \`placed.total()\`: comparing the response with the row only proves they agree. \`isEqualByComparingTo\` ignores scale. (4) \`containsExactly\` also proves there is no third line. (5) The UI part checks presentation of one value. In a real suite I would keep this three-layer test to one or two critical journeys, and cover variations at API level.

**"Not there" checks** need the opposite care: after a refused request, "no row" is true immediately and also true one millisecond before a late write. Use Awaitility's \`during(...)\` with \`atMost(...)\`, or better, wait for a positive signal first (the rejected status, a processed-event marker).

### CRUD mapping: UI action → API → SQL

| UI action | API call (ShopEasy contract) | Statement the app runs (typical) | DB assertion |
|---|---|---|---|
| Register | \`POST /api/users\` → 201 / 409 \`USERNAME_TAKEN\` | \`INSERT INTO users\` | one row; password column is a hash (if you may read it) |
| Add to cart | \`POST /api/cart/items\` → 201 / 409 | \`INSERT INTO cart_items\` | one row per (cart, product), also after two parallel calls |
| Remove from cart | \`DELETE /api/cart/items/{productId}\` → 204 | \`DELETE FROM cart_items\` | row gone, other lines untouched |
| Place order | \`POST /api/orders\` → 201 | \`INSERT orders, order_items\`, \`DELETE cart_items\`, one transaction | header + lines + empty cart, or **nothing** after a failure |
| View history | \`GET /api/orders\` | \`SELECT … WHERE user_id = ?\` | same ids, only this user's |
| Edit profile | \`PATCH /api/users/{id}\` | \`UPDATE users SET … WHERE id = ?\` | only that column of only that row changed |

For updates, snapshot the row before and after and compare all other columns: the missing \`WHERE\` and the "PATCH wiped the phone" bugs are found by what should **not** change.

## 9. Test data: set-up and clean-up

| Strategy | How it works | Advantages | Disadvantages | Speed | Parallel | Use when |
|---|---|---|---|---|---|---|
| **API** | \`POST /api/users\`, orders through clients | valid by construction, survives schema changes, commits visibly | needs endpoints for every state | fast | unique data | **default for E2E/API tests** |
| Direct SQL | fixture account inserts rows | reaches impossible states (year-old order, expired card) | bypasses rules, events, caches; coupled to schema | fastest | unique keys needed | states the API cannot create |
| Seed script / Flyway | versioned SQL runs before the suite | reviewable, same everywhere | shared, must stay read-only for tests | once | yes if read-only | reference data, empty environment |
| Snapshot/restore, template database | copy a prepared database | large realistic volumes | heavy; needs exclusive access | minutes / seconds | one copy per worker | ETL, performance, manual regression |
| Transaction rollback | section 6 | nothing left | only in-process | fastest | yes | DAO, procedures, triggers |
| **Testcontainers** | throwaway database per build | isolation, real engine, no credentials | Docker, start-up time | seconds | one per JVM | component tests, CI |

**Recommended:** create through the API, read reference data from a migration-controlled seed, insert by SQL only what the API cannot produce (in one \`Fixtures\` class with its own account), and use Testcontainers wherever your suite starts the application itself. Clean-up deletes **only ids this test created**, child tables first, in an always-run hook; never \`DELETE FROM orders\` on a shared database.

Flyway: files \`V1__schema.sql\`, \`V2__seed_reference.sql\` under \`db/migration\`, then

\`\`\`java
Flyway.configure().dataSource(url, user, password).locations("classpath:db/migration").load().migrate();
\`\`\`

Recent versions need the \`flyway-database-postgresql\` artifact next to \`flyway-core\`. Running the **application's** migrations in your container is better than a hand-written copy of the schema: the copy drifts, and migrations get tested for free.

PostgreSQL's template feature is an underused fast reset: \`CREATE DATABASE shop_w1 TEMPLATE shop_seed;\` copies a prepared database at file level (nobody may be connected to the template), one per worker.

## 10. Testcontainers with PostgreSQL

JUnit 5, one container per class:

\`\`\`java
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;      // artifact testcontainers-junit-jupiter
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;   // 2.x package

@Testcontainers
class OrderTotalsIT {

    @Container                                          // static: started once for the class
    static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:16-alpine")
            .withInitScript("db/shop-schema-and-seed.sql");   // the script of restassured-deep-sql-for-testers

    @Test
    void integrityQueryFindsExactlyThePlantedDefect() {
        try (Db db = new Db(new DbConfig(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword(), 2))) {
            List<Long> wrong = db.list("""
                    WITH calc AS (SELECT order_id, SUM(price * quantity) AS s FROM order_items GROUP BY order_id)
                    SELECT o.id FROM orders o JOIN calc c ON c.order_id = o.id
                    WHERE o.total <> c.s + ROUND(c.s * 0.08, 2)
                    ORDER BY o.id
                    """, r -> r.longValue("id"));
            assertThat(wrong).containsExactly(1005L);
        }
    }
}
\`\`\`

TestNG, or any suite that wants **one container for all classes** — the singleton pattern:

\`\`\`java
public final class ShopDatabase {
    private static final PostgreSQLContainer PG =
            new PostgreSQLContainer("postgres:16-alpine").withInitScript("db/shop-schema-and-seed.sql");
    static { PG.start(); }                              // JVM class initialisation = started exactly once
    private ShopDatabase() { }
    public static DbConfig config() {
        return new DbConfig(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword(), 4);
    }
}

public abstract class BaseDbTest {
    protected static Db db;
    @BeforeSuite(alwaysRun = true) public void open()  { db = new Db(ShopDatabase.config()); }
    @AfterSuite(alwaysRun = true)  public void close() { if (db != null) db.close(); }
}
\`\`\`

**Notes.** The host port is random, so always use \`getJdbcUrl()\`. Nobody calls \`stop()\`: the Ryuk side-car removes containers when the JVM ends. The JUnit extension documents that it was only tested with sequential execution — use the singleton for parallel runs. Pin the image to the **production major version**; the \`latest\` tag makes yesterday's green build unrepeatable. H2 in "PostgreSQL mode" is not a substitute: JSONB, \`ON CONFLICT\`, locking and error codes differ. Failure "Could not find a valid Docker environment" means Docker is not reachable from that agent, not a test defect.

## 11. Assertions on constraint errors: SQLState

Message texts change with versions and languages; the five-character SQLState does not.

| SQLState | PostgreSQL meaning | Typical test |
|---|---|---|
| 23502 / 23503 / 23505 / 23514 | not null / foreign key / unique / check violation | constraint tests |
| 25006 | write in a read-only transaction | proves your helper is read-only |
| 25P02 | transaction already aborted | an earlier error was swallowed; roll back |
| 40001 / 40P01 | serialization failure / deadlock | application must retry |
| 57014 | query cancelled (timeout) | slow or blocked query |
| 53300 | too many connections | pool sizing |
| 42P01 / 42703 | unknown table / column | wrong schema or migration missing |

The class (first two characters) is standard: 23 = integrity, 40 = rollback, 08 = connection. Vendor details differ: MySQL and SQL Server mostly report 23000 for all integrity errors and need the vendor code as well.

## 12. The TypeScript/Playwright equivalent

\`\`\`ts
// fixtures.ts — npm i pg; npm i -D @types/pg
import { test as base, expect } from '@playwright/test';
import { Pool, type QueryResultRow } from 'pg';

export class Db {
  constructor(private readonly pool: Pool) {}

  async list<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pool.query<T>(sql, params)).rows;           // $1, $2 placeholders
  }

  async find<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this.list<T>(sql, params);
    if (rows.length > 1) throw new Error(\`expected at most 1 row, got \${rows.length}: \${sql}\`);
    return rows[0];
  }
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(\`\${name} is not set\`);
  return value;
};

export const test = base.extend<{}, { db: Db }>({
  db: [async ({}, use) => {
    const pool = new Pool({
      connectionString: required('DATABASE_URL'),
      max: 2,                                                      // per worker process!
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      application_name: 'qa-playwright',
      options: '-c default_transaction_read_only=on',
    });
    pool.on('error', (e) => console.error('idle pg client', e.message));
    await use(new Db(pool));
    await pool.end();                                              // worker teardown
  }, { scope: 'worker' }],
});
export { expect };
\`\`\`

\`\`\`ts
// order-persistence.spec.ts — typical real app behind ShopEasy's contract; baseURL and the customer's token
// come from config/fixtures as in pw-deep-api-testing
import { test, expect } from './fixtures';

type OrderRow = { status: string; subtotal: string; tax: string; total: string };
const cents = (numeric: string): number => Math.round(Number(numeric) * 100);

test('a placed order is stored with the right money', async ({ request, db }) => {
  const response = await request.post('/api/orders', {
    data: { firstName: 'Mia', lastName: 'Tester', postalCode: '560001',
            items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 2 }] },
  });
  expect(response.status()).toBe(201);
  const { id } = await response.json();

  const read = () => db.find<OrderRow>('SELECT status, subtotal, tax, total FROM orders WHERE id = $1', [id]);
  await expect.poll(async () => (await read())?.status, { timeout: 10_000 }).toBe('PLACED');

  const row = (await read())!;
  expect([cents(row.subtotal), cents(row.tax), cents(row.total)]).toEqual([4997, 400, 5397]);
});
\`\`\`

| Point | Java | Playwright/TypeScript |
|---|---|---|
| Lifetime | one \`Db\` per JVM | one pool per **worker process** (worker-scoped fixture); restarted after a failed test |
| Connections | forks × pool size | workers × shards × \`max\` |
| NUMERIC | \`BigDecimal\` | \`pg\` returns a **string**, on purpose: compare cents or use a decimal library |
| BIGINT | \`long\` | string, too (beyond safe integers) |
| TIMESTAMPTZ | \`OffsetDateTime\`/\`Instant\` | \`Date\` with millisecond precision; \`TIMESTAMP\` without zone is interpreted in the Node process's zone |
| Polling | Awaitility | \`expect.poll\`, \`expect(...).toPass\` |
| Mapping | record mapper | type parameter is **not** checked at run time |

\`pool.query\` uses any free client, so \`BEGIN\`/\`COMMIT\` must go through one client: \`const client = await pool.connect()\` … \`client.release()\` in \`finally\`.

## 13. Cucumber step with the helper

\`\`\`java
public class OrderDbSteps {
    private final ScenarioWorld world;              // PicoContainer: one per scenario
    private final OrderQueries orders;

    public OrderDbSteps(ScenarioWorld world) {
        this.world = world;
        this.orders = new OrderQueries(SuiteDb.shared());   // the pool outlives scenarios; opened in @BeforeAll
    }

    @Then("the order is stored with a total of {bigdecimal}")
    public void storedWithTotal(BigDecimal expected) {
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
            assertThat(orders.byId(world.orderId)).get()
                .extracting(OrderQueries.OrderRow::total, as(InstanceOfAssertFactories.BIG_DECIMAL))
                .isEqualByComparingTo(expected));
    }
}
\`\`\`

The feature says *what is true for the business* ("the order is stored…"), never table names. Scenario state stays in the world object; \`cucumber-deep-dependency-injection-hooks\` covers wiring.

## 14. ETL and migration checks

Four levels, cheap to expensive. Example: \`legacy_orders\` migrated to \`orders\`.

\`\`\`sql
-- 1. counts, per partition, so that +1 and -1 cannot cancel out
SELECT COALESCE(s.m, t.m) AS month, s.n AS source_rows, t.n AS target_rows
FROM      (SELECT date_trunc('month', created_at) AS m, COUNT(*) AS n FROM legacy_orders GROUP BY 1) s
FULL JOIN (SELECT date_trunc('month', created_at) AS m, COUNT(*) AS n FROM orders        GROUP BY 1) t ON t.m = s.m
WHERE  s.n IS DISTINCT FROM t.n;

-- 2. control totals: what finance will compare
SELECT SUM(total), SUM(tax), MIN(created_at), MAX(created_at), COUNT(DISTINCT user_id) FROM orders;

-- 3. row differences in both directions
(SELECT id, user_id, total FROM legacy_orders EXCEPT SELECT id, user_id, total FROM orders)
UNION ALL
(SELECT id, user_id, total FROM orders EXCEPT SELECT id, user_id, total FROM legacy_orders);

-- 4. field-level reconciliation: which column differs
SELECT s.id, s.total AS source_total, t.total AS target_total, s.status AS source_status, t.status AS target_status
FROM   legacy_orders s JOIN orders t ON t.id = s.id
WHERE  s.total IS DISTINCT FROM t.total OR s.status IS DISTINCT FROM t.status;
\`\`\`

Across two servers, compare **checksums** per bucket and drill into the bucket that differs:

\`\`\`sql
SELECT id / 1000 AS bucket, COUNT(*) AS n,
       md5(string_agg(concat_ws('|', id, user_id, COALESCE(total::text, '<null>'), status), ',' ORDER BY id)) AS checksum
FROM   orders GROUP BY id / 1000 ORDER BY bucket;
\`\`\`

Canonicalise first: number scale, time zone, trimming, encoding and NULL markers (\`concat_ws\` *skips* NULLs, hence the COALESCE; add one for every nullable column). \`EXCEPT\` removes duplicates, so also compare counts. Beyond equality test transformation rules (one row per rule and boundary), rejects (rejected + loaded = source), **idempotency** (run twice, same result), incremental loads (late and updated rows), and slowly changing dimensions (exactly one current row per key).

## 15. NoSQL in brief

MongoDB stores documents: an order embeds its items, so "header + lines" is one read and one atomic write.

\`\`\`java
Document order = mongo.getDatabase("shop").getCollection("orders").find(Filters.eq("_id", 1001)).first();
BigDecimal total = order.get("total", Decimal128.class).bigDecimalValue();    // store money as Decimal128, not double
\`\`\`

| Topic | Relational | MongoDB |
|---|---|---|
| Schema | enforced by DDL | optional validators: test missing fields, wrong types, **old document versions** |
| Relations | foreign keys | none enforced: orphan checks (\`$lookup\`) matter more |
| Duplicated data | exception | by design: test that all copies are updated |
| Consistency | commit, then visible | depends on read/write concern and read preference; secondary reads can be stale: read from primary, or poll |
| Transactions | normal | single-document atomicity; multi-document on replica sets |
| Injection | strings in SQL | operator objects (\`{"$ne": null}\`) in JSON input |

Key-value stores (Redis): test TTL, eviction and cache invalidation after the write. Search indexes: test lag and deletes.

## 16. Database testing in CI

\`\`\`yaml
jobs:
  db-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: shop
          POSTGRES_PASSWORD: \${{ secrets.CI_PG_PASSWORD }}
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s --health-timeout 3s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: "17", cache: maven }
      - run: mvn -B verify -Dgroups=db
        env:
          DB_URL: jdbc:postgresql://localhost:5432/shop
          DB_USER: postgres
          DB_PASSWORD: \${{ secrets.CI_PG_PASSWORD }}
\`\`\`

Service container vs Testcontainers: the service is declared once by the pipeline; Testcontainers makes the same test runnable on a laptop without instructions. I prefer Testcontainers and keep services for images that need privileged set-up.

* **Pull request:** migrations from empty plus constraint and procedure tests on a container; also migrate a copy of the **previous release's** schema with data.
* **After deployment to QA:** E2E with a few DB assertions, read-only account.
* **Nightly:** integrity (zero-row) suite, with trend.
* Health check, not a sleep, before connecting. Tag DB tests so a laptop without VPN can skip them **visibly** — silently skipped checks are worse than none.

## Common mistakes and debugging

| Symptom | Likely cause | How to find and fix it |
|---|---|---|
| \`Connection refused\` (08001) | wrong host/port, container not ready, VPN, \`localhost\` inside a container | test with \`psql\` from the **same machine**; use the service name between containers; wait on health |
| \`No suitable driver found\` | driver not on the runtime class path, typo in \`jdbc:\` URL | \`mvn dependency:tree\`; URL must start \`jdbc:postgresql://\` |
| \`too many clients\` (53300) | forks × pool, leaked pools, one pool per test | group \`pg_stat_activity\` by \`application_name\`; one pool per JVM |
| Pool timeout "Connection is not available, request timed out" | leak, or nested borrowing | read the HikariCP leak-detection stack trace; try-with-resources |
| Row visible in the SQL client, not in the test | different database/schema, read replica lag, uncommitted work in your client | print \`current_database()\`, \`current_schema()\`, \`inet_server_addr()\` |
| **Stale reads** inside one test | REPEATABLE READ transaction left open, replica, or an ORM cache | new transaction per query; poll the primary |
| Off by hours, or by one day | \`TIMESTAMP\` without zone, JVM zone vs DB zone (pgjdbc passes the JVM's zone to the session) | \`TIMESTAMPTZ\` + \`OffsetDateTime\`; run the suite once with \`-Duser.timezone=UTC\` and once with another zone |
| \`deadlock detected\` (40P01) | tests lock the same rows in different order | read the server log (it names both statements); own data per test; same lock order; do not "fix" with blind retries |
| Test hangs | blocked by another session's open transaction | \`SELECT pid, state, wait_event_type, query FROM pg_stat_activity\`; \`pg_blocking_pids(pid)\`; set timeouts |
| \`This ResultSet is closed\` | mapped lazily after \`close()\`, or the same Statement was executed again | read fully inside the try block |
| \`current transaction is aborted\` (25P02) | earlier exception swallowed | roll back; find the first error |
| \`permission denied\` (42501) | grants missing after a new table | correct! ask for the grant; do not switch to the owner account |
| Insert fails with a duplicate key right after seeding | explicit ids did not advance the identity sequence | \`ALTER TABLE … RESTART WITH\` |

## Best practices for experienced engineers

* A DB assertion must answer: *which fact can nothing else show?*
* Read-only by grant; a second, separate account for fixtures; none for production.
* One pool per JVM or worker, sized to threads, with timeouts and an application name.
* SQL in query classes, bound parameters, columns named, results mapped to records and fully read.
* \`BigDecimal\`/\`TIMESTAMPTZ\` end to end; expectations recomputed from the requirement.
* Assert on your own ids; poll only where the contract is asynchronous.
* Engine in tests = engine and major version in production.
* Never log connection strings with credentials or rows with personal data.

## Interview questions

### Q: When do you verify data in the database, and when not?

**Short answer (30–60 s):** I verify there only what no API or UI can show: side effects, derived or batch-computed values, constraints under concurrency, migrations. Everything a client can see I assert through the API, because SQL in tests couples them to the schema.

**Detailed answer:** Example: after \`POST /api/orders\` I check through the API that the order reads back, and one test checks in the DB that header, lines and stock changed together. I keep SQL in query classes, use a read-only account, and treat an unreachable database of another service as a design fact, not an obstacle. The trade-off is sensitivity against coupling; a nightly zero-row integrity suite gives more value than SQL in every test.

### Q: Explain DriverManager vs DataSource and why you use a pool.

**Short answer (30–60 s):** DriverManager opens a new physical connection per call; a DataSource is a factory that can be a pool. A pool reuses connections, bounds their number and adds timeouts, leak detection and validation.

**Detailed answer:** \`close()\` on a pooled connection returns it after resetting state and rolling back open work. Size follows concurrent borrowers and multiplies by forks or workers; I state \`max_connections\` before choosing. \`Class.forName\` is obsolete since JDBC 4 service loading. A static shared Connection is the anti-pattern: JDBC connections hold transaction state and are not meant for concurrent use.

### Q: How does PreparedStatement prevent SQL injection, and where does it not help?

**Short answer (30–60 s):** The SQL is parsed with placeholders and values travel separately, so a value can never become syntax. It does not help for identifiers, for SQL concatenated before preparing, or inside procedures using dynamic SQL.

**Detailed answer:** For dynamic sort columns I use a whitelist. Server-side plan reuse is a second benefit: the PostgreSQL driver switches to server-prepared statements after five executions by default (\`prepareThreshold\`). Testing for injection happens at the API with hostile values and the expectation of a clean 4xx or an empty result.

### Q: Why can't you isolate an API test with a transaction rollback?

**Short answer (30–60 s):** The application uses another connection: it cannot see my uncommitted rows, may block on my locks, and commits its own changes, which my rollback does not touch.

**Detailed answer:** A uniquely indexed value I inserted but not committed makes the app's insert wait, while my test waits for the app — a cycle the database cannot see. Rollback works when test and code share the connection: DAO tests, procedures, or Spring \`@Transactional\` with MockMvc. Otherwise: unique committed data, targeted clean-up, or a throwaway database.

### Q: How do you make database checks safe in parallel runs?

**Short answer (30–60 s):** One thread-safe pool per JVM, one connection per call, stateless query classes, and assertions on rows that this test owns.

**Detailed answer:** I never assert table-wide counts, and I reserve a product for stock tests. Pool size × forks stays below the server limit. No connection is held while calling the UI or API. For full isolation each worker gets its own database, from a template or a container.

### Q: Compare ways to prepare test data.

**Short answer (30–60 s):** API first because it creates valid, visible data; SQL for states the API cannot reach; migrations for reference data; snapshots for volume; Testcontainers when the suite owns the environment.

**Detailed answer:** SQL set-up bypasses validation, events and caches, so it can create impossible states and false failures. I keep it in one Fixtures class with a separate account, and review it when the schema changes. Clean-up is by id, child tables first, in an always-run hook. On ShopEasy's practice API, orders cannot be deleted, so tests must tolerate leftovers.

### Q: How would you test a data migration of 50 million orders?

**Short answer (30–60 s):** Counts per partition, control totals, bucket checksums to locate differences, field-level comparison of the differing buckets, rule tests with boundary rows, plus rerun and rollback tests.

**Detailed answer:** Full EXCEPT is feasible only on one server; across servers I checksum by id range after canonicalising formats, and drill down. Source = loaded + rejected, with reasons. I rehearse on a production-size masked copy to measure duration and locking, and test application behaviour during the cut-over.

## Scenario-based questions

**1. DB assertions pass locally and fail in CI with a five-and-a-half-hour difference.** That is the IST offset. I check column types: \`TIMESTAMP\` without zone written in local time and read in UTC. I prove it by running locally with \`-Duser.timezone=UTC\`. Fix in the test: OffsetDateTime/Instant; the real fix is raised as a product defect, because any second server in another zone would corrupt data: migrate to TIMESTAMPTZ.

**2. The suite grew to 12 parallel forks and staging now reports "too many clients", hitting real users of the environment.** Immediately lower forks or pool size (\`db.poolSize=1\`), then count sessions by \`application_name\`. I usually find one pool per test class or a pool never closed. Structural fix: one pool per JVM, \`minimumIdle=0\`, a connection limit on the \`qa_ro\` role, and moving component-level DB tests to Testcontainers so that staging sees only E2E.

**3. A manager wants every UI test to verify the database "to be sure".** I show the cost: coupling, credentials in every job, slower runs, and duplicated checks. I propose a map: each fact gets its cheapest reliable observation point, one persistence test per write operation, plus a nightly integrity suite over all rows. Then I plant a real defect — a total one cent off — and show which layer catches it.

## Tricky follow-ups

* **Q: Does \`con.close()\` commit?** Implementation-defined by the JDBC specification when a transaction is open; HikariCP rolls back. Always end the transaction explicitly if you write.
* **Q: Is \`setReadOnly(true)\` a security control?** No, a hint whose effect depends on the driver and autocommit mode. Grants are the control.
* **Q: Why can a query be fast in the SQL client and slow in the test?** Different plan for bound parameters, different fetch size, network distance, or the client limiting rows automatically.
* **Q: Can you read the row immediately after a 201?** If the write is committed before the response, yes, from the primary. From a replica, or with an asynchronous consumer, not necessarily.
* **Q: Why not use the application's repository classes for assertions?** Shared mapping bugs and caches make the check confirm itself.`,
  keyPoints: [
    'Assert at the highest level that can observe the fact; go to the database for side effects, derived data, constraints under concurrency and migrations, and keep the SQL in query classes.',
    'DataSource/pool over DriverManager; one pool per JVM or worker, a connection per call, sizes multiplied by forks and kept below max_connections.',
    'PreparedStatement binds values only; identifiers need a whitelist. Read by column name into records with BigDecimal and OffsetDateTime/Instant, and treat NULL explicitly.',
    'Read-only is enforced by grants; setReadOnly works in pgjdbc only with autocommit off by default, which also enables streaming fetch size.',
    'Rollback isolation works only when test and code share the connection; across processes it causes invisible rows and undetectable waits.',
    'Create data through the API, use SQL fixtures only for unreachable states, migrations for reference data, Testcontainers where the suite owns the environment.',
    'Recompute money from the requirement and poll only where the contract is asynchronous; assert on ids your test owns.',
    'Assert errors by SQLState (23505, 23514, 40P01…), and reconcile migrations with counts, control totals, checksums and two-way differences.',
  ],
  mistakes: [
    'A static Connection in BaseTest shared by parallel threads ("This connection has been closed", mixed transactions). Fix: one HikariDataSource per JVM and a borrowed connection per call in try-with-resources.',
    'Inserting test rows in an open transaction and calling the API, which returns 404 or hangs on a unique index. Fix: commit uniquely owned data (or create it through the API); look at pg_blocking_pids when a test hangs.',
    'rs.getDouble for totals and getTimestamp into LocalDateTime, failing by a cent or by 5.5 hours in CI. Fix: getBigDecimal with compareTo, TIMESTAMPTZ with OffsetDateTime; run the suite under two values of -Duser.timezone.',
    'Comparing the database row with the API response instead of the requirement, so both wrong values agree. Fix: expected subtotal, tax and total are recomputed in the test.',
    'Using the schema owner account because qa_ro lacks a grant. Fix: request the SELECT grant; keep a separate fixture account for writes and none for production.',
    'One pool per test class times many forks until the server answers "too many clients" (53300). Fix: group pg_stat_activity by application_name, share one pool per JVM, set minimumIdle 0 and a role connection limit.',
  ],
  tryIt: `You need PostgreSQL from any source you are allowed to use (local install, company sandbox, or Docker for Testcontainers).

1. Load the schema and seed from \`restassured-deep-sql-for-testers\`, create the \`qa_ro\` role, and set \`DB_URL\`, \`DB_USER\`, \`DB_PASSWORD\`.
2. Build \`DbConfig\`, \`Row\`, \`Db\` and \`OrderQueries\`. Test: order 1004 has two items and total 84.20; order 1007 is \`Optional.empty()\`.
3. Try an UPDATE through \`Db\` using an account **with** write grants and confirm SQLState 25006; then set \`autoCommit\` to true and explain what changes.
4. Run 8 threads with \`poolSize\` 2, then leak a connection on purpose and read the HikariCP leak-detection log.
5. Reproduce section 6 with two SQL sessions: insert a user without committing in the first, insert the same username in the second, and look at \`pg_stat_activity\`.
6. Turn the ten integrity checks of the SQL lesson into one data-provider test; it must fail with exactly the planted ids (1005, 1008, payment 9, …).
7. Start ShopEasy (\`npm run api\`), place the order of section 8 and compare the API's subtotal, tax and total with 49.97 / 4.00 / 53.97 — then explain why step "DB assertion" cannot be done against ShopEasy itself.`,
  problems: ['api-012', 'api-032', 'api-039', 'api-044'],
}
