export default {
  slug: 'pw-deep-enterprise-playwright-typescript',
  category: 'playwright',
  order: 22,
  title: `Deep dive: Enterprise Framework B — TypeScript, Playwright Test, POM, fixtures and API testing, built end to end`,
  minutes: 45,
  summary: `Build a complete Playwright Test project for ShopEasy file by file — strict toolchain, projects and web servers, validated environment, logger, typed API clients with runtime schemas, pages, fixtures, sessionStorage sign-in, matchers, UI and API tests, sharded CI and Docker — then compare it with Framework A.`,
  manualAnalogy: `Think of a test lab with two benches: one for the shop's screens, one for its services. Both use the same catalogue, the same customer forms and the same evidence sheets, but each bench has its own tools and nobody carries a screwdriver from one to the other. Fixtures are the assistant who prepares the bench before each case and cleans it afterwards; the configuration is the lab schedule.`,
  body: `## What you will have at the end

A complete project, \`tests-pw/\`, inside this app's repository: 19 UI tests and 11 API tests, strict TypeScript, typed fixtures and a sharded pipeline. Every file is on this page; copy them, run \`npm install\` once (it creates the lockfile that \`npm ci\` needs), and \`npx playwright test\` starts the shop and the API by itself. How it relates to the **Playwright** project on the Framework Blueprint page: that one combines a small spec suite with Cucumber-JS and \`process.env\` lookups; this one drops Cucumber and adds a validated API layer, state seeding, custom matchers, an enforced import boundary, per-test logs and merged shard reports.

Theory lives in finished deep dives and is not repeated: fixture internals and the page-object debate (\`pw-deep-fixtures-pom-components\`), config resolution and environments (\`pw-deep-config-environments-ci\`), API contexts (\`pw-deep-api-testing\`), reports and traces (\`pw-deep-reporting-debugging\`), tags, annotations and data-driven styles (\`pw-deep-test-organisation-data-driven\`), storage (\`pw-deep-network-cookies-sessions\`). Here the question is: **which decision in which file, and why.**

**Honest limits of ShopEasy.** The practice site (port 5180) is static, keeps its state in \`sessionStorage\`, never calls the API (port 5181) and accepts only \`standard_user\` and \`locked_out_user\`. A customer registered through the API cannot log in to the web shop. So the two layers are tested **separately** here. "Create data through the API, verify in the UI" is the standard technique in a *typical real app*, and section 6 shows where it would plug in.

## 1. Requirements and architecture decisions

**Requirements:** UI and API tests in one runner; Chromium always, Firefox and WebKit for the critical journeys; one command on a laptop and in CI; parallel and sharded; a red test explains itself without a rerun; wrong configuration and wrong response shapes fail loudly; a forgotten \`await\` cannot be merged.

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Runner | Playwright Test, Cucumber-JS, Jest/Vitest + library | Playwright Test | fixtures, projects, sharding, traces and web-first assertions come with it |
| Location | own repository, folder in the app repository | folder \`tests-pw/\` | a UI change and its test change in one pull request |
| Shared code between UI and API tests | one fixture module, two entry points | \`@fixtures/ui\` and \`@fixtures/api\` over one base | API tests never create a page; the import shows the kind of test |
| Page objects | \`BasePage\` inheritance, composition, none | plain classes, composition | \`goto\` is one line; a base class invites helpers |
| Where assertions live | pages, tests, matchers | tests plus three domain matchers | pages stay reusable for negative tests |
| API client result | throw on error, raw response, result union | \`ApiResult<T>\` union + \`unwrap\` | one method per endpoint serves positive *and* negative tests |
| Response types | \`as T\`, generated from OpenAPI, runtime schema | zod schema, type inferred | ShopEasy has no OpenAPI file; \`as T\` checks nothing |
| Test data | JSON, builder classes, factory functions | factory functions with \`Partial\` overrides | idiomatic TypeScript, no ceremony |
| UI session | login per test, \`storageState\`, init script | init script | \`storageState\` does not save \`sessionStorage\` |
| Retries | none, everywhere, per project | UI in CI: 1, API: 0 | an API test that needs a retry is a finding |
| Imports | relative, aliases | \`paths\` aliases | \`@core/http\` survives moving a file |

\`\`\`text
tests/ui   tests/api              intent + assertions
   │           │
fixtures/ui  fixtures/api         which object, in which state, cleaned up when
   │    ╲   ╱    │
   │    base     │                log
 ui/*          api/*              pages, components   |   clients, schemas
     ╲         ╱
   domain/*   core/*              catalogue, money, builders | env, logger, http
\`\`\`

\`\`\`text
tests-pw/
├── package.json  tsconfig.json  eslint.config.mjs  playwright.config.ts
├── .env.example  .gitignore  Dockerfile
├── src/
│   ├── core/      env.ts  logger.ts  http.ts
│   ├── domain/    catalogue.ts  money.ts  builders.ts
│   ├── api/       schemas.ts  clients.ts
│   ├── ui/        session.ts  components/  pages/
│   └── fixtures/  base.ts  api.ts  ui.ts  matchers.ts
└── tests/         setup/  ui/  api/
.github/workflows/e2e-pw.yml      (repository root)
\`\`\`

## 2. Toolchain

**\`package.json\`**

\`\`\`json
{
  "name": "shopeasy-e2e",
  "private": true,
  "version": "1.0.0",
  "engines": { "node": ">=22.13" },
  "scripts": {
    "check": "tsc --noEmit && eslint .",
    "test": "playwright test",
    "test:smoke": "playwright test --grep @smoke --project=api --project=ui-chromium",
    "test:api": "playwright test --project=api",
    "test:ui": "playwright test --project=ui-chromium",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@playwright/test": "1.64.1",
    "@types/node": "^22.0.0",
    "eslint": "10.15.0",
    "typescript": "6.0.3",
    "typescript-eslint": "8.74.0",
    "zod": "4.6.7"
  }
}
\`\`\`

**\`tsconfig.json\`**

\`\`\`json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"],
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "paths": {
      "@core/*": ["./src/core/*"],
      "@domain/*": ["./src/domain/*"],
      "@api/*": ["./src/api/*"],
      "@ui/*": ["./src/ui/*"],
      "@fixtures/*": ["./src/fixtures/*"]
    }
  },
  "include": ["src", "tests", "playwright.config.ts"]
}
\`\`\`

**\`eslint.config.mjs\`**

\`\`\`js
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['playwright-report/', 'blob-report/', 'test-results/']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',     // a forgotten await is a test that checks nothing
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],   // async ({}, use) => ...
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@playwright/test', message: 'Import test and expect from @fixtures/ui or @fixtures/api.' }],
      }],
      'no-restricted-properties': ['error', {
        object: 'page', property: 'waitForTimeout', message: 'Wait for a state, not for time.',
      }],
    },
  },
]);
\`\`\`

**\`.gitignore\`**

\`\`\`text
node_modules/
playwright-report/
blob-report/
test-results/
.auth/
.env
\`\`\`

**Step by step**

- **Exact versions for Playwright, TypeScript and ESLint.** Playwright must equal the Docker image tag. TypeScript stays on 6.0.3 although 7 exists: the typed lint rules of \`typescript-eslint\` 8.74 declare support for \`<6.1.0\`, and the lint rule is worth more than the faster compiler. Re-check on each upgrade.
- **Playwright does not type-check.** It strips types and runs. \`npm run check\` (compiler, then lint) is therefore a separate, *first* CI job.
- **No \`"type": "module"\`** in this package, although the app's root has it: Playwright then loads the project as CommonJS, where extension-less imports and \`__dirname\` work. With ESM you would need \`import.meta.dirname\` and consistent extensions.
- **\`paths\` without \`baseUrl\`**: relative to the tsconfig, understood by the compiler and by Playwright's loader. \`types: ["node"]\` is explicit because TypeScript 6 no longer includes every \`@types\` package automatically.
- **\`noUncheckedIndexedAccess\`** makes \`items[0]\` possibly \`undefined\`, which in tests is usually the truth.
- **\`no-floating-promises\` is the most valuable rule in the project**: \`expect(locator).toBeVisible()\` without \`await\` is a test that cannot fail. It needs type information, hence \`projectService\`.
- **\`no-restricted-imports\` in \`tests/\`** forces specs to take \`test\` and \`expect\` from our fixtures. An import from \`@playwright/test\` would silently lose the log, the seeding and the matchers.

## 3. Configuration

**\`.env.example\`**

\`\`\`text
# copy to .env for local overrides; .env is git-ignored
SHOP_ENV=local
WEB_BASE_URL=http://localhost:5180/practice-site/
API_BASE_URL=http://localhost:5181
SHOP_USER=standard_user
SHOP_PASS=
ALLOW_RESET=false
LOG_ECHO=false
\`\`\`

**\`src/core/env.ts\`**

\`\`\`ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const envFile = resolve(__dirname, '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);      // real environment variables win over the file

const isCI = !!process.env.CI;

const schema = z
  .object({
    SHOP_ENV: z.enum(['local', 'ci', 'staging']).default(isCI ? 'ci' : 'local'),
    WEB_BASE_URL: z.url().endsWith('/').default('http://localhost:5180/practice-site/'),
    API_BASE_URL: z.url().default('http://localhost:5181'),
    SHOP_USER: z.string().min(1).default('standard_user'),
    SHOP_PASS: z.string().min(1).optional(),
    ALLOW_RESET: z.stringbool().default(false),
    LOG_ECHO: z.stringbool().default(false),
  })
  .refine((e) => e.SHOP_ENV !== 'staging' || e.SHOP_PASS, { path: ['SHOP_PASS'], error: 'is required for staging' })
  .refine((e) => e.SHOP_ENV !== 'staging' || !e.ALLOW_RESET, { path: ['ALLOW_RESET'], error: 'never reset staging' });

// an empty value in .env means "not set", not "the empty string"
const input = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));
const parsed = schema.safeParse(input);
if (!parsed.success) throw new Error('Invalid test configuration:\\n' + z.prettifyError(parsed.error));

export const env = Object.freeze({
  ...parsed.data,
  SHOP_PASS: parsed.data.SHOP_PASS ?? 'secret_sauce',       // public demo password of the practice site
});
\`\`\`

**\`playwright.config.ts\`**

\`\`\`ts
import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { env } from './src/core/env';
import type { ShopOptions } from './src/fixtures/ui';

const isCI = !!process.env.CI;
const repoRoot = resolve(__dirname, '..');      // the practice app; this project lives in tests-pw/

export default defineConfig<ShopOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 4 : undefined,
  maxFailures: isCI ? 20 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  failOnFlakyTests: process.env.FAIL_ON_FLAKY === 'true',
  reporter: isCI
    ? [['list'], ['github'], ['blob']]
    : [['list'], ['html', { open: 'on-failure' }]],

  use: {
    baseURL: env.WEB_BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
  },

  projects: [
    { name: 'api-ready', testDir: './tests/setup', testMatch: /api\\.setup\\.ts/, retries: 0 },
    { name: 'web-ready', testDir: './tests/setup', testMatch: /web\\.setup\\.ts/, use: { signedInAs: null } },

    { name: 'api', testDir: './tests/api', dependencies: ['api-ready'], retries: 0 },

    { name: 'ui-chromium', testDir: './tests/ui', dependencies: ['web-ready'],
      use: { ...devices['Desktop Chrome'] } },
    { name: 'ui-firefox', testDir: './tests/ui', dependencies: ['web-ready'],
      grep: /@cross-browser/, use: { ...devices['Desktop Firefox'] } },
    { name: 'ui-webkit', testDir: './tests/ui', dependencies: ['web-ready'],
      grep: /@cross-browser/, use: { ...devices['Desktop Safari'] } },
  ],

  webServer: env.SHOP_ENV === 'staging' ? undefined : [
    {
      name: 'web', command: 'npm run dev -- --strictPort', cwd: repoRoot,
      url: 'http://localhost:5180/practice-site/login.html',
      reuseExistingServer: !isCI, timeout: 120_000,
    },
    {
      name: 'api', command: 'npm run api', cwd: repoRoot,
      url: 'http://localhost:5181/api/health',
      reuseExistingServer: !isCI,
    },
  ],
});
\`\`\`

**Step by step**

- **\`env.ts\` is the only file that reads \`process.env\`** (besides the \`CI\` and \`FAIL_ON_FLAKY\` switches in the config). It validates everything, prints all problems together with \`z.prettifyError\`, and freezes the result. \`process.loadEnvFile\` is built into Node; no dotenv. Real variables win over the file.
- **\`z.stringbool()\`** accepts \`true/false/1/0/yes/no\`; \`z.coerce.boolean()\` would turn the string \`"false"\` into \`true\`.
- **Guards are code**: staging requires a password and can never be reset.
- **Projects**: two tiny *setup* projects check that each server works. \`dependencies\` means: if the API is down, API tests are skipped as "did not run" instead of failing 11 times. The API reset runs there, once per run or shard, and only with \`ALLOW_RESET\`.
- **\`api\` has no device and no browser**: tests that never ask for \`page\` never launch one. \`retries: 0\` on purpose.
- **Firefox and WebKit run only \`@cross-browser\`**: the full suite in three browsers triples cost and finds few extra bugs; critical journeys find most of them.
- **\`webServer\`** starts both servers from the repository root. \`--strictPort\` stops Vite from moving to another port; \`reuseExistingServer: !isCI\` reuses yours locally and fails in CI if something already listens, because testing a leftover server is worse than failing.
- **Evidence**: locally every failure keeps a trace; in CI the first attempt stays cheap and the retry is traced. \`blob\` in CI exists to be merged.

## 4. Core: logger and HTTP

**\`src/core/logger.ts\`**

\`\`\`ts
import { env } from './env';

const SECRET_KEYS = /^(password|token|authorization)$/i;

/** Collects lines for one test; the base fixture attaches them when the test fails. */
export class Logger {
  private readonly lines: string[] = [];

  info(message: string, data?: unknown): void {
    this.write('INFO ', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write('WARN ', message, data);
  }

  text(): string {
    return this.lines.join('\\n');
  }

  private write(level: string, message: string, data?: unknown): void {
    const payload = data === undefined ? '' : ' ' + JSON.stringify(data, mask);
    const line = \`\${new Date().toISOString()} \${level} \${message}\${payload}\`;
    this.lines.push(line);
    if (env.LOG_ECHO) console.log(line);
  }
}

function mask(key: string, value: unknown): unknown {
  return SECRET_KEYS.test(key) ? '********' : value;
}
\`\`\`

**\`src/core/http.ts\`**

\`\`\`ts
import type { APIRequestContext } from '@playwright/test';
import { z } from 'zod';
import type { Logger } from './logger';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof errorSchema>['error'];

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiErrorBody };

export interface SendOptions {
  body?: unknown;
  query?: Record<string, string | number>;
}

/** One place for auth, logging and runtime validation. Knows HTTP, knows nothing about orders or carts. */
export class HttpClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly log: Logger,
    private readonly token?: string,
  ) {}

  async send<T>(method: Method, path: string, schema: z.ZodType<T>, options: SendOptions = {}): Promise<ApiResult<T>> {
    const response = await this.request.fetch(path, {
      method,
      data: options.body,
      params: options.query,
      headers: this.token ? { Authorization: \`Bearer \${this.token}\` } : {},
    });
    const status = response.status();
    const body = parseBody(await response.text());
    this.log.info(\`\${method} \${path} -> \${status}\`, { query: options.query, request: options.body, response: body });

    if (response.ok()) return { ok: true, status, data: validate(schema, body, \`\${method} \${path} \${status}\`) };
    return { ok: false, status, error: validate(errorSchema, body, \`\${method} \${path} \${status}\`).error };
  }
}

/** For arrange steps: the happy path or a readable failure. */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(\`Unexpected API error \${result.status} \${result.error.code}: \${result.error.message}\`);
}

function parseBody(text: string): unknown {
  if (text === '') return undefined;                        // 204
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(\`Response is not JSON: \${text.slice(0, 200)}\`);
  }
}

function validate<T>(schema: z.ZodType<T>, body: unknown, where: string): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error(\`Contract broken at \${where}:\\n\${z.prettifyError(parsed.error)}\`);
  return parsed.data;
}
\`\`\`

**Why a result union?** Three designs compete:

| | Client throws on non-2xx | Client returns \`APIResponse\` | Client returns \`ApiResult<T>\` |
|---|---|---|---|
| Positive test | short | status check, cast, every time | \`unwrap(...)\` |
| Negative test | \`rejects.toThrow\`, error parsing | manual JSON handling | \`toBeApiError(409, '…')\` |
| Type safety | good | none (\`json()\` is \`any\`) | compiler forces \`ok\` check before \`data\` |
| Contract check | easy to forget for errors | by hand | success *and* error bodies validated |
| When to use | set-up-only helpers | protocol tests (headers, redirects) | a client used by both kinds of tests |

Other decisions: the request is sent with the test's own \`APIRequestContext\`, so calls appear in the trace; the logger records request and response with **passwords and tokens masked by key**; a wrong shape throws "Contract broken at POST /api/orders 201" with the field path, *before* any assertion could pass by accident; unknown extra fields are stripped, so the provider may add fields (a tolerant reader). Use \`z.strictObject\` where additions must be noticed.

ShopEasy's product schema is also published at \`/api/schema/product\` (draft-04); validating against *it* is a different test (does the API match its own document?) and is shown in \`pw-deep-api-testing\`.

## 5. Domain: catalogue, money, builders

**\`src/domain/catalogue.ts\`**

\`\`\`ts
export interface Product {
  readonly id: number;        // API id
  readonly slug: string;      // UI id, also the value in sessionStorage
  readonly name: string;
  readonly price: number;
  readonly description: string;
}

/** The expected catalogue: an oracle written from the specification, not read from the system under test. */
export const products = {
  backpack: { id: 1, slug: 'trailblazer-backpack', name: 'Trailblazer Backpack', price: 29.99, description: 'Water-resistant 22L daypack with a padded laptop sleeve.' },
  bikeLight: { id: 2, slug: 'pulse-bike-light', name: 'Pulse Bike Light', price: 9.99, description: 'USB-rechargeable front light with three flash modes.' },
  crewTee: { id: 3, slug: 'classic-crew-t-shirt', name: 'Classic Crew T-Shirt', price: 15.99, description: 'Soft cotton crew-neck tee that survives 100 washes.' },
  fleece: { id: 4, slug: 'storm-fleece-jacket', name: 'Storm Fleece Jacket', price: 49.99, description: 'Mid-weight fleece with a wind-blocking chest panel.' },
  onesie: { id: 5, slug: 'junior-onesie', name: 'Junior Onesie', price: 7.99, description: 'Organic cotton onesie with easy snap buttons.' },
  redTee: { id: 6, slug: 'retro-red-tee', name: 'Retro Red Tee', price: 15.99, description: 'Vintage-wash red tee with a 70s ShopEasy logo.' },
} as const satisfies Record<string, Product>;
\`\`\`

**\`src/domain/money.ts\`**

\`\`\`ts
export interface Totals {
  readonly subtotal: number;
  readonly tax: number;
  readonly total: number;
}

const TAX_PERCENT = 8;
const toCents = (amount: number): number => Math.round(amount * 100);

/** Integer cents: no 0.1 + 0.2 surprises in the oracle. */
export function totalsFor(lines: readonly { price: number; quantity?: number }[]): Totals {
  const subtotal = lines.reduce((sum, line) => sum + toCents(line.price) * (line.quantity ?? 1), 0);
  const tax = Math.round((subtotal * TAX_PERCENT) / 100);
  return { subtotal: subtotal / 100, tax: tax / 100, total: (subtotal + tax) / 100 };
}

export const usd = (amount: number): string => \`$\${amount.toFixed(2)}\`;
\`\`\`

**\`src/domain/builders.ts\`**

\`\`\`ts
import { randomUUID } from 'node:crypto';

export interface DeliveryDetails {
  firstName: string;
  lastName: string;
  postalCode: string;
}

export interface Registration {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Valid by default; a test states only what it is about: aDelivery({ postalCode: '!!' }). */
export function aDelivery(overrides: Partial<DeliveryDetails> = {}): DeliveryDetails {
  return { firstName: 'Asha', lastName: 'Rao', postalCode: '560001', ...overrides };
}

/** Unique across workers, shards and runs. The API allows 3-40 characters of [a-z0-9_.-]. */
export function aRegistration(overrides: Partial<Registration> = {}): Registration {
  const username = \`pw_\${randomUUID().slice(0, 13)}\`;
  return {
    username,
    password: 'Passw0rd-for-tests',
    firstName: 'Asha',
    lastName: 'Rao',
    email: \`\${username}@example.test\`,
    ...overrides,
  };
}
\`\`\`

\`as const satisfies Record<string, Product>\` keeps literal types (\`products.backpack\` autocompletes, a typo does not compile) while checking every entry. The catalogue is an **oracle from the specification**; reading expected values from the API and comparing the API with them proves nothing. Money is computed in integer cents. \`aRegistration\` is unique across workers and shards because it uses a UUID; a worker index alone repeats on every CI machine.

## 6. API clients and fixtures

**\`src/api/schemas.ts\`**

\`\`\`ts
import { z } from 'zod';

export const productSchema = z.object({
  id: z.int().positive(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  price: z.number().positive(),
  category: z.enum(['bags', 'accessories', 'clothing', 'kids']),
  stock: z.int().min(0),
  inStock: z.boolean(),
  description: z.string(),
});

export const productPageSchema = z.object({
  data: z.array(productSchema),
  page: z.int(),
  size: z.int(),
  total: z.int(),
  totalPages: z.int(),
});

export const sessionSchema = z.object({
  token: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.int().positive(),
  user: z.object({ id: z.int(), username: z.string() }),
});

const lineSchema = z.object({
  productId: z.int(),
  name: z.string(),
  price: z.number(),
  quantity: z.int().min(1).max(10),
  lineTotal: z.number(),
});

export const cartSchema = z.object({
  userId: z.int(),
  items: z.array(lineSchema),
  itemCount: z.int(),
  subtotal: z.number(),
});

export const orderSchema = z.object({
  id: z.int(),
  userId: z.int(),
  status: z.literal('PLACED'),
  customer: z.object({ firstName: z.string(), lastName: z.string(), postalCode: z.string() }),
  items: z.array(lineSchema).nonempty(),
  itemCount: z.int(),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  createdAt: z.iso.datetime(),
});

export const userSchema = z.object({
  id: z.int(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  phone: z.string(),
  roles: z.array(z.string()),
  address: z.object({ street: z.string(), city: z.string(), postalCode: z.string(), country: z.string() }),
});

export type Order = z.infer<typeof orderSchema>;
export type User = z.infer<typeof userSchema>;
export type Session = z.infer<typeof sessionSchema>;
\`\`\`

**\`src/api/clients.ts\`**

\`\`\`ts
import { z } from 'zod';
import type { ApiResult, HttpClient } from '@core/http';
import type { DeliveryDetails, Registration } from '@domain/builders';
import {
  cartSchema, orderSchema, productPageSchema, productSchema, sessionSchema, userSchema,
  type Order, type Session, type User,
} from './schemas';

const noContent = z.undefined();

export class SystemClient {
  constructor(private readonly http: HttpClient) {}
  health() { return this.http.send('GET', '/api/health', z.object({ status: z.literal('UP') })); }
  reset() { return this.http.send('POST', '/api/reset', z.object({ status: z.literal('RESET') })); }
}

export class AuthClient {
  constructor(private readonly http: HttpClient) {}
  login(username: string, password: string): Promise<ApiResult<Session>> {
    return this.http.send('POST', '/api/auth/login', sessionSchema, { body: { username, password } });
  }
}

export class UsersClient {
  constructor(private readonly http: HttpClient) {}
  register(registration: Registration): Promise<ApiResult<User>> {
    return this.http.send('POST', '/api/users', userSchema, { body: registration });
  }
  byId(id: number): Promise<ApiResult<User>> {
    return this.http.send('GET', \`/api/users/\${id}\`, userSchema);
  }
  patch(id: number, changes: Record<string, unknown>): Promise<ApiResult<User>> {
    return this.http.send('PATCH', \`/api/users/\${id}\`, userSchema, { body: changes });
  }
}

export type ProductSort = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc';

export class ProductsClient {
  constructor(private readonly http: HttpClient) {}
  list(query: { q?: string; sort?: ProductSort; page?: number; size?: number } = {}) {
    return this.http.send('GET', '/api/products', productPageSchema, { query });
  }
  byId(id: number | string) { return this.http.send('GET', \`/api/products/\${id}\`, productSchema); }
}

export class CartClient {
  constructor(private readonly http: HttpClient) {}
  get() { return this.http.send('GET', '/api/cart', cartSchema); }
  add(productId: number, quantity = 1) {
    return this.http.send('POST', '/api/cart/items', cartSchema, { body: { productId, quantity } });
  }
  remove(productId: number) { return this.http.send('DELETE', \`/api/cart/items/\${productId}\`, noContent); }
  clear() { return this.http.send('DELETE', '/api/cart', noContent); }
}

export class OrdersClient {
  constructor(private readonly http: HttpClient) {}
  /** Orders the current cart. */
  place(delivery: DeliveryDetails): Promise<ApiResult<Order>> {
    return this.http.send('POST', '/api/orders', orderSchema, { body: delivery });
  }
  byId(id: number): Promise<ApiResult<Order>> {
    return this.http.send('GET', \`/api/orders/\${id}\`, orderSchema);
  }
}

/** Everything one identity can do. Anonymous or signed in: that is the HttpClient's business. */
export class ShopApi {
  readonly system: SystemClient;
  readonly auth: AuthClient;
  readonly users: UsersClient;
  readonly products: ProductsClient;
  readonly cart: CartClient;
  readonly orders: OrdersClient;

  constructor(http: HttpClient) {
    this.system = new SystemClient(http);
    this.auth = new AuthClient(http);
    this.users = new UsersClient(http);
    this.products = new ProductsClient(http);
    this.cart = new CartClient(http);
    this.orders = new OrdersClient(http);
  }
}
\`\`\`

**\`src/fixtures/base.ts\`**

\`\`\`ts
import { test as base } from '@playwright/test';
import { Logger } from '@core/logger';

/** What every test has, UI or API: a log that is attached when the test does not end as expected. */
export const test = base.extend<{ log: Logger }>({
  log: [async ({}, use, testInfo) => {
    const log = new Logger();
    await use(log);
    if (testInfo.status !== testInfo.expectedStatus && log.text() !== '') {
      await testInfo.attach('test.log', { body: log.text(), contentType: 'text/plain' });
    }
  }, { auto: true }],
});
\`\`\`

**\`src/fixtures/api.ts\`**

\`\`\`ts
import type { APIRequestContext } from '@playwright/test';
import { ShopApi } from '@api/clients';
import { env } from '@core/env';
import { HttpClient, unwrap } from '@core/http';
import { Logger } from '@core/logger';
import { aRegistration, type Registration } from '@domain/builders';
import { test as base } from './base';

export interface CustomerSession {
  id: number;
  username: string;
  api: ShopApi;
}

type WorkerFixtures = { workerCustomer: Registration & { id: number } };
type TestFixtures = {
  apiContext: APIRequestContext;
  anonymousApi: ShopApi;
  customer: CustomerSession;
  newCustomer: () => Promise<CustomerSession>;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // one registration per worker process; a worker runs one test at a time
  workerCustomer: [async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: env.API_BASE_URL });
    const registration = aRegistration();
    const api = new ShopApi(new HttpClient(context, new Logger()));
    const user = unwrap(await api.users.register(registration));
    await context.dispose();
    await use({ ...registration, id: user.id });
    // ShopEasy has no "delete user"; a real system would delete or tag the account here
  }, { scope: 'worker', timeout: 20_000 }],

  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: env.API_BASE_URL });
    await use(context);
    await context.dispose();
  },

  anonymousApi: async ({ apiContext, log }, use) => {
    await use(new ShopApi(new HttpClient(apiContext, log)));
  },

  // a fresh token per test: a long worker can never outlive its token
  customer: async ({ apiContext, anonymousApi, workerCustomer, log }, use) => {
    const session = await signIn(apiContext, anonymousApi, log, workerCustomer);
    unwrap(await session.api.cart.clear());
    await use(session);
  },

  // a factory, for tests that need a second identity
  newCustomer: async ({ apiContext, anonymousApi, log }, use) => {
    await use(async () => {
      const registration = aRegistration();
      unwrap(await anonymousApi.users.register(registration));
      return signIn(apiContext, anonymousApi, log, registration);
    });
  },
});

async function signIn(
  context: APIRequestContext, anonymous: ShopApi, log: Logger, who: Registration,
): Promise<CustomerSession> {
  const session = unwrap(await anonymous.auth.login(who.username, who.password));
  return {
    id: session.user.id,
    username: session.user.username,
    api: new ShopApi(new HttpClient(context, log, session.token)),
  };
}

export { expect } from './matchers';
\`\`\`

**Step by step**

- **Types are inferred from schemas**, so there is one definition. Annotate returns where the inferred type is exported (\`Order\`, \`User\`); let the rest be inferred.
- **\`ShopApi\` is one identity.** Anonymous or signed in is decided by the \`HttpClient\` it receives. Two \`ShopApi\` objects in one test are two users, with no global token to mix up.
- **\`log\` is an automatic fixture** in the base, so both worlds attach \`test.log\` on an unexpected status. \`status !== expectedStatus\` also treats \`test.fail()\` tests correctly.
- **Scopes**: registration is slow and harmless to share, so it is worker-scoped; tokens (announced as valid for one hour) and cart state are test-scoped. A worker runs one test at a time, so one account per worker is never used concurrently, and \`cart.clear()\` removes what the previous test left. Orders accumulate, therefore no test counts "all my orders"; a test that must uses \`newCustomer()\`.
- **\`newCustomer\` is a factory fixture**: the test decides how many identities it needs, and they share the test's context and log.
- **Typical real app**: a UI fixture would depend on these: create the order through \`customer.api\`, open it in the browser as the same user. With ShopEasy that is impossible, because the web shop does not know API users; do not fake it.

## 7. UI: session, components, pages

**\`src/ui/session.ts\`**

\`\`\`ts
import type { Page } from '@playwright/test';
import type { Product } from '@domain/catalogue';

/**
 * ShopEasy keeps its session in sessionStorage: shopeasy.user is the plain user name,
 * shopeasy.cart a JSON array of product slugs. storageState does not cover sessionStorage.
 * Seeds once per tab, so that logging out or emptying the cart is not undone by the next navigation.
 */
export async function seedSession(page: Page, siteUrl: string, user: string | null, cart: readonly Product[]): Promise<void> {
  if (user === null && cart.length === 0) return;
  const seed = { origin: new URL(siteUrl).origin, user, slugs: cart.map((product) => product.slug) };
  await page.addInitScript(({ origin, user, slugs }) => {
    if (window.location.origin !== origin || window.sessionStorage.getItem('e2e.seeded')) return;
    window.sessionStorage.setItem('e2e.seeded', 'yes');
    if (user) window.sessionStorage.setItem('shopeasy.user', user);
    window.sessionStorage.setItem('shopeasy.cart', JSON.stringify(slugs));
  }, seed);
}
\`\`\`

**\`src/ui/components/header.ts\`**

\`\`\`ts
import type { Locator, Page } from '@playwright/test';

export class Header {
  readonly cartIcon: Locator;
  readonly cartBadge: Locator;
  readonly userName: Locator;
  readonly logoutLink: Locator;

  constructor(page: Page) {
    const root = page.getByRole('banner');
    this.cartIcon = root.getByTestId('shopping-cart-link');       // not the plain "Cart" link in the navigation
    this.cartBadge = root.getByTestId('shopping-cart-badge');
    this.userName = root.getByTestId('logged-in-user');
    this.logoutLink = root.getByTestId('logout-link');
  }
}
\`\`\`

**\`src/ui/components/product-card.ts\`**

\`\`\`ts
import type { Locator, Page } from '@playwright/test';
import type { Product } from '@domain/catalogue';

export class ProductCard {
  readonly root: Locator;
  readonly name: Locator;
  readonly price: Locator;
  readonly description: Locator;
  readonly addButton: Locator;
  readonly removeButton: Locator;

  constructor(page: Page, product: Product) {
    // data-slug never changes; id and data-testid switch from add-to-cart-* to remove-*
    this.root = page.getByTestId('inventory-item').filter({ has: page.locator(\`[data-slug="\${product.slug}"]\`) });
    this.name = this.root.locator('.item-name');
    this.price = this.root.locator('.item-price');
    this.description = this.root.locator('.item-desc');
    this.addButton = this.root.getByRole('button', { name: 'Add to cart' });
    this.removeButton = this.root.getByRole('button', { name: 'Remove' });
  }
}
\`\`\`

**\`src/ui/pages/login-page.ts\`**

\`\`\`ts
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly username: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.username = page.getByLabel('Username');
    this.password = page.getByLabel('Password');
    this.submitButton = page.getByTestId('login-button');
    this.error = page.getByTestId('error');
  }

  async open(): Promise<void> {
    await this.page.goto('login.html');
  }

  async submit(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.submitButton.click();
  }
}
\`\`\`

**\`src/ui/pages/inventory-page.ts\`**

\`\`\`ts
import type { Locator, Page } from '@playwright/test';
import type { Product } from '@domain/catalogue';
import { Header } from '../components/header';
import { ProductCard } from '../components/product-card';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

export class InventoryPage {
  readonly header: Header;
  readonly title: Locator;
  readonly productNames: Locator;
  private readonly sort: Locator;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.title = page.getByTestId('title');
    this.productNames = page.getByTestId('inventory-list').locator('.item-name');
    this.sort = page.getByTestId('product-sort');
  }

  async open(): Promise<void> {
    await this.page.goto('inventory.html');
  }

  card(product: Product): ProductCard {
    return new ProductCard(this.page, product);
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sort.selectOption(option);
  }
}
\`\`\`

**\`src/ui/pages/cart-page.ts\`**

\`\`\`ts
import type { Locator, Page } from '@playwright/test';
import type { Product } from '@domain/catalogue';
import { Header } from '../components/header';

export class CartPage {
  readonly header: Header;
  readonly lineNames: Locator;
  readonly emptyMessage: Locator;
  readonly checkoutButton: Locator;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.lineNames = page.getByTestId('inventory-item-name');
    this.emptyMessage = page.getByTestId('empty-cart-message');
    this.checkoutButton = page.getByTestId('checkout');
  }

  async open(): Promise<void> {
    await this.page.goto('cart.html');
  }

  async remove(product: Product): Promise<void> {
    await this.page.getByTestId(\`remove-\${product.slug}\`).click();
  }
}
\`\`\`

**\`src/ui/pages/checkout-page.ts\`**

\`\`\`ts
import type { Locator, Page } from '@playwright/test';
import type { DeliveryDetails } from '@domain/builders';
import { Header } from '../components/header';

/** One URL, three steps. */
export class CheckoutPage {
  readonly header: Header;
  readonly error: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly postalCode: Locator;
  readonly shipTo: Locator;
  readonly subtotal: Locator;
  readonly tax: Locator;
  readonly total: Locator;
  readonly confirmation: Locator;
  readonly orderNumber: Locator;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.error = page.getByTestId('error');
    this.firstName = page.getByLabel('First Name');
    this.lastName = page.getByLabel('Last Name');
    this.postalCode = page.getByLabel('Zip/Postal Code');
    this.shipTo = page.getByTestId('summary-ship-to');
    this.subtotal = page.locator('#summary-subtotal');
    this.tax = page.locator('#summary-tax');
    this.total = page.locator('#summary-total');
    this.confirmation = page.getByTestId('complete-header');
    this.orderNumber = page.locator('#order-number');
  }

  async open(): Promise<void> {
    await this.page.goto('checkout.html');
  }

  async continueAs(details: DeliveryDetails): Promise<void> {
    await this.firstName.fill(details.firstName);
    await this.lastName.fill(details.lastName);
    await this.postalCode.fill(details.postalCode);
    await this.page.getByTestId('continue').click();
  }

  async finish(): Promise<void> {
    await this.page.getByTestId('finish').click();
  }
}
\`\`\`

**Authentication, done correctly for this app.** \`context.storageState()\` saves cookies, \`localStorage\` and (on request) IndexedDB, **not** \`sessionStorage\`. \`shop.js\` stores the plain name \`standard_user\` under \`shopeasy.user\` and reads it with \`getItem\`: no JSON. \`addInitScript\` runs before the page's own scripts on *every* navigation, which would log the user in again after a logout. The \`e2e.seeded\` marker makes the seed happen once per tab, so logout tests work with the same fixture. The origin check keeps the script from writing into third-party frames.

**Typical real app** (cookie or \`localStorage\` session): sign in once in a setup project and reuse the file.

\`\`\`ts
// illustrative: not for ShopEasy
import { test as setup } from '@playwright/test';

setup('sign in', async ({ request }) => {
  const response = await request.post('/api/session', { data: { user: 'u', password: 'p' } });
  if (!response.ok()) throw new Error(\`sign in failed: \${response.status()}\`);
  await request.storageState({ path: '.auth/customer.json' });      // git-ignored
});
// project: { name: 'ui', dependencies: ['setup'], use: { storageState: '.auth/customer.json' } }
\`\`\`

| | Login through the UI in each test | \`storageState\` from a setup project | Init script (chosen) |
|---|---|---|---|
| Speed | slow | fast | fastest |
| Realism | full | real session | session as the app stores it |
| Breaks when | login page changes | session expires mid-run | storage format changes |
| When | only tests *about* login | cookies, \`localStorage\` | \`sessionStorage\` apps like this one |

**Page design.** No \`BasePage\`: the only shared thing would be a constructor. Locators are \`readonly\` public fields, because web-first assertions need locators; methods exist where an action has several steps or a parameter. \`ProductCard\` filters by \`data-slug\`, the one attribute that survives the *Add* → *Remove* switch (ids and test ids are rewritten). There is no product-details page in ShopEasy (product links do nothing), so details are asserted on the card.

## 8. UI fixtures and custom matchers

**\`src/fixtures/ui.ts\`**

\`\`\`ts
import { env } from '@core/env';
import type { Product } from '@domain/catalogue';
import { CartPage } from '@ui/pages/cart-page';
import { CheckoutPage } from '@ui/pages/checkout-page';
import { InventoryPage } from '@ui/pages/inventory-page';
import { LoginPage } from '@ui/pages/login-page';
import { seedSession } from '@ui/session';
import { test as base } from './base';

export interface ShopOptions {
  signedInAs: string | null;                       // null = guest
  startingCart: { products: readonly Product[] };
}

type PageFixtures = {
  browserLog: void;
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
};

export const test = base.extend<ShopOptions & PageFixtures>({
  signedInAs: [env.SHOP_USER, { option: true }],
  startingCart: [{ products: [] }, { option: true }],

  page: async ({ page, signedInAs, startingCart }, use) => {
    await seedSession(page, env.WEB_BASE_URL, signedInAs, startingCart.products);
    await use(page);
  },

  browserLog: [async ({ page, log }, use) => {
    page.on('console', (message) => {
      if (message.type() === 'error') log.warn(\`browser console: \${message.text()}\`);
    });
    page.on('pageerror', (error) => log.warn(\`uncaught in page: \${error.message}\`));
    page.on('requestfailed', (request) => log.warn(\`request failed: \${request.url()} \${request.failure()?.errorText ?? ''}\`));
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) log.info(\`navigated to \${frame.url()}\`);
    });
    await use();
  }, { auto: true, box: true }],

  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  inventoryPage: async ({ page }, use) => use(new InventoryPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
});

export { expect } from './matchers';
\`\`\`

**\`src/fixtures/matchers.ts\`**

\`\`\`ts
import { expect as baseExpect, type Locator } from '@playwright/test';
import type { ApiResult } from '@core/http';
import { usd, type Totals } from '@domain/money';
import type { Header } from '@ui/components/header';
import type { CheckoutPage } from '@ui/pages/checkout-page';

/** Runs web-first assertions and turns the first failure into a matcher result. */
async function verdict(name: string, checks: () => Promise<void>) {
  try {
    await checks();
    return { pass: true, name, message: () => \`expected \${name} to fail\` };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { pass: false, name, message: () => \`\${name}: \${reason}\` };
  }
}

const badge = (header: Header): Locator => header.cartBadge;

export const expect = baseExpect.extend({
  /** Polling. The badge element does not exist while the cart is empty. */
  async toShowCartCount(header: Header, expected: number) {
    if (this.isNot) throw new Error('toShowCartCount has no negated form: state the count you expect');
    return verdict('toShowCartCount', async () => {
      if (expected === 0) await baseExpect(badge(header)).toHaveCount(0);
      else await baseExpect(badge(header)).toHaveText(String(expected));
    });
  },

  /** Polling. All three amounts, formatted as the customer sees them. */
  async toShowTotals(checkout: CheckoutPage, expected: Totals) {
    if (this.isNot) throw new Error('toShowTotals has no negated form');
    return verdict('toShowTotals', async () => {
      await baseExpect(checkout.subtotal).toHaveText(usd(expected.subtotal));
      await baseExpect(checkout.tax).toHaveText(usd(expected.tax));
      await baseExpect(checkout.total).toHaveText(usd(expected.total));
    });
  },

  /** Immediate: an API result does not change while we look at it. */
  toBeApiError(result: ApiResult<unknown>, status: number, code: string) {
    const actual = result.ok ? \`\${result.status} (success)\` : \`\${result.status} \${result.error.code}\`;
    const expected = \`\${status} \${code}\`;
    const pass = actual === expected;
    return {
      pass,
      name: 'toBeApiError',
      expected,
      actual,
      message: () => \`expected API result \${pass ? 'not ' : ''}to be \${expected}, got \${actual}\`,
    };
  },
});
\`\`\`

**Step by step**

- **Two option fixtures** describe the start state in business terms: \`test.use({ signedInAs: null })\` is a guest; \`test.use({ startingCart: { products: [redTee] } })\` starts with a cart. The cart is wrapped in an object on purpose: Playwright interprets an **array** value of a fixture as \`[value, options]\`, so raw array options are a trap.
- **Overriding \`page\`** means every page object automatically gets the seeded page. The type parameter of \`defineConfig<ShopOptions>\` lets projects set the options with type checking.
- **\`browserLog\`** writes console errors, page errors, failed requests and navigations into the same log the API layer uses; \`box: true\` hides it from the report's step list.
- **Matchers.** \`toShowCartCount\` and \`toShowTotals\` wrap web-first assertions, so they poll. They refuse \`.not\` instead of implementing it badly: negating a polling matcher must *wait for the negative*, and "not 2" is rarely what a test means. \`toBeApiError\` is synchronous and compares status and code as one string, so the failure reads "expected … 409 ITEM_ALREADY_IN_CART, got 201 (success)".
- \`toBeApiError\` supports \`.not\` for free; the runner inverts \`pass\` and uses the same message function.

## 9. Tests

**\`tests/setup/api.setup.ts\`**

\`\`\`ts
import { test as setup, expect } from '@fixtures/api';
import { env } from '@core/env';
import { unwrap } from '@core/http';

setup('the API is up', async ({ anonymousApi }) => {
  expect(unwrap(await anonymousApi.system.health()).status).toBe('UP');
  if (env.ALLOW_RESET) unwrap(await anonymousApi.system.reset());     // once per shard, before any API test
});
\`\`\`

**\`tests/setup/web.setup.ts\`**

\`\`\`ts
import { test as setup, expect } from '@fixtures/ui';

setup('the shop is up', async ({ page, loginPage }) => {
  await loginPage.open();
  await expect(page).toHaveTitle('ShopEasy — Login');
});
\`\`\`

**\`tests/ui/login.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { env } from '@core/env';

test.describe('sign in', () => {
  test.use({ signedInAs: null });

  test('a customer signs in through the form', { tag: ['@smoke', '@cross-browser'] }, async ({ loginPage, inventoryPage }) => {
    await loginPage.open();
    await loginPage.submit(env.SHOP_USER, env.SHOP_PASS);

    await expect(inventoryPage.title).toHaveText('Products');
    await expect(inventoryPage.header.userName).toHaveText(env.SHOP_USER);
  });

  const refusals = [
    { title: 'no user name', user: '', password: 'any', message: 'Error: Username is required' },
    { title: 'no password', user: 'standard_user', password: '', message: 'Error: Password is required' },
    { title: 'wrong password', user: 'standard_user', password: 'wrong', message: 'Error: Username and password do not match any user in this service' },
    { title: 'locked user', user: 'locked_out_user', password: env.SHOP_PASS, message: 'Error: Sorry, this user has been locked out.' },
  ];

  for (const { title, user, password, message } of refusals) {
    test(\`refused: \${title}\`, async ({ loginPage }) => {
      await loginPage.open();
      await loginPage.submit(user, password);
      await expect(loginPage.error).toContainText(message);
    });
  }
});

test('logging out ends the session', async ({ page, loginPage, inventoryPage }) => {
  await inventoryPage.open();
  await expect(inventoryPage.header.userName).toHaveText(env.SHOP_USER);

  await inventoryPage.header.logoutLink.click();
  await expect(loginPage.submitButton).toBeVisible();
  await page.goto('inventory.html');
  await expect(inventoryPage.header.userName).toHaveText('guest');
});
\`\`\`

**\`tests/ui/catalogue.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { products } from '@domain/catalogue';
import { usd } from '@domain/money';
import type { SortOption } from '@ui/pages/inventory-page';

const { backpack, bikeLight, crewTee, fleece, onesie, redTee } = products;

const sortings = [
  { option: 'lohi', first: onesie, last: fleece },
  { option: 'hilo', first: fleece, last: onesie },
  { option: 'az', first: crewTee, last: backpack },
  { option: 'za', first: backpack, last: crewTee },
] satisfies { option: SortOption; first: { name: string }; last: { name: string } }[];

for (const { option, first, last } of sortings) {
  test(\`sorting by \${option} starts with \${first.name}\`, async ({ inventoryPage }) => {
    await inventoryPage.open();
    await inventoryPage.sortBy(option);
    await expect(inventoryPage.productNames.first()).toHaveText(first.name);
    await expect(inventoryPage.productNames.last()).toHaveText(last.name);
  });
}

for (const product of [bikeLight, redTee]) {
  test(\`the card of \${product.name} shows its details\`, async ({ inventoryPage }) => {
    await inventoryPage.open();
    const card = inventoryPage.card(product);
    await expect(card.name).toHaveText(product.name);
    await expect(card.price).toHaveText(usd(product.price));
    await expect(card.description).toHaveText(product.description);
  });
}
\`\`\`

**\`tests/ui/cart-checkout.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { aDelivery } from '@domain/builders';
import { products } from '@domain/catalogue';
import { totalsFor } from '@domain/money';

const { backpack, bikeLight, redTee } = products;

test('a customer buys two products', { tag: ['@smoke', '@cross-browser'] }, async ({ inventoryPage, cartPage, checkoutPage }) => {
  const delivery = aDelivery();

  await test.step('fill the cart', async () => {
    await inventoryPage.open();
    await inventoryPage.card(backpack).addButton.click();
    await inventoryPage.card(bikeLight).addButton.click();
    await expect(inventoryPage.header).toShowCartCount(2);
  });

  await test.step('check out', async () => {
    await inventoryPage.header.cartIcon.click();
    await expect(cartPage.lineNames).toHaveText([backpack.name, bikeLight.name]);
    await cartPage.checkoutButton.click();
    await checkoutPage.continueAs(delivery);
    await expect(checkoutPage).toShowTotals({ subtotal: 39.98, tax: 3.2, total: 43.18 });
    await expect(checkoutPage.shipTo).toHaveText('Asha Rao, 560001');
  });

  await test.step('place the order', async () => {
    await checkoutPage.finish();
    await expect(checkoutPage.confirmation).toHaveText('Thank you for your order!');
    await expect(checkoutPage.orderNumber).toHaveText(/^SE-\\d{6}$/);
    await expect(checkoutPage.header).toShowCartCount(0);
  });
});

test.describe('with one product in the cart', () => {
  test.use({ startingCart: { products: [redTee] } });

  test('removing it empties the cart', async ({ cartPage }) => {
    await cartPage.open();
    await cartPage.remove(redTee);
    await expect(cartPage.lineNames).toHaveCount(0);
    await expect(cartPage.emptyMessage).toBeVisible();
    await expect(cartPage.checkoutButton).toBeDisabled();
    await expect(cartPage.header).toShowCartCount(0);
  });

  test('8% tax is added', async ({ checkoutPage }) => {
    await checkoutPage.open();
    await checkoutPage.continueAs(aDelivery());
    await expect(checkoutPage).toShowTotals(totalsFor([redTee]));
  });

  const invalid = [
    { details: aDelivery({ firstName: '' }), message: 'Error: First Name is required' },
    { details: aDelivery({ lastName: '' }), message: 'Error: Last Name is required' },
    { details: aDelivery({ postalCode: '' }), message: 'Error: Postal Code is required' },
    { details: aDelivery({ postalCode: '!!' }), message: 'Error: Postal Code is invalid' },
  ];

  for (const { details, message } of invalid) {
    test(\`delivery validation: \${message}\`, async ({ checkoutPage }) => {
      await checkoutPage.open();
      await checkoutPage.continueAs(details);
      await expect(checkoutPage.error).toContainText(message);
    });
  }
});
\`\`\`

**\`tests/api/products.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/api';
import type { ProductSort } from '@api/clients';
import { unwrap } from '@core/http';
import { products } from '@domain/catalogue';

test('the catalogue matches the specification', { tag: '@smoke' }, async ({ anonymousApi }) => {
  const page = unwrap(await anonymousApi.products.list({ size: 50 }));
  expect(page.total).toBe(6);
  for (const { id, slug, name, price, description } of Object.values(products)) {
    expect.soft(page.data.find((p) => p.id === id)).toMatchObject({ slug, name, price, description });
  }
});

const sorts = [
  { sort: 'price_asc', ids: [5, 2, 3, 6, 1, 4] },
  { sort: 'price_desc', ids: [4, 1, 3, 6, 2, 5] },
] satisfies { sort: ProductSort; ids: number[] }[];

for (const { sort, ids } of sorts) {
  test(\`products sorted by \${sort}\`, async ({ anonymousApi }) => {
    const page = unwrap(await anonymousApi.products.list({ sort }));
    expect(page.data.map((p) => p.id)).toEqual(ids);
  });
}

test('unknown and malformed ids', async ({ anonymousApi }) => {
  expect(await anonymousApi.products.byId(999)).toBeApiError(404, 'PRODUCT_NOT_FOUND');
  expect(await anonymousApi.products.byId('abc')).toBeApiError(400, 'INVALID_ID');
});
\`\`\`

**\`tests/api/orders.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/api';
import { unwrap } from '@core/http';
import { aDelivery } from '@domain/builders';
import { products } from '@domain/catalogue';
import { totalsFor } from '@domain/money';

const { backpack, bikeLight, redTee } = products;

test('a customer orders the cart', { tag: '@smoke' }, async ({ customer }) => {
  unwrap(await customer.api.cart.add(backpack.id, 2));
  unwrap(await customer.api.cart.add(bikeLight.id));

  const result = await customer.api.orders.place(aDelivery());

  expect(result.status).toBe(201);
  const order = unwrap(result);
  expect(order).toMatchObject({
    userId: customer.id,
    itemCount: 3,
    customer: aDelivery(),
    ...totalsFor([{ ...backpack, quantity: 2 }, bikeLight]),
  });
  expect(unwrap(await customer.api.cart.get()).itemCount, 'the order empties the cart').toBe(0);
  expect(unwrap(await customer.api.orders.byId(order.id))).toEqual(order);
});

test('cart rules', async ({ customer }) => {
  unwrap(await customer.api.cart.add(backpack.id));
  expect(await customer.api.cart.add(backpack.id), 'same product twice').toBeApiError(409, 'ITEM_ALREADY_IN_CART');
  expect(await customer.api.cart.add(bikeLight.id, 11), 'more than 10').toBeApiError(422, 'INVALID_QUANTITY');
  expect(await customer.api.cart.add(redTee.id), 'stock is 0').toBeApiError(422, 'OUT_OF_STOCK');
  expect(await customer.api.cart.remove(bikeLight.id), 'not in the cart').toBeApiError(404, 'ITEM_NOT_IN_CART');
});

test('an order needs items and valid delivery details', async ({ customer }) => {
  expect(await customer.api.orders.place(aDelivery())).toBeApiError(422, 'EMPTY_CART');

  const result = await customer.api.orders.place(aDelivery({ firstName: '', postalCode: '!!' }));
  expect(result).toBeApiError(400, 'VALIDATION_FAILED');
  if (!result.ok) expect(result.error.details?.map((d) => d.field)).toEqual(['firstName', 'postalCode']);
});

test('nobody reads an order of another customer', { tag: '@security' }, async ({ customer, newCustomer, anonymousApi }) => {
  unwrap(await customer.api.cart.add(backpack.id));
  const { id } = unwrap(await customer.api.orders.place(aDelivery()));
  const stranger = await newCustomer();

  expect(await stranger.api.orders.byId(id)).toBeApiError(403, 'FORBIDDEN');
  expect(await anonymousApi.orders.byId(id)).toBeApiError(401, 'UNAUTHORIZED');
});
\`\`\`

**\`tests/api/users.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/api';
import { env } from '@core/env';
import { unwrap } from '@core/http';
import { aRegistration } from '@domain/builders';

test('a new customer can register and sign in', async ({ anonymousApi }) => {
  const registration = aRegistration();
  const user = unwrap(await anonymousApi.users.register(registration));
  expect(user).toMatchObject({ username: registration.username, email: registration.email, roles: ['CUSTOMER'] });

  const session = unwrap(await anonymousApi.auth.login(registration.username, registration.password));
  expect(session.user.id).toBe(user.id);
  expect(await anonymousApi.users.register(registration)).toBeApiError(409, 'USERNAME_TAKEN');
});

test('sign-in errors', async ({ anonymousApi }) => {
  expect(await anonymousApi.auth.login(env.SHOP_USER, 'wrong')).toBeApiError(401, 'INVALID_CREDENTIALS');
  expect(await anonymousApi.auth.login('locked_out_user', env.SHOP_PASS)).toBeApiError(403, 'USER_LOCKED');
});

test('customers change only their own profile', async ({ customer, newCustomer }) => {
  const other = await newCustomer();
  expect(unwrap(await customer.api.users.patch(customer.id, { phone: '+91-80-5550-9999' })).phone).toBe('+91-80-5550-9999');
  expect(await customer.api.users.patch(other.id, { phone: '1' })).toBeApiError(403, 'FORBIDDEN');
  expect(await customer.api.users.patch(customer.id, { email: 'nope' })).toBeApiError(422, 'INVALID_EMAIL');
});
\`\`\`

**What to notice**

- The **journey** test uses literals (\`39.98 / 3.20 / 43.18\`), the agreed example. Other totals use the oracle.
- **Data-driven** tests are loops over typed arrays; titles are unique because they contain the data. Object rows with \`satisfies\` check \`option\` against the real \`<option>\` values.
- The validation rows start at \`checkout.html\` with a seeded cart: no login, no clicking, about a second each.
- \`expect.soft\` inside the catalogue loop reports all wrong products in one run.
- **Security tests are ordinary tests** here: 401 for nobody, 403 for a stranger. They cost three lines because identities are objects.
- Tags: \`@smoke\` (pull request), \`@cross-browser\` (all engines), \`@security\` (reporting). Tags are properties, not title text.

## 10. Pipeline, Docker, commands

**\`.github/workflows/e2e-pw.yml\`**

\`\`\`yaml
name: e2e (Playwright)
on:
  pull_request:
  schedule: [{ cron: '0 2 * * 1-5' }]
concurrency:
  group: e2e-pw-\${{ github.ref }}
  cancel-in-progress: true
defaults:
  run: { working-directory: tests-pw }
env:
  ALLOW_RESET: 'true'            # every shard has its own servers
jobs:
  static:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: 22, cache: npm, cache-dependency-path: tests-pw/package-lock.json }
      - run: npm ci
      - run: npm run check

  test:
    needs: static
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix: { shard: [1, 2, 3] }
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: 22 }
      - run: npm ci
        working-directory: .       # Vite and the API
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: Pull request = smoke, nightly = everything
        run: npx playwright test --shard=\${{ matrix.shard }}/3 \${{ github.event_name == 'pull_request' && '--grep @smoke' || '' }}
        env:
          FAIL_ON_FLAKY: \${{ github.event_name == 'schedule' }}
      - uses: actions/upload-artifact@v5
        if: \${{ !cancelled() }}
        with: { name: 'blob-\${{ matrix.shard }}', path: tests-pw/blob-report, retention-days: 1 }

  report:
    needs: test
    if: \${{ !cancelled() }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: 22 }
      - run: npm ci
      - uses: actions/download-artifact@v5
        with: { path: tests-pw/all-blobs, pattern: 'blob-*', merge-multiple: true }
      - run: npx playwright merge-reports --reporter html ./all-blobs
      - uses: actions/upload-artifact@v5
        with: { name: playwright-report, path: tests-pw/playwright-report, retention-days: 14 }
\`\`\`

**\`Dockerfile\`**

\`\`\`dockerfile
# build from the repository root:  docker build -f tests-pw/Dockerfile -t shopeasy-pw .
FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /repo
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tests-pw/package.json tests-pw/package-lock.json ./tests-pw/
RUN cd tests-pw && npm ci --no-audit --no-fund
COPY . .
WORKDIR /repo/tests-pw
ENV CI=1
ENTRYPOINT ["npx", "playwright", "test"]
\`\`\`

- The \`static\` job fails in under a minute for type and lint errors, before any browser is installed.
- Each shard is a machine with **its own servers**; that is why \`ALLOW_RESET\` is safe here and nowhere else. On a shared environment, isolation must come from unique data alone.
- \`merge-reports\` combines blobs into one HTML report with traces. It runs if a shard failed, which is when you need it.
- **Flaky policy**: one UI retry. On pull requests a flaky test is reported but does not block; nightly, \`failOnFlakyTests\` turns it red. A flaky test gets an owner and a ticket the same day, or \`test.fixme\` with a link. Ten flaky tests are a trend; hide none of them with \`retries: 3\`.
- The image contains browsers matching the pinned version; run it with \`docker run --rm --ipc=host shopeasy-pw --project=api\`. Add a \`.dockerignore\` with \`node_modules\`. Networking and Compose are in \`framework-deep-docker-for-test-automation\`.

| Goal | Command (in \`tests-pw\`) |
|---|---|
| first time | \`npm install\` then \`npx playwright install\` |
| types and lint | \`npm run check\` |
| everything | \`npx playwright test\` |
| API only, no browser | \`npm run test:api\` |
| one test, debugger | \`npx playwright test -g "two products" --project=ui-chromium --debug\` |
| explore | \`npx playwright test --ui\` |
| stress a new test | \`npx playwright test -g "two products" --project=ui-chromium --repeat-each=20 --workers=4\` |
| only what changed | \`npx playwright test --only-changed=main\` |
| staging | \`SHOP_ENV=staging WEB_BASE_URL=… API_BASE_URL=… SHOP_PASS=… npx playwright test --grep @smoke\` |
| simulate CI shard 2 | \`CI=1 npx playwright test --shard=2/3\` |
| open a trace | \`npx playwright show-trace test-results/…/trace.zip\` |

## 11. Adding a feature: "Remember me"

The login form keeps the user name in \`localStorage\` when *Remember me* is ticked.

**1. The test**, in \`login.spec.ts\` inside the \`sign in\` block (it starts as a guest):

\`\`\`ts
test('the shop remembers the user name', async ({ loginPage, inventoryPage }) => {
  await loginPage.open();
  await loginPage.rememberMe.check();
  await loginPage.submit(env.SHOP_USER, env.SHOP_PASS);
  await inventoryPage.header.logoutLink.click();

  await expect(loginPage.username).toHaveValue(env.SHOP_USER);
});
\`\`\`

**2. The page object**: one field and one constructor line.

\`\`\`ts
readonly rememberMe: Locator;
// constructor
this.rememberMe = page.getByLabel('Remember me');
\`\`\`

**3.** \`npm run check\`, **4.** break the expectation once and read the report as a stranger would, **5.** \`--repeat-each=20\`. No fixture, config or core file changes. A new *endpoint* follows the same shape: schema, one client method, fixture only if it creates state that must be cleaned.

## 12. Scaling, governance, alternatives

- **Pyramid by arithmetic.** A validated API test takes tens of milliseconds, a UI test seconds. Rules go to the API project; the UI proves that screens are wired.
- **Folders by capability** (\`tests/ui/checkout/…\`) around 100 specs; \`CODEOWNERS\` per capability; split \`clients.ts\` per resource when it passes 200 lines.
- **Shards**: add them until the slowest shard is dominated by its longest test; \`fullyParallel\` balances single tests.
- **Review checklist**: imports from \`@fixtures/*\`; no \`waitForTimeout\`; no \`page.locator\` chains in specs; unique data; no test depends on another; failure demonstrated; \`expect\` awaited (lint).
- **Generated clients**: with an OpenAPI document, generate types and keep only hand-written flows.
- **Upgrades**: Playwright monthly, image tag in the same pull request.

| Alternative | Choose it when | Price |
|---|---|---|
| Cucumber-JS + Playwright | the business really reads and writes Gherkin | you rebuild fixtures, retries, sharding and reports around \`World\` |
| playwright-bdd (Gherkin compiled to Playwright tests) | Gherkin wanted *and* the runner kept | an extra generation step |
| Monorepo package (\`packages/e2e-kit\`) | several front ends share clients and fixtures | versioning and an owner |
| Screenplay (Serenity/JS) | many actors, long cross-role journeys | indirection, learning curve |
| Component testing + few journeys | front-end team owns quality | needs app code integration |

## 13. Common failures and debugging

| Symptom | Cause | Fix / where to look |
|---|---|---|
| \`Cannot find module '@core/env'\` | alias missing in tsconfig, or the run used another tsconfig | \`paths\`; \`--tsconfig\` |
| \`Invalid test configuration:\` before any test | \`env.ts\` guard | read the list; \`.env\` may contain an old value |
| tests "did not run" | a setup project failed | open the \`api-ready\` / \`web-ready\` result first |
| port already used in CI | leftover server, \`reuseExistingServer\` is false | kill it; never set it to true in CI |
| user is \`guest\` although seeded | spec imports \`@playwright/test\` (lint off), or the URL has another origin (\`127.0.0.1\` vs \`localhost\`) | import; compare origins |
| user logged in again after logout | init script without the once-marker | \`e2e.seeded\` |
| \`Contract broken at …\` | API changed, or schema too strict | the field path in the message |
| 401 in the middle of a long run | token cached in a worker fixture | sign in per test, as \`customer\` does |
| strict mode violation on "Cart" | the header has a text link *and* the icon | \`header.cartIcon\` |
| test green, but checks nothing | missing \`await\` | \`npm run check\` |
| worker fixture re-created often | each failure starts a new worker | fix the failures; the fixture is idempotent |
| merged report is empty | shard wrote \`html\` instead of \`blob\` | \`CI\` variable not set in the container |
| "executable doesn't exist" | image and package version differ | same version in both |

## Best practices for experienced engineers

- Let types carry rules: \`signedInAs: string | null\`, \`SortOption\`, \`ApiResult\`. A rule the compiler checks needs no reviewer.
- Keep fixtures named after *states*, matchers after *facts*, page methods after *actions*.
- Prefer deleting an abstraction to documenting it; three callers is the minimum.
- Make every failure self-explaining: log + trace + named steps, then judge by a deliberately broken build.
- State limits openly (UI and API of ShopEasy are separate) instead of building a demo that pretends otherwise.

**Equivalent in the other stack:** fixtures ↔ PicoContainer + hooks, \`ApiResult\` ↔ REST Assured client layer (\`restassured-deep-api-framework-architecture\`), projects and shards ↔ suite files, Surefire threads and Jenkins matrix.

## 14. Framework A or Framework B?

| | A: Java, Selenium, Cucumber, TestNG | B: TypeScript, Playwright Test |
|---|---|---|
| Scenario language | Gherkin, readable outside the team | code with \`test.step\` |
| Waiting | explicit \`Waits\`, our responsibility | auto-waiting, web-first assertions |
| State and lifecycle | PicoContainer + hooks | fixtures (lazy, typed, scoped) |
| Parallelism | TestNG data-provider threads, Grid | worker processes, shards |
| Isolation unit | browser per scenario | context per test (cheaper) |
| API tests | separate library (REST Assured) | same runner, same reports |
| Evidence | screenshot, URL, scenario log, Allure | trace with DOM snapshots and network, video, log |
| Browsers | every WebDriver browser, real Safari, Appium family, any Grid or cloud | Chromium, Firefox, WebKit builds; branded Chrome and Edge |
| Code to own here | about 30 Java files plus XML | about 20 TypeScript files |
| Hiring and reuse | large Java pool, shares code with JVM services | front-end developers contribute |
| Typical costs | Grid operation, waits, glue upkeep | fast-moving releases, no real Safari or legacy browsers |

**Choose A** when the organisation is Java-centred, business people use the Gherkin, real Safari/IE-mode/mobile-web through Appium or an existing Grid is required, or a large Selenium estate works well. **Choose B** for a new web product, a TypeScript front-end team, UI and API tests in one place, and fast feedback. **Migrate** only with a reason you can measure: run B for new capabilities next to A, move the flakiest capability first, stop A per capability, and never translate page objects line by line. Both frameworks share the ideas that matter: one object graph per test, typed settings, seeded state, evidence by default, a bounded retry policy.

## Interview questions

### Q: Walk me through your Playwright framework.
**Short answer (30–60 s):** Tests state intent; fixtures provide objects in a defined state; pages and API clients know the two interfaces; domain and core hold data, environment, logging and HTTP. UI and API have separate fixture entry points over one base, enforced by lint. Config has setup projects, one API project without a browser and browser projects. CI type-checks first, then runs shards and merges blobs.

**Detailed answer:** Follow one test: \`customer\` → worker registration → fresh login → cleared cart → \`orders.place\` → schema validation → matcher. Then one design with its alternatives, for example the result union versus throwing clients, and one limit you accepted: storage seeding. End with how you know it works: a deliberately broken test and what its report shows.

### Q: How do you handle authentication when the session is in sessionStorage?
**Short answer (30–60 s):** \`storageState\` does not capture it, so I seed the key with \`addInitScript\`, guarded by origin and a once-per-tab marker, inside an override of the \`page\` fixture. Login itself is tested separately through the form.

**Detailed answer:** Explain the order (init scripts run before page scripts on every navigation), the logout trap, the exact value format read from the app's code, and that a cookie or \`localStorage\` app should use a setup project with \`storageState\`. Mention expiry: state files need to be regenerated per run, per role, and git-ignored.

### Q: How do you validate API responses in TypeScript?
**Short answer (30–60 s):** With runtime schemas at the client boundary. Types disappear at run time, \`as T\` is a claim, not a check. The schema gives the type and the validation, for success and error bodies.

**Detailed answer:** Compare with generated OpenAPI types (good, but compile-time only unless combined with a validator), JSON Schema with Ajv (reuses the provider's document), and snapshots (brittle). Discuss strict versus tolerant objects and where contract tests with the provider belong.

### Q: Why both worker-scoped and test-scoped API fixtures?
**Short answer (30–60 s):** Registration is expensive and safe to share within a worker; tokens and carts are cheap and mutable, so each test gets its own. The combination is fast and isolated.

**Detailed answer:** A worker runs one test at a time, so sharing is sequential. After a failure the worker is replaced and registers again, so it must be idempotent: UUID, no fixed name. Tokens expire in long workers, a bug seen only in full nightly runs. Where history matters (order lists), use the factory for a brand-new customer.

### Q: How do you prevent unawaited assertions?
**Short answer (30–60 s):** Typed linting with \`no-floating-promises\` in a required CI job, strict TypeScript, and matchers that are clearly sync or async.

**Detailed answer:** Playwright does not type-check, so the compiler and linter must be explicit steps. Also \`no-misused-promises\` catches async callbacks in \`forEach\`. In review I look for tests that have never been seen red.

### Q: What is your retry and flaky strategy?
**Short answer (30–60 s):** One retry for UI in CI, none for API, trace on the retry, flaky reported on pull requests and failing nightly, quarantine with owner and deadline.

**Detailed answer:** Retries are a measuring instrument: they tell you *that* a test is unstable and record a trace. They do not fix races. I track the flaky rate per capability and treat a rise as a product or environment defect until proven otherwise.

### Q: UI and API tests in one project: benefits and risks?
**Short answer (30–60 s):** One runner, one report, shared domain data and clients, so preconditions come cheap. The risk is mixing: API tests that open pages, UI tests that assert API details.

**Detailed answer:** Separate projects and fixture entry points, different retry rules, folder ownership. In a typical real app UI tests arrange through the API. For ShopEasy that does not work because the site never calls it, and I say so rather than pretend.

## Scenario-based questions

**1. The suite passes locally; in CI 30 % of UI tests show "guest".** Something prevents the seed. I compare origins first: CI overrides \`WEB_BASE_URL\` with \`127.0.0.1\` while navigation goes to \`localhost\`, or a redirect changes the host. The log attachment lists navigations, so one failed test is enough. Fix the variable; then add the origin to the \`web-ready\` check so the next case fails once, not thirty times.

**2. An API release adds a field and 40 tests fail with "Contract broken".** Our schemas are tolerant, so a *new* field cannot do that; a changed or removed one can. I read the field path, check the API change log with the provider team, and if the change is intended, one schema line fixes 40 tests. If it was accidental we just found a breaking change before the mobile client did. Then I ask why it was not caught by a contract test in the provider's pipeline.

**3. Management wants Gherkin "because the Java team has it".** I ask who will read the scenarios and how often. If product owners take part in writing them, playwright-bdd keeps the runner. If not, named \`test.step\`s and a tagged report give the same readability without a second language. I offer a two-week trial with one capability and compare review participation, not opinions.

## Tricky follow-ups

- **Does \`request\` from a UI test share the API base URL?** No: it uses the project's \`baseURL\` (the web shop). That is why \`apiContext\` is created explicitly.
- **Why does \`log\` not depend on \`page\`?** Automatic fixtures that depend on \`page\` would open a page in every API test.
- **Can two \`test.use\` calls for \`startingCart\` merge?** No, the inner one replaces the value.
- **Why are setup files tests and not \`globalSetup\`?** They appear in the report, have traces and fixtures, and block only their dependants.
- **Why throw in a matcher for \`.not\`?** A wrong silent negation passes immediately; an explicit error is honest.`,
  keyPoints: [
    `Separate fixture entry points (@fixtures/ui, @fixtures/api) over one base, enforced by an ESLint import rule; API tests never open a page.`,
    `Playwright strips types without checking them: tsc and typed lint (no-floating-promises) are a required first CI job.`,
    `One validated, frozen env module; guards such as "never reset staging" are code.`,
    `API clients return ApiResult<T> validated by runtime schemas: unwrap for arrange steps, toBeApiError for negative tests.`,
    `ShopEasy signs in through sessionStorage, which storageState does not save: seed with addInitScript, origin check and a once-per-tab marker.`,
    `Worker-scoped account, test-scoped token and cart, factory fixture for extra identities; unique data by UUID.`,
    `Setup projects gate their dependants, API has no retries, UI has one in CI, failOnFlakyTests runs nightly, shards merge blob reports.`,
    `Choose A or B by team, readers, browsers and existing estate, and migrate by capability with measurements.`,
  ],
  mistakes: [
    `Importing test from @playwright/test in a spec: no seeding, no log, no matchers, and everything looks like "guest". Fix: no-restricted-imports in tests/ and a CI lint gate.`,
    `Seeding sessionStorage with addInitScript on every navigation, so logout never works. Fix: a marker key that makes the seed run once per tab, plus a logout test.`,
    `Trusting as T on API responses; a renamed field becomes undefined and the assertion compares undefined with undefined. Fix: validate at the client boundary and fail with the field path.`,
    `Passing a raw array as an option fixture value; Playwright reads it as [value, options]. Fix: wrap it in an object such as { products: [...] }.`,
    `Caching a token in a worker fixture: nightly runs get 401 after an hour. Fix: share the account, sign in per test (or refresh before expiry).`,
    `Setting reuseExistingServer to true in CI, testing a leftover build. Fix: !isCI, --strictPort, and a setup project that checks the page really is the shop.`,
  ],
  tryIt: `Create \`tests-pw\` next to the app's \`package.json\` and copy the files. (1) \`npm install\`, \`npx playwright install chromium\`, \`npm run check\`, \`npm run test:api\` (no browser starts), \`npm run test:ui\`. (2) Delete one \`await\` before an \`expect\` and confirm that the test stays green but \`npm run check\` fails. (3) Change \`total\` to \`z.string()\` in \`orderSchema\` and read the contract error in the attached \`test.log\` and trace. (4) Remove the \`e2e.seeded\` check and watch the logout test fail. (5) Run \`CI=1 npx playwright test --shard=1/2\` and \`2/2\`, keeping the two blob folders apart, and merge them. (6) Add the "Remember me" test from section 11 with \`--repeat-each=20\`, and a cart API test for \`quantity: 0\`.`,
  problems: ['pw-031', 'pw-035', 'pw-043', 'pw-044'],
}
