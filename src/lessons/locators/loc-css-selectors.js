export default {
  slug: 'loc-css-selectors',
  category: 'locators',
  order: 3,
  title: 'CSS selectors: tags, classes, attributes and scoping',
  minutes: 8,
  summary: 'Write CSS selectors that combine tag, class and attribute conditions, and scope them inside a stable container so they match exactly the elements you mean.',
  manualAnalogy: `In a bug report you narrow things down: "the *price* in the *cart list*, not the one in the banner". CSS selectors let you narrow down the same way — by kind of element, by its attributes, and by *where it lives* on the page. Each extra condition is one more word of precision in your description.`,
  body: `## The building blocks

| Selector | Matches | Example on the practice site |
|---|---|---|
| \`tag\` | every element of that tag | \`select\` |
| \`#id\` | the element with that id | \`#product-sort\` |
| \`.class\` | elements having that class | \`.cart-item\` |
| \`[attr]\` | elements that have the attribute at all | \`[data-testid]\` |
| \`[attr='value']\` | attribute equals value exactly | \`[name='postalCode']\` |

Attributes do not have to be identifiers. Some describe **behaviour** — \`type='email'\`, \`href\`, \`target\`, \`aria-label\`. Locating by
them lets one selector find "every element that behaves like this" on any page, e.g. \`input[type='email']\` for every email field.

Quotes inside the brackets can be single or double. In Java the whole selector is a Java string, so use single quotes inside: \`By.cssSelector("[name='postalCode']")\`.

## Combining conditions on ONE element (no spaces!)

Write conditions back to back, with **no space**, and the element must satisfy all of them (AND):

\`\`\`css
input[type='checkbox']                     /* inputs that are checkboxes */
input[type='checkbox'][name='categories']  /* …and in the categories group */
.btn.btn-danger                            /* has class btn AND class btn-danger */
button.btn-primary#finish                  /* tag + class + id, all on one button */
\`\`\`

Why combine? \`[name='categories']\` alone is fine today, but adding the tag and type documents *what* you expect and stops matching, say, a hidden field that happens to reuse the name.

## Descendant scoping (a space)

A **space** means "somewhere inside":

\`\`\`css
#cart-list .item-price        /* prices anywhere inside the cart list */
#checkout-info-form input     /* inputs inside the checkout form only */
\`\`\`

This is the most important CSS skill for real pages. Pages often reuse the same class in several places — a price in a promo banner, a price in the product grid, a price in a "recommended" sidebar. A bare \`.item-price\` matches all of them, and a "prices are sorted" check suddenly includes a banner price. Starting from a **stable container** (one with an id or test id) limits the search to the area you care about.

## Child (>) and siblings (+, ~)

\`\`\`css
#cart-list > li          /* li elements that are DIRECT children of the list */
label + input            /* the input immediately after a label (same parent) */
h1 ~ .panel              /* any .panel after the h1, same parent */
\`\`\`

\`>\` is stricter than a space: only one level down. Use it when nested lists or grids would otherwise match too much. \`+\` and \`~\` only go **forward** to later siblings — CSS cannot go up to a parent or back to an earlier sibling (that is XPath's job, see the *XPath axes* lesson).

## Reading a selector right to left

The browser reads \`#checkout-info-form input[type='text']\` from the right: "find text inputs, keep those that have \`#checkout-info-form\` as an ancestor". Reading it the same way helps you predict matches: the **rightmost** part is what you get back; everything to the left is a filter.

## Classes that change with state

Pages often add a modifier class to one element of a group — \`active\` on the current nav link, \`selected\` on a chosen row, \`--featured\` or \`--highlighted\` on a promoted card:

\`\`\`html
<a href="login.html" class="active">Login</a>
\`\`\`

\`\`\`css
.site-nav a.active      /* the nav link for the current page */
\`\`\`

The modifier class tells you *which* element is special without relying on its text or position. Then a space lets you go down into it: \`.some-card.is-selected button\` = "the button inside the selected card".

## In Selenium

\`\`\`java
List<WebElement> cartPrices = driver.findElements(By.cssSelector("#cart-list .item-price"));
WebElement sortBox = driver.findElement(By.cssSelector("select#product-sort"));
\`\`\`

## CSS vs XPath in one line

CSS is shorter, fast and readable — use it whenever you identify elements by id, class, attributes and containment. Reach for XPath when you need **visible text** or need to move **up** or **backwards** in the tree.`,
  keyPoints: [
    'No space = all conditions on the same element: input[type=\'checkbox\'][name=\'x\'], .a.b',
    'Space = descendant (anywhere inside); > = direct child.',
    'Scope selectors to a stable container to avoid matching look-alikes elsewhere on the page.',
    'The rightmost part of a selector is what you get back; the rest filters.',
    'State classes (active, selected, --featured) identify the special one in a group.',
  ],
  mistakes: [
    'Adding a space by accident: "input [type=\'text\']" means "something with type=text INSIDE an input" — matches nothing.',
    'Using a bare class like .item-price on a page that reuses it in a banner — scope it to the list container.',
    'Using double quotes inside a Java string without escaping — use single quotes in the selector.',
    'Expecting CSS to select a parent or an earlier sibling — CSS only goes down and forward.',
  ],
  tryIt: `On http://localhost:5180/practice-site/form.html run \`$$("input[type='checkbox']")\` and \`$$("#category-group input[type='checkbox']")\` in the Console. Then try \`$$('#registration-form select')\` — how many dropdowns does the form have?`,
  problems: ['loc-002', 'loc-004', 'loc-005', 'loc-006', 'loc-011', 'loc-022', 'loc-032'],
}
