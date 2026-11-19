export default {
  id: 'pw-001',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Typed test data: interfaces, union types and arrow functions',
  level: 'BEGINNER',
  tags: ['typescript', 'interfaces', 'test-data'],
  estMinutes: 15,
  scenario: `The team is migrating the Java/Selenium ShopEasy suite to Playwright + TypeScript. Step one is the test data: the Java
\`TestUsers\` class becomes \`src/data/users.ts\`. A teammate already ported it as plain JavaScript — no types, \`any\` everywhere —
and last week a typo (\`pasword\`) slipped through review and broke 12 tests at runtime. TypeScript would have caught it while typing.`,
  description: `Rewrite \`users.ts\` with proper types.

**Acceptance**
- A **union type** \`UserRole\` that only allows \`'standard'\` or \`'locked'\`.
- An exported **interface** \`User\` with \`username: string\`, \`password: string\`, \`role: UserRole\` and an **optional** \`expectedError\`.
- \`users\` is typed as \`User[]\` and holds \`standard_user\` and \`locked_out_user\` (password \`secret_sauce\`; the locked user expects
  \`Sorry, this user has been locked out.\`).
- \`findUser\` is an **arrow function** with a typed parameter and return type: it returns the user for a role, or throws a clear \`Error\`.
- No \`any\` anywhere.`,
  starterCode: `// src/data/users.ts — ported from TestUsers.java, but untyped

export const users: any = [
  { username: 'standard_user', password: 'secret_sauce', role: 'standard' },
  { username: 'locked_out_user', pasword: 'secret_sauce', role: 'locked', expectedError: 'Sorry, this user has been locked out.' },
];

export function findUser(role: any) {
  // TODO: return the matching user, throw if there is none
  for (const u of users) {
    if (u.role == role) return u;
  }
}
`,
  solution: `// src/data/users.ts

export type UserRole = 'standard' | 'locked';

export interface User {
  username: string;
  password: string;
  role: UserRole;
  expectedError?: string; // only negative users have one
}

export const users: User[] = [
  { username: 'standard_user', password: 'secret_sauce', role: 'standard' },
  {
    username: 'locked_out_user',
    password: 'secret_sauce',
    role: 'locked',
    expectedError: 'Sorry, this user has been locked out.',
  },
];

export const findUser = (role: UserRole): User => {
  const user = users.find((u) => u.role === role);
  if (!user) {
    throw new Error('No test user configured for role: ' + role);
  }
  return user;
};
`,
  checks: [
    { label: 'Union type for roles', pattern: "type\\s+UserRole\\s*=\\s*['\"]\\w+['\"]\\s*\\|\\s*['\"]\\w+['\"]", hint: "export type UserRole = 'standard' | 'locked';" },
    { label: 'Interface User with typed fields', pattern: 'interface\\s+User\\s*\\{[^}]*username\\s*:\\s*string[^}]*password\\s*:\\s*string', flags: 'ms', hint: 'export interface User { username: string; password: string; ... }' },
    { label: 'Optional expectedError', pattern: 'expectedError\\?\\s*:\\s*string', hint: 'expectedError?: string — the ? makes it optional' },
    { label: 'Array typed as User[]', pattern: 'users\\s*:\\s*(User\\[\\]|Array<User>)', hint: 'export const users: User[] = [...]' },
    { label: 'Arrow function with typed parameter and return type', pattern: 'findUser\\s*=\\s*\\(\\s*\\w+\\s*:\\s*UserRole\\s*\\)\\s*:\\s*User\\s*=>', hint: 'export const findUser = (role: UserRole): User => { ... }' },
    { label: 'No any', pattern: ':\\s*any\\b', mustNot: true, hint: 'any switches the type checker off — use the User interface.' },
  ],
  hints: [
    'An interface describes the shape of an object; a type alias with | describes a fixed set of allowed values.',
    'Add ? after a property name to make it optional: expectedError?: string.',
    'Array.find returns User | undefined — handle undefined (throw) so the return type can be plain User.',
  ],
  explanation: `With \`users: User[]\` the compiler checks every object literal against the interface, so \`pasword\` is a red squiggle in VS Code
instead of a runtime failure in CI. The union \`'standard' | 'locked'\` works like a Java enum but costs nothing: \`findUser('admin')\` will not compile.

\`users.find(...)\` returns \`User | undefined\` — TypeScript forces you to deal with "not found". Throwing a descriptive error is better
than returning \`undefined\` and getting *"Cannot read properties of undefined (reading 'username')"* three steps later.

Reviewers look for: no \`any\`, optional fields marked with \`?\`, \`===\` instead of \`==\`, and exported types so page objects and steps can reuse them.`,
  mistakes: [
    'Using any "to get it compiling" — you lose every benefit of TypeScript.',
    'Typing the interface but leaving the array untyped — a literal array is then inferred loosely and typos in keys are only caught partially.',
    'Using == instead of === — JavaScript type coercion surprises (0 == "" is true).',
    'Making every property optional so that nothing is ever an error.',
  ],
  interview: [
    { q: 'interface vs type in TypeScript?', a: 'Both describe shapes. Interfaces can be extended and merged and are the convention for object shapes; type aliases can also express unions, intersections and primitives. In test code: interface for data objects, type for unions like roles or environments.' },
    { q: 'How is TypeScript different from Java at runtime?', a: 'Types exist only at compile time and are erased; the output is JavaScript. There is no runtime type checking, so data coming from JSON or APIs still needs validation.' },
    { q: 'Why do you avoid any?', a: 'any disables type checking for that value and everything derived from it. unknown is the safe alternative when the type is genuinely not known — it forces a check before use.' },
  ],
}
