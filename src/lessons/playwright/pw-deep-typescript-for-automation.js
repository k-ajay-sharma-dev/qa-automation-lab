export default {
  slug: 'pw-deep-typescript-for-automation',
  category: 'playwright',
  order: 11,
  title: 'Deep dive: TypeScript for automation engineers',
  minutes: 28,
  summary: 'Use TypeScript the way a senior SDET does: scoping and narrowing rules, type vs interface, enums vs unions, access modifiers, abstract page objects, generics for API helpers and data builders, this binding, modules and the tsconfig a test project really needs.',
  manualAnalogy: `A good test-case template does not only list fields; it constrains them: "Priority" is a drop-down, "Expected result" is mandatory, "Build" is read-only once executed. TypeScript's type system is that template for a framework, and a senior engineer decides how strict each field should be, so that a careless change fails in review (the compiler) and not at 2 a.m. in the nightly run.`,
  body: `## Where this lesson starts

The *TypeScript for testers coming from Java* lesson covers the vocabulary: interfaces, union types, arrow functions, a basic class, \`async\`/\`await\`. This deep dive is about the **rules underneath**, and about the design decisions an interviewer expects a 5–8-year engineer to argue for. Keep one fact in mind throughout: **TypeScript types are erased.** Playwright transpiles your \`.ts\` files to JavaScript on the fly and does **not type-check them**. A type error does not stop \`npx playwright test\`; only \`tsc --noEmit\` (or your IDE) reports it. So every guarantee below is a *compile-time* guarantee, unless it is stated as a runtime one.

## let, const, var: scope, hoisting and the temporal dead zone

| | \`var\` | \`let\` | \`const\` |
|---|---|---|---|
| Scope | function | block \`{ }\` | block \`{ }\` |
| Hoisted | yes, initialised to \`undefined\` | yes, but **uninitialised** (TDZ) | yes, uninitialised (TDZ) |
| Re-assign | yes | yes | no |
| Re-declare in same scope | yes (silently) | error | error |

**How it works internally.** When the engine enters a scope it creates bindings for *all* declarations in it before running any line. \`var\` bindings get \`undefined\` immediately. \`let\`/\`const\` bindings exist but are uninitialised until the declaration line runs. Touching them earlier throws \`ReferenceError: Cannot access 'x' before initialization\`. That window is the **temporal dead zone**.

The classic interview bug is a closure in a loop:

\`\`\`ts
const handlers: Array<() => number> = [];
for (var i = 0; i < 3; i++) handlers.push(() => i);
handlers.map((h) => h());          // [3, 3, 3]: one function-scoped i, shared

const fixed: Array<() => number> = [];
for (let j = 0; j < 3; j++) fixed.push(() => j);
fixed.map((h) => h());             // [0, 1, 2]: a fresh j binding per iteration
\`\`\`

In a test suite the TDZ shows up when a module-level \`const\` is used by a helper that runs during import (for example a config object read in a circular import): the error says *before initialization* and points to a line that looks fine. The cause is the import order, not the line.

### const is not immutable

\`const\` freezes the **binding**, not the value. \`const user = { name: 'Asha' }; user.name = 'Lars';\` is legal. Three tools give you real read-only data, with different strength:

\`\`\`ts
const SORTS = ['az', 'za', 'lohi', 'hilo'] as const;  // readonly ['az','za','lohi','hilo'] (compile time)
type SortOption = (typeof SORTS)[number];               // 'az' | 'za' | 'lohi' | 'hilo'

const USERS = Object.freeze({ standard: 'standard_user', locked: 'locked_out_user' }); // runtime, shallow

interface Env { readonly baseURL: string }              // compile time, per property
\`\`\`

\`as const\` does two things: it makes everything \`readonly\` and keeps **literal types** (\`'az'\`, not \`string\`). That second part is why \`(typeof SORTS)[number]\` produces a union you can use as a parameter type: one array is both the test data and the type. \`Object.freeze\` is the only one that holds at runtime, and it is shallow.

## Data types that matter in a framework

### Primitives, arrays and tuples

TypeScript primitives are \`string\`, \`number\` (one IEEE double, so \`0.1 + 0.2 !== 0.3\`: compare prices in cents or with \`toBeCloseTo\`), \`bigint\`, \`boolean\`, \`symbol\`, \`null\`, \`undefined\`. Arrays are \`T[]\` or \`Array<T>\`; \`readonly T[]\` removes \`push\`/\`splice\` from the type. A **tuple** is an array with a fixed length and a type per position, ideal for parameterised tests:

\`\`\`ts
const loginCases: ReadonlyArray<readonly [username: string, error: string]> = [
  ['locked_out_user', 'Error: Sorry, this user has been locked out.'],
  ['', 'Error: Username is required'],
];
for (const [username, error] of loginCases) { /* test(...) per row */ }
\`\`\`

### any vs unknown vs never

| Type | Meaning | What the compiler lets you do | Use in tests |
|---|---|---|---|
| \`any\` | "stop checking" | everything; it also **spreads** into whatever it touches | almost never; \`noImplicitAny\` blocks the implicit kind |
| \`unknown\` | "some value, not yet checked" | nothing until you narrow it | JSON bodies, \`catch (e)\` values, \`page.evaluate\` results |
| \`never\` | "cannot happen" | it is assignable to everything, nothing is assignable to it | exhaustiveness checks, functions that always throw |

\`never\` earns its place in exhaustive \`switch\` statements: add a new value to the union and the build breaks at every switch that forgot it.

\`\`\`ts
type Role = 'CUSTOMER' | 'SELLER' | 'ADMIN';

function landingPath(role: Role): string {
  switch (role) {
    case 'CUSTOMER': return 'inventory.html';
    case 'SELLER':   return 'form.html';
    case 'ADMIN':    return 'table.html';
    default: {
      const unreachable: never = role;   // compile error here if a Role is not handled
      throw new Error(\`Unhandled role \${unreachable}\`);
    }
  }
}
\`\`\`

### Literal types, unions and narrowing

Narrowing is how the compiler shrinks a union inside a branch. The guards you will use:

| Guard | Example | Narrows |
|---|---|---|
| \`typeof\` | \`typeof v === 'string'\` | primitives |
| \`instanceof\` | \`e instanceof Error\` | classes (runtime prototype check) |
| \`in\` | \`'error' in body\` | object shapes |
| equality / discriminant | \`res.kind === 'ok'\` | discriminated unions |
| user-defined guard | \`function isApiError(x: unknown): x is ApiError\` | anything you can check |
| assertion function | \`function assertDefined<T>(v: T): asserts v is NonNullable<T>\` | the rest of the scope |

The ShopEasy API returns either a resource or \`{ error: { code, message, details? } }\`. A user-defined guard turns an \`unknown\` body into a typed one:

\`\`\`ts
export interface ApiError {
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
}

export function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && 'error' in body
    && typeof (body as { error: unknown }).error === 'object';
}
\`\`\`

The guard is only as honest as its body: \`x is ApiError\` is a promise you make to the compiler, and it is not verified.

### Optional chaining and nullish coalescing

\`a?.b\` short-circuits to \`undefined\` when \`a\` is \`null\`/\`undefined\`. \`a ?? b\` falls back only on \`null\`/\`undefined\`, whereas \`a || b\` falls back on **any falsy** value: \`0\`, \`''\`, \`false\`.

\`\`\`ts
const workers = Number(process.env.WORKERS) || 4;     // WORKERS=0 silently becomes 4
const retries = process.env.CI ? 2 : 0;
const timeout = config.timeout ?? 30_000;              // timeout: 0 (no limit) is kept
const firstDetail = body.error.details?.[0]?.field;    // string | undefined
\`\`\`

\`textContent()\` returns \`string | null\`; \`(await loc.textContent())?.trim() ?? ''\` is the idiomatic, null-safe read. Better still, assert on the locator with \`toHaveText\` and skip the read.

## type vs interface

Both describe object shapes and both are erased. The differences are real but narrow:

| | \`interface\` | \`type\` alias |
|---|---|---|
| Object shapes | yes | yes |
| Unions, tuples, primitives, mapped and conditional types | no | yes |
| Declaration merging (two declarations combine) | yes | no (duplicate identifier) |
| Extending | \`extends\` (errors on conflicting members) | \`&\` intersection (conflicts become \`never\` silently) |
| \`implements\` by a class | yes | yes, if it is an object type |
| Error messages and IDE hover | shows the name | sometimes expands the whole structure |

Declaration merging is the one feature you genuinely need from \`interface\`: it is how you **augment** a library type, for example adding a custom matcher's signature to Playwright's \`Matchers\` or a field to a global \`Window\`.

**Recommendation.** I would recommend \`interface\` for object shapes that other code extends or implements (page-object contracts, DTOs, fixture types) and \`type\` for everything an interface cannot express: unions, tuples, derived types such as \`Pick<Product, 'id' | 'name'>\`. The trade-off is minor; what matters is that the team applies one rule consistently and enforces it with the \`@typescript-eslint/consistent-type-definitions\` lint rule, so reviews do not argue about it.

## Enums vs string-literal unions vs as const objects

\`\`\`ts
// 1. enum: emits a real JavaScript object
export enum SortOrder { NameAsc = 'az', NameDesc = 'za', PriceLowHigh = 'lohi', PriceHighLow = 'hilo' }

// 2. string-literal union: zero runtime code
export type SortValue = 'az' | 'za' | 'lohi' | 'hilo';

// 3. as const object: a runtime object plus a derived union
export const Sort = { NameAsc: 'az', NameDesc: 'za', PriceLowHigh: 'lohi', PriceHighLow: 'hilo' } as const;
export type Sort = (typeof Sort)[keyof typeof Sort];   // 'az' | 'za' | 'lohi' | 'hilo'
\`\`\`

| | enum | literal union | \`as const\` object |
|---|---|---|---|
| How it works | compiler emits an object (numeric enums also get a reverse mapping) | type only, erased | plain object; type derived from it |
| Runtime value to iterate | yes (\`Object.values\`, but numeric enums include the reverse keys) | no | yes |
| Accepts a plain string | **no** for string enums: \`'az'\` is not assignable to \`SortOrder\` | yes | yes |
| Readability at call site | \`SortOrder.PriceLowHigh\` | \`'lohi'\` | \`Sort.PriceLowHigh\` or \`'lohi'\` |
| Pitfalls | nominal-ish typing, \`const enum\` breaks under per-file transpilers | no list to loop over | slightly more syntax |
| When to use | legacy code, team convention | small, fixed sets in signatures | values you both iterate and type-check |

String enums are the one nominal corner of TypeScript: test data loaded from JSON (\`{"sort":"lohi"}\`) does not type-check against them without a cast. And \`const enum\` is inlined by \`tsc\`, but per-file transpilers (Babel, esbuild, the kind of transform Playwright uses) cannot inline one imported from another file; \`isolatedModules: true\` reports it. **Recommended:** the \`as const\` object. It gives you named constants, a loopable list for data-driven tests, and plain strings that match API and JSON data.

\`\`\`ts
import { test, expect } from '@playwright/test';
import { Sort } from '../data/sort';

for (const value of Object.values(Sort)) {
  test(\`inventory sorts by \${value}\`, async ({ page }) => {
    await page.goto('inventory.html');
    await page.getByTestId('product-sort').selectOption(value);
    await expect(page.getByTestId('product-sort')).toHaveValue(value);
  });
}
\`\`\`

## Classes, access modifiers and #private

| Modifier | TypeScript meaning | Enforced |
|---|---|---|
| \`public\` (default) | accessible everywhere | n/a |
| \`protected\` | the class and subclasses | compile time only |
| \`private\` | the declaring class only | compile time only; \`obj['field']\` still compiles and works |
| \`readonly\` | assign only in the declaration or constructor | compile time only |
| \`#field\` | ECMAScript private field | **runtime**: invisible to \`Object.keys\`, \`JSON.stringify\`, subclasses and bracket access |

**Java contrast.** Java has no "compile-time only" modifier: \`private\` is enforced by the JVM and only reflection with \`setAccessible\` breaks it. Java also has package-private (the default); TypeScript's closest equivalent is simply not exporting something from the module. TypeScript \`protected\` does not grant package access as Java's does.

When does \`#private\` matter in automation? Rarely, but in one place clearly: objects that get serialised or logged. A \`private apiToken\` is printed by \`console.log(client)\` and ends up in an attached report; \`#apiToken\` is not enumerable. For page objects, TypeScript \`private\`/\`protected readonly\` is enough and works with parameter properties, which \`#\` fields do not support.

## Inheritance, abstract classes and composition

An \`abstract\` class cannot be instantiated and can declare \`abstract\` members that subclasses must implement. That suits a \`BasePage\` that owns the *template* of "open a page and prove it is loaded":

\`\`\`ts
// pages/base-page.ts
import { type Locator, type Page, expect } from '@playwright/test';
import { Header } from './components/header';

export abstract class BasePage {
  readonly header: Header;                       // composition: a component, not a parent class

  constructor(protected readonly page: Page) {
    this.header = new Header(page.locator('.site-header'));
  }

  protected abstract readonly path: string;      // each page says where it lives
  protected abstract readonly readyMarker: Locator;

  async open(): Promise<this> {                  // polymorphic this: returns the subclass type
    await this.page.goto(this.path);
    await this.waitUntilReady();
    return this;
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.readyMarker).toBeVisible();
  }
}

// pages/inventory-page.ts
import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

export class InventoryPage extends BasePage {
  protected readonly path = 'inventory.html';
  protected readonly readyMarker: Locator;
  readonly sort: Locator;

  constructor(page: Page) {
    super(page);                                 // must run before any use of this
    this.readyMarker = page.getByTestId('inventory-list');
    this.sort = page.getByTestId('product-sort');
  }

  override async waitUntilReady(): Promise<void> {
    await super.waitUntilReady();                // keep the base behaviour, then add to it
    await expect(this.page.getByTestId('title')).toHaveText('Products');
  }

  async addToCart(slug: string): Promise<void> {
    await this.page.getByTestId(\`add-to-cart-\${slug}\`).click();
  }
}
\`\`\`

Step by step:

- \`protected readonly page\` is a parameter property: subclasses can use \`this.page\`, tests cannot.
- \`protected abstract readonly path\` forces every concrete page to declare its URL; forgetting it is a compile error, not a runtime \`undefined\`.
- \`Promise<this>\` is the **polymorphic this type**: \`await new InventoryPage(page).open()\` is typed as \`InventoryPage\`, so you can call \`addToCart\` on the result without a cast.
- \`super(page)\` must come first. Reading \`this\` before \`super()\` is a compile error and a runtime \`ReferenceError\`.
- \`override\` (with \`noImplicitOverride\` in tsconfig) makes the intent explicit; if the base method is renamed, the subclass fails to compile instead of silently becoming a new, never-called method.
- Field initialisation order: base constructor runs, then the subclass field initialisers, then the rest of the subclass constructor. That is why \`readyMarker\` is not read in the base constructor: it does not exist yet at that point. This is a common source of \`undefined\` locators in deep hierarchies.

### Composition vs inheritance for page objects

| | Deep inheritance (\`BasePage → AuthenticatedPage → ShopPage → InventoryPage\`) | Composition (components passed in or created) |
|---|---|---|
| How it works | behaviour inherited through the chain | page object *has* a \`Header\`, \`ProductCard\`, \`CartBadge\` |
| Advantages | little wiring code | each component reusable on any page; small, focused classes |
| Disadvantages | fragile base class; every page inherits methods it does not need | a few more constructors |
| Maintainability | one change in the base ripples everywhere | change is local to the component |
| Scalability | poor beyond 2 levels | good: new pages assemble existing parts |
| When to use | one thin \`BasePage\` for truly universal behaviour | everything that appears on some pages but not all |

**Recommended:** at most one level of inheritance (a thin \`BasePage\`) and composition for the rest. That is the Single Responsibility and Interface Segregation principles applied to page objects, and it is the answer interviewers want when they ask "what is wrong with our 900-line BasePage?".

## Generics: typed API helpers and data builders

Generics let one helper keep the caller's type instead of falling back to \`any\`.

\`\`\`ts
// support/api.ts
import { type APIRequestContext, expect } from '@playwright/test';

export interface Product {
  id: number; slug: string; name: string; price: number;
  category: string; stock: number; description: string;
}
export interface Paged<T> { data: T[]; page: number; size: number; total: number; totalPages: number }

export async function getJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const response = await request.get(url);
  await expect(response, \`GET \${url}\`).toBeOK();
  return (await response.json()) as T;             // a cast, NOT a runtime check
}

export function byId<T extends { id: number }>(items: readonly T[], id: number): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(\`No item with id \${id}\`);
  return found;
}
\`\`\`

\`\`\`ts
// tests/api/catalogue.spec.ts
import { test, expect } from '@playwright/test';
import { getJson, byId, type Paged, type Product } from '../../support/api';

test('catalogue search returns typed products', async ({ request }) => {
  const result = await getJson<Paged<Product>>(request, 'http://localhost:5181/api/products?q=tee&sort=price_asc');
  expect(result.total).toBeGreaterThan(0);
  const first = byId(result.data, result.data[0].id);   // typed as Product, no cast
  expect(first.name.toLowerCase()).toContain('tee');
});
\`\`\`

- \`getJson<T>\` returns \`Promise<T>\`; the caller decides \`T\`. Inside, \`as T\` is an **unchecked cast**. If the API renames \`price\` to \`unitPrice\`, the test still compiles and \`first.price\` is \`undefined\` at runtime. For contract-level confidence, validate at the boundary with a schema (the API serves one at \`/api/schema/product\`; a validator such as Ajv or a library like zod turns it into a real runtime check).
- \`<T extends { id: number }>\` is a **constraint**: \`byId\` works for products, orders, users, anything with a numeric \`id\`, and still returns the precise type.

### Java generics vs TypeScript generics

\`\`\`java
// Java: nominal typing, erasure, but classes still exist at runtime
public <T> T getJson(String url, Class<T> type) {
    return given().get(url).then().statusCode(200).extract().as(type); // Jackson needs the Class<T> token
}
\`\`\`

Both languages erase generic parameters, but Java keeps classes at runtime, so Jackson can build a real \`Product\` instance from a \`Class<T>\` token, and \`instanceof Product\` works. TypeScript erases the **whole** type, including interfaces, so \`response.json()\` gives you a plain object and \`as T\` simply trusts you. TypeScript is also **structural**: any object with the right members *is* a \`Product\`, no \`implements\` needed. Java is **nominal**: only a declared \`Product\` is a \`Product\`.

### Utility types for test data builders

| Utility | Produces | Test-data use |
|---|---|---|
| \`Partial<T>\` | every property optional | override bag for a builder |
| \`Required<T>\` | every property required | "fully filled" fixtures |
| \`Pick<T, K>\` | only keys \`K\` | the fields a form actually shows |
| \`Omit<T, K>\` | all keys except \`K\` | request body without server-generated \`id\` |
| \`Record<K, V>\` | object with keys \`K\` and values \`V\` | users keyed by role, expected errors keyed by field |
| \`Readonly<T>\` | every property \`readonly\` (shallow) | shared seed data nobody should mutate |

\`\`\`ts
// data/builders.ts
export interface Customer { firstName: string; lastName: string; postalCode: string }
export interface OrderLine { productId: number; quantity: number }
export interface OrderRequest extends Customer { items?: OrderLine[] }

export type CheckoutForm = Pick<Customer, 'firstName' | 'lastName' | 'postalCode'>;
export type NewUser = Omit<{ id: number; username: string; password: string; email: string } & Customer, 'id'>;

const DEFAULT_CUSTOMER: Readonly<Customer> = { firstName: 'Asha', lastName: 'Rao', postalCode: '560001' };

export function buildOrder(overrides: Partial<OrderRequest> = {}): OrderRequest {
  return { ...DEFAULT_CUSTOMER, items: [{ productId: 1, quantity: 1 }], ...overrides };
}

export const checkoutErrors: Record<keyof CheckoutForm, string> = {
  firstName: 'Error: First Name is required',
  lastName: 'Error: Last Name is required',
  postalCode: 'Error: Postal Code is required',
};
\`\`\`

\`buildOrder({ postalCode: '' })\` reads as *"a valid order except the postal code"*, which is exactly what a negative test should say. \`Record<keyof CheckoutForm, string>\` means adding a field to \`CheckoutForm\` breaks the build until its error message is added: the type system keeps test data complete.

## Arrow functions, regular functions and this

A regular function gets \`this\` from **how it is called**; an arrow function captures \`this\` from **where it is defined**. Class methods are regular functions on the prototype, so passing one as a callback detaches it:

\`\`\`ts
export class AlertsPage {
  readonly messages: string[] = [];
  constructor(private readonly page: Page) {}

  private recordBroken(dialog: Dialog) { this.messages.push(dialog.message()); }   // this is undefined when detached
  private record = (dialog: Dialog) => { this.messages.push(dialog.message()); };   // arrow field: this is bound

  listen(): void {
    // this.page.on('dialog', this.recordBroken);   // TypeError: Cannot read properties of undefined (reading 'messages')
    this.page.on('dialog', this.record);            // works; also removable with page.off('dialog', this.record)
    // equivalent: this.page.on('dialog', (d) => this.recordBroken(d));
  }
}
\`\`\`

| Option | Advantages | Disadvantages | Use when |
|---|---|---|---|
| inline arrow \`(d) => this.m(d)\` | explicit at the call site | a new function each time; cannot be removed with \`off\` | one-off callbacks |
| arrow class field | bound once, removable | one copy per instance, not on the prototype, so \`super.record()\` cannot reach it | event handlers you add and remove |
| \`this.m.bind(this)\` in the constructor | method stays on the prototype | boilerplate, easy to forget | legacy style |

Inside a Playwright test you rarely see \`this\`. Cucumber step definitions are the exception: they need \`function\` so Cucumber can bind \`this\` to the World (see the *Cucumber with Playwright* lesson).

## Destructuring, spread and rest, and why fixtures need them

\`\`\`ts
const { firstName, ...rest } = buildOrder();         // rest = everything except firstName
const [cheapest, ...others] = prices;                 // array rest
const merged = { ...defaults, ...overrides };         // later spread wins; shallow copy only
function tag(...tags: string[]) { return tags.join(' '); }
\`\`\`

\`test('…', async ({ page, request }, testInfo) => {…})\` is an async arrow function whose first parameter is **destructured**. That is not only style: Playwright reads the parameter list of your function to learn **which fixtures you asked for**, and only sets up those. A test that destructures \`{ request }\` never launches a browser page. Write \`async (fixtures) => fixtures.page\` and Playwright fails with an error saying the first argument must use the object destructuring pattern. The same applies to your own fixtures in \`test.extend\`: \`async ({ page }, use) => { … }\`.

Spread is **shallow**. \`const copy = { ...seedUser }\` shares the nested \`address\` object, so a test that mutates \`copy.address.city\` mutates the seed for every later test in that worker. Use \`structuredClone(seedUser)\` (Node 17+) for a deep copy.

## Modules and imports

| | ES modules | CommonJS |
|---|---|---|
| Syntax | \`import\`/\`export\` | \`require\`/\`module.exports\` |
| Binding | live, read-only bindings, statically analysable | a copied value from a function call |
| Loading | asynchronous, top-level \`await\` allowed | synchronous |
| Chosen by | \`"type": "module"\` in package.json, or \`.mts\` | default for \`.ts\`/\`.js\` without it |

Playwright handles both. You write \`import\` syntax either way; whether it is emitted as ESM or CommonJS depends on \`package.json\` \`"type"\` and the tsconfig \`module\` setting. Mixing them (a CommonJS helper package that ships no ESM build, a JSON import) is where "\`require\` is not defined" or "Cannot use import statement outside a module" comes from.

- **Named exports** (\`export class LoginPage\`) are greppable, refactor-safe and auto-imported by the IDE under one name. **Default exports** let every importer invent a name. I would recommend named exports only, enforced by lint.
- **\`import type { Page } from '@playwright/test'\`** is erased entirely. It documents intent, avoids loading a module for types only and avoids circular-import side effects. With \`verbatimModuleSyntax\` (TypeScript 5.0+) the compiler requires it for type-only imports.
- **Barrel files** (\`pages/index.ts\` re-exporting every page) give short imports, but they load every module when you import one and are the most common cause of circular imports between page objects and fixtures. Keep barrels small and never import a barrel from inside the folder it re-exports.
- **Path aliases**: \`"paths": { "@pages/*": ["pages/*"] }\` plus \`baseUrl\` in tsconfig give \`import { LoginPage } from '@pages/login-page'\`. Playwright's loader honours tsconfig \`paths\`. The trade-off: every *other* tool (ESLint import resolver, a plain \`node\` script, a Cucumber runner using \`ts-node\`) needs its own alias configuration, so aliases add a coupling you must document.

## tsconfig settings that matter for a test project

\`\`\`json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": { "@pages/*": ["pages/*"], "@data/*": ["data/*"] }
  },
  "include": ["tests", "pages", "fixtures", "data", "support", "playwright.config.ts"]
}
\`\`\`

| Setting | Why it matters for tests |
|---|---|
| \`strict\` | umbrella for \`noImplicitAny\`, \`strictNullChecks\`, \`strictPropertyInitialization\` and more. Without \`strictNullChecks\`, \`textContent()\` looks like \`string\` and you get \`Cannot read properties of null\` at runtime |
| \`noImplicitAny\` | untyped parameters (\`(row) => row.name\`) become errors instead of silent \`any\` |
| \`target\` | language level of emitted code; Node 18+ supports ES2022 natively, so a low target only adds down-levelling |
| \`module\` / \`moduleResolution\` | how imports are resolved: \`NodeNext\` follows Node's rules (package \`exports\`, ESM/CJS); \`Bundler\` (TypeScript 5.0+) is looser and suits projects that never run raw in Node |
| \`noUncheckedIndexedAccess\` | \`rows[0]\` is \`Row | undefined\`, forcing the check that empty tables need |
| \`noEmit\` | tsconfig is for type-checking; Playwright transpiles itself |

Because Playwright does not type-check, add \`"typecheck": "tsc --noEmit"\` to package.json and run it in CI before the tests. A test project without that step has types that nobody enforces.

## Common mistakes and debugging

- **"It compiles, so the API response is fine."** \`as T\` checked nothing. Symptom: \`expected undefined to be 29.99\`. Debug by logging \`Object.keys(body)\`; fix with schema validation at the boundary.
- **\`TypeError: Cannot read properties of undefined (reading 'click')\`** in a page object: a method passed as a callback lost \`this\`, or a field was read in a base constructor before the subclass initialised it. Set a breakpoint and inspect \`this\`.
- **Type errors only in CI**: the IDE used a different tsconfig (or none) than \`tsc\`. Make sure \`include\` covers every folder and run \`npx tsc --noEmit -p .\` locally.
- **\`ReferenceError: Cannot access 'X' before initialization\`**: circular import, usually through a barrel. Find it with \`npx madge --circular\` and break the cycle.

## Best practices for experienced engineers

- \`strict\` on from day one; \`tsc --noEmit\` and \`@typescript-eslint\` with type information in CI.
- No \`any\` in shared code; \`unknown\` plus a guard at boundaries (API bodies, \`page.evaluate\`, \`catch\`).
- One source of truth for value sets: \`as const\` objects, types derived from them.
- Thin \`BasePage\`, components by composition, \`override\` keyword enforced.
- Builders with \`Partial\` overrides for test data; never mutate shared seed objects.
- Named exports, \`import type\`, small barrels, documented path aliases.

## Interview questions

### Q: What is the difference between let, const and var, and what is the temporal dead zone?
**Short answer (30–60 s):** \`var\` is function-scoped and hoisted with \`undefined\`; \`let\` and \`const\` are block-scoped and hoisted but uninitialised, so using them before the declaration throws. That window is the TDZ. \`const\` prevents re-assignment, not mutation.

**Detailed answer:** On entering a scope the engine creates all bindings first. \`var\` is initialised immediately, which is why the old \`for (var i…)\` closure bug prints the last value. \`let\` creates a new binding per loop iteration. For immutability I use \`as const\` or \`Readonly<T>\` at compile time and \`Object.freeze\` when runtime protection matters, knowing it is shallow. In test code I default to \`const\` and treat a \`let\` as a signal that state changes, which reviewers should look at.

### Q: any vs unknown vs never?
**Short answer (30–60 s):** \`any\` turns checking off and spreads; \`unknown\` is a value you must narrow before use; \`never\` is a type with no values, used for exhaustive checks and functions that always throw.

**Detailed answer:** I type every external input as \`unknown\` (JSON, \`catch\` variables, \`page.evaluate\` results) and narrow it with a guard or a schema validator. \`never\` gives compile-time exhaustiveness: a \`default\` branch assigning the value to \`never\` breaks the build when someone adds a union member. I allow \`any\` only behind an eslint-disable comment with a reason, so it is visible in review.

### Q: type or interface — which do you use?
**Short answer (30–60 s):** \`interface\` for object contracts that are extended or implemented and for augmenting library types (declaration merging); \`type\` for unions, tuples and derived types. Then apply it consistently with a lint rule.

**Detailed answer:** Interfaces report conflicts on \`extends\`, while intersections quietly produce \`never\` members, so interfaces give better errors for hierarchies like DTOs. Only interfaces merge, which is how you add a custom matcher's signature to Playwright's types. Types are required for \`'az' | 'za'\`, \`Pick<…>\`, mapped and conditional types. Performance-wise, interfaces are cached by name and can check faster in very large codebases, but for a test project consistency matters more than speed.

### Q: Enums, union types or as const objects for something like sort options?
**Short answer (30–60 s):** I prefer an \`as const\` object with a derived union: it is a runtime list I can loop over for data-driven tests, and it accepts plain strings from JSON. String enums reject plain strings, and \`const enum\` breaks under per-file transpilers.

**Detailed answer:** An enum emits an object; numeric enums add reverse mappings, so \`Object.values\` returns names and numbers. String enums behave nominally: \`'lohi'\` from a JSON fixture is not a \`SortOrder\` without a cast. A literal union is zero-cost but gives no runtime list. \`const Sort = {…} as const; type Sort = (typeof Sort)[keyof typeof Sort]\` gives named access, a loopable list and structural compatibility with strings.

### Q: TypeScript private vs #private?
**Short answer (30–60 s):** \`private\` is checked by the compiler and erased, so it exists at runtime and bracket access reaches it. \`#field\` is a JavaScript private field enforced by the runtime: not enumerable, not serialised, not reachable from subclasses.

**Detailed answer:** In Java, \`private\` is enforced by the JVM. In TypeScript only \`#\` gives that. For page objects I use \`private\`/\`protected readonly\` because parameter properties are concise and nothing attacks a page object. For anything holding secrets that might be logged or attached to a report, such as an API client with a token, I use \`#token\`, because \`JSON.stringify\` and \`console.log\` will not expose it.

### Q: How would you write a typed API helper, and what does the type actually guarantee?
**Short answer (30–60 s):** A generic \`getJson<T>(request, url): Promise<T>\` that asserts \`toBeOK()\` and returns \`await response.json() as T\`. The type guarantees nothing at runtime; it is a cast. For contract confidence I validate the body against a schema.

**Detailed answer:**

\`\`\`ts
export async function getJson<T>(request: APIRequestContext, url: string, validate?: (b: unknown) => b is T): Promise<T> {
  const res = await request.get(url);
  await expect(res).toBeOK();
  const body: unknown = await res.json();
  if (validate && !validate(body)) throw new Error(\`Unexpected body from \${url}\`);
  return body as T;
}
\`\`\`

Java with Jackson materialises a real class from a \`Class<T>\` token; TypeScript erases everything, so the validator is the only runtime check. I keep the cast in one helper so it is not scattered across tests.

### Q: Why must a Playwright test use async ({ page }) => instead of async (fixtures) =>?
**Short answer (30–60 s):** Playwright inspects the function's first parameter to find which fixtures you requested, and only creates those. That requires object destructuring; otherwise it throws.

**Detailed answer:** Fixtures are lazy: \`{ request }\` alone never launches a page, and worker-scoped fixtures are only started if some test asks for them. Playwright discovers the requested names by parsing the destructuring pattern of the function. A consequence: wrapping test functions in a higher-order helper that hides the destructuring breaks fixture detection, so such helpers must pass through a function with the destructuring visible.

### Q: Inheritance or composition for page objects?
**Short answer (30–60 s):** One thin abstract \`BasePage\` for universal behaviour (open, wait until ready), and composition for components like the header, product card or cart badge.

**Detailed answer:** Deep hierarchies create a fragile base class: every page inherits methods it does not need and a base change ripples everywhere. Components that take a root \`Locator\` are reusable on any page and testable alone. I use \`abstract\` members to force each page to declare its \`path\` and ready marker, \`Promise<this>\` so \`open()\` returns the subclass type, and \`noImplicitOverride\` so overrides are explicit.

## Scenario-based questions

**A test passes locally but in CI the order total is \`NaN\`.** The page object reads \`textContent()\` and does \`Number(text.replace('Total: $', ''))\`; the project has \`strict: false\`, so \`string | null\` was never surfaced. I would turn on \`strictNullChecks\`, fix the read to assert on the locator with \`toHaveText(/\\$\\d+\\.\\d{2}/)\`, or parse defensively with \`?? ''\` and an explicit check, and add \`tsc --noEmit\` to CI so the class of bug cannot return.

**The team's \`BasePage\` is 900 lines with 6 levels of inheritance and every change breaks unrelated tests.** I would not rewrite it in one go. First, extract components (\`Header\`, \`ProductCard\`) behind the existing methods so callers do not change; then move pages to depend on the components; then delete the levels that became empty. I would agree a rule with the team: one level of inheritance, \`override\` required, components for everything else, and track it in review.

**A contract change on \`/api/products\` (\`price\` became a string) did not fail any API test.** The tests used \`getJson<Product>\` and compared prices with \`toBeGreaterThan\`, which coerced. The types never ran. I would add schema validation in the helper (the API serves its JSON Schema), make it fail with the field path, and explain in the review that TypeScript types are a design-time tool, not a contract test.

## Tricky follow-ups

- **Does \`readonly string[]\` stop \`push\` at runtime?** No. It removes the method from the type only; \`Object.freeze\` stops it at runtime.
- **Is \`interface A extends B\` the same as \`type A = B & {…}\`?** Almost, but conflicting members error with \`extends\` and silently become \`never\` with \`&\`.
- **Can you \`instanceof\` an interface?** No: interfaces do not exist at runtime. Use a type guard or a class.
- **Does \`Readonly<Customer>\` protect \`customer.address.city\`?** No, it is shallow. Write a recursive \`DeepReadonly\` type or freeze deeply.
- **Why does \`satisfies\` (TypeScript 4.9+) help with config objects?** \`const users = {…} satisfies Record<string, User>\` checks the shape but keeps the precise literal keys, so \`users.standard\` autocompletes and a typo is an error; a type annotation would widen the keys to \`string\`.`,
  keyPoints: [
    'Types are erased and Playwright does not type-check: run tsc --noEmit in CI or the types are decoration.',
    'let/const are block-scoped with a temporal dead zone; const freezes the binding, not the value. as const keeps literal types and readonly.',
    'Type external data as unknown and narrow it with guards or schema validation; getJson<T> with as T is a cast, not a check.',
    'interface for extendable object contracts and augmentation; type for unions, tuples and derived types. Pick one rule and lint it.',
    'Prefer as const objects over enums: named constants, a loopable list for data-driven tests, plain strings from JSON.',
    'TS private/protected/readonly are compile time only; #private is enforced at runtime.',
    'One thin abstract BasePage plus composition; Promise<this>, abstract members and override keep hierarchies honest.',
    'Playwright reads the destructured first parameter to decide which fixtures to set up, so async ({ page }) => is required.',
  ],
  mistakes: [
    'Trusting response.json() as T as if it validated the contract. Fix: keep the cast in one helper, validate the body against the JSON Schema at the boundary, and log Object.keys(body) when a field is unexpectedly undefined.',
    'Passing a class method as a callback (page.on(\'dialog\', this.handle)) and getting "Cannot read properties of undefined". Fix: an arrow class field or an inline arrow; inspect this at a breakpoint to confirm.',
    'Using || for defaults on numeric config: WORKERS=0 or timeout: 0 silently becomes the fallback. Fix: ?? for null/undefined-only defaults, and parse env vars explicitly.',
    'Shallow-copying seed data with spread and then mutating a nested object, which leaks state into later tests in the same worker. Fix: builders that return fresh objects, or structuredClone.',
    'Barrel files that import each other, producing "Cannot access X before initialization". Fix: find cycles with npx madge --circular, import directly from the module inside the folder, keep barrels for outside consumers only.',
    'Relying on IDE squiggles while CI runs only npx playwright test. Fix: a typecheck script (tsc --noEmit with strict) as the first CI step, with include covering every folder.',
  ],
  tryIt: `Build a small typed layer against the ShopEasy API (\`http://localhost:5181\`) and the shop (\`http://localhost:5180/practice-site/\`):
1. Write \`interface Product\` and \`interface Paged<T>\` matching \`GET /api/products\`, and a generic \`getJson<T>()\` helper that asserts \`toBeOK()\`.
2. Add a user-defined guard \`isApiError(body: unknown): body is ApiError\` and use it on \`GET /api/products/999\` (expect \`PRODUCT_NOT_FOUND\`).
3. Create \`const Sort = { … } as const\` with the inventory page's sort values (read them from the \`product-sort\` select), derive \`type Sort\`, and generate one test per value with \`for (const value of Object.values(Sort))\`.
4. Write an abstract \`BasePage\` with \`abstract path\` and \`abstract readyMarker\`, and an \`InventoryPage\` whose \`open()\` returns \`Promise<this>\`.
5. Run \`npx tsc --noEmit\` with \`strict\` and \`noUncheckedIndexedAccess\` on, and fix every error without using \`any\`.`,
  problems: ['pw-001', 'pw-002', 'pw-009', 'pw-010'],
}
