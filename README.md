# QA Automation Lab

A study app that takes an experienced **manual QA** engineer to **automation**: Java, Selenium WebDriver,
Page Object Model, Cucumber BDD, TestNG/Maven/CI — taught through real project situations.
Same look and feel as the Mule Practice Lab (DataWeave) app.

## Run it

```bash
npm install
npm run dev        # http://localhost:5180
```

## What's inside

| Area | What the learner does |
| --- | --- |
| **Learning Path** | 7-stage, 12-week roadmap; each stage pulls problems by section + level |
| **Core Java for Testers** | Java exercises framed as automation tasks, rule-checked in the browser |
| **Locator Lab** | Write CSS / XPath against the practice site; matches are highlighted live and graded |
| **Selenium WebDriver** | Waits, dropdowns, alerts, frames, windows, Actions, JS executor, tables… |
| **Page Object Model** | Page classes, BasePage, components, DriverFactory, refactoring |
| **Cucumber BDD** | Manual test case → Gherkin, step definitions, DataTables, hooks, runners |
| **Framework & CI** | TestNG, Maven, config, DataProvider, listeners, reports, Jenkins / GitHub Actions |
| **Debugging Clinic** | Failing tests with real stack traces — diagnose and fix (the "real-time" experience) |
| **Interview Ready** | Interview quizzes and live-coding rounds with model answers |
| **Practice Site** | `public/practice-site/` — the "ShopEasy" web shop to automate with real Selenium |
| **Framework Blueprint** | A complete reference framework, file by file |
| Flashcards, Cheat Sheets, Revisit, Progress | Revision tools; progress is saved in the browser (export/import on Progress) |

## Adding content

Every problem is one file in `src/content/<section>/<id>.js`; the format is in [CONTENT_SCHEMA.md](CONTENT_SCHEMA.md).
Validate with:

```bash
npm run check-content
```
