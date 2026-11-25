export default {
  slug: 'framework-deep-docker-for-test-automation',
  category: 'framework',
  order: 16,
  title: 'Deep dive: Docker for test automation — images, Compose, networking and containerised test runs',
  minutes: 35,
  summary: 'Containerise a test run end to end — what a container really is, layer caching and multi-stage builds, ENTRYPOINT vs CMD, images for ShopEasy, the Java suite and the Playwright suite, a Compose stack with healthchecks and correct exit codes, networking, volumes and permissions, /dev/shm, secrets, Testcontainers vs Compose vs shared environments, Docker in CI, Kubernetes for testers, image security and a troubleshooting table.',
  manualAnalogy: `Before a certification run you prepare a clean machine: fixed operating system, fixed browser, fixed build, known data — and you document it so that someone else can repeat the run. A container image is that prepared machine as a file, and a Compose file is the lab plan: which machines exist, how they are connected, and when the test may start.`,
  body: `## Where the earlier lessons stop

\`framework-docker-selenium-grid\` introduced RemoteWebDriver, a standalone browser container and the "localhost is not your machine" rule. Covered in depth elsewhere and not repeated:

- Grid architecture, hub/node Compose files, Dynamic Grid, video, Helm and KEDA: \`selenium-deep-grid-infrastructure\`.
- Running the Playwright image by hand and matching the tag: \`pw-deep-config-environments-ci\`.
- Testcontainers with PostgreSQL and JUnit/TestNG lifecycles: \`restassured-deep-database-testing-jdbc\`.
- Pipelines: \`framework-deep-jenkins-ci-cd-pipelines\`.

Here we build the images **ourselves**: ShopEasy, the Java suite and the Playwright suite, wire them together with Compose, and look at what breaks: networking, shared memory, permissions, signals, exit codes. The examples assume the typical monorepo of the previous lesson (app in the root, \`tests-java/\`, \`tests-pw/\`). Baseline: current Docker Engine with BuildKit and Compose v2 (\`docker compose\`, not the old \`docker-compose\`).

## 1. What a container is

### Processes with restricted views

A container is **not a small VM**. It is an ordinary process (tree) on a Linux kernel, started with three mechanisms:

| Mechanism | What it restricts | What a tester notices |
|---|---|---|
| **Namespaces** | what the process can *see*: pid, net, mnt, uts, ipc, user | PID 1 inside is your test process; its own \`localhost\`; its own hostname; its own \`/dev/shm\` (ipc) |
| **cgroups** | what it can *use*: CPU, memory, pids, I/O | exit code 137 when the memory limit is hit; throttled CPU shows up as timeouts |
| **Union file system** (overlay2) | what it *has*: read-only image layers + one writable layer | files written in the container vanish with it; "copy-up" makes the first write to a large file slow |

Plus hardening: dropped capabilities, a seccomp profile, optionally user namespaces. Chrome's own sandbox needs kernel features that the default profile blocks — the origin of \`--no-sandbox\` in containers.

| | Container | Virtual machine |
|---|---|---|
| Kernel | shared with the host | its own |
| Start | milliseconds to seconds | tens of seconds to minutes |
| Size | MB to ~2 GB (browser images) | GB |
| Isolation | process-level; a kernel exploit escapes | hardware-level |
| Can run | Linux user space on a Linux kernel | any operating system |
| Test use | services, browsers on Linux, reproducible runners | Windows/macOS browsers (real Edge on Windows, Safari), kernel tests, untrusted code |

On Windows and macOS, Docker Desktop runs a **Linux VM** and puts your containers in it. Hence three practical facts: the memory limit of that VM caps all browsers together; bind mounts from a Windows drive cross a file-system boundary and are slow (keep projects inside WSL2); and \`localhost\` published ports are forwarded by Desktop. And containers do not test Safari: Playwright's WebKit on Linux is close to it but is not Safari on macOS.

### Image vs container, and layers

- An **image** is an immutable, ordered list of layers (file-system diffs) + configuration (env, entrypoint, user), identified by a **digest**. A **tag** is a movable name for a digest.
- A **container** is an image + a thin writable layer + runtime settings. A hundred containers of one image share the layers.
- Each \`RUN\`, \`COPY\`, \`ADD\` creates a layer. A file deleted in a later layer still exists in the earlier one — so \`RUN rm secret.txt\` does not remove a secret and \`RUN rm -rf /var/cache\` in its own instruction does not shrink the image.

### The build cache

For each instruction BuildKit computes a key from the parent layer, the instruction text and, for \`COPY\`/\`ADD\`, the **content** of the files. The first miss invalidates everything after it. So: rarely changing things first.

\`\`\`dockerfile
# slow: any change in a test re-downloads all dependencies
COPY . .
RUN npm ci

# fast: dependencies are rebuilt only when the manifest changes
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
\`\`\`

Corollary: \`RUN apt-get update\` in its own layer is cached for months, and a later \`apt-get install\` then fails with 404. Always \`apt-get update && apt-get install -y --no-install-recommends … && rm -rf /var/lib/apt/lists/*\` in **one** RUN.

## 2. Dockerfile instructions that matter

| Instruction | Notes for senior use |
|---|---|
| \`FROM image:tag AS name\` | start of a stage; pin a precise tag, or \`@sha256:\` digest for full reproducibility |
| \`ARG\` / \`ENV\` | \`ARG\` is build-time only (but visible in \`docker history\`: no secrets); \`ENV\` stays in the image and container |
| \`WORKDIR\` | creates and enters the directory; never \`RUN cd\` |
| \`COPY\` vs \`ADD\` | \`COPY\` copies. \`ADD\` also downloads URLs and unpacks local tar files. Use \`COPY\` unless you need exactly that |
| \`RUN --mount=type=cache\` | cache directory (\`~/.m2\`, npm) kept between builds, not in the layer |
| \`RUN --mount=type=secret\` | secret available only during this step, not stored in a layer |
| \`USER\` | from here on run as this user; applies at run time too |
| \`EXPOSE\` | documentation; publishes nothing |
| \`HEALTHCHECK\` | command whose exit status decides healthy/unhealthy; used by Compose, ignored by Kubernetes |
| \`ENTRYPOINT\` / \`CMD\` | what runs |
| \`.dockerignore\` | what the build context excludes: \`node_modules\`, \`target\`, \`.git\`, reports, \`.env\` |

### ENTRYPOINT vs CMD, exec vs shell form

| | No ENTRYPOINT | \`ENTRYPOINT ["java","-jar","t.jar"]\` | \`ENTRYPOINT java -jar t.jar\` (shell form) |
|---|---|---|---|
| \`CMD ["smoke.xml"]\` | executes \`smoke.xml\` (error) | \`java -jar t.jar smoke.xml\` | CMD **ignored** |
| \`docker run img regression.xml\` | executes \`regression.xml\` | \`java -jar t.jar regression.xml\` | argument **ignored** |
| Signals | direct | direct: java is PID 1 | \`/bin/sh\` is PID 1 and does not forward SIGTERM |

**Recommended for test images:** exec-form \`ENTRYPOINT\` for the runner, \`CMD\` for the default suite. Then the image behaves like a command: \`docker run tests\` is smoke, \`docker run tests test-classes/suites/regression.xml\` is regression. Override the entrypoint for debugging: \`docker run --rm -it --entrypoint bash tests\`.

**PID 1 is special.** The kernel gives PID 1 no default action for SIGTERM and makes it responsible for reaping orphaned children. ShopEasy's API installs no signal handler, so as PID 1 it ignores \`docker stop\` and is killed after the grace period (10 s). \`docker run --init\` / Compose \`init: true\` puts a tiny init process in front; with browsers as children it prevents zombie processes too.

## 3. Containerising ShopEasy

### What the code says about binding

| Component | Binding today | What a container needs |
|---|---|---|
| Web, \`npm run dev\` (Vite, \`vite.config.js\`: only \`server: { port: 5180 }\`) | **localhost only** (Vite's default host) | \`--host 0.0.0.0\`, and the Host header must be allowed: \`localhost\`, \`*.localhost\` and IP addresses are by default, a service name such as \`web\` or \`host.docker.internal\` is **not**. Add it through \`server.allowedHosts\` or the environment variable \`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS\` |
| API, \`npm run api\` (\`server.listen(PORT)\`, no host) | all interfaces, port from \`PORT\` (default 5181) | nothing; it has no dependencies, only \`node:http\` |

A process bound to \`127.0.0.1\` **inside** a container is unreachable even with \`-p 5180:5180\`: the port forward arrives at the container's \`eth0\`, not at its loopback. Symptom: \`Empty reply from server\` or \`Connection reset\` from the host, although \`docker exec … wget 127.0.0.1\` works.

### Two ways to serve the web part

| | Vite dev server in the container | nginx with the static practice site |
|---|---|---|
| How | \`npm ci\`, \`vite --host 0.0.0.0\` | \`public/practice-site\` is plain HTML/CSS/JS: copy it |
| Advantages | identical to local development | ~50 MB image, starts in under a second, close to production, no Host check |
| Disadvantages | big image, dev server in tests, Host header setting | does not serve the React study app (not under test here) |
| When | debugging app changes live | test runs |

**Recommended:** nginx for test runs. (For an app with a build step: a build stage with \`npm run build\`, then copy the output into nginx.)

\`\`\`dockerfile
# docker/web.Dockerfile
FROM nginx:stable-alpine
COPY public/practice-site /usr/share/nginx/html/practice-site
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \\
  CMD wget -q -O /dev/null http://127.0.0.1/practice-site/login.html || exit 1
\`\`\`

\`\`\`dockerfile
# docker/api.Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY scripts/api-server.mjs ./
ENV PORT=5181
EXPOSE 5181
USER node
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \\
  CMD wget -q -O /dev/null "http://127.0.0.1:\${PORT}/api/health" || exit 1
CMD ["node", "api-server.mjs"]
\`\`\`

Three details a reviewer should see: \`127.0.0.1\` rather than \`localhost\` (which may resolve to \`::1\` first, where nginx may not listen); a real GET rather than \`wget --spider\` (a HEAD request, which an API may answer with 405); and \`USER node\`, the non-root user of the Node image. The API file is \`.mjs\`, so no \`package.json\` is needed. Its data lives **in memory**: one container per test run gives perfect isolation, and two replicas behind a load balancer would disagree about carts.

## 4. The Java suite as an image

Option A keeps Maven in the image (\`ENTRYPOINT ["mvn", …]\`): simple, large, slow to start, needs the repository or an offline \`~/.m2\`. Option B compiles in one stage and runs plain Java in the next: smaller, starts immediately, no network at run time. B is shown; it needs the suite's classes only.

\`\`\`dockerfile
# syntax=docker/dockerfile:1
# tests-java/Dockerfile (the syntax directive must stay on the first line)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \\
    mvn -B -q test-compile dependency:copy-dependencies \\
        -DincludeScope=test -DoutputDirectory=target/libs \\
 && mkdir -p target/classes

FROM eclipse-temurin:17-jre AS tests
RUN groupadd --gid 10001 qa && useradd --uid 10001 --gid qa --create-home qa
WORKDIR /tests
COPY --from=build /build/target/libs ./libs
COPY --from=build /build/target/classes ./classes
COPY --from=build /build/target/test-classes ./test-classes
RUN mkdir -p reports && chown -R qa:qa /tests/reports
USER qa
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -Dfile.encoding=UTF-8 -Duser.timezone=UTC"
ENTRYPOINT ["java", "-cp", "classes:test-classes:libs/*", "org.testng.TestNG", "-d", "reports"]
CMD ["test-classes/suites/smoke.xml"]
\`\`\`

**Step by step**

- **Stage \`build\`** has JDK, Maven and sources; nothing of it reaches the final image unless copied. \`go-offline\` before \`COPY src\` caches dependencies by pom; the cache mount keeps \`~/.m2\` between builds without putting it in a layer. (Some plugins resolve artifacts lazily, so \`go-offline\` is not always complete: the second RUN may still download a little.)
- \`copy-dependencies -DincludeScope=test\` collects the *whole* test class path (compile, runtime and test scope).
- **Order of COPY:** libraries (change rarely, large) before classes (change always, tiny). A rebuild after a test change pushes a few hundred kilobytes.
- **No browser and no driver inside.** The browser is another container; the tests need only Grid's URL. One suite image, any browser.
- TestNG is started directly, so **Surefire's behaviour is absent**: no \`-Dtest\`, no reruns, no plugin configuration. Suite XML files work here regardless of the Surefire 3.6 change. TestNG's default reporters write \`testng-results.xml\` and JUnit-style XML under \`reports/\`.
- **Exit code:** TestNG's command line ends with a non-zero status for failures *and* for skips. That status becomes the container's.
- \`MaxRAMPercentage\` sizes the heap from the cgroup limit; JDK 17 is container-aware, and the default of 25 % is small. Keep in mind that \`JAVA_TOOL_OPTIONS\` prints a "Picked up…" line on stderr.
- Configuration through environment variables: the framework's \`UiConfig\` (\`selenium-deep-framework-design\`) maps \`base.url\` → \`BASE_URL\`, \`grid.url\` → \`GRID_URL\`, \`browser\` → \`BROWSER\`, so the image contains no environment.

\`\`\`bash
docker build -t shopeasy-tests-java:local tests-java
docker run --rm -e BASE_URL=http://host.docker.internal:5180/practice-site/ \\
  -e GRID_URL=http://host.docker.internal:4444 shopeasy-tests-java:local
docker run --rm shopeasy-tests-java:local -groups smoke test-classes/suites/regression.xml
\`\`\`

## 5. The Playwright suite as an image

\`\`\`dockerfile
# syntax=docker/dockerfile:1
ARG PW_VERSION=1.64.1
FROM mcr.microsoft.com/playwright:v\${PW_VERSION}-noble
ARG PW_VERSION
RUN mkdir -p /work && chown pwuser:pwuser /work
WORKDIR /work
USER pwuser
COPY --chown=pwuser:pwuser package.json package-lock.json ./
RUN npm ci
# fail the BUILD, not 200 tests, when image and package differ
RUN node -e "const v=require('@playwright/test/package.json').version; if (v!==process.argv[1]) { console.error('image '+process.argv[1]+' but @playwright/test '+v); process.exit(1) }" "$PW_VERSION"
COPY --chown=pwuser:pwuser . .
ENV CI=true PLAYWRIGHT_HTML_OPEN=never
ENTRYPOINT ["npx", "playwright", "test"]
CMD ["--project=smoke"]
\`\`\`

- The official image contains the **browsers** and system libraries for one exact Playwright version; \`@playwright/test\` comes from your lock file. If they differ you get \`Executable doesn't exist at /ms-playwright/…\`. The guard turns that into one clear build error.
- \`ARG\` before \`FROM\` must be **re-declared** after it to be visible in the stage.
- The images are Ubuntu based (22.04 \`jammy\`, 24.04 \`noble\`, 26.04 \`resolute\` for the current release). Alpine is not supported: Firefox and WebKit builds need glibc. Do not "optimise" to \`node:alpine\`.
- The image's default user is root, which disables Chromium's sandbox. \`pwuser\` is provided; for untrusted sites also use Playwright's seccomp profile.
- Run with \`--ipc=host\` (or a big enough \`--shm-size\`) and \`--init\`.
- Why a separate image per stack? One "everything" image with JDK, Maven, Node and three browsers is 4 GB, rebuilt for every change, and couples two upgrade cycles.

## 6. Compose: the whole system in one command

\`\`\`yaml
# compose.e2e.yml
name: shopeasy-e2e

services:
  api:
    build: { context: ., dockerfile: docker/api.Dockerfile }
    image: shopeasy-api:\${APP_TAG:-local}
    init: true
    # HEALTHCHECK comes from the image

  web:
    build: { context: ., dockerfile: docker/web.Dockerfile }
    image: shopeasy-web:\${APP_TAG:-local}
    ports: ["5180:80"]            # only for a human on the host; the tests do not need it

  chrome:
    image: selenium/standalone-chrome:4.54.0-20261124
    shm_size: 2gb
    environment:
      SE_NODE_MAX_SESSIONS: "2"
      SE_NODE_OVERRIDE_MAX_SESSIONS: "true"
    ports: ["7900:7900"]          # noVNC, to watch
    healthcheck:
      test: ["CMD", "/opt/bin/check-grid.sh", "--host", "0.0.0.0", "--port", "4444"]
      interval: 5s
      timeout: 10s
      retries: 12
      start_period: 10s

  tests:
    build: ./tests-java
    image: shopeasy-tests-java:\${TEST_TAG:-local}
    init: true
    user: "\${HOST_UID:-1000}:\${HOST_GID:-1000}"
    command: ["test-classes/suites/\${SUITE:-smoke}.xml"]
    environment:
      BASE_URL: http://web/practice-site/
      API_URL: http://api:5181
      GRID_URL: http://chrome:4444
      BROWSER: chrome
      SHOP_PASS_FILE: /run/secrets/shop_pass
    secrets: [shop_pass]
    volumes:
      - ./reports:/tests/reports
    depends_on:
      api:    { condition: service_healthy }
      web:    { condition: service_healthy }
      chrome: { condition: service_healthy }

  tests-pw:
    profiles: [pw]
    build: ./tests-pw
    init: true
    ipc: host
    environment:
      BASE_URL: http://web/practice-site/
      API_URL: http://api:5181
    depends_on:
      api: { condition: service_healthy }
      web: { condition: service_healthy }

secrets:
  shop_pass:
    environment: SHOP_PASS        # taken from the shell that runs compose
\`\`\`

\`\`\`bash
mkdir -p reports                                   # or the daemon creates it, owned by root
export HOST_UID=$(id -u) HOST_GID=$(id -g) SHOP_PASS=...
docker compose -f compose.e2e.yml up --build --abort-on-container-exit --exit-code-from tests
code=$?
docker compose -f compose.e2e.yml logs --no-color > reports/compose.log
docker compose -f compose.e2e.yml down -v --remove-orphans
exit $code
\`\`\`

**Step by step**

- **Service name = DNS name** on the project's network. The *browser* opens \`http://web/practice-site/\` (container port 80), the *JVM* calls \`http://api:5181\`. Nothing uses \`localhost\`.
- **\`depends_on\` with \`service_healthy\`** waits for the health check. The short form only orders *starting*, and "started" is not "ready". A dependency without any healthcheck makes Compose report an error for this condition. \`service_completed_successfully\` is for one-shot jobs such as migrations or seeding.
- \`check-grid.sh\` ships in the docker-selenium images: it queries the Grid status and checks \`ready\`.
- **\`--exit-code-from tests\`** returns the tests' exit code and implies \`--abort-on-container-exit\`: when the tests finish, the servers stop. Without it, \`up\` never returns or returns the wrong code: a pipeline that cannot fail.
- **Logs before \`down\`**, and \`down\` always — in CI in an \`always\` step. \`-v\` deletes named volumes: the next run starts clean.
- **\`profiles\`** keep Playwright out of the default run. \`docker compose -f compose.e2e.yml run --build --rm tests-pw\` starts it with its dependencies, and its exit code is the command's.
- The file never mentions a container name; with \`-p pr-123\` (or a different \`name\`) two builds can run on one host — but then drop the published \`ports\`, which would collide.

**\`up --exit-code-from\` vs \`run --rm\`**

| | \`up --abort-on-container-exit --exit-code-from tests\` | \`run --rm tests\` |
|---|---|---|
| Output | all services interleaved | only the tests |
| Arguments | fixed in the file | \`run --rm tests test-classes/suites/regression.xml\` |
| One-shot services (seed, migrate) | **their exit stops everything**, even with code 0 | waits for them correctly |
| Afterwards | all stopped | dependencies keep running until \`down\` |
| When | simple stacks, full log | anything with init jobs, or ad-hoc suites |

**Recommended:** \`run --rm\` + \`down\` in CI as soon as there is a seed service; the abort trap above costs people a day.

### Watching a failing run

\`\`\`bash
docker compose -f compose.e2e.yml up -d --wait api web chrome   # returns when healthy
docker compose -f compose.e2e.yml run --rm tests -methods com.shopeasy.ui.CheckoutIT.totalsWithTax
docker compose -f compose.e2e.yml exec chrome curl -sS http://web/practice-site/login.html   # the browser's view
\`\`\`

Open noVNC on port 7900 while the second command runs. The third line is the most useful debugging habit of all: **test connectivity from the container that has the problem**.

## 7. Networking

| From → to | Address | Why |
|---|---|---|
| host → container | \`localhost:<published port>\` | \`-p 5180:80\` = host 5180 → container 80 |
| container → container (same user-defined network) | \`http://service:<container port>\` | embedded DNS; published ports irrelevant |
| container → host | \`host.docker.internal\` | built in on Docker Desktop; on Linux add \`--add-host=host.docker.internal:host-gateway\` (Compose \`extra_hosts\`) |
| container → itself | \`localhost\` | own network namespace |
| default bridge network | IP only, **no DNS by name** | use a user-defined network (Compose creates one) |
| \`network_mode: host\` (Linux) | shares the host's network | no isolation, port collisions; \`ports:\` ignored |

The four-question drill for "connection refused": *Who* makes the connection (JVM, browser, shell)? *Where* does that process run? *Which name* does it resolve, to what (\`getent hosts web\`)? *Does the server listen* on that interface (\`0.0.0.0\` or only \`127.0.0.1\`)? In a Selenium run the browser and the JVM are usually in different places, so the same URL may be right for one and wrong for the other.

More traps: a published port binds to all host interfaces unless you write \`127.0.0.1:5180:80\` (a test database on a laptop in a café); a corporate proxy set in the container also intercepts \`http://web\` unless \`NO_PROXY\` lists the service names; and browsers treat \`http://web\` as an insecure origin, unlike \`http://localhost\`, so secure-context features (clipboard, service workers) may behave differently.

## 8. Volumes, permissions, shared memory

### Getting reports out

| | Bind mount \`./reports:/tests/reports\` | Named volume | \`docker cp\` / \`compose cp\` after the run |
|---|---|---|---|
| How | host directory appears in the container | managed by Docker | copy from the stopped container |
| Advantages | files immediately on the host | fast on every OS, correct ownership from the image | no uid problem, works with remote daemons |
| Disadvantages | uid/gid mismatch; slow on Desktop | need an extra step to read | container must not be removed first |
| CI with a remote or sibling daemon | path is resolved **on the daemon's host** | works | works |
| When | local runs | dependency caches | CI in containers |

\`\`\`bash
docker compose -f compose.e2e.yml up --exit-code-from tests ; code=$?
docker compose -f compose.e2e.yml cp tests:/tests/reports ./reports   # container is stopped but exists
docker compose -f compose.e2e.yml down -v ; exit $code
\`\`\`

### File ownership

Linux compares **numbers**. If the container writes as uid 0, the CI user cannot delete \`reports/\` in the next build (\`AccessDeniedException\` at workspace cleanup). If it runs as 10001, it cannot write into a bind-mounted directory owned by 1000 (\`Permission denied\`). Solutions, in order: \`user: "\${HOST_UID}:\${HOST_GID}"\`; copy instead of mounting; never \`chmod 777\`. A container running under a uid without an entry in \`/etc/passwd\` has no home directory: set \`HOME\` to something writable when a tool needs it (npm, Maven). Docker Desktop maps ownership itself — which is why the bug appears only on Linux CI.

### /dev/shm

Chrome shares memory between its processes through \`/dev/shm\`; Docker's default is **64 MB**. Heavy pages then crash the tab ("session deleted because of page crash", "Target crashed").

| Fix | Effect |
|---|---|
| \`--shm-size=2g\` / \`shm_size: 2gb\` | enlarges it for this container: the recommended way for Selenium images |
| \`--ipc=host\` / \`ipc: host\` | uses the host's: recommended by Playwright's docs; weaker isolation |
| \`--disable-dev-shm-usage\` (Chrome argument) | uses \`/tmp\` instead: the workaround when you cannot change the container |
| Kubernetes | \`emptyDir\` with \`medium: Memory\` mounted at \`/dev/shm\` (counts against the memory limit) |

## 9. Configuration, secrets, exit codes

- **Environment** for non-secrets: \`environment:\`, \`env_file:\`. Compose interpolates \`\${VAR}\` from the *shell or the project's \`.env\` file*; that is different from \`env_file:\`, which feeds the container. \`docker compose config\` prints the final result — including interpolated secrets, so do not archive it.
- **Run-time secrets:** Compose \`secrets\` mount a file under \`/run/secrets/<name>\`, only in services that ask for it; the code reads \`SHOP_PASS_FILE\`. Unlike environment variables they do not appear in \`docker inspect\`, crash dumps and child processes.
- **Build-time secrets** (private Maven repository): never \`ARG\` or \`COPY settings.xml\`:

\`\`\`dockerfile
RUN --mount=type=secret,id=m2settings,target=/root/.m2/settings.xml \\
    --mount=type=cache,target=/root/.m2/repository \\
    mvn -B -q dependency:go-offline
\`\`\`

\`\`\`bash
docker build --secret id=m2settings,src=$HOME/.m2/settings.xml -t shopeasy-tests-java tests-java
\`\`\`

| Exit code | Meaning | Typical cause in a test run |
|---|---|---|
| 0 | success | — or the runner found no tests |
| 1 (2, …) | the application's own failure | red tests; TestNG uses other values for skips |
| 125 | the \`docker run\` command itself failed | bad option, port already allocated, unknown image |
| 126 | command found, not executable | missing \`chmod +x\` |
| 127 | command not found | wrong PATH, CRLF in the shebang |
| 137 | SIGKILL (128+9) | out of memory (\`docker inspect -f '{{.State.OOMKilled}}'\`), or \`docker stop\` after the grace period |
| 139 | SIGSEGV | native crash; musl/glibc mismatch |
| 143 | SIGTERM (128+15) | stopped normally by \`docker stop\` or an orchestrator |

\`docker run … | tee out.log\` returns \`tee\`'s code: use \`set -o pipefail\`. Docker's \`restart:\` policies have no place on a test service: \`always\` makes a failed suite run forever.

## 10. Testcontainers, Compose or a shared environment

| | Testcontainers | Docker Compose | Shared environment (QA) |
|---|---|---|---|
| How it works | the test code starts containers, random ports, removes them | a file describes the system, a command starts it | deployed once, everyone uses it |
| Advantages | one \`mvn verify\`; per-class isolation; no port conflicts; IDE friendly | whole system, language neutral, also for manual testing | real integrations and data volumes |
| Disadvantages | needs Docker on every machine; start-up inside test time; E2E stacks become Java code | state between runs unless torn down; ports | collisions, unknown version, downtime |
| Performance | seconds per container; singleton pattern | one start per run | none, plus waiting for others |
| Maintainability | versioned with tests | versioned with the app | operations work |
| Scalability | per JVM/fork | per host/project name | poor |
| When to use | integration and API tests with dependencies | E2E locally and on CI | staging checks, third-party integrations |

**Recommended:** Testcontainers for API and database integration tests, Compose for the E2E stack, the shared environment only for what cannot be containerised. Testing the *same image* in all three is what matters.

\`\`\`java
package com.shopeasy.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import io.restassured.http.ContentType;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

public class CartApiIT {

    private final GenericContainer<?> api = new GenericContainer<>(
            DockerImageName.parse("shopeasy-api:" + System.getProperty("app.tag", "local")))
            .withExposedPorts(5181)                                  // container port; the host port is random
            .waitingFor(Wait.forHttp("/api/health").forStatusCode(200));

    @BeforeClass
    public void start() {
        api.start();
    }

    @AfterClass(alwaysRun = true)
    public void stop() {
        api.stop();
    }

    @Test
    public void addingTheSameProductTwiceIsAConflict() {
        String base = "http://" + api.getHost() + ":" + api.getMappedPort(5181);   // never "localhost:5181"
        String token = given().baseUri(base).contentType(ContentType.JSON)
                .body("{\\"username\\":\\"standard_user\\",\\"password\\":\\"secret_sauce\\"}")
                .post("/api/auth/login")
                .then().statusCode(200).extract().path("token");

        String item = "{\\"productId\\":2,\\"quantity\\":1}";
        given().baseUri(base).auth().oauth2(token).contentType(ContentType.JSON).body(item)
                .post("/api/cart/items").then().statusCode(201);
        given().baseUri(base).auth().oauth2(token).contentType(ContentType.JSON).body(item)
                .post("/api/cart/items").then().statusCode(409)
                .body("error.code", equalTo("ITEM_ALREADY_IN_CART"));
    }
}
\`\`\`

\`getHost()\` + \`getMappedPort()\` is the portable address: inside a CI container with a mounted socket the host is *not* localhost. Containers that must reach each other share a \`Network\` with \`withNetworkAliases("web")\`; a container that must reach a server on the test JVM's machine uses \`Testcontainers.exposeHostPorts(port)\` and \`host.testcontainers.internal\`. When the API misbehaves, \`api.getLogs()\` in a failure listener is the evidence to attach.

## 11. Docker in CI

| | Job runs on a VM with Docker | Socket mount (\`/var/run/docker.sock\`) | Docker-in-Docker (privileged) | CI "services" / K8s pods |
|---|---|---|---|---|
| How | the job calls docker directly | the job container uses the **host's** daemon; containers are *siblings* | own daemon inside the job container | the CI starts side containers |
| Advantages | simplest | shared layer cache, fast | isolated, clean | no docker needed in the job |
| Disadvantages | one VM per job, or clean-up discipline | root on the host in practice; name/port clashes; **paths are host paths** | privileged container; cold cache; storage driver issues | less control over start-up |
| When | GitHub-hosted runners, VM agents | trusted single-tenant agents | GitLab shared runners | one or two dependencies |

**The sibling path trap:** in a Jenkins agent *container* with a mounted socket, \`docker run -v $PWD/reports:/out\` asks the **host** daemon to mount \`/home/jenkins/agent/workspace/...\` *from the host*, where it does not exist: an empty directory is created and reports "disappear". Use \`docker cp\`, a named volume, or an agent workspace mounted at the same path on host and container.

**Recommended:** a throw-away VM per job when you can get it; otherwise a rootless builder for images (for example BuildKit rootless or Buildah) and CI services or Kubernetes pods for dependencies. A mounted socket means every test author is root on that agent.

### A GitHub Actions job with the same Compose file

\`\`\`yaml
  e2e-compose:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      APP_TAG: \${{ github.sha }}
      SHOP_PASS: \${{ secrets.SHOP_PASS }}
    steps:
      - uses: actions/checkout@v7
      - run: mkdir -p reports && echo "HOST_UID=$(id -u)" >> "$GITHUB_ENV" && echo "HOST_GID=$(id -g)" >> "$GITHUB_ENV"
      - run: docker compose -f compose.e2e.yml build
      - run: docker compose -f compose.e2e.yml run --rm tests
      - if: \${{ !cancelled() }}
        run: docker compose -f compose.e2e.yml logs --no-color > reports/compose.log
      - if: \${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with: { name: 'e2e-\${{ github.run_attempt }}', path: reports }
      - if: \${{ always() }}
        run: docker compose -f compose.e2e.yml down -v --remove-orphans
\`\`\`

### Tagging and registry

- Tag every image with the **commit** (\`shopeasy-api:3f2c9a1\`), add a human tag (\`main\`, \`2.4.0\`) for convenience, deploy and test **by digest**: \`docker pull\` prints it and \`image@sha256:…\` can never change.
- \`latest\` is just the default tag, not "the newest". It makes yesterday's result unrepeatable and Kubernetes' pull policy unpredictable.
- Version the **test image** too: a defect report then names app digest + test image digest and can be replayed with one command, months later.
- Retention: delete PR tags after the PR closes; keep release tags. Registries limit anonymous pulls: authenticate or use a pull-through cache (\`toomanyrequests\` on Monday morning is this).

## 12. Kubernetes in brief, for testers

A **pod** is one or more containers sharing network and volumes. A **deployment** keeps N replicas of a pod running. A **service** gives them a stable DNS name. A **job** runs a pod to completion: this is what a test run is. ConfigMaps and Secrets feed configuration.

\`\`\`yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: shopeasy-smoke-3f2c9a1
spec:
  backoffLimit: 0                  # a red suite must not be retried by the scheduler
  activeDeadlineSeconds: 1800      # hard timeout
  ttlSecondsAfterFinished: 86400   # remove it a day later
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: tests
          image: registry.example.com/shopeasy-tests-java:3f2c9a1
          args: ["test-classes/suites/smoke.xml"]
          env:
            - { name: BASE_URL, value: "http://web/practice-site/" }
            - { name: GRID_URL, value: "http://selenium:4444" }
            - name: SHOP_PASS
              valueFrom: { secretKeyRef: { name: shopeasy-test-user, key: password } }
          resources:
            requests: { cpu: "1", memory: 1Gi }
            limits: { memory: 1Gi }
\`\`\`

\`\`\`bash
kubectl apply -f smoke-job.yaml
kubectl get pods -l job-name=shopeasy-smoke-3f2c9a1 -o wide
kubectl logs -f job/shopeasy-smoke-3f2c9a1
kubectl logs <pod> --previous                # the crashed container's log
kubectl describe pod <pod>                   # events: ImagePullBackOff, OOMKilled, failed probes
kubectl get events --sort-by=.lastTimestamp
kubectl exec -it deploy/web -- sh            # look from inside
kubectl port-forward svc/api 5181:5181       # reach a cluster service from the laptop
kubectl rollout status deploy/web            # is the new version really out before I test?
\`\`\`

Tester's traps: \`kubectl wait --for=condition=complete\` blocks until its timeout when the job **fails** (wait for \`condition=failed\` too, or poll the status). Reports vanish with the pod and \`kubectl cp\` needs a *running* container, so upload to object storage at the end of the run. Readiness decides whether a pod gets traffic and liveness whether it is restarted: a "random 502 during deploy" is usually a missing readiness probe. Docker's \`HEALTHCHECK\` is ignored here.

## 13. Size and security

| Measure | Why it matters for a test image |
|---|---|
| Multi-stage, JRE instead of JDK + Maven | hundreds of MB less per agent pull |
| \`.dockerignore\` | no \`node_modules\`, \`target\`, \`.git\`, \`.env\` in context or layers |
| \`docker history\`, \`docker image ls\` | find the layer that costs |
| Pin base image tag or digest; let Renovate propose updates | reproducible *and* patched |
| Non-root \`USER\`, no \`--privileged\` | a compromised dependency has less reach |
| Scan in CI | fails on fixable critical findings |
| SBOM | answers "are we affected?" in minutes |

\`\`\`bash
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 shopeasy-tests-java:3f2c9a1
docker scout cves shopeasy-tests-java:3f2c9a1        # Docker's own scanner
docker history --no-trunc shopeasy-tests-java:3f2c9a1 # also shows secrets passed as ARG
\`\`\`

Browser images are large and always contain some findings; the policy is "no fixable critical older than N days", plus regular upgrades, not "zero CVEs". Alpine is not a goal in itself: musl breaks browsers and some native libraries.

## 14. Command table

| Task | Command |
|---|---|
| Build, show all output, ignore cache | \`docker build --progress=plain --no-cache -t x .\` |
| Stop at one stage | \`docker build --target build -t x-build .\` |
| Run once, remove, interactive | \`docker run --rm -it image\` |
| Shell in an image whose entrypoint is a runner | \`docker run --rm -it --entrypoint sh image\` |
| Shell in a running container | \`docker exec -it name sh\` |
| Logs since 5 minutes, following | \`docker logs -f --since 5m name\` |
| Exit code, OOM, health | \`docker inspect -f '{{.State.ExitCode}} {{.State.OOMKilled}}' name\`; \`docker inspect -f '{{json .State.Health}}' name\` |
| CPU and memory now | \`docker stats --no-stream\` |
| Files out of a (stopped) container | \`docker cp name:/tests/reports ./reports\` |
| Networks, who is on it | \`docker network inspect shopeasy-e2e_default\` |
| Final Compose file | \`docker compose config\` |
| Start and wait for health | \`docker compose up -d --wait\` |
| Scale | \`docker compose up -d --scale chrome=3\` |
| One-off command with dependencies | \`docker compose run --rm tests …\` |
| Disk usage, clean-up | \`docker system df\`; \`docker system prune\` (add \`--volumes\` only when you mean it) |
| Multi-platform build | \`docker buildx build --platform linux/amd64,linux/arm64 …\` |

## Common mistakes and debugging

| Symptom | Cause | How to confirm | Fix |
|---|---|---|---|
| \`ERR_CONNECTION_REFUSED\` in the browser | \`localhost\` inside the browser container | noVNC / screenshot; \`exec chrome curl\` | service name or \`host.docker.internal\` |
| \`Empty reply\` / reset on the published port | server bound to 127.0.0.1 in the container | \`docker exec … wget 127.0.0.1\` works | bind 0.0.0.0 (\`vite --host\`) |
| "Blocked request. This host is not allowed" | Vite Host check | response body | allowed hosts, or nginx |
| Tests start before the app is ready | short \`depends_on\` | timestamps in the logs | healthcheck + \`service_healthy\` |
| Container "unhealthy" although the app works | tool missing (\`curl\`), HEAD refused, IPv6 localhost | \`docker inspect … Health\` log | \`wget\`, GET, 127.0.0.1 |
| \`session deleted because of page crash\` | \`/dev/shm\` 64 MB | \`df -h /dev/shm\` | \`shm_size\`, \`--ipc=host\` |
| Exit 137 | OOM | \`.State.OOMKilled\`, Desktop's memory | more memory, fewer browsers, heap limit |
| \`exec format error\` | image for another CPU architecture | \`docker image inspect -f '{{.Architecture}}'\` | right platform; Edge images are amd64 only |
| \`exec /entrypoint.sh: no such file or directory\` (it exists) | CRLF, or missing interpreter (\`bash\` on Alpine) | \`od -c file\` shows \`\\r \\n\` | LF via \`.gitattributes\`; \`sh\` |
| \`Executable doesn't exist at /ms-playwright\` | image ≠ package version | compare versions | align; build guard |
| Native module errors (\`invalid ELF header\`) | host \`node_modules\` mounted or copied | \`.dockerignore\` | \`npm ci\` in the image; volume for \`node_modules\` |
| \`Permission denied\` writing reports | uid mismatch | \`id\` inside, \`ls -ln\` outside | \`user:\`, \`docker cp\` |
| Reports directory empty in CI | sibling daemon path | \`docker inspect\` mounts | \`cp\` or named volume |
| Pipeline green, tests red | exit code lost (\`-d\`, pipe, missing \`--exit-code-from\`) | \`echo $?\` | \`run --rm\`, \`pipefail\` |
| Everything stops after the seed job | \`--abort-on-container-exit\` | first container to exit in the log | \`run --rm tests\` |
| Change not visible in the run | old image or cache | \`docker compose build\`, image date | \`--build\`; tag by commit |
| \`port is already allocated\` | previous run, parallel project | \`docker ps\` | \`down\`; no published ports in CI |
| Time is an hour off | UTC in the container | \`date\` | set \`TZ\`/\`user.timezone\` on purpose |
| \`toomanyrequests\` | registry pull limit | — | authenticate, mirror |

## Best practices for experienced engineers

- Test the **same image** that will be released; record digests of app and tests in the report.
- Ready means healthy: healthchecks everywhere, no sleeps.
- No \`localhost\` between containers; all addresses come from configuration.
- Images contain no environment and no secret; both arrive at run time.
- Non-root, init process, exec-form entrypoint, meaningful exit codes.
- Evidence leaves the container before it is removed: reports, logs, health state.
- Pin tags; upgrade deliberately and regularly; scan.
- Keep "run one test from the IDE without Docker" working: containers are for reproducibility, not a tax on every developer.

## Equivalent in the other stack

| | Selenium + Java | Playwright + TypeScript |
|---|---|---|
| Where the browser is | separate container (Grid) | same container as the tests |
| Version coupling | browser image tag, loosely coupled client | image tag **must equal** the package |
| shm | \`shm_size\` on the browser container | \`--ipc=host\` on the test container |
| \`localhost\` trap | two network views (JVM vs browser) | one view: runner and browser share it |
| Remote option | RemoteWebDriver/Grid | \`playwright run-server\` + \`PW_TEST_CONNECT_WS_ENDPOINT\` |
| Visual baselines | rare | record inside the same image as CI |

## Interview questions

### Q: What is a container, and how does it differ from a VM?

**Short answer (30–60 s):** A container is a process on the host's kernel with restricted views (namespaces), limited resources (cgroups) and a layered file system. A VM virtualises hardware and runs its own kernel. Containers start in a second and are small but isolate less, and Linux containers cannot provide Windows or macOS browsers.

**Detailed answer:** Consequences for testing: own network namespace → localhost differs; own ipc namespace → \`/dev/shm\` of 64 MB; memory cgroup → exit 137; writable layer disposable → copy reports out. On Windows and macOS there is a Linux VM in between, which explains slow bind mounts and the memory cap. For real Safari or Windows-specific Edge behaviour I need VMs, devices or a cloud provider.

### Q: How do layer caching and multi-stage builds work, and how do you structure a test image?

**Short answer (30–60 s):** Every instruction is cached by its parent, text and copied file content; the first change invalidates the rest. So manifests and dependency download come first, sources last. A multi-stage build compiles in a JDK/Maven stage and copies only classes and libraries into a JRE stage.

**Detailed answer:** Cache mounts keep \`~/.m2\` across builds without adding it to a layer, secret mounts provide a settings.xml without leaving it there. The runtime stage is non-root, has an exec-form ENTRYPOINT with CMD as the default suite, and no browser: the browser is another container. For Playwright the official image is the base and the version is checked at build time.

### Q: ENTRYPOINT vs CMD, and why does the form matter?

**Short answer (30–60 s):** ENTRYPOINT is the executable, CMD its default arguments; \`docker run\` arguments replace CMD. The exec form runs the process directly as PID 1; the shell form wraps it in \`sh -c\`, ignores arguments and does not forward signals.

**Detailed answer:** As PID 1 a process without handlers ignores SIGTERM and must reap children, so \`docker stop\` takes ten seconds and browsers leave zombies; \`--init\` solves both. With \`ENTRYPOINT ["npx","playwright","test"]\` the image acts like the command itself, e.g. \`docker run img --grep @cart\`.

### Q: Your test container cannot reach the application. How do you debug it?

**Short answer (30–60 s):** I ask who connects and from where. In Selenium it may be the browser container, not the JVM. Then I check from that container: name resolution, port, and whether the server listens on 0.0.0.0. Between containers I use service names and container ports, to the host \`host.docker.internal\`.

**Detailed answer:** Typical causes in order: \`localhost\` in the base URL, host port used instead of container port, server bound to loopback (Vite's default), Host-header check, different networks or projects, proxy without \`NO_PROXY\`, app not ready. \`docker compose exec chrome curl -sS http://web/…\` separates network from test problems in ten seconds.

### Q: How do you make a Compose run fail the pipeline correctly?

**Short answer (30–60 s):** Either \`up --exit-code-from tests\`, which also stops the other services, or \`run --rm tests\`, whose exit code is the command's. Health-based \`depends_on\`, logs and reports collected first, and \`down -v\` always.

**Detailed answer:** \`up -d\` returns 0 as soon as containers start. \`--abort-on-container-exit\` is triggered by a successfully finished seed container, so with one-shot services I use \`run\`. I also protect the code through pipes (\`pipefail\`), and I make sure the runner returns non-zero when no tests were executed.

### Q: Testcontainers or Docker Compose?

**Short answer (30–60 s):** Testcontainers when the test owns its dependencies: database, API, broker with random ports and per-run lifecycle. Compose when I want the whole system for E2E, local exploration and CI in one file.

**Detailed answer:** Testcontainers makes \`mvn verify\` self-contained and parallel safe, at the cost of Docker on each machine and start-up time (singleton pattern helps). Compose is language neutral and readable by developers and operations. Shared environments remain for third-party integrations. In all cases I test the same image digest.

### Q: How would you run tests in Docker on Jenkins, and what are the security implications?

**Short answer (30–60 s):** Docker agents per stage on labelled VMs, or pods on Kubernetes. Mounting the Docker socket gives root on the host, and DinD needs a privileged container, so both only on isolated, disposable agents.

**Detailed answer:** With a mounted socket containers are siblings: bind mounts refer to host paths, which is why reports vanish, and names and ports collide between builds. For image building, rootless builders avoid both. I'd use a project name per build, no published ports, and cleanup in \`post { always }\`.

## Scenario-based questions

### Scenario 1: "The suite is stable locally, but every tenth run in the container crashes the tab"

I collect evidence first: container exit code, \`OOMKilled\`, \`df -h /dev/shm\`, \`docker stats\` during the run, browser log. If \`/dev/shm\` is at 64 MB, set \`shm_size: 2gb\`; if the memory limit is hit, reduce sessions per container or raise the limit. Verify by running the heaviest test 50 times before and after. \`--disable-dev-shm-usage\` only if I cannot change the container. I would not add a retry: it hides a capacity problem which comes back with the next heavy page.

### Scenario 2: "A release candidate passed in CI but failed on staging with the same tests"

Check identity first: did both environments run the same **digest**? A typical finding is that staging rebuilt the image from the same commit with a newer base image, or used the tag \`main\`, which moved. Then compare configuration and data (environment, migrations). Fix: build once, promote by digest, show digest and config hash in \`/health\` and in the report, and add a deployment smoke test that asserts the version before the suite starts.

### Scenario 3: "New joiners need two days to run the E2E tests"

Provide one command: \`docker compose -f compose.e2e.yml run --rm --build tests\`, with images pinned, healthchecks, sensible defaults and no local JDK, browsers or servers. Keep the second path — IDE + local browser against \`docker compose up -d --wait web api\` — because debugging inside containers is slower. Measure: a new joiner's time to the first green run; then put both commands at the top of the README (problem \`fw-028\`), and run the same command in CI so it cannot rot.

## Tricky follow-ups

**Q: Does \`EXPOSE 5181\` make the port reachable from the host?** A: No, it is metadata. \`-p\`/\`ports:\` publishes; containers in the same network reach any listening port without either.

**Q: You deleted a secret file in the last RUN. Is it gone?** A: No, it is still in the earlier layer. Rotate it and rebuild using a secret mount.

**Q: Why does \`docker stop\` take exactly ten seconds?** A: PID 1 ignores SIGTERM (no handler or shell form), so Docker sends SIGKILL after the default grace period. Use \`--init\` or handle the signal.

**Q: Two containers of the same image: do they share written files?** A: No, each has its own writable layer. Sharing needs a volume.

**Q: Is an image tag immutable?** A: No. Only the digest is.`,
  keyPoints: [
    'A container is a process with namespaces, cgroups and layered files — which explains localhost, /dev/shm of 64 MB, exit 137 and disappearing reports.',
    'Put dependency manifests before sources, build in one stage and run in another, use cache and secret mounts, non-root users and exec-form ENTRYPOINT with CMD as the default suite.',
    'ShopEasy\'s API listens on all interfaces, but Vite binds to localhost and checks the Host header: serve the static site with nginx or set --host and the allowed hosts.',
    'Between containers use service names and container ports; in Selenium the JVM and the browser may see the network differently.',
    'depends_on with service_healthy instead of sleeps; run --rm tests or --exit-code-from for the pipeline result; mind one-shot services with --abort-on-container-exit.',
    'The Playwright image tag must equal the @playwright/test version: check it during the build.',
    'Testcontainers for integration tests, Compose for the E2E stack, shared environments only for what cannot be containerised.',
    'Tag by commit, promote by digest; a mounted Docker socket is root on the host and makes bind-mount paths host paths.',
  ],
  mistakes: [
    'Base URL `http://localhost:5180` for a browser that runs in a container — use the service name; confirm with `docker compose exec chrome curl`.',
    'Short-form `depends_on` plus sleeps — add healthchecks (GET on 127.0.0.1 with a tool that exists in the image) and `condition: service_healthy`.',
    'Running `up -d` or piping the run through `tee` and losing the exit code — `run --rm tests` or `--exit-code-from`, with `set -o pipefail`.',
    'Writing reports as root or as a different uid into a bind mount — set `user:` to the CI uid, or `docker compose cp` after the run; never `chmod 777`.',
    'Passing a private repository password as ARG — it stays in `docker history`; use `RUN --mount=type=secret` and rotate what leaked.',
    'Fixing tab crashes with retries — check /dev/shm, OOMKilled and memory per browser first, then set `shm_size` or reduce sessions.',
  ],
  tryIt: `If you have Docker: create \`docker/web.Dockerfile\` and \`docker/api.Dockerfile\` from the lesson in a copy of this repository, build both, and run the API with and without \`--init\`, timing \`docker stop\` each time. Then start the dev server normally on your machine and try to open \`http://host.docker.internal:5180/practice-site/login.html\` from a \`selenium/standalone-chrome\` container; explain each of the two errors you get before and after adding \`--host 0.0.0.0\` (binding, then the Host check). Without Docker: read the compose file and write down, for every address in it, who connects and from where.`,
  problems: ['fw-021', 'fw-025', 'fw-028'],
}
