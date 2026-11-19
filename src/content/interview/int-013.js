export default {
  id: 'int-013',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: find duplicate product names on the inventory page',
  level: 'BEGINNER',
  tags: ['java', 'live-coding', 'collections', 'set', 'duplicates'],
  estMinutes: 15,
  scenario: `A favourite QA twist on the classic "find duplicates in a list": *"The ShopEasy inventory page must not show the same product twice. You've collected the names with findElements. Write a method that returns the duplicates."* The interviewer wants to see a **Set-based O(n)** solution, not nested loops — and you explaining the difference.`,
  description: `Implement \`findDuplicates(List<String> names)\` in \`ProductListUtils\`:

- Return each duplicated name **once**, in the order its duplicate was first found.
- \`["Trailblazer Backpack", "Pulse Bike Light", "Trailblazer Backpack", "Junior Onesie", "Pulse Bike Light", "Trailblazer Backpack"]\` → \`["Trailblazer Backpack", "Pulse Bike Light"]\`.
- Also write \`getProductNames(WebDriver driver)\` that reads all \`#inventory-list .item-name\` texts into a \`List<String>\`.

**Rules / Acceptance**
- Use a \`HashSet\` to remember seen names (no nested loops).
- Use a \`LinkedHashSet\` (or check \`contains\`) so each duplicate appears only once and in order.
- Trim the text from the UI before comparing.
- Don't return \`null\`.`,
  hints: [
    'Set.add() returns false when the element was already present.',
    'if (!seen.add(name)) duplicates.add(name); — with duplicates being a LinkedHashSet.',
    'Convert at the end: return new ArrayList<>(duplicates);',
  ],
  language: 'java',
  starterCode: String.raw`import java.util.ArrayList;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class ProductListUtils {

    public static List<String> getProductNames(WebDriver driver) {
        List<String> names = new ArrayList<>();
        // TODO: read every #inventory-list .item-name text
        return names;
    }

    public static List<String> findDuplicates(List<String> names) {
        List<String> duplicates = new ArrayList<>();
        for (int i = 0; i < names.size(); i++) {
            for (int j = i + 1; j < names.size(); j++) {
                if (names.get(i).equals(names.get(j))) {
                    duplicates.add(names.get(i)); // adds "Trailblazer Backpack" twice!
                }
            }
        }
        return duplicates;
    }
}
`,
  solution: String.raw`import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class ProductListUtils {

    private static final By PRODUCT_NAMES = By.cssSelector("#inventory-list .item-name");

    public static List<String> getProductNames(WebDriver driver) {
        List<String> names = new ArrayList<>();
        for (WebElement element : driver.findElements(PRODUCT_NAMES)) {
            names.add(element.getText().trim());
        }
        return names;
    }

    public static List<String> findDuplicates(List<String> names) {
        Set<String> seen = new HashSet<>();
        Set<String> duplicates = new LinkedHashSet<>();
        for (String name : names) {
            if (!seen.add(name)) {        // add() returns false if it was already there
                duplicates.add(name);     // LinkedHashSet keeps each duplicate once, in order
            }
        }
        return new ArrayList<>(duplicates);
    }
}
`,
  checks: [
    { label: 'Uses a HashSet to track seen names', pattern: 'new\\s+HashSet\\s*<', hint: 'Set<String> seen = new HashSet<>();' },
    { label: 'Uses the boolean result of add() (or contains)', pattern: '(!\\s*\\w+\\.add\\s*\\(|\\.contains\\s*\\()', hint: 'if (!seen.add(name)) ...' },
    { label: 'Each duplicate reported once (LinkedHashSet / distinct)', pattern: '(LinkedHashSet|\\.distinct\\s*\\(|!\\s*\\w+\\.contains\\s*\\()', hint: 'Collect duplicates in a LinkedHashSet' },
    { label: 'No nested loops over the list', pattern: 'for\\s*\\([^{]*\\{\\s*for\\s*\\(', mustNot: true, hint: 'Nested loops are O(n²) and add repeats' },
    { label: 'Reads product names with findElements and trims them', pattern: 'findElements\\s*\\([\\s\\S]*getText\\s*\\(\\s*\\)\\s*\\.trim\\s*\\(', flags: 'ms', hint: 'element.getText().trim()' },
  ],
  explanation: `**Why the Set solution wins:**
- \`HashSet.add()\` is O(1) on average and returns \`false\` if the value was already present — one pass over the list finds every duplicate: **O(n)**.
- The nested-loop version is **O(n²)** and reports "Trailblazer Backpack" twice (it appears 3 times). Interviewers often let you write it first, then ask "can you improve it?" — be ready.
- \`LinkedHashSet\` both de-duplicates the results and keeps a predictable order for the assertion.

**Stream alternative** (mention after the loop):
\`\`\`java
names.stream()
     .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()))
     .entrySet().stream().filter(e -> e.getValue() > 1).map(Map.Entry::getKey).toList();
\`\`\`

**How you'd use it in the test:**
\`\`\`java
List<String> dupes = ProductListUtils.findDuplicates(ProductListUtils.getProductNames(driver));
Assert.assertTrue(dupes.isEmpty(), "Duplicate products shown: " + dupes);
\`\`\`
The message lists the offending names — great evidence for a defect.`,
  mistakes: [
    'Nested loops that report the same duplicate multiple times.',
    'Forgetting trim() — "Trailblazer Backpack " and "Trailblazer Backpack" look identical on screen but are not equal.',
    'Using a List for "seen" and calling contains() on it — O(n²) again.',
    'Asserting only the size difference without listing which names are duplicated.',
  ],
  interview: [
    { q: 'What is the time complexity of your solution?', a: 'O(n) on average, because HashSet add and contains are constant time on average and I iterate the list once. The nested-loop approach is O(n²).' },
    { q: 'How would you check that a list has no duplicates in one line?', a: 'Compare new HashSet<>(list).size() with list.size() — if they are equal there are no duplicates. For the assertion message I still prefer finding the actual duplicates.' },
  ],
}
