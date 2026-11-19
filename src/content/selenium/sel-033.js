export default {
  id: 'sel-033',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Single-select dropdown edge cases: placeholder, option count, isMultiple',
  level: 'BEGINNER',
  tags: ['select', 'dropdown', 'getFirstSelectedOption', 'isMultiple'],
  estMinutes: 12,
  scenario: `The product owner added Australia to the **Country** dropdown on the seller registration form (\`form.html\`). In the same release someone accidentally removed the "-- Select country --" placeholder on staging, so new sellers were silently registered as Indian businesses. Your manual test caught it; now automate the dropdown checks so the next release cannot break them unnoticed.`,
  description: `Open \`http://localhost:5180/practice-site/form.html\` and check the native \`<select id="country">\`:

1. Wrap it in \`Select\` and assert \`isMultiple()\` is **false** (it is a single-select).
2. Assert \`getOptions().size()\` is **6** (placeholder + India, United States, United Kingdom, Germany, Australia).
3. Before choosing anything, assert \`getFirstSelectedOption().getText()\` is \`-- Select country --\` (the placeholder is the default).
4. Choose Australia with \`selectByValue("AU")\` and assert the first selected option is now **Australia**.

**Rules**
- Use the \`Select\` API for every step — no clicking \`<option>\` elements.
- Use TestNG assertions with a clear message.`,
  hints: [
    'Select country = new Select(driver.findElement(By.id("country")));',
    'Assert.assertFalse(country.isMultiple(), "...")',
    'On a single-select, getFirstSelectedOption() returns the one selected option — by default the first <option>.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.annotations.Test;

public class CountryDropdownTest extends BaseTest {

    private static final By COUNTRY = By.id("country");

    @Test
    public void countryDropdownHasPlaceholderAndAllCountries() {
        driver.get("http://localhost:5180/practice-site/form.html");
        WebElement dropdown = driver.findElement(COUNTRY);
        // TODO: check it is a single-select
        // TODO: check the option count and the default placeholder
        // TODO: pick Australia and verify
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.Select;
import org.testng.Assert;
import org.testng.annotations.Test;

public class CountryDropdownTest extends BaseTest {

    private static final By COUNTRY = By.id("country");

    @Test
    public void countryDropdownHasPlaceholderAndAllCountries() {
        driver.get("http://localhost:5180/practice-site/form.html");
        Select country = new Select(driver.findElement(COUNTRY));

        Assert.assertFalse(country.isMultiple(), "Country should be a single-select");
        Assert.assertEquals(country.getOptions().size(), 6, "Placeholder + 5 countries expected");
        Assert.assertEquals(country.getFirstSelectedOption().getText(), "-- Select country --",
                "Placeholder must be selected by default");

        country.selectByValue("AU");
        Assert.assertEquals(country.getFirstSelectedOption().getText(), "Australia",
                "Australia should be selected after selectByValue(\\"AU\\")");
    }
}
`,
  checks: [
    { label: 'Wraps the dropdown in Select', pattern: 'new\\s+Select\\s*\\(', hint: 'Select country = new Select(driver.findElement(COUNTRY));' },
    { label: 'Asserts it is not a multi-select', pattern: '(assertFalse\\s*\\([^;]*isMultiple\\s*\\(|isMultiple\\s*\\(\\s*\\)\\s*,\\s*false)', hint: 'Assert.assertFalse(country.isMultiple())' },
    { label: 'Checks the option count', pattern: 'getOptions\\s*\\(\\s*\\)\\s*\\.size\\s*\\(', hint: 'country.getOptions().size()' },
    { label: 'Checks the default selected option', pattern: 'getFirstSelectedOption\\s*\\(', hint: 'country.getFirstSelectedOption().getText()' },
    { label: 'Selects Australia via the Select API', pattern: 'selectBy(Value\\s*\\(\\s*"AU"|VisibleText\\s*\\(\\s*"Australia")', hint: 'country.selectByValue("AU")' },
    { label: 'Asserts with TestNG', pattern: 'Assert\\.assert', hint: 'Use Assert.assertEquals / assertFalse' },
  ],
  explanation: `A single-select \`<select>\` always has exactly one selected option — if no option has the \`selected\` attribute, the browser selects the **first** one. That is why \`getFirstSelectedOption()\` returns the placeholder on page load, and why a missing placeholder means the form silently defaults to India.

\`isMultiple()\` reads the \`multiple\` attribute. It matters because the \`deselect*\` methods only work on multi-selects: \`deselectAll()\` on a single-select throws \`UnsupportedOperationException\`.

Asserting \`getOptions().size()\` catches added/removed options; for a stricter check, map the options to their texts and compare with the expected list, so the failure message shows exactly which country is missing.`,
  mistakes: [
    'Assuming nothing is selected by default — a single-select always reports one selected option.',
    'Calling deselectAll() on a single-select to "reset" it — it throws UnsupportedOperationException; select the placeholder instead.',
    'Hard-coding the count without the placeholder (5 instead of 6).',
    'Using getAllSelectedOptions() and expecting more than one element on a single-select.',
  ],
  interview: [
    { q: 'What does getFirstSelectedOption() return on a single-select where nothing was chosen?', a: 'The option the browser selected by default — the one with the selected attribute, or otherwise the first option. It throws NoSuchElementException only when no option is selected at all, which is possible on a multi-select.' },
    { q: 'How do you check the full list of options, not only the count?', a: 'Stream getOptions(), map WebElement::getText to a List<String>, and assertEquals it with the expected list. The failure message then shows the exact difference.' },
    { q: 'What happens if you call deselectByValue on a single-select?', a: 'It throws UnsupportedOperationException — "You may only deselect options of a multi-select". To reset a single-select you select the placeholder option.' },
  ],
}
