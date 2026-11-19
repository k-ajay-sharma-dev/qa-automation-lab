export default {
  id: 'java-015',
  category: 'java',
  kind: 'code',
  title: 'Streams for assertions: map, filter, sorted, collect',
  level: 'ADVANCED',
  tags: ['streams', 'lambdas', 'collections', 'assertions'],
  estMinutes: 30,
  scenario: `Your \`SearchResultsPage\` has grown four near-identical methods, each with a for loop, a temp list and an if. The senior SDET on the team rewrites
this kind of code as one-line **stream pipelines** — and the interview panel for your next role will expect you to read and write them too.
Search for "laptop" and verify the results with streams.`,
  description: `Rewrite the methods of \`SearchAssertions\` using the Stream API — **no \`for\`/\`while\` loops**.

**Acceptance**
* \`List<String> getTitles(List<WebElement> cards)\` — \`map\` each element to its trimmed text and \`collect\` to a list.
* \`List<String> titlesNotMatching(List<String> titles, String term)\` — \`filter\` titles that do **not** contain the term (case-insensitive). The test asserts this list is empty, so the failure message shows the offenders.
* \`List<Double> toPrices(List<String> priceTexts)\` — strip \`$\`/\`,\` and parse using \`map\`.
* \`boolean isSortedDescending(List<Double> prices)\` — compare the list with a copy produced by \`sorted(Comparator.reverseOrder())\`.`,
  hints: [
    'cards.stream().map(WebElement::getText).map(String::trim).collect(Collectors.toList())  — or .toList() on Java 16+',
    'titles.stream().filter(t -> !t.toLowerCase().contains(term.toLowerCase())).toList()',
    'prices.stream().sorted(Comparator.reverseOrder()).toList().equals(prices)',
  ],
  language: 'java',
  starterCode: `package com.shop.assertions;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.WebElement;

public class SearchAssertions {

    public static List<String> getTitles(List<WebElement> cards) {
        List<String> titles = new ArrayList<>();
        for (WebElement card : cards) {
            titles.add(card.getText().trim());
        }
        return titles;
    }

    public static List<String> titlesNotMatching(List<String> titles, String term) {
        List<String> bad = new ArrayList<>();
        for (String t : titles) {
            if (!t.toLowerCase().contains(term.toLowerCase())) {
                bad.add(t);
            }
        }
        return bad;
    }

    public static List<Double> toPrices(List<String> priceTexts) {
        List<Double> prices = new ArrayList<>();
        for (String p : priceTexts) {
            prices.add(Double.parseDouble(p.replace("$", "").replace(",", "")));
        }
        return prices;
    }

    public static boolean isSortedDescending(List<Double> prices) {
        List<Double> copy = new ArrayList<>(prices);
        Collections.sort(copy, Collections.reverseOrder());
        return copy.equals(prices);
    }

    // TODO: rewrite all four methods with streams - no loops
}
`,
  solution: `package com.shop.assertions;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.WebElement;

public class SearchAssertions {

    public static List<String> getTitles(List<WebElement> cards) {
        return cards.stream()
                .map(WebElement::getText)
                .map(String::trim)
                .collect(Collectors.toList());
    }

    public static List<String> titlesNotMatching(List<String> titles, String term) {
        String needle = term.toLowerCase();
        return titles.stream()
                .filter(title -> !title.toLowerCase().contains(needle))
                .collect(Collectors.toList());
    }

    public static List<Double> toPrices(List<String> priceTexts) {
        return priceTexts.stream()
                .map(text -> text.replace("$", "").replace(",", "").trim())
                .map(Double::parseDouble)
                .collect(Collectors.toList());
    }

    public static boolean isSortedDescending(List<Double> prices) {
        List<Double> expected = prices.stream()
                .sorted(Comparator.reverseOrder())
                .collect(Collectors.toList());
        return expected.equals(prices);
    }
}

// In the test:
// List<String> titles = SearchAssertions.getTitles(driver.findElements(By.cssSelector(".product-card h3")));
// Assert.assertFalse(titles.isEmpty(), "No search results");
// Assert.assertEquals(SearchAssertions.titlesNotMatching(titles, "laptop"), List.of(), "Irrelevant results");
`,
  checks: [
    { label: 'Uses .stream()', pattern: '\\.stream\\s*\\(\\s*\\)', hint: 'cards.stream()' },
    { label: 'Transforms with map', pattern: '\\.map\\s*\\(\\s*(WebElement::getText|\\w+\\s*->\\s*\\w+\\.getText\\s*\\(\\s*\\))', hint: '.map(WebElement::getText)' },
    { label: 'Filters with a negated contains', pattern: '\\.filter\\s*\\([^;]*!\\s*[\\w.()]*contains\\s*\\(', hint: '.filter(t -> !t.toLowerCase().contains(needle))' },
    { label: 'Sorts in reverse order in the stream', pattern: '\\.sorted\\s*\\(\\s*(Comparator\\.reverseOrder|Collections\\.reverseOrder)\\s*\\(\\s*\\)\\s*\\)', hint: '.sorted(Comparator.reverseOrder())' },
    { label: 'Collects results to a List', pattern: '(\\.collect\\s*\\(\\s*Collectors\\.toList\\s*\\(\\s*\\)\\s*\\)|\\.toList\\s*\\(\\s*\\))', hint: '.collect(Collectors.toList()) or .toList()' },
    { label: 'Parses prices inside the pipeline', pattern: '\\.map\\s*\\(\\s*(Double::parseDouble|Double::valueOf|\\w+\\s*->\\s*Double\\.(parseDouble|valueOf))', hint: '.map(Double::parseDouble)' },
    { label: 'No for/while loops left', pattern: '\\b(for|while)\\s*\\(', mustNot: true, hint: 'Replace each loop with a stream pipeline.' },
  ],
  explanation: `A stream pipeline reads like the sentence you'd write in a test case: *take the cards → get their text → trim → keep those not containing "laptop" → collect*.

* **\`map\`** transforms each element (\`WebElement\` → \`String\`, \`String\` → \`Double\`). Method references like \`WebElement::getText\` are shorthand for \`e -> e.getText()\`.
* **\`filter\`** keeps elements matching a predicate. Returning the *offenders* (not a boolean) means the assertion message shows exactly which results are wrong.
* **\`sorted\`** with \`Comparator.reverseOrder()\` produces a sorted copy — the original list is untouched, so comparing \`expected.equals(prices)\` is a valid sort check.
* **\`collect(Collectors.toList())\`** (or \`.toList()\` on Java 16+, which returns an unmodifiable list) ends the pipeline.

Other terminal operations testers use daily: \`allMatch\` / \`anyMatch\` / \`noneMatch\` (boolean checks), \`count()\`, \`distinct()\` (duplicates: \`list.size() != list.stream().distinct().count()\`), \`mapToDouble(...).sum()\` for cart totals.

Streams are lazy and single-use; the code doesn't touch the browser more often than the loop version did — each \`getText()\` is still one call per element.`,
  mistakes: [
    'Forgetting the terminal operation (collect/toList) — nothing executes and you get a Stream, not a List.',
    'Using allMatch for assertions and losing the information about WHICH element failed.',
    'Trying to modify the result of .toList() (it is unmodifiable) — use Collectors.toList() or new ArrayList<>(...) if you need to.',
    'Calling stream() on a List<WebElement> long after reading it and getting StaleElementReferenceException — map to Strings immediately.',
  ],
  interview: [
    { q: 'What is the difference between map and filter?', a: 'map transforms every element into something else (same count, possibly different type). filter keeps or drops elements based on a boolean predicate (same type, possibly fewer elements).' },
    { q: 'Intermediate vs terminal operations?', a: 'Intermediate operations (map, filter, sorted, distinct) return a new Stream and are lazy. Terminal operations (collect, toList, count, allMatch, forEach) trigger execution and produce a result; after one, the stream cannot be reused.' },
    { q: 'How would you get all link texts on a page using streams?', a: 'driver.findElements(By.tagName("a")).stream().map(WebElement::getText).map(String::trim).filter(t -> !t.isEmpty()).toList();' },
  ],
}
