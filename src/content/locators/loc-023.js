export default {
  id: 'loc-023',
  category: 'locators',
  kind: 'locator',
  title: ':not() — the real countries, without the placeholder',
  level: 'INTERMEDIATE',
  tags: ['css', 'not', 'select', 'xpath', 'form'],
  estMinutes: 8,
  scenario: `Your dropdown test for SELL-212 compares the Country options with the five countries in the story. It keeps failing with
"expected 5 but found 6" because the first option, "-- Select country --", is a placeholder, not a country. A teammate "fixed" it with
\`options.remove(0)\` in Java. You would rather the locator itself say what you mean: *options that have a real value*.`,
  description: `On **form.html**, match **every option of the Country dropdown except the placeholder**.

**Rules**
- Express the exclusion in the locator (CSS \`:not(...)\` or XPath \`not(...)\`), based on the placeholder's \`value\` attribute.
- Do not list the five countries one by one.
- Exactly 5 elements.`,
  hints: [
    'Inspect the placeholder: <option value="">-- Select country --</option>. Every real country has a non-empty value.',
    'CSS: #country option:not([value=\'\'])',
    'XPath: //select[@id=\'country\']/option[not(@value=\'\')]',
  ],
  page: 'form.html',
  strategy: 'either',
  expected: "#country option:not([value=''])",
  expectedCount: 5,
  solution: `CSS:    #country option:not([value=''])
XPath:  //select[@id='country']/option[not(@value='')]
        //select[@id='country']/option[@value!='']      (also works here, see explanation)

Java:
List<String> countries = driver.findElements(By.cssSelector("#country option:not([value=''])"))
        .stream().map(WebElement::getText).toList();
Assert.assertEquals(countries, List.of("India", "United States", "United Kingdom", "Germany", "Australia"));`,
  explanation: `\`:not(X)\` keeps the elements that do **not** match X. Here X is \`[value='']\` — the placeholder's signature — so the locator reads
"options of #country whose value is not empty". That describes the business rule (real choices) rather than a position.

Why not \`option:not(:first-child)\`? It returns the same 5 today, but it encodes *position*. If the developers move the placeholder, add a
"Recently used" group at the top, or remove the placeholder, the meaning silently changes.

XPath has \`not()\` as a function. Note the subtle difference between \`not(@value='')\` and \`@value!=''\`: the first is also true for an
option with **no** value attribute at all, the second is false for it (a missing attribute never compares equal *or* unequal). For "everything
except the placeholder", \`not(...)\` is the safer habit.`,
  mistakes: [
    'Removing index 0 in Java — the locator still lies about what it returns, and the hack breaks if the placeholder moves.',
    'Using :not(:first-child) — position instead of meaning.',
    'Putting a space before :not ("option :not(...)") — that means "descendants of an option", which matches nothing.',
  ],
  interview: [
    {
      q: 'How do you exclude elements in CSS and in XPath?',
      a: 'CSS: the :not() pseudo-class, e.g. button:not([disabled]) or .item:not(.sold-out). XPath: the not() function inside a predicate, e.g. //button[not(@disabled)] or //tr[not(td[.=\'Inactive\'])].',
    },
    {
      q: 'In XPath, what is the difference between not(@a=\'x\') and @a!=\'x\'?',
      a: 'not(@a=\'x\') is true when the attribute is missing or has another value. @a!=\'x\' needs the attribute to exist with a different value, so elements without the attribute are excluded. Choose based on whether "no attribute" should count as a match.',
    },
  ],
}
