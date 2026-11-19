export default {
  id: 'loc-030',
  category: 'locators',
  kind: 'locator',
  title: 'Filter by a number: Add-to-cart buttons for products under $20',
  level: 'EXPERT',
  tags: ['xpath', 'functions', 'number', 'predicates', 'inventory'],
  estMinutes: 18,
  scenario: `Marketing launches a "Gifts under $20" campaign: every product cheaper than $20 gets a badge, and the test must add **all** of them to the
cart and then verify the badge count. The catalogue changes weekly, so names in the locator are not an option — the rule is the **price**.
The price is text like "$15.99" in a div, and there is a *promo banner* above the grid that also contains a price ($7.49) with the same class.`,
  description: `On **inventory.html**, match the **Add to cart button of every product whose price is less than $20** — decided from the
price shown on its card.

**Rules**
- XPath. Compare the price **as a number** (convert "$15.99" → 15.99 inside the XPath).
- No product names, slugs, ids or data-testid values in the locator.
- Do not let the promo banner price take part.
- Exactly 4 elements (Classic Crew T-Shirt, Junior Onesie, Pulse Bike Light, Retro Red Tee).`,
  hints: [
    'XPath 1.0 has string functions: substring-after(\'$15.99\', \'$\') → \'15.99\', translate(., \'$\', \'\') removes the $, and number(...) converts.',
    'Put the comparison in a predicate on the product card: //div[contains(@class,\'inventory-item\')][ number(...) < 20 ]//button',
    '//div[@id=\'inventory-list\']/div[contains(@class,\'inventory-item\')][number(substring-after(normalize-space(.//div[contains(@class,\'item-price\')]),\'$\')) < 20]//button',
  ],
  page: 'inventory.html',
  strategy: 'xpath',
  expected: "#inventory-list button[data-slug='classic-crew-t-shirt'], #inventory-list button[data-slug='junior-onesie'], #inventory-list button[data-slug='pulse-bike-light'], #inventory-list button[data-slug='retro-red-tee']",
  expectedCount: 4,
  solution: `XPath:  //div[@id='inventory-list']/div[contains(@class,'inventory-item')]
            [number(substring-after(normalize-space(.//div[contains(@class,'item-price')]),'$')) < 20]
            //button
        (written on one line in the Lab)

Shorter, anchoring on the price div and stepping sideways to the button:
        //div[@id='inventory-list']//div[contains(@class,'item-price')][number(translate(.,'$','')) < 20]/following-sibling::button

Java (Page Object):
private static final String ADD_UNDER =
        "//div[@id='inventory-list']/div[contains(@class,'inventory-item')]"
        + "[number(substring-after(normalize-space(.//div[contains(@class,'item-price')]),'$')) < %s]//button";

public int addEverythingCheaperThan(BigDecimal limit) {
    List<WebElement> buttons = driver.findElements(By.xpath(String.format(ADD_UNDER, limit.toPlainString())));
    buttons.forEach(WebElement::click);
    return buttons.size();
}`,
  explanation: `XPath 1.0 (what browsers and Selenium use) can do small calculations inside predicates. Build the expression inside-out:

\`\`\`
.//div[contains(@class,'item-price')]        the price div inside this card       → "$15.99"
normalize-space( … )                         trim stray whitespace                → "$15.99"
substring-after( … , '$')                    drop the currency sign              → "15.99"
number( … )                                  string → number                     → 15.99
[ … < 20 ]                                   keep cards that pass the rule
//button                                     → that card's Add to cart button
\`\`\`

Without the conversion, \`. < 20\` turns "$15.99" into **NaN**, and every comparison with NaN is false — the locator returns nothing and you
start doubting XPath itself.

The promo banner trap: \`//*[contains(@class,'item-price')][number(translate(.,'$','')) < 20]\` returns **5** prices — the banner's
\`<span class="item-price">$7.49</span>\` sneaks in. Starting from \`#inventory-list\` and the card container excludes it, and guarantees each price is
paired with the button **of the same card**.

Is this the "best" locator? It is the right tool when the rule really is numeric and the data changes. In a code review, also ask the
developers for a \`data-price\` attribute — \`[data-price < 20]\` is still impossible in CSS, but a numeric attribute avoids text parsing
(currency symbols, "1,299.00", localisation) in XPath.`,
  mistakes: [
    'Comparing the raw text with a number ("$15.99" < 20) — it becomes NaN and nothing matches.',
    'Searching every .item-price on the page — the promo banner price joins the list.',
    'Finding prices and buttons as two separate lists and pairing them by index — they drift apart as soon as one card differs.',
    'Forgetting localisation: a price like "1,299.00" or "15,99 €" needs translate() to remove separators before number().',
  ],
  interview: [
    {
      q: 'Can XPath compare numbers? What are the pitfalls?',
      a: 'Yes — <, >, <=, >= and = work on numbers, and number() converts strings. Pitfalls: text with currency symbols, thousands separators or spaces converts to NaN (always false), so clean it first with substring-after, translate and normalize-space. Browsers only support XPath 1.0, so there are no regex or date functions.',
    },
    {
      q: 'Would you rather filter in the locator or in Java?',
      a: 'Both are valid. Filtering in Java (find all cards, parse price with BigDecimal, filter with streams) is easier to debug and handles any format. A filtering locator is compact and atomic, which is handy in Page Objects and waits. For complex rules I filter in Java; for a simple numeric threshold an XPath predicate is fine.',
    },
    {
      q: 'Which XPath 1.0 functions do you use in locators?',
      a: 'text(), normalize-space(), contains(), starts-with(), not(), translate() (e.g. for case-insensitive matching or removing characters), substring-before()/substring-after(), number(), string-length(), position() and last(), count() inside predicates.',
    },
  ],
}
