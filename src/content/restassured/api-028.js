export default {
  id: 'api-028',
  category: 'restassured',
  kind: 'quiz',
  title: 'Response time, timeouts and flaky SLA checks',
  level: 'INTERMEDIATE',
  tags: ['response-time', 'timeouts', 'flaky-tests', 'non-functional'],
  estMinutes: 12,
  scenario: `Since the team added \`.time(lessThan(1500L))\` to the catalogue tests, the nightly run is red about one night in
twenty, always on a different test, and always green on re-run. On top of that, last Tuesday a backend deploy left one
endpoint hanging and the whole pipeline sat waiting for 45 minutes until Jenkins killed it. The lead asks you to sort
out what response-time checks can and cannot do. The practice API's \`GET /api/slow?ms=...\` lets you reproduce each
situation.`,
  description: `Answer the questions. Try them against \`http://localhost:5181/api/slow?ms=1200\` (and other values up to 10000) if you are unsure.`,
  questions: [
    {
      q: 'What exactly does `.then().time(lessThan(1500L), TimeUnit.MILLISECONDS)` measure?',
      options: [
        'Only the time the server spent processing the request',
        'The round trip seen by the test machine: connecting, sending, server processing, network and reading the response',
        'The average of the last 10 requests',
        'The time until the first byte of the response headers, nothing more',
      ],
      answer: 1,
      why: 'RestAssured measures from the client side, so DNS, connection setup, a busy CI agent, the network and the server all add up. That is why the same call can take 300 ms on your laptop and 1600 ms on a loaded build agent — and why this number is not a server performance metric.',
    },
    {
      q: 'The 1500 ms check fails about 5% of nights and passes on re-run. What is the best fix?',
      options: [
        'Add a retry analyzer so failed tests run again until they pass',
        'Delete all timing assertions',
        'Keep a generous ceiling from config (for example 3× the normal time) as a smoke check for big regressions, and measure real latency in a performance tool',
        'Add Thread.sleep(500) before the request so the server can warm up',
      ],
      answer: 2,
      why: 'A functional suite should only catch **gross** regressions (10× slower), with a threshold that tolerates CI noise and lives in config per environment. Percentiles and SLAs belong in JMeter, Gatling or k6 under controlled load. Retries hide real problems, and sleeping only makes the suite slower.',
    },
    {
      q: 'Why does `.time(lessThan(1500))` (without the `L`) not compile?',
      options: [
        'time() only accepts seconds',
        'time() expects a Matcher<Long>; lessThan(1500) creates a Matcher<Integer>',
        'lessThan is not a Hamcrest matcher',
        'It compiles, but always passes',
      ],
      answer: 1,
      why: 'Response times are `long` values, so `time(...)` and `expectResponseTime(...)` take a `Matcher<Long>`. `1500L` is a long literal; `1500` is an int and gives `Matcher<Integer>`, which the compiler rejects.',
    },
    {
      q: 'An endpoint hangs for minutes. Which setting makes the test fail after about 3 seconds instead of blocking the pipeline?',
      options: [
        '`.time(lessThan(3000L))` in then()',
        '`expectResponseTime(lessThan(3000L))` in the response spec',
        'A client timeout, e.g. `RestAssured.config().httpClient(HttpClientConfig.httpClientConfig().setParam("http.socket.timeout", 3000))`',
        'TestNG `@Test(priority = 1)`',
      ],
      answer: 2,
      why: 'A time assertion is checked **after** the response arrives — if it never arrives, you wait forever. A socket/connection timeout makes the HTTP client give up and throw (`SocketTimeoutException`), failing the test fast. TestNG\'s `@Test(timeOut = 5000)` is another safety net; `priority` has nothing to do with time.',
    },
    {
      q: 'The first request of every run is 3× slower than the rest, so the first test often fails its time check. What is the cleanest approach?',
      options: [
        'Make the first test in alphabetical order always skip its time check',
        'Warm up before measuring — e.g. the health check in @BeforeSuite — so connection setup and JIT warm-up do not hit a measured call',
        'Measure only the last test of the run',
        'Increase every threshold to 60 seconds',
      ],
      answer: 1,
      why: 'Cold starts (connection pool, TLS handshake, server JIT and caches) are real but not what a regression check is about. A warm-up call that is not measured, like the smoke health check that runs first anyway, removes that noise without weakening the other checks.',
    },
    {
      q: 'Your manager wants to see whether the catalogue is getting slower release by release. What should the API suite do?',
      options: [
        'Fail every test that is 1 ms slower than last week',
        'Record `response.timeIn(TimeUnit.MILLISECONDS)` and attach or export it (report, CSV, metrics) to show the trend, while only asserting a coarse ceiling',
        'Nothing — API tests cannot measure time',
        'Print the time with System.out.println and read it manually',
      ],
      answer: 1,
      why: '`response.timeIn(MILLISECONDS)` (or `getTimeIn`) gives the number for **reporting**. Trends need many samples over time, which a report or dashboard shows well; a hard pass/fail on tiny differences would just be another flaky check.',
    },
  ],
  hints: ['Ask for each case: does this check catch a real problem, and can it fail when nothing is wrong?'],
  explanation: `Two different tools solve two different problems:

| Need | Tool | Fails when |
|---|---|---|
| catch a big slowdown | \`.time(lessThan(X))\` / \`expectResponseTime\` with a generous X from config | the response arrives, but late |
| never hang the pipeline | client socket/connection timeout (\`HttpClientConfig\`), TestNG \`timeOut\` | no response within the limit |
| show trends / SLAs | \`response.timeIn(...)\` → report; JMeter, Gatling, k6 for load | (reporting, not pass/fail) |

Flaky timing checks damage trust in the whole suite: after a few false alarms people stop reading red builds. Keep
time assertions coarse, warm up first, and leave real performance measurement to tools built for it.`,
  mistakes: [
    'Copying the production SLA (e.g. 200 ms) into functional tests that run on shared CI agents.',
    'Expecting a time assertion to stop a hanging request — it only runs after the response has arrived.',
    'Adding retries to make timing checks green — real slowdowns then disappear from the report.',
    'Measuring the very first call of the run, which includes connection setup and cold caches.',
  ],
  interview: [
    { q: 'Can RestAssured be used for performance testing?', a: 'Only as a smoke check: it measures one request at a time from the client side. For latency percentiles, throughput and behaviour under load use a load tool such as JMeter, Gatling or k6, ideally in a production-like environment.' },
    { q: 'How do you stop a hanging API from blocking your pipeline?', a: 'Configure connection and socket timeouts on the HTTP client through RestAssuredConfig, add a TestNG timeOut or a suite-level timeout as a safety net, and fail fast with a clear message instead of waiting for the CI job to be killed.' },
  ],
}
