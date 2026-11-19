export default {
  id: 'fw-003',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Hard vs soft assertions: SoftAssert for a product card',
  level: 'BEGINNER',
  tags: ['testng', 'assertions', 'softassert'],
  estMinutes: 15,
  scenario: `The product cards on the ShopEasy Products page got a redesign. Your manual checklist verifies **five** things on the
Trailblazer Backpack card: name, price, description, image and the Add-to-cart button. With hard asserts, the automated test stops at
the first failure, so the bug report says "price wrong" and you only discover the broken image in the next build.
The BA wants all problems in one run.`,
  description: `Rewrite the test using TestNG \`SoftAssert\`.

**Rules**
- Create a \`new SoftAssert()\` inside the test method (not as a shared field).
- Use \`softly.assertEquals\` / \`assertTrue\` for the five checks, each with a message.
- Call \`softly.assertAll()\` at the end — without it the test always passes.
- Keep the *precondition* (page loaded) as a **hard** \`Assert\` — no point checking details on a page that did not open.`,
  starterCode: `package com.shopeasy.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

public class ProductCardTest extends BaseTest {

    @Test
    public void backpackCardShowsCorrectDetails() {
        ProductCard card = loginAsStandardUser().productCard("Trailblazer Backpack");

        Assert.assertTrue(card.isLoaded());
        Assert.assertEquals(card.getName(), "Trailblazer Backpack");
        Assert.assertEquals(card.getPrice(), "$29.99");
        Assert.assertTrue(card.getDescription().contains("22L daypack"));
        Assert.assertTrue(card.isImageDisplayed());
        Assert.assertTrue(card.isAddToCartEnabled());
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.testng.Assert;
import org.testng.annotations.Test;
import org.testng.asserts.SoftAssert;

public class ProductCardTest extends BaseTest {

    @Test
    public void backpackCardShowsCorrectDetails() {
        ProductCard card = loginAsStandardUser().productCard("Trailblazer Backpack");

        Assert.assertTrue(card.isLoaded(), "Product card was not found on the Products page");

        SoftAssert softly = new SoftAssert();
        softly.assertEquals(card.getName(), "Trailblazer Backpack", "Product name");
        softly.assertEquals(card.getPrice(), "$29.99", "Product price");
        softly.assertTrue(card.getDescription().contains("22L daypack"),
                "Description was: " + card.getDescription());
        softly.assertTrue(card.isImageDisplayed(), "Product image should be visible");
        softly.assertTrue(card.isAddToCartEnabled(), "Add to cart should be enabled");
        softly.assertAll();
    }
}
`,
  checks: [
    { label: 'Imports TestNG SoftAssert', pattern: 'import\\s+org\\.testng\\.asserts\\.SoftAssert\\s*;', hint: 'import org.testng.asserts.SoftAssert;' },
    { label: 'New SoftAssert per test', pattern: 'SoftAssert\\s+\\w+\\s*=\\s*new\\s+SoftAssert\\s*\\(\\s*\\)', hint: 'SoftAssert softly = new SoftAssert(); inside the method' },
    { label: 'Uses soft assertions for the details', pattern: '\\w+\\.assertEquals\\s*\\([^;]*getPrice', hint: 'softly.assertEquals(card.getPrice(), "$29.99", "Product price");' },
    { label: 'Calls assertAll()', pattern: '\\.assertAll\\s*\\(\\s*\\)\\s*;', hint: 'Without assertAll() failures are never reported' },
    { label: 'Precondition stays a hard assert', pattern: 'Assert\\.assertTrue\\s*\\(\\s*\\w+\\.isLoaded\\s*\\(\\s*\\)', hint: 'Assert.assertTrue(card.isLoaded(), "...")' },
    { label: 'No shared SoftAssert field', pattern: '(private|protected|public|static)\\s+[\\w\\s]*SoftAssert\\s+\\w+\\s*[=;]', mustNot: true, hint: 'A field SoftAssert keeps failures from previous tests' },
  ],
  hints: [
    'SoftAssert lives in org.testng.asserts, not org.testng.Assert.',
    'Replace Assert.assertX with softly.assertX for the five detail checks.',
    'The last line must be softly.assertAll();',
  ],
  explanation: `- **Hard assert** (\`Assert.*\`) throws immediately → the test stops. Right for preconditions and for steps
  where continuing makes no sense (login failed, page not loaded).
- **Soft assert** (\`SoftAssert\`) records failures and throws **once** in \`assertAll()\` with all of them listed.
  Right for verifying many independent fields on one screen — like your manual checklist.

Two classic bugs:
1. Forgetting \`assertAll()\` → the test is **always green**. Reviewers grep for it.
2. A \`SoftAssert\` stored as a class field → failures from test A are reported again in test B (and it is not
   thread-safe). Always create it inside the test method.

Soft asserts are not a licence to cram 40 checks into one test; they are for one logical verification with many facets.`,
  mistakes: [
    'Forgetting softly.assertAll(), so failures are silently swallowed.',
    'Sharing one SoftAssert instance across tests.',
    'Using soft asserts for preconditions and getting a cascade of NullPointerExceptions after the page failed to load.',
  ],
  interview: [
    { q: 'Hard vs soft assertion?', a: 'A hard assertion throws immediately and stops the test. A soft assertion collects failures and reports them all when assertAll() is called. Use hard for preconditions and critical steps, soft for verifying several independent attributes of the same state.' },
    { q: 'What happens if you forget assertAll()?', a: 'Recorded failures are never thrown, so the test passes even though checks failed. This is a common review finding.' },
  ],
}
