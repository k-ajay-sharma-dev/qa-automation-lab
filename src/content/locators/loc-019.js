export default {
  id: 'loc-019',
  category: 'locators',
  kind: 'locator',
  title: 'Dropdown options: every choice in the Country list',
  level: 'BEGINNER',
  tags: ['css', 'select', 'options', 'findElements', 'form'],
  estMinutes: 6,
  scenario: `Story SELL-212: "Sellers can register from India, the United States, the United Kingdom, Germany and Australia." In manual testing you
opened the Country dropdown and read the list with your eyes. To automate that check you need a locator that returns **every option** of
that one dropdown as a list — and nothing from the other dropdown on the same form (Sales channels).`,
  description: `On **form.html**, write a locator that matches **all \`<option>\` elements of the Country dropdown** — including the
"-- Select country --" placeholder.

**Rules**
- Start from the dropdown's own id, then go down to its options.
- Do not match the options of the *Sales channels* list.
- Exactly 6 elements.`,
  hints: [
    'Inspect the Country dropdown: it is a <select id="country"> with <option> children.',
    'A space (or >) goes from the select down to its options: #country option',
  ],
  page: 'form.html',
  strategy: 'either',
  expected: '#country option',
  expectedCount: 6,
  solution: `CSS:    #country option            (or  select#country > option)
XPath:  //select[@id='country']/option

Java — option 1, plain findElements:
List<WebElement> options = driver.findElements(By.cssSelector("#country option"));
List<String> labels = options.stream().map(WebElement::getText).toList();
// [-- Select country --, India, United States, United Kingdom, Germany, Australia]

Java — option 2, Selenium's Select helper (usual for <select>):
Select country = new Select(driver.findElement(By.id("country")));
List<WebElement> same = country.getOptions();`,
  explanation: `A dropdown in HTML is a parent \`<select>\` with one \`<option>\` child per choice. The DOM is a family tree, so "every option of
**this** dropdown" is simply "the select with id country → its option children". A bare \`option\` selector would also return the five
*Sales channels* options (11 in total) and your "5 countries" assertion would fail for a confusing reason.

For \`<select>\` elements Selenium ships a helper class, \`Select\`, with \`getOptions()\`, \`selectByVisibleText()\`, \`selectByValue()\` and
\`getFirstSelectedOption()\`. Under the hood \`getOptions()\` runs the same kind of locator you just wrote.

Notice the placeholder option is part of the list. When you compare against the expected countries, either skip it or locate only the real
options — that is the next problem's topic.`,
  mistakes: [
    'Writing just "option" — it also matches the Sales channels options on the same form.',
    'Expecting 5 elements and forgetting the "-- Select country --" placeholder is an option too.',
    'Trying to click() options of a native <select> one by one instead of using the Select class.',
  ],
  interview: [
    {
      q: 'How do you verify all the values of a dropdown in Selenium?',
      a: 'Wrap the <select> WebElement in new Select(element), call getOptions(), map each option to getText() and compare the list with the expected values (often from the requirement or a data file). Assert on the whole list so a missing, extra or re-ordered option is caught.',
    },
    {
      q: 'Does the Select class work for every dropdown you see on a page?',
      a: 'No — only for real <select> elements. Many modern UIs build dropdowns from divs and lists (React-Select, Material). For those you click the trigger and then locate the option elements like any other list, usually by visible text.',
    },
  ],
}
