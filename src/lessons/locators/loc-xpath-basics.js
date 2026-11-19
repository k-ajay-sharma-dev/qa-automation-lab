export default {
  slug: 'loc-xpath-basics',
  category: 'locators',
  order: 5,
  title: 'XPath basics: attributes, text(), contains() and starts-with()',
  minutes: 9,
  summary: 'Write relative XPath expressions with predicates, match visible text exactly or partially, and handle multi-class attributes and whitespace with contains() and normalize-space().',
  manualAnalogy: `Manual test steps are written in the user's words: "click **Finish**", "the row that says *Chen Wei*". Often the visible text is the only thing that makes an element unique — two buttons can look identical in the HTML except for their label. XPath is the locator language that can read that text, so it lets your automation describe elements the same way your test case does.`,
  body: `## The shape of an XPath

\`\`\`xpath
//button[@id='finish']
\`\`\`

| Part | Meaning |
|---|---|
| \`//\` | search **anywhere** in the document (relative XPath) |
| \`button\` | the tag name; \`*\` means any tag |
| \`[ … ]\` | a **predicate**: a condition the element must satisfy |
| \`@id\` | an attribute (always with \`@\`) |

More examples:

\`\`\`xpath
//input[@name='postalCode']
//*[@data-testid='finish']
//select[@id='product-sort']/option        (option children of the select)
//ul[@id='cart-list']//div                 (any div anywhere inside the list)
\`\`\`

\`/\` = direct child, \`//\` = any depth below — the XPath equivalents of CSS \`>\` and a space.

## Matching visible text

\`\`\`xpath
//a[text()='Logout']
//button[.='Finish']
\`\`\`

- \`text()\` is the element's **own** text node. \`text()='Logout'\` is an **exact** match.
- \`.\` means "the whole text of this element including children". Use it when the text is split by inner tags, e.g. \`<button><span>⚙</span> Settings</button>\`.

Exact match is what you want when several elements share a prefix. Imagine a toolbar with **Export**, **Export CSV** and **Export PDF**: \`text()='Export'\` matches one button, but a partial match would match all three.

## Partial matching: contains() and starts-with()

\`\`\`xpath
//p[contains(text(), 'cart is empty')]
//*[starts-with(@id, 'item-')]
//input[contains(@placeholder, 'Name')]
\`\`\`

- \`contains(value, 'part')\` — true if \`part\` appears anywhere.
- \`starts-with(value, 'part')\` — true if \`value\` begins with \`part\`. Perfect for ids with a fixed prefix and a generated tail.
- Both are **case-sensitive**.

Use \`contains\` for long messages where only a key phrase matters ("Your cart is empty. Add something…"). Avoid it when a shorter word is part of other labels — check the match count.

## Whitespace: normalize-space()

HTML often has invisible spaces and line breaks around text. \`text()='Products'\` fails on \`<h1> Products </h1>\`. \`normalize-space()\` trims both ends and collapses inner runs of spaces:

\`\`\`xpath
//h1[normalize-space()='Products']
\`\`\`

With no argument it uses the element's full text (like \`.\`). It is a safe default for any exact text match.

## Classes in XPath: the multi-class trap

XPath sees \`class\` as one plain string. For \`<div class="notice hidden">\`:

\`\`\`xpath
//div[@class='notice']                    ✗ no match — the string is "notice hidden"
//div[contains(@class, 'notice')]         ✓ matches
\`\`\`

\`@class='…'\` only works when you write the **entire** attribute value. \`contains(@class, 'x')\` checks for the class, but it is a substring test: \`contains(@class, 'btn')\` also matches \`btn-primary\` or \`btn-sm\`. Choose a distinctive class name (e.g. one with a modifier like \`--something\`), or use the bullet-proof form:

\`\`\`xpath
//div[contains(concat(' ', normalize-space(@class), ' '), ' notice ')]
\`\`\`

…or switch to CSS, where \`.notice\` handles multiple classes naturally.

## Combining conditions: and / or

\`\`\`xpath
//input[@type='text' and @name='lastName']
//button[text()='Cancel' or text()='Close']
\`\`\`

Several predicates in a row also mean AND: \`//input[@type='text'][@name='lastName']\`.

## In Selenium

\`\`\`java
driver.findElement(By.xpath("//a[normalize-space()='Logout']")).click();
\`\`\`

Use single quotes inside the XPath because the Java string uses double quotes. For a dynamic value, build the string with \`String.format\` (see the Java *Methods* lesson).

## Relative, not absolute

Always start with \`//\`. An XPath beginning with \`/html/body/…\` describes a path through every level of the page — the topic of the *Dynamic and tricky elements* lesson.`,
  keyPoints: [
    '//tag[@attr=\'value\'] — // searches anywhere; @ marks an attribute; [ ] is a condition.',
    'text()=\'X\' and normalize-space()=\'X\' are exact; contains()/starts-with() are partial.',
    'Prefer normalize-space() for text to ignore surrounding whitespace.',
    '@class=\'x\' fails on multi-class elements; use contains(@class,\'x\') with a distinctive name.',
    'Combine conditions with and / or or several [ ] predicates.',
  ],
  mistakes: [
    'Using contains(text(),\'Save\') when other buttons start with "Save" — use an exact match.',
    'Writing //div[@class=\'plan\'] for an element with several classes — matches nothing.',
    'Forgetting the @ — //input[name=\'x\'] looks for a CHILD element called name.',
    'Wrapping the XPath in double quotes inside a Java double-quoted string — use single quotes inside.',
  ],
  tryIt: `On http://localhost:5180/practice-site/dynamic.html run \`$x("//button[contains(text(),'Save')]")\` and count the matches. Then run \`$x("//button[text()='Cancel']")\`. Finally try \`$x("//div[@class='plan']")\` vs \`$x("//div[contains(@class,'plan')]")\` — why do the counts differ (hint: plan-price)?`,
  problems: ['loc-010', 'loc-011', 'loc-012', 'loc-016', 'loc-025', 'loc-035'],
}
