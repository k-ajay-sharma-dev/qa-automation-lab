export default {
  slug: 'selenium-deep-grid-infrastructure',
  category: 'selenium',
  order: 16,
  title: 'Deep dive: Selenium Grid 4, Docker, Kubernetes and cloud grids',
  minutes: 30,
  summary: 'Design, run and troubleshoot remote browser infrastructure — Grid 4 components and the new-session flow, standalone/hub-node/distributed modes, server flags and TOML node config, stereotypes and slot matching, RemoteWebDriver client settings, docker-selenium (compose, shm, noVNC, video, Dynamic Grid), Kubernetes with the Helm chart and KEDA, capacity planning, observability endpoints, and when a cloud grid beats a self-hosted one.',
  manualAnalogy: `A manual test lab has a booking desk: testers ask for "Chrome on Windows", the desk checks which machines are free and fit, hands one over, and keeps a list of who is on which machine. When all machines are busy, people wait in a queue — hiring more testers does not create more machines. Selenium Grid is that booking desk for browsers, and most Grid problems are booking problems: nobody has the requested machine, the queue is too long, or a machine fell over and nobody noticed.`,
  body: `## Where the earlier lessons stop

The *Browser options, screenshots, Grid and parallel runs* lesson introduced \`RemoteWebDriver\`, \`LocalFileDetector\`, \`se:name\` and the Docker images by name. *selenium-deep-architecture* explained that \`ChromeDriver\` **is** a \`RemoteWebDriver\`, the \`Augmenter\`, \`ClientConfig\` read timeouts, session cleanup and how capabilities are negotiated (\`alwaysMatch\`/\`firstMatch\`). *java-deep-multithreading-synchronization* covers the \`ThreadLocal\` driver and TestNG parallel modes. This lesson is the infrastructure side: how Grid 4 works inside, how to run it on a jar, Docker and Kubernetes, how to size it, observe it and troubleshoot it, and when to pay a cloud vendor instead.

## Grid 4 architecture

Grid 4 is a rewrite of the Selenium 3 hub/node: the old hub's responsibilities were split into separate components that can run in one process or many.

| Component | Responsibility | Default port (distributed mode) |
|---|---|---|
| **Router** | the front door: receives every client request; new-session requests go to the queue, commands for existing sessions go straight to the owning Node | 4444 |
| **New Session Queue** | holds new-session requests that are not yet assigned; enforces the request timeout | 5559 |
| **Distributor** | keeps a model of all Nodes and their slots; polls the queue and assigns each request to a matching free slot | 5553 |
| **Session Map** | session id → Node URI; the Router consults it for every command | 5556 |
| **Event Bus** | asynchronous messages between components (node registration, heartbeats, session closed) | 4442 publish / 4443 subscribe |
| **Node** | owns **slots** (one per possible concurrent session), each with a **stereotype**; starts the real driver (or a container) and proxies commands to it | 5555 |

### How a new-session request flows

\`\`\`
client: POST /session {capabilities}
   │
   ▼
Router ──────────────► New Session Queue   (request waits here; timeout = session-request-timeout)
                              ▲
                              │ polls (on "request added" events and periodically)
                          Distributor
                              │ 1. matches capabilities against slot STEREOTYPES in its grid model
                              │ 2. picks a free matching slot (spreads load across nodes)
                              ▼
                            Node ── starts chromedriver/geckodriver (or a Docker container) ──► browser
                              │ returns session id + capabilities
                              ▼
                       Session Map: sessionId → node URI
   ◄──────────────── response flows back to the waiting client

client: POST /session/{id}/element ...
Router ── looks up Session Map ──► Node ──► driver ──► browser
\`\`\`

Things worth saying in an interview:

- The Distributor assigns from its **grid model** rather than asking every Node, which is fast but can be briefly out of date (a Node that just died still looks available until heartbeats/health checks catch up) — one source of sporadic \`SessionNotCreatedException\`s after node crashes.
- After creation, the Distributor and queue are **out of the path**: every command is Router → Session Map lookup → Node. A slow Distributor shows up as long session *start* times, not slow commands.
- The Event Bus carries broadcasts (node added, node removed, session closed). If a Node cannot reach the bus ports, it never registers — the most common "node does not appear" cause.
- Each **slot** is a capacity unit. A Node with \`max-sessions = 4\` and Chrome+Firefox detected has slots for both browsers but runs at most 4 sessions in total.

### Modes and when each fits

| Mode | Command | Processes | Fits |
|---|---|---|---|
| **Standalone** | \`java -jar selenium-server-<version>.jar standalone\` | all components + one Node in one JVM | a developer machine, a single CI agent, one Docker container (\`selenium/standalone-chrome\`) |
| **Hub and Node** | \`... hub\` on one host; \`... node --hub http://<hub-ip>:4444\` on others | hub = Router, Distributor, Session Map, Queue, Event Bus; separate Nodes | the usual team Grid: one hub, several Nodes or containers |
| **Fully distributed** | \`event-bus\`, \`sessionqueue\`, \`sessions\`, \`distributor\`, \`router\`, \`node\` started separately | each component its own process/host | very large grids, Kubernetes with independent scaling and isolation of components |

Distributed mode as documented on selenium.dev (replace the placeholders):

\`\`\`bash
java -jar selenium-server-<version>.jar event-bus --publish-events tcp://<bus-ip>:4442 --subscribe-events tcp://<bus-ip>:4443 --port 5557
java -jar selenium-server-<version>.jar sessionqueue --port 5559
java -jar selenium-server-<version>.jar sessions --publish-events tcp://<bus-ip>:4442 --subscribe-events tcp://<bus-ip>:4443 --port 5556
java -jar selenium-server-<version>.jar distributor --publish-events tcp://<bus-ip>:4442 --subscribe-events tcp://<bus-ip>:4443 \\
     --sessions http://<sessions-ip>:5556 --sessionqueue http://<queue-ip>:5559 --port 5553 --bind-bus false
java -jar selenium-server-<version>.jar router --sessions http://<sessions-ip>:5556 --distributor http://<distributor-ip>:5553 \\
     --sessionqueue http://<queue-ip>:5559 --port 4444
java -jar selenium-server-<version>.jar node --publish-events tcp://<bus-ip>:4442 --subscribe-events tcp://<bus-ip>:4443
\`\`\`

**Recommended:** standalone for local and single-agent CI; hub and node (in Docker) for most teams; fully distributed only when you run on Kubernetes at a scale where one hub process is a bottleneck or a single point of failure you need to isolate.

## Running Grid from the server jar

### Flags you actually tune

| Flag (section) | What it does | Notes |
|---|---|---|
| \`--max-sessions\` (node) | concurrent sessions per Node | docs: default is the number of available processors |
| \`--override-max-sessions\` (node) | allow \`--max-sessions\` above the processor count | only with evidence the hardware copes (RAM, \`/dev/shm\`) |
| \`--session-timeout\` (node) | seconds an **idle** session may live before the Node kills it | 300 s in the docs; reaps sessions leaked by killed CI jobs — and debug sessions paused at a breakpoint |
| \`--session-request-timeout\` (sessionqueue) | how long a new-session request may wait in the queue | 300 s in the docs; expires as \`SessionNotCreatedException\` |
| \`--detect-drivers\` (node) | auto-detect browsers/drivers on the host and create slots | turn off when you declare slots explicitly in TOML |
| \`--selenium-manager\` (node) | let the Node use Selenium Manager to obtain drivers | docs: false by default — a bare-metal Node otherwise needs drivers on the \`PATH\` |
| \`--drain-after-session-count\` (node) | shut the Node down after N sessions | values > 0 enable it; handy for one-session-per-container hygiene |
| \`--reject-unsupported-caps\` (distributor) | reject immediately when **no** Node could ever match | leave off with autoscaling (nodes appear later); turn on for static grids to fail fast |
| \`--enable-managed-downloads\` (node) | Grid-managed browser downloads, retrievable by the client | pair with \`se:downloadsEnabled\` in the request |
| \`--log-level\` | e.g. \`FINE\` for detailed logs and tracing events on the console | noisy; use temporarily |

Always confirm against \`java -jar selenium-server-<version>.jar <command> --help\` for your version — flags are added between releases.

### Declaring slots with TOML

Command-line flags are fine for a demo; production Nodes are configured with a TOML file (\`--config node.toml\`). Each \`[[node.driver-configuration]]\` block declares a **stereotype** and how many slots it gets:

\`\`\`toml
# node.toml — illustrative; key names as in the selenium.dev TOML examples
[node]
detect-drivers = false
max-sessions = 4
session-timeout = 300

[[node.driver-configuration]]
display-name = "Chrome"
stereotype = '{"browserName": "chrome", "platformName": "linux"}'
max-sessions = 4

[[node.driver-configuration]]
display-name = "Firefox"
stereotype = '{"browserName": "firefox", "platformName": "linux"}'
max-sessions = 2
\`\`\`

## Stereotypes and slot matching

A **stereotype** is the minimal capability set a request must match to be assigned to that slot. The Distributor compares the request's capabilities (after \`alwaysMatch\`/\`firstMatch\` expansion — see *selenium-deep-architecture*) with each free slot's stereotype:

- \`browserName\`, \`browserVersion\` and \`platformName\` must be compatible when the request specifies them. Ask for \`browserVersion: "130"\` and only slots whose stereotype says 130 match; omit it and any version matches.
- Browser-specific option blocks (\`goog:chromeOptions\`, \`moz:firefoxOptions\`) are passed through to the driver — headless flags, arguments and prefs do not affect matching.
- **Custom prefixed capabilities** in the stereotype (the selenium.dev example uses an \`applicationName\`-style key under a prefix) let you route requests to dedicated Nodes: e.g. \`"shopeasy:pool": "checkout"\` on a Node with special network access. Use a vendor prefix (\`something:\`) — unprefixed non-standard keys are invalid in W3C.
- **No match anywhere** → the request waits in the queue until \`session-request-timeout\` (or is rejected immediately with \`--reject-unsupported-caps\`). This is why a typo like \`browserName: "chorme"\` on a Grid looks like a 5-minute hang rather than an instant error.

## RemoteWebDriver: the client side

\`\`\`java
package com.shopeasy.framework.grid;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.LocalFileDetector;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.openqa.selenium.remote.http.ClientConfig;

import java.net.MalformedURLException;
import java.net.URL;
import java.time.Duration;

/** Opens a Chrome session on the Grid with client timeouts sized for queueing. */
public final class GridSessions {

    private GridSessions() { }

    public static WebDriver chromeOnGrid(String testName) {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--window-size=1920,1080");
        options.setCapability("se:name", testName);                 // label in the Grid UI
        options.setCapability("shopeasy:pool", "general");          // matches a custom stereotype key

        ClientConfig config = ClientConfig.defaultConfig()
                .baseUrl(gridUrl())
                .connectionTimeout(Duration.ofSeconds(10))          // fail fast if the Router is down
                .readTimeout(Duration.ofMinutes(6));                // > session-request-timeout (queue wait)

        RemoteWebDriver driver = (RemoteWebDriver) RemoteWebDriver.builder()
                .oneOf(options)
                .config(config)
                .build();
        driver.setFileDetector(new LocalFileDetector());            // sendKeys(path) uploads the local file
        return driver;
    }

    private static URL gridUrl() {
        try {
            return new URL(System.getProperty("grid.url", "http://localhost:4444"));
        } catch (MalformedURLException e) {
            throw new IllegalArgumentException("Invalid -Dgrid.url", e);
        }
    }
}
\`\`\`

**Step by step**

- \`se:name\` shows up in the Grid UI next to the session (and docker-selenium can use it to name videos — check the README for your tag); cloud vendors use their own keys (e.g. a vendor-prefixed \`name\`).
- The **read timeout** applies to every HTTP call, including \`POST /session\`, which blocks while the request sits in the queue. If it is shorter than the queue time, the client gives up while the Grid later creates a session nobody will use — an orphan that holds a slot until \`session-timeout\` reaps it. Size it above \`session-request-timeout\`, and above your slowest page load.
- \`connectionTimeout\` is separate: a short one turns "Grid is down" into a fast, clear environment failure.
- \`LocalFileDetector\`: when \`sendKeys\` receives a string that is a path to an existing **local** file, the client zips and uploads it to the Node, then types the remote path. Without it, the Node looks for a Windows path such as \`C:\\Users\\...\` on a Linux container and the upload fails or silently does nothing.
- The method returns \`WebDriver\`: the rest of the framework must not care whether it is local or remote. Switching local/remote and browsers belongs in your driver factory (problem sel-019 practises it).
- For CDP/BiDi features over Grid, see *selenium-deep-architecture*: BiDi goes through the Grid's WebSocket proxy when the request asks for \`webSocketUrl\`; \`HasDevTools\` needs the \`Augmenter\`.

## Docker: docker-selenium

The official images (repository SeleniumHQ/docker-selenium) ship a matched browser + driver + Grid component per image. Tags are pinned as \`<selenium-version>-<date>\` — the README showed \`4.52.0-20261101\` at the time of writing; always pin a full tag, never \`latest\`, so a browser update is a deliberate change.

| Image | Role |
|---|---|
| \`selenium/standalone-chrome\` / \`-firefox\` / \`-edge\` / \`-chromium\` | a complete one-browser Grid in one container |
| \`selenium/hub\` | Router + Distributor + Session Map + Queue + Event Bus |
| \`selenium/node-chrome\` / \`-firefox\` / \`-edge\` / \`-chromium\` | a Node with one browser type |
| \`selenium/node-docker\`, \`selenium/standalone-docker\` | **Dynamic Grid**: a Node that starts a fresh browser container per session |
| \`selenium/video\` | ffmpeg recorder for a browser container's display |

Platform note from the README: Chrome and Firefox have arm64 images (on arm64 the Chrome images use a Chromium driver of the same major, because no Linux/ARM64 ChromeDriver is published); Edge is amd64-only.

### Standalone in one line

\`\`\`bash
docker run -d -p 4444:4444 -p 7900:7900 --shm-size="2g" selenium/standalone-chrome:<tag>
\`\`\`

- \`--shm-size="2g"\`: Chrome uses \`/dev/shm\` for shared memory; Docker's default is 64 MB, and Chrome **crashes** on heavy pages ("session deleted because of page crash", "tab crashed"). The README asks for 2g on every browser image. \`--disable-dev-shm-usage\` is the workaround when you cannot change the size (it moves that memory to \`/tmp\`, slower).
- Port **7900** serves **noVNC** — open \`http://localhost:7900/?autoconnect=1&resize=scale&password=secret\` to watch sessions live (default VNC password \`secret\`; port 5900 for a native VNC client).

### Hub and nodes with docker compose

\`\`\`yaml
# docker-compose.yml — illustrative; use a full pinned tag for every image
services:
  selenium-hub:
    image: selenium/hub:<tag>
    ports:
      - "4442:4442"
      - "4443:4443"
      - "4444:4444"

  chrome:
    image: selenium/node-chrome:<tag>
    shm_size: 2gb
    depends_on: [selenium-hub]
    environment:
      - SE_EVENT_BUS_HOST=selenium-hub
      - SE_EVENT_BUS_PUBLISH_PORT=4442
      - SE_EVENT_BUS_SUBSCRIBE_PORT=4443
      - SE_NODE_MAX_SESSIONS=2
      - SE_NODE_OVERRIDE_MAX_SESSIONS=true
      - SE_NODE_SESSION_TIMEOUT=300
    extra_hosts:
      - "host.docker.internal:host-gateway"      # reach the app on the host (Linux; see below)

  firefox:
    image: selenium/node-firefox:<tag>
    shm_size: 2gb
    depends_on: [selenium-hub]
    environment:
      - SE_EVENT_BUS_HOST=selenium-hub
      - SE_EVENT_BUS_PUBLISH_PORT=4442
      - SE_EVENT_BUS_SUBSCRIBE_PORT=4443

  chrome_video:
    image: selenium/video:<tag>
    depends_on: [chrome]
    volumes:
      - ./videos:/videos
    environment:
      - DISPLAY_CONTAINER_NAME=chrome
      - SE_VIDEO_FILE_NAME=auto
\`\`\`

**Step by step**

- Nodes find the hub through \`SE_EVENT_BUS_HOST\` (compose service name = DNS name on the compose network); the publish/subscribe ports are the hub's Event Bus.
- \`SE_NODE_MAX_SESSIONS\` / \`SE_NODE_OVERRIDE_MAX_SESSIONS\` map to the server flags; most teams keep **one session per browser container** and scale containers (\`docker compose up --scale chrome=4\`) instead — better isolation, simpler resource accounting.
- Scale with \`--scale\` only for services without fixed host ports (that is why the nodes do not publish 7900 here; use the Grid UI's VNC link or publish a range).
- Video: one \`selenium/video\` container per browser container records its display into \`/videos\`. The README documents further switches (\`SE_RECORD_VIDEO\`, upload destinations, keeping only failures); check it for your tag rather than copying old blog posts — these variables have changed over time.

### Dynamic Grid

A \`node-docker\` Node does not run a browser itself: for each new session it starts a fresh browser container from a configured image, proxies the session, and removes the container afterwards. Perfect isolation (new profile, new \`/dev/shm\`, no leftover processes) at the cost of container start-up time per session.

\`\`\`toml
# config.toml mounted at /opt/selenium/docker.toml in selenium/node-docker — illustrative
[docker]
configs = [
  "selenium/standalone-chrome:<tag>", '{"browserName": "chrome"}',
  "selenium/standalone-firefox:<tag>", '{"browserName": "firefox"}'
]
url = "http://127.0.0.1:2375"            # Docker daemon; on Windows/macOS setups the README uses host.docker.internal:2375
video-image = "selenium/video:<tag>"
\`\`\`

The Node needs access to the Docker daemon (the socket mounted, or the daemon's TCP endpoint as above) — which is effectively root on that host: run it on dedicated machines only. In Dynamic Grid, recording is per session: the README documents the \`se:recordVideo\` capability (\`"se:recordVideo": "true"\`) to switch it on for one session.

## Kubernetes: the Helm chart and KEDA

The docker-selenium project publishes a Helm chart:

\`\`\`bash
helm repo add docker-selenium https://www.selenium.dev/docker-selenium
helm install selenium-grid docker-selenium/selenium-grid
# distributed components (Router, Distributor, EventBus, SessionMap, SessionQueue as separate pods):
helm install selenium-grid docker-selenium/selenium-grid --set isolateComponents=true
\`\`\`

**Autoscaling with KEDA.** Browser pods are expensive to keep idle. The chart integrates with **KEDA** (Kubernetes Event-Driven Autoscaling), which has a \`selenium-grid\` scaler that watches the Grid's **pending requests in the session queue** and scales browser nodes accordingly — down to zero when nothing is queued. From the chart README:

- \`autoscaling.enabled\` — the chart installs KEDA and enables scaling; \`autoscaling.enableWithExistingKEDA\` — use a KEDA already in the cluster.
- \`autoscaling.scalingType\` — \`job\` (default: each browser pod is a Kubernetes Job that serves a session and exits — clean isolation, like Dynamic Grid) or \`deployment\` (long-lived pods scaled up and down — faster reuse, but scale-down must not kill a pod mid-session).
- Ingress is enabled by default with a default hostname of \`selenium-grid.local\` (\`ingress.hostname\` to change).

\`\`\`yaml
# values.yaml — ILLUSTRATIVE ONLY; check the chart's CONFIGURATION file for your chart version
autoscaling:
  enabled: true
  scalingType: job
isolateComponents: false
ingress:
  hostname: grid.qa.example.internal
\`\`\`

Kubernetes-specific concerns: give browser pods real memory **requests and limits** (an OOM-killed pod looks like a random session crash), mount a memory-backed \`/dev/shm\` volume (the chart handles this for its node templates), account for pod start-up latency in \`session-request-timeout\`, and keep the Grid internal (the selenium.dev docs warn against exposing the Router to the internet).

## Capacity planning

### The arithmetic

- **Slots** = Σ over Nodes of max-sessions (or running browser pods). This is the hard ceiling of concurrent sessions.
- **Resources per session**: the Grid docs plan about **1 CPU and ~1 GB RAM per browser session** (hence the processor-count default for max-sessions). Heavy SPAs, video recording and devtools tracing need more; measure with \`docker stats\` during a real run.
- **Client threads vs slots**: a TestNG \`thread-count\` of 20 against 8 slots does not run 20 tests at once — 12 requests sit in the queue. Throughput is the same as 8 threads, but each queued test's \`POST /session\` blocks (risking the client read timeout), and failures look like random \`SessionNotCreatedException: ... timed out\`.
- **Queue time** grows when arrival rate exceeds service rate. With 8 slots and 4-minute average tests, the Grid completes ~2 tests/minute; a 300-test suite needs at least ~150 minutes regardless of thread count. More slots — not more threads — shortens it.
- **Session timeout** should exceed your longest legitimate idle gap (a long API setup between UI steps) but be short enough to reclaim slots leaked by killed CI jobs.

| Symptom | Likely capacity problem | Fix |
|---|---|---|
| Suite does not get faster after raising \`thread-count\` | already slot-bound | add Nodes/pods or reduce per-test time |
| Session start takes minutes | queueing, or Dynamic Grid/Kubernetes pod start-up | more slots, pre-pulled images, \`deployment\` scaling with warm pods |
| Random page crashes under load | RAM or \`/dev/shm\` exhausted | fewer sessions per Node, \`--shm-size\`, memory limits |
| Tests slower on Grid than locally, CPU at 100 % | \`--override-max-sessions\` beyond hardware | one session per CPU, measure |
| Slots occupied with no tests running | leaked sessions (killed CI job, client read timeout) | lower \`session-timeout\`, client timeout above queue timeout, always \`quit()\` |

### Grid, local parallel or cloud: approaches compared

\`\`\`java
// 1. Local parallel: N browsers on the CI agent itself
WebDriver local = new ChromeDriver(options);
// 2. Self-hosted Grid (Docker/Kubernetes)
WebDriver grid = RemoteWebDriver.builder().oneOf(options).address("http://grid.internal:4444").build();
// 3. Cloud grid: same API, vendor URL + credentials from the CI secret store + vendor-prefixed options
WebDriver cloud = RemoteWebDriver.builder().oneOf(options).address(System.getenv("CLOUD_GRID_URL")).build();
\`\`\`

| | Local parallel on the agent | Self-hosted Docker/K8s Grid | Cloud grid (BrowserStack, Sauce Labs, LambdaTest…) |
|---|---|---|---|
| How it works | drivers + browsers on the CI agent | your Grid, your containers/pods | vendor-hosted Grid-compatible endpoint |
| Cost | agent size only | infra + engineering time to run it | subscription priced largely by **parallel sessions**; real devices cost more |
| Browser/OS coverage | the agent's OS | Linux Chrome/Firefox/Edge easily; Safari needs macOS hardware | Windows/macOS/Safari/old versions, **real mobile devices** |
| Parallelism | limited by one machine | as many slots as you provision; autoscaling with KEDA | capped by plan; extra queueing when exceeded |
| Reaching internal apps | trivial | inside your network | needs the vendor's **tunnel** (BrowserStack Local, Sauce Connect, LambdaTest Tunnel) — another moving part |
| Data privacy | data never leaves | data stays in your network | test data, screenshots, videos stored at the vendor — check retention, region, compliance |
| Debugging | local everything | noVNC, videos, Grid logs you control | rich dashboards, video, logs per session out of the box |
| Latency | lowest | low (same network) | highest (internet round trip per command) |
| Maintenance | lowest | highest (images, upgrades, capacity) | lowest |
| When to use | small suites, PR smoke runs | large Chrome/Firefox suites, many runs per day, private data | Safari/real devices/OS matrix coverage, small teams without platform support |

**Recommended approach and why, by team size:**

- **Small team (1–3 SDETs, < ~300 UI tests):** local parallel on CI agents or a single \`standalone-chrome\` container per job; buy cloud minutes only for the Safari/mobile matrix. Running a Grid is not where this team's time pays off.
- **Mid-size (several squads, nightly + PR runs):** a self-hosted docker-compose or Dynamic Grid for Chrome/Firefox (cheap, fast, private), plus a small cloud plan for Safari and real devices. Pin image tags, record videos on failure.
- **Large organisation (many teams, thousands of sessions/day):** Kubernetes with the Helm chart, KEDA autoscaling, \`job\` scaling for isolation, monitoring on queue size; cloud for coverage the cluster cannot provide. Treat the Grid as a platform with an owner and SLOs.

## Observability

| Endpoint / tool | What you get |
|---|---|
| Grid UI — \`http://<grid>:4444/ui\` | nodes, slots, stereotypes, running sessions, queue; VNC link for sessions on images with VNC |
| \`GET /status\` | JSON: \`ready\` flag and every Node with its slots and current sessions — the health check for CI pre-flight |
| \`POST /graphql\` | queryable model: \`grid { maxSession, sessionCount, sessionQueueSize }\`, \`nodesInfo\`, \`sessionsInfo\` |
| \`GET /se/grid/newsessionqueue/queue\` | the queued requests and their capabilities — shows *what* is waiting (e.g. a misspelt browser) |
| \`POST /se/grid/distributor/node/<node-id>/drain\` | drain a Node (finish sessions, then stop) for upgrades; needs the \`X-REGISTRATION-SECRET\` header |
| Logs + tracing | Grid emits OpenTelemetry-based tracing and is **enabled by default**; event logs appear at \`FINE\` (\`--log-level FINE\`); \`java -jar selenium-server-<version>.jar info tracing\` prints how to export to Jaeger |

\`\`\`bash
curl -s http://localhost:4444/status
curl -s -X POST -H "Content-Type: application/json" \\
  --data '{"query":"{ grid { maxSession, sessionCount, sessionQueueSize } }"}' \\
  http://localhost:4444/graphql
\`\`\`

A CI pre-flight that fails the job as an **environment** failure when \`/status\` is not ready, or when \`sessionQueueSize\` is already large, saves a whole run of misleading red tests. Exporting \`sessionCount\` and \`sessionQueueSize\` to your metrics system gives the two numbers that drive capacity decisions.

## Running ShopEasy against a Docker Grid

The classic trap: the test passes \`http://localhost:5180/practice-site/login.html\` to a browser **inside a container**. For that browser, \`localhost\` is the container itself — "This site can't be reached" / \`ERR_CONNECTION_REFUSED\`, and the next \`findElement\` fails.

| Option | How | Notes |
|---|---|---|
| \`host.docker.internal\` | base URL \`http://host.docker.internal:5180/practice-site/\` | built into Docker Desktop (Windows/macOS); on Linux Docker Engine add \`extra_hosts: "host.docker.internal:host-gateway"\` (as in the compose file) |
| Host IP | \`http://<host-LAN-IP>:5180/...\` | works everywhere; IP changes |
| Host networking (Linux) | \`network_mode: host\` on the node | \`localhost\` then means the host; loses compose DNS isolation |
| App in the same compose network | add the app (or the API) as a service; use \`http://shopeasy:5180\` | most reproducible for CI |

Two ShopEasy-specific details:

1. The Vite dev server listens on **localhost only** by default. Start it with \`npx vite --host\` (or set \`server.host\` in the config) so requests from containers arrive at all. Recent Vite versions also check the \`Host\` header against an allow-list (\`server.allowedHosts\`) and answer "Blocked request. This host is not allowed" for unknown names like \`host.docker.internal\` — add the name there for local Grid experiments.
2. The API server (\`npm run api\`, port 5181) listens on all interfaces, so \`http://host.docker.internal:5181/api/health\` works from a container once the name resolves. Test code that calls the API runs on **your** JVM, so it can keep using \`localhost:5181\` — only URLs given to the **browser** need the container-visible host.

Make the base URL a property (\`-Dbase.url=http://host.docker.internal:5180/practice-site/\`) and build every page URL from it — the same rule that keeps tests portable across environments.

## Troubleshooting Grid

| Symptom | Cause | Diagnosis | Fix |
|---|---|---|---|
| \`SessionNotCreatedException\` after ~5 min: "Could not start a new session... timed out" | no **matching** stereotype (typo, unavailable version/platform) or no **free** slot | \`GET /se/grid/newsessionqueue/queue\` shows the waiting capabilities; Grid UI shows stereotypes and busy slots | correct the capabilities; add capacity; \`--reject-unsupported-caps\` on static grids to fail fast |
| Sessions stuck in the queue while slots look free | Nodes registered but unhealthy, Distributor model stale, or capability mismatch on custom keys | Node \`/status\` on port 5555; Distributor/Node logs at \`FINE\` | fix Node health; remove/re-register Node; check stereotype keys |
| Node never appears in the UI | cannot reach Event Bus ports 4442/4443, wrong \`SE_EVENT_BUS_HOST\`, registration secret mismatch, node advertises an unreachable URI | Node log ("registration" / connection errors) | open ports, fix host name, set the Node's externally reachable address |
| \`NoSuchSessionException\` mid-test | \`session-timeout\` reaped an idle session (breakpoint, long setup) or Node restarted | Node log shows session timeout / removal | keep sessions busy, raise the timeout for debug runs, investigate Node restarts |
| "session deleted because of page crash" / "tab crashed" | \`/dev/shm\` too small, memory limits | container memory, \`df -h /dev/shm\` in the node | \`--shm-size=2g\` / memory-backed volume, fewer sessions per Node |
| Upload works locally, fails on Grid | no \`LocalFileDetector\` | Node log shows a host path | \`setFileDetector(new LocalFileDetector())\` |
| Client \`TimeoutException\`/read timeout on \`new RemoteWebDriver\` | client read timeout shorter than queue wait | Grid later shows a session nobody uses | \`ClientConfig.readTimeout\` above \`session-request-timeout\` |
| Browser shows connection refused for the app | \`localhost\` inside the container | screenshot/noVNC shows the browser error page | container-visible base URL (section above) |

## Common mistakes and debugging

- **Raising \`thread-count\` to speed up a slot-bound suite.** Look at \`sessionQueueSize\` during the run; if it is > 0, threads are not the bottleneck.
- **\`--override-max-sessions\` with 10 sessions on a 4-CPU VM.** Everything gets slower and flakier; one session per CPU and ~1 GB RAM is the documented starting point.
- **Unpinned \`latest\` images.** A browser upgrade lands in the middle of a release week. Pin full tags and upgrade by PR.
- **No \`shm_size\`.** Chrome crashes on heavy pages only — looks like flaky tests.
- **Exposing the Grid to the internet** "for the cloud CI". Anyone can drive browsers inside your network. Keep it private, put it behind a VPN or run the CI agents inside the network.
- **Treating Grid failures as test failures.** Classify \`SessionNotCreatedException\`, connection refused and queue timeouts as environment failures (see *selenium-deep-troubleshooting-flaky-tests* and *java-deep-exception-design*).

## Best practices for experienced engineers

- One browser session per container (or per Kubernetes Job) and scale containers; isolation beats packing.
- Pin image tags; upgrade Grid images, browsers and Selenium client together in one PR that runs the full suite.
- Size client \`readTimeout\` > \`session-request-timeout\` > typical queue time; keep \`session-timeout\` short enough to reclaim leaks.
- Health-check \`/status\` before the run; export \`sessionCount\` and \`sessionQueueSize\`; alert on sustained queueing.
- Record videos (at least on failure) and log the session id with every test result.
- Route special needs with custom prefixed stereotype capabilities, not separate Grids.
- Keep the Grid private; protect drain/delete endpoints with the registration secret.
- Use a cloud grid for what you cannot host well (Safari, real devices, OS matrix), not for what Docker does cheaply.

## Playwright (TypeScript) equivalent

Playwright does not use Selenium Grid. It scales with **workers** (processes on one machine) and **sharding** across CI machines, and can connect to a remote Playwright server:

\`\`\`typescript
// npx playwright test --workers=8 --shard=2/4         (this machine runs shard 2 of 4)
// remote browsers: start "npx playwright run-server" in a container, then
const browser = await chromium.connect('ws://playwright-server:3000/');
\`\`\`

Because a Playwright worker can open many cheap browser contexts in one browser, horizontal scaling is usually "more CI machines with shards" rather than a central browser farm. The cloud vendors listed above also offer Playwright endpoints. See *pw-deep-architecture*.

## Interview questions

### Q: Explain the Selenium Grid 4 architecture.

**Short answer (30–60 s):** Grid 4 splits the old hub into a Router (front door), New Session Queue, Distributor (assigns requests to slots using a model of all Nodes), Session Map (session id → Node), Event Bus (async messages), and Nodes that own slots with stereotypes and run the drivers. They can run in one process (standalone), as hub + nodes, or fully distributed.

**Detailed answer:** A new-session request goes Router → queue; the Distributor polls the queue, matches capabilities against free slots' stereotypes in its model, asks the chosen Node to create the session and records it in the Session Map. Every later command is Router → Session Map → Node, so the Distributor is only involved at start-up. The split matters operationally: queue time shows capacity problems, Event Bus connectivity explains nodes not registering, and the Distributor's model can be briefly stale after a node crash. In Kubernetes, distributed mode lets you scale and isolate components.

### Q: What is a stereotype, and how does slot matching work?

**Short answer (30–60 s):** A stereotype is the minimal capability set a slot offers — browserName, version, platform, plus optional custom prefixed keys. The Distributor assigns a request to a free slot whose stereotype matches the requested capabilities; browser-specific options like \`goog:chromeOptions\` do not affect matching.

**Detailed answer:** Unspecified capabilities match anything, so omitting \`browserVersion\` takes any Chrome slot. Custom keys such as \`shopeasy:pool\` let you route tests to Nodes with special network access or hardware. If nothing can match, the request waits in the queue until \`session-request-timeout\` — unless \`--reject-unsupported-caps\` is set — which is why a capability typo looks like a five-minute hang. With autoscaling, waiting is desirable because a matching node may be created on demand.

### Q: Your suite runs 20 TestNG threads against a Grid with 8 slots. What happens?

**Short answer (30–60 s):** Only 8 tests run at a time; 12 new-session requests queue. Throughput equals 8 threads, start times grow, and if a client read timeout or \`session-request-timeout\` is shorter than the wait you get \`SessionNotCreatedException\`s and possibly orphaned sessions.

**Detailed answer:** Threads above slots add no throughput. The fix is either more slots or matching \`thread-count\` to slots. I would watch \`sessionQueueSize\` during the run, size the client \`readTimeout\` above the queue timeout to avoid orphans, and plan capacity with ~1 CPU and ~1 GB RAM per session as the starting point, then measure.

### Q: How do you run Selenium Grid in Docker, and what are the classic pitfalls?

**Short answer (30–60 s):** docker-selenium images: \`standalone-chrome\` for one container, or \`hub\` + \`node-chrome\`/\`node-firefox\` with compose, nodes pointing at the hub via \`SE_EVENT_BUS_HOST\`. Pitfalls: \`/dev/shm\` too small (use \`--shm-size=2g\`), unpinned \`latest\` tags, \`localhost\` meaning the container, and no video or VNC to debug.

**Detailed answer:** I pin full tags, run one session per container and scale with \`--scale\`, use noVNC on port 7900 to watch, add \`selenium/video\` or Dynamic Grid with \`se:recordVideo\` for evidence, and give the app a container-visible URL — \`host.docker.internal\` (with \`host-gateway\` on Linux) or the app as a compose service. Dynamic Grid gives a fresh container per session at the cost of start-up time and Docker-daemon access, which must be restricted.

### Q: How would you autoscale Grid on Kubernetes?

**Short answer (30–60 s):** Use the docker-selenium Helm chart with KEDA: its \`selenium-grid\` scaler watches pending requests in the session queue and scales browser nodes, to zero when idle. \`autoscaling.enabled\` (or \`enableWithExistingKEDA\`) switches it on; \`scalingType\` is \`job\` by default or \`deployment\`.

**Detailed answer:** \`job\` gives a fresh pod per session — clean isolation — but pays pod start-up on every session; \`deployment\` reuses warm pods but scale-down must not terminate busy pods. Either way I set memory requests/limits, a memory-backed \`/dev/shm\`, a \`session-request-timeout\` that covers pod start-up, keep \`--reject-unsupported-caps\` off so requests wait for new pods, and alert on sustained queue size. I would keep exact values in the chart's own configuration reference rather than copying them from blogs.

### Q: Self-hosted Grid or cloud grid?

**Short answer (30–60 s):** Self-hosted Docker/Kubernetes for high-volume Chrome/Firefox runs — cheap per session, low latency, data stays private. Cloud for Safari, real mobile devices and broad OS/version matrices, and for small teams without platform support. Most mid-size teams use both.

**Detailed answer:** Cloud pricing is driven by parallel sessions; a plan's cap becomes your queue. Cloud adds internet latency on every command and needs a tunnel to reach internal apps, and it stores screenshots, videos and logs that may contain test data — check retention and region. Self-hosting costs engineering time: images, upgrades, capacity, monitoring. I decide from the browser matrix, run volume, privacy constraints and who will own the infrastructure.

### Q: How do you monitor a Grid?

**Short answer (30–60 s):** \`/status\` as a health check, the GraphQL endpoint for \`sessionCount\`, \`maxSession\` and \`sessionQueueSize\`, the queue endpoint to see what is waiting, the Grid UI and noVNC for live sessions, and logs with OpenTelemetry tracing, which is enabled by default.

**Detailed answer:** I run a pre-flight check in CI that fails as an environment failure if the Grid is not ready, scrape queue size and session count into metrics for capacity planning, keep videos and the session id per test for debugging, and raise the log level to \`FINE\` temporarily when diagnosing registration or matching. Tracing can be exported to Jaeger; \`info tracing\` on the server jar explains how.

## Scenario-based questions

**1. After moving to a Docker Grid, every test fails on the first \`findElement\` and the screenshots show "This site can't be reached".** The browser runs in a container where \`localhost\` is the container. I would make the base URL configurable and use \`host.docker.internal\` (adding \`host-gateway\` on Linux) or put the app into the compose network; for ShopEasy also start Vite with \`--host\` and allow the host name. Then add a pre-flight test that opens the base URL from the Grid and fails fast as an environment error.

**2. Nightly runs on the Kubernetes Grid show 5% \`SessionNotCreatedException: ... timed out\`, always in the first 10 minutes.** The run starts 40 threads at once; KEDA scales from zero, and pod scheduling plus image pull exceeds the queue timeout for the last requests. Options: pre-pulled images on nodes, a minimum replica count before the nightly window, a longer \`session-request-timeout\` with a matching client read timeout, or ramping threads. I would confirm with \`sessionQueueSize\` over time and pod start-up durations before choosing.

**3. The team wants Safari and iOS coverage; the self-hosted Grid is Linux only.** Safari needs macOS (SafariDriver, one session per machine), and real iOS devices need device farms. Building that in-house is expensive. I would propose a cloud plan sized for the Safari/iOS subset — tagged tests in a separate job — keeping Chrome/Firefox on the internal Grid, with a tunnel for the staging environment and a review of what test data and videos the vendor stores.

## Tricky follow-ups

- **Q: Does \`--max-sessions 10\` on a 4-CPU node give you 10 sessions?** Not without \`--override-max-sessions\`; and even then it usually makes everything slower — the default is one per processor for a reason.
- **Q: Do headless Chrome arguments affect which node is chosen?** No — they are inside \`goog:chromeOptions\`, passed to the driver; matching uses browser name, version, platform and custom stereotype keys.
- **Q: Why might a Grid hold busy slots when no tests are running?** Sessions leaked by killed CI jobs or by clients that timed out waiting in the queue; they live until \`session-timeout\` reaps them.
- **Q: Can you get CDP or BiDi through Grid?** Yes — Grid 4 proxies the WebSocket; request \`webSocketUrl\` for BiDi, and use the \`Augmenter\` for \`HasDevTools\` on a \`RemoteWebDriver\`.
- **Q: Is the Router safe to expose publicly?** No. The docs warn against it; anyone could start browsers inside your network. Keep it internal.`,
  keyPoints: [
    'Grid 4 = Router, New Session Queue, Distributor, Session Map, Event Bus and Nodes with slots; the Distributor matches requests to slot stereotypes, and later commands go Router → Session Map → Node.',
    'Modes: standalone (one process), hub and node (most teams), fully distributed (large or Kubernetes setups).',
    'Key flags: --max-sessions (default = processors), --override-max-sessions, --session-timeout, --session-request-timeout, --reject-unsupported-caps; declare slots in TOML with [[node.driver-configuration]] stereotypes.',
    'Client side: ClientConfig readTimeout above the queue timeout, short connectionTimeout, LocalFileDetector for uploads, se:name for labels; code against WebDriver.',
    'docker-selenium: pin full tags, --shm-size=2g, noVNC on 7900, one session per container, selenium/video or Dynamic Grid with se:recordVideo; Kubernetes via the Helm chart with KEDA scaling on queue length.',
    'Capacity is slots, not threads: about 1 CPU and 1 GB RAM per session; extra threads only queue.',
    'Observe with /status, /graphql (sessionCount, sessionQueueSize), the queue endpoint, Grid UI and tracing (enabled by default).',
    'A browser in a container cannot reach the host via localhost — use host.docker.internal (host-gateway on Linux) or a compose service; cloud grids fit Safari/real devices/OS matrices, self-hosted fits high-volume Chrome/Firefox.',
  ],
  mistakes: [
    'Raising thread-count beyond available slots to speed up the suite. Fix: check sessionQueueSize during the run; add slots or match thread-count to capacity.',
    'Client read timeout shorter than the session queue wait, leaving orphaned sessions holding slots. Fix: ClientConfig.readTimeout above session-request-timeout, and a session-timeout that reclaims leaks.',
    'Running browser containers with Docker\'s default 64 MB /dev/shm, causing "tab crashed" failures under load. Fix: --shm-size=2g (shm_size in compose) or a memory-backed volume on Kubernetes; fewer sessions per node.',
    'Pointing the containerised browser at http://localhost:5180. Fix: a configurable base URL using host.docker.internal (with host-gateway on Linux) or the app as a compose service; start Vite with --host and allow the host name.',
    'Using latest image tags so browsers change silently mid-release. Fix: pin full docker-selenium tags and upgrade Grid, browsers and Selenium client together in one PR.',
    'A capability typo that hangs for five minutes before SessionNotCreatedException. Fix: inspect /se/grid/newsessionqueue/queue and stereotypes in the Grid UI; enable --reject-unsupported-caps on static grids.',
  ],
  tryIt: `With Docker installed: (1) start \`selenium/standalone-chrome:<pinned tag>\` with \`--shm-size=2g\` and ports 4444/7900, open \`http://localhost:4444/ui\` and noVNC on 7900; (2) start ShopEasy with \`npx vite --host\` and connect a \`RemoteWebDriver\` (with \`ClientConfig\` timeouts and \`LocalFileDetector\`) to \`http://localhost:4444\` — first navigate to \`http://localhost:5180/practice-site/login.html\` and observe the failure in noVNC, then fix it with \`host.docker.internal\` (add it to Vite's allowed hosts if Vite blocks it) and log in as \`standard_user\`; (3) switch to a compose file with a hub and two Chrome nodes, run a TestNG suite with \`thread-count\` 6, and record \`sessionCount\` and \`sessionQueueSize\` from \`/graphql\` every few seconds — explain the queue; (4) request a misspelt browser name and find the waiting request at \`/se/grid/newsessionqueue/queue\`.`,
  problems: ['sel-019', 'sel-020'],
}
