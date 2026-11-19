export default {
  slug: 'framework-docker-selenium-grid',
  category: 'framework',
  order: 10,
  title: 'Selenium Grid in Docker and RemoteWebDriver',
  minutes: 8,
  summary: 'Run browsers in Docker containers through Selenium Grid, and switch your framework between local browsers and the Grid with one configuration value.',
  manualAnalogy: `In a manual lab, testers do not install every browser on their own laptop — they use a shared device lab: "send this test to the Firefox machine". Selenium Grid is that device lab for automation. Your test stays on your machine (or the CI agent) and sends its commands to a machine that has the browser; Docker makes creating that lab a one-line command.`,
  body: `## How a remote browser works

Every Selenium command is an HTTP request. With \`ChromeDriver\` those requests go to a driver process on your machine. With **\`RemoteWebDriver\`** they go to a **Grid** URL (port \`4444\` by default), and the Grid forwards them to a **node** — a machine or container running the real browser.

\`\`\`java
ChromeOptions options = new ChromeOptions();
options.addArguments("--window-size=1920,1080");
WebDriver driver = new RemoteWebDriver(URI.create("http://localhost:4444").toURL(), options);
\`\`\`

The options object doubles as the request "I need a Chrome with these settings". Everything after this line — pages, waits, assertions — is unchanged.

## Starting a Grid with Docker

The official \`selenium/*\` images contain the browser, the driver and the Grid. For one browser, a single container is enough:

\`\`\`
docker run -d -p 4444:4444 --shm-size=2g selenium/standalone-firefox:4.27.0-20241204
\`\`\`

For several browsers, \`docker compose\` starts a **hub** plus one container per browser **node**; the nodes register with the hub through its event bus (ports 4442/4443). Open \`http://localhost:4444/ui\` to see the nodes and running sessions.

Settings that matter:

| Setting | Why |
|---|---|
| \`--shm-size=2g\` / \`shm_size: 2gb\` | Chrome and Firefox crash randomly with Docker's small default shared memory |
| \`SE_NODE_MAX_SESSIONS\` | how many browsers one node runs at once |
| a pinned image tag | the same browser version every run, not whatever \`latest\` is today |

Total capacity = nodes × sessions per node. Keep TestNG's \`thread-count\` at or below it; extra sessions wait in the queue and may time out.

## One factory, two modes

Laptops should not need Docker to run one test. So the driver factory decides at runtime:

- build the options for the requested browser (headless, window size) — **once**;
- if a grid URL is configured (a \`-D\` property or an environment variable from CI), create a \`RemoteWebDriver\` with those options;
- otherwise create a local driver with the **same** options.

No URL is hard-coded: the CI pipeline sets it, a developer's laptop leaves it empty.

## "localhost" is not your machine any more

The browser now runs **inside a container**. If the base URL is \`http://localhost:5180/practice-site\`, the browser looks for a server inside its own container and finds nothing. For grid runs the base URL must be reachable *from the node*: a deployed QA environment, the compose service name of the app, or \`host.docker.internal\` (Docker Desktop's name for the host). Keep that URL in the environment's config file, not in code.

## Using it in CI

A CI job can start the Grid as a step (\`docker compose up -d\`), or — in GitHub Actions — as a job \`services:\` container, then run Maven with the grid URL set and \`docker compose down\` at the end (in an always-run step). The agent itself needs Docker but no browsers.

File uploads need one extra line, because the file lives on your machine but the browser runs on the node: \`((RemoteWebDriver) driver).setFileDetector(new LocalFileDetector())\`.`,
  keyPoints: [
    'RemoteWebDriver sends the same commands over HTTP to a Grid, which runs them on a node with the real browser.',
    'Docker images (selenium/standalone-*, hub + node-*) give you a Grid in one command; set shm size and pin the tag.',
    'One driver factory: same options, remote when a grid URL is configured, local otherwise.',
    'Inside a container, localhost is the container — the app URL must be reachable from the node.',
    'Keep thread-count within the Grid capacity (nodes × max sessions).',
  ],
  mistakes: [
    'Hard-coding http://localhost:4444 in the factory — laptops without Docker can no longer run tests.',
    'Forgetting --shm-size, then chasing random "tab crashed" failures.',
    'Pointing the remote browser at localhost for the application under test.',
    'Running more parallel threads than the Grid has sessions, so tests time out in the queue.',
  ],
  tryIt: `If you have Docker, run \`docker run -d -p 4444:4444 --shm-size=2g selenium/standalone-chrome:4.27.0-20241204\`, open http://localhost:4444/ui, then start any test with a RemoteWebDriver pointing at it and watch the session appear. Try opening http://localhost:5180/practice-site/login.html from that remote browser and see why the base URL needs \`host.docker.internal\`.`,
  problems: ['fw-025'],
}
