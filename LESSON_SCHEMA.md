# Topic lessons — schema

Problems test a skill; lessons **teach** it first. A learner opens a problem, sees the **Learn** tab, reads the
lesson(s) for that topic, then solves. Lessons are shared: one lesson ("Explicit waits") serves every problem that
needs it, and the Lessons page lists them all as a course.

Audience: a manual QA engineer with ~6 years of experience — excellent at testing, new to coding. Teach like a patient
senior SDET: start from what they already know as a manual tester, then the idea, then the code, line by line.
Never assume they know a Java/Selenium term you haven't explained or that an earlier lesson in the same section
covered (say "see the *X* lesson" when relying on one).

One file per lesson: `src/lessons/<category>/<slug>.js`, default export:

```js
export default {
  slug: 'explicit-waits',          // unique across ALL lessons, kebab-case, = file name
  category: 'selenium',            // folder name = problem category it belongs to
  order: 6,                        // position inside its category (1, 2, 3 … learning order)
  title: 'Explicit waits',
  minutes: 6,                      // honest reading time, 3–10
  summary: 'One sentence: what you will be able to do after this lesson.',
  manualAnalogy: `markdown — 2–4 sentences linking it to manual testing ("When you test by hand you…")`,
  body: `markdown — the lesson itself:
    ## headings for each step of the idea
    short paragraphs, small code blocks (\`\`\`java / \`\`\`gherkin / \`\`\`xml / \`\`\`css …) with the important lines
    explained right after the block, a table where a comparison helps. 400–900 words.`,
  keyPoints: ['3–6 short takeaways'],
  mistakes: ['2–4 beginner mistakes with the fix'],
  tryIt: `markdown — optional: a 2-minute thing to try (e.g. on the practice site http://localhost:5180/practice-site/…)`,
  problems: ['sel-006', 'sel-007'], // EVERY problem id this lesson prepares for (see below)
}
```

Rules
* Every problem in a category must be listed in **at least one** lesson's `problems` (1–2 lessons per problem is
  ideal). Read each problem file to decide which topics it needs.
* A lesson should serve 1–6 problems. Aim for 5–8 lessons per category.
* Examples must use the ShopEasy practice site's real ids where they touch the site (read `public/practice-site/*.html`
  and `shop.js`), Java 17, Selenium 4, Cucumber 7, TestNG 7.
* Teach the concept — **do not give away the problem's exact solution**. Use a different page/element/data than the
  problem does where you can.
* Markdown in template literals: escape backticks as \` and `${` as \${.
* Validate with `node scripts/check-content.mjs` (it checks lessons too).
