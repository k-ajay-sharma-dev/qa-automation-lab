export default {
  id: 'java-012',
  category: 'java',
  kind: 'code',
  title: 'Map for form test data, Set for duplicate detection',
  level: 'INTERMEDIATE',
  tags: ['collections', 'map', 'set', 'test-data'],
  estMinutes: 25,
  scenario: `Two tickets landed on your board. (1) The checkout form test has eight \`sendKeys\` lines in a row, and adding a field means editing the test.
(2) Production bug SHOP-901: the Order History page sometimes lists the same order twice after a payment retry. You will use the two most useful
collections after \`List\`: a **Map** to drive the form from data, and a **Set** to detect duplicates.`,
  description: `Complete \`CheckoutHelpers\`.

**Acceptance**
* \`Map<String, String> shippingData()\` — returns a \`LinkedHashMap\` (keeps insertion order = fill order) mapping **field id → value**:
  \`firstName → Asha\`, \`lastName → Rao\`, \`zip → 560001\`, \`city → Bengaluru\`.
* \`void fillForm(WebDriver driver, Map<String, String> data)\` — loops over the map's **entries** and types each value into \`By.id(key)\`.
* \`Set<String> findDuplicates(List<String> orderIds)\` — returns the ids that appear more than once, using a \`HashSet\`. Hint: \`Set.add\` returns \`false\` when the value is already present.`,
  hints: [
    'for (Map.Entry<String, String> entry : data.entrySet()) { entry.getKey(); entry.getValue(); }',
    'Set<String> seen = new HashSet<>(); Set<String> duplicates = new LinkedHashSet<>();',
    'if (!seen.add(id)) { duplicates.add(id); }',
  ],
  language: 'java',
  starterCode: `package com.shop.helpers;

import java.util.*;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CheckoutHelpers {

    public static void fillShipping(WebDriver driver) {
        driver.findElement(By.id("firstName")).sendKeys("Asha");
        driver.findElement(By.id("lastName")).sendKeys("Rao");
        driver.findElement(By.id("zip")).sendKeys("560001");
        driver.findElement(By.id("city")).sendKeys("Bengaluru");
    }

    public static List<String> findDuplicates(List<String> orderIds) {
        // TODO: return ids that appear more than once (use a Set)
        return new ArrayList<>();
    }

    // TODO: Map<String, String> shippingData()
    // TODO: void fillForm(WebDriver driver, Map<String, String> data)
}
`,
  solution: `package com.shop.helpers;

import java.util.*;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CheckoutHelpers {

    public static Map<String, String> shippingData() {
        Map<String, String> data = new LinkedHashMap<>();   // keeps fill order
        data.put("firstName", "Asha");
        data.put("lastName", "Rao");
        data.put("zip", "560001");
        data.put("city", "Bengaluru");
        return data;
    }

    public static void fillForm(WebDriver driver, Map<String, String> data) {
        for (Map.Entry<String, String> entry : data.entrySet()) {
            var field = driver.findElement(By.id(entry.getKey()));
            field.clear();
            field.sendKeys(entry.getValue());
        }
    }

    public static Set<String> findDuplicates(List<String> orderIds) {
        Set<String> seen = new HashSet<>();
        Set<String> duplicates = new LinkedHashSet<>();
        for (String id : orderIds) {
            if (!seen.add(id)) {          // add() returns false if id was already there
                duplicates.add(id);
            }
        }
        return duplicates;
    }
}

// Test usage:
// fillForm(driver, shippingData());
// Assert.assertTrue(findDuplicates(historyPage.getOrderIds()).isEmpty(), "Duplicate orders shown");
`,
  checks: [
    { label: 'Declares a Map<String, String>', pattern: 'Map\\s*<\\s*String\\s*,\\s*String\\s*>', hint: 'Map<String, String> data = new LinkedHashMap<>();' },
    { label: 'Creates a (Linked)HashMap', pattern: 'new\\s+(Linked)?HashMap\\s*<', hint: 'new LinkedHashMap<>() keeps insertion order' },
    { label: 'Adds entries with put', pattern: '\\.put\\s*\\(\\s*"\\w+"\\s*,', hint: 'data.put("firstName", "Asha");' },
    { label: 'Iterates the map entries', pattern: '(\\.entrySet\\s*\\(\\s*\\)|\\.forEach\\s*\\(\\s*\\(\\s*\\w+\\s*,\\s*\\w+\\s*\\)\\s*->|\\.keySet\\s*\\(\\s*\\))', hint: 'for (Map.Entry<String, String> e : data.entrySet())' },
    { label: 'Uses a HashSet to track seen ids', pattern: 'new\\s+(Linked)?HashSet\\s*<', hint: 'Set<String> seen = new HashSet<>();' },
    { label: 'Detects duplicates via add() result or contains()', pattern: '(!\\s*\\w+\\.add\\s*\\(|\\.add\\s*\\([^)]*\\)\\s*==\\s*false|\\.contains\\s*\\()', hint: 'if (!seen.add(id)) duplicates.add(id);' },
    { label: 'findDuplicates returns a Set', pattern: 'Set\\s*<\\s*String\\s*>\\s+findDuplicates\\s*\\(', hint: 'public static Set<String> findDuplicates(List<String> orderIds)' },
  ],
  explanation: `Pick the collection by the question you are asking:

| Collection | Question it answers | Automation example |
|---|---|---|
| \`List\` | ordered, duplicates allowed | product names in page order |
| \`Set\` | "is it unique?" — no duplicates | order ids, menu links, error messages |
| \`Map\` | "what is the value for this key?" | field id → value, role → user, env → URL |

* **Map-driven forms**: the test data is now *data*. Adding a "phone" field is one \`put\` — \`fillForm\` doesn't change. \`LinkedHashMap\` keeps insertion order, which matters when fields depend on each other (country before state). \`HashMap\` has no guaranteed order; \`TreeMap\` sorts by key.
* **Set for duplicates**: \`Set.add\` returns \`false\` if the element already exists — a one-line duplicate detector that is O(n). Returning the duplicates (not just a boolean) makes the failure message actionable: "Duplicate orders shown: [ORD-1042]".
* \`entrySet()\` gives key and value together; iterating \`keySet()\` and calling \`get(key)\` also works but does a second lookup.`,
  mistakes: [
    'Using HashMap for form data and getting fields filled in a random order.',
    'Detecting duplicates with nested loops (O(n²)) and off-by-one comparisons of an element with itself.',
    'Comparing list.size() with new HashSet<>(list).size() — tells you THAT there are duplicates, not WHICH.',
    'Using a mutable object without equals/hashCode as a Set element or Map key.',
  ],
  interview: [
    { q: 'Difference between List, Set and Map?', a: 'List is ordered and allows duplicates (index access). Set holds unique elements (HashSet unordered, LinkedHashSet insertion order, TreeSet sorted). Map stores key-value pairs with unique keys (HashMap, LinkedHashMap, TreeMap).' },
    { q: 'How do you find duplicate elements on a page?', a: 'Collect the texts into a List, then iterate and add each to a HashSet; when add() returns false it is a duplicate. Collect those into another Set and assert it is empty, printing it in the failure message.' },
    { q: 'HashMap vs Hashtable vs ConcurrentHashMap?', a: 'HashMap is not synchronized and allows one null key. Hashtable is a legacy synchronized class with no nulls. ConcurrentHashMap is the modern thread-safe map — relevant if a map is shared across parallel test threads.' },
  ],
}
