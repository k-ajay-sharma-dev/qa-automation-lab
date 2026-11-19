export default {
  id: 'sel-023',
  category: 'selenium',
  kind: 'quiz',
  title: 'isDisplayed, isEnabled, getDomAttribute, getDomProperty, getCssValue: what do they return?',
  level: 'BEGINNER',
  tags: ['element-state', 'getDomProperty', 'getCssValue', 'isDisplayed'],
  estMinutes: 10,
  scenario: `Your first sprint review: three of your new assertions passed even though the feature was broken, and one failed even though the screen looked right. The cause each time was the same: you asked the element the wrong question. Before you rewrite them, check that you know exactly what each state and value method returns on ShopEasy's real pages.`,
  description: `Each question uses a real ShopEasy element. Pick what Selenium actually returns.`,
  hints: [
    'An element can be in the DOM and still not displayed. findElement only needs it to be in the DOM.',
    'An attribute is what the HTML source says; a property is the live value in the browser right now.',
  ],
  questions: [
    {
      q: `On \`waits.html\`, right after the page loads, "Claim reward" is rendered but disabled for 5 seconds:

\`\`\`html
<button type="button" class="btn btn-primary" id="claim-reward-btn" disabled>Claim reward</button>
\`\`\`

What do \`isDisplayed()\` and \`isEnabled()\` return during those 5 seconds?`,
      options: [
        'isDisplayed() = false, isEnabled() = false',
        'isDisplayed() = true, isEnabled() = false',
        'isDisplayed() = true, isEnabled() = true',
        'findElement throws because the button is disabled',
      ],
      answer: 1,
      why: 'A disabled button is still drawn on screen, so it is displayed. `isEnabled()` reflects the `disabled` attribute. That is why `elementToBeClickable` checks *both* visibility and enabled state; `visibilityOf` alone would return immediately.',
    },
    {
      q: `On \`waits.html\`, before you click "Show message", the coupon message exists but is hidden:

\`\`\`html
<p id="delayed-message" class="success-banner" style="display: none;">Your coupon code is <strong>WAIT4IT</strong></p>
\`\`\`

What happens with \`driver.findElement(By.id("delayed-message"))\`, and what does \`getText()\` return?`,
      options: [
        'findElement throws NoSuchElementException',
        'findElement returns the element; isDisplayed() is false and getText() returns ""',
        'findElement returns the element and getText() returns "Your coupon code is WAIT4IT"',
        'findElement waits until the element becomes visible',
      ],
      answer: 1,
      why: '`findElement` only needs the element in the DOM, and hidden elements are in the DOM. `getText()` returns *visible* text only, so a hidden element gives an empty string. If you really need hidden text, read the `textContent` property with `getDomProperty("textContent")`, but usually you should wait for visibility instead.',
    },
    {
      q: `On \`form.html\` you typed \`Jane\` into the first-name box. Its HTML source is:

\`\`\`html
<input type="text" id="firstName" name="firstName" placeholder="Jane" required>
\`\`\`

Which call returns the text you typed?`,
      options: [
        'getDomAttribute("value") — it returns "Jane"',
        'getText() — it returns "Jane"',
        'getDomProperty("value") — it returns "Jane"; getDomAttribute("value") returns null because the HTML has no value attribute',
        'getDomAttribute("placeholder") — it returns the typed value',
      ],
      answer: 2,
      why: 'Typing changes the live **property** `value`, not the HTML **attribute** written in the source. `getDomAttribute` reads the source attribute (none here → null); `getDomProperty` reads the live property. `getText()` is always empty for inputs. The legacy `getAttribute("value")` would also return "Jane", because it checks the property first — Selenium 4 recommends the explicit methods so you know which one you get.',
    },
    {
      q: `The stylesheet colours the active navigation link with \`color: #0f766e\`. What does \`driver.findElement(By.cssSelector(".site-nav a.active")).getCssValue("color")\` return in Chrome?`,
      options: [
        '"#0f766e"',
        '"teal"',
        '"rgba(15, 118, 110, 1)"',
        'null, because getCssValue only reads inline styles',
      ],
      answer: 2,
      why: '`getCssValue` returns the **computed** style, and browsers report colours as `rgba(r, g, b, a)` regardless of how the CSS wrote them. Convert before comparing: `Color.fromString(value).asHex()` (from `org.openqa.selenium.support.Color`) gives `#0f766e`. It reads computed styles from any stylesheet, not only inline ones.',
    },
    {
      q: `On \`form.html\` the result panel is in the HTML from the start and hidden with a class (\`.hidden { display: none !important; }\`) until the form is submitted:

\`\`\`html
<section class="panel hidden" id="result-panel" data-testid="result-panel">…</section>
\`\`\`

Your negative test submits an invalid form and must prove the panel is **not shown**. Which assertion is correct?`,
      options: [
        'Assert.assertTrue(driver.findElements(By.id("result-panel")).isEmpty())',
        'Assert.assertFalse(driver.findElement(By.id("result-panel")).isDisplayed())',
        'Assert.assertNull(driver.findElement(By.id("result-panel")))',
        'Assert.assertEquals(driver.findElement(By.id("result-panel")).getText(), null)',
      ],
      answer: 1,
      why: 'The panel is always in the DOM, so `findElements(...).isEmpty()` is false and that assertion fails although the app is correct. `findElement` never returns null, and `getText()` returns "" not null. "Not shown" for an element that exists means `isDisplayed() == false`. (Use `findElements(...).isEmpty()` only for elements that are *removed* from the DOM, like the cart badge on an empty cart.)',
    },
  ],
  explanation: `Ask the element the question you actually mean:

| You want to know… | Method | Returns |
|---|---|---|
| Can the user see it? | \`isDisplayed()\` | false for \`display:none\`, \`visibility:hidden\`, zero size |
| Can the user use it? | \`isEnabled()\` | false for \`disabled\` form controls |
| Is it ticked/chosen? | \`isSelected()\` | checkboxes, radios, \`<option>\` |
| What text does the user read? | \`getText()\` | visible text only; "" for hidden elements and inputs |
| What does the HTML source say? | \`getDomAttribute("x")\` | attribute as written, or null |
| What is the live value now? | \`getDomProperty("x")\` | e.g. typed \`value\`, \`checked\`, \`textContent\` |
| How is it styled? | \`getCssValue("x")\` | computed style, colours as \`rgba(...)\` |

Present ≠ displayed ≠ enabled. Most "the test passed but the feature was broken" stories come from checking presence when the requirement was about visibility or usability.`,
  interview: [
    { q: 'What is the difference between getDomAttribute and getDomProperty?', a: 'getDomAttribute returns the HTML attribute as written in the source; getDomProperty returns the current JavaScript property of the element. For an input the value attribute is the initial value, the value property is what is in the box now.' },
    { q: 'How do you verify a button colour?', a: 'element.getCssValue("background-color") returns the computed colour as rgba(...). Compare it through org.openqa.selenium.support.Color, e.g. Color.fromString(actual).asHex(), so the format does not matter.' },
    { q: 'How do you assert an element is not visible?', a: 'If it stays in the DOM, assertFalse(element.isDisplayed()) or wait with invisibilityOfElementLocated. If it is removed from the DOM, findElements(locator).isEmpty(). invisibilityOfElementLocated covers both cases.' },
  ],
}
