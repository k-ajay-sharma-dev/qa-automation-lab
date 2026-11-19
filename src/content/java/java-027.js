export default {
  id: 'java-027',
  category: 'java',
  kind: 'quiz',
  title: 'Pass-by-value and collection traps: the classic interview round',
  level: 'ADVANCED',
  tags: ['pass-by-value', 'collections', 'references', 'interview', 'output-prediction'],
  estMinutes: 15,
  scenario: `"Is Java pass-by-value or pass-by-reference?" is asked in almost every Java interview, and most candidates get the follow-up snippet wrong.
The same misunderstanding causes real test bugs: a helper "resets" a cart list and nothing happens, a sort check passes even though the page is unsorted, a cleanup loop crashes with \`ConcurrentModificationException\`.
Every snippet below comes from ShopEasy test code.`,
  description: `Predict the output. For every variable, ask: does it hold a **value** (primitive) or a **reference** to an object? A method always gets a **copy of what the variable holds**.`,
  questions: [
    {
      q: `What does this print?
\`\`\`java
static void addItem(List<String> cart) {
    cart.add("Retro Red Tee");
}
static void resetCart(List<String> cart) {
    cart = new ArrayList<>();
    cart.add("Junior Onesie");
}

List<String> cart = new ArrayList<>(List.of("Pulse Bike Light"));
addItem(cart);
resetCart(cart);
System.out.println(cart);
\`\`\``,
      options: [
        '[Pulse Bike Light]',
        '[Pulse Bike Light, Retro Red Tee]',
        '[Junior Onesie]',
        '[Pulse Bike Light, Retro Red Tee, Junior Onesie]',
      ],
      answer: 1,
      why: 'Java is **always pass-by-value**. For objects, the value copied into the method is the **reference**. `addItem` uses its copy to modify the *same* list, so the change is visible. `resetCart` points its *local copy* at a brand-new list, and the caller\'s variable still points at the original. Result: `[Pulse Bike Light, Retro Red Tee]`.',
    },
    {
      q: `What does this print?
\`\`\`java
static void applyDiscount(double price) {
    price = price * 0.9;
}
static void normalize(String label) {
    label = label.trim();
}

double price = 49.99;
String label = "  Add to cart ";
applyDiscount(price);
normalize(label);
System.out.println(price + "|" + label + "|");
\`\`\``,
      options: ['44.991|Add to cart|', '49.99|  Add to cart |', '44.991|  Add to cart |', '49.99|Add to cart|'],
      answer: 1,
      why: 'The `double` is copied, so the method changes only its own copy. The String reference is copied too, and `trim()` creates a **new** String that is assigned to the local variable only (Strings can\'t be changed anyway). Neither change reaches the caller. Helpers must **return** the new value: `price = applyDiscount(price);`.',
    },
    {
      q: `A sort check from a pull request. What does it print when the page shows prices \`[15.99, 7.99, 49.99]\`?
\`\`\`java
List<Double> actual = new ArrayList<>(List.of(15.99, 7.99, 49.99));
List<Double> expected = actual;
Collections.sort(expected);
System.out.println(expected.equals(actual));
\`\`\``,
      options: ['false: the page is not sorted', 'true', 'ClassCastException', 'Compile error'],
      answer: 1,
      why: '`expected = actual` copies the **reference**, not the list. Both variables point to the same list, so sorting `expected` also sorts `actual`, and `equals` is always **true**. The check can never fail. Make a real copy: `new ArrayList<>(actual)`.',
    },
    {
      q: `What happens?
\`\`\`java
List<String> items = new ArrayList<>(List.of("Junior Onesie", "Retro Red Tee", "Pulse Bike Light"));
for (String item : items) {
    if (item.startsWith("J")) {
        items.remove(item);
    }
}
System.out.println(items);
\`\`\``,
      options: [
        '[Retro Red Tee, Pulse Bike Light]',
        'ConcurrentModificationException',
        'IndexOutOfBoundsException',
        '[Junior Onesie, Retro Red Tee, Pulse Bike Light]',
      ],
      answer: 1,
      why: 'A for-each loop uses an Iterator behind the scenes. Removing from the list directly (not through the iterator) changes it under the iterator, and the next `next()` call detects that and throws **ConcurrentModificationException**. Use `items.removeIf(i -> i.startsWith("J"))`, or `iterator.remove()`.',
    },
    {
      q: `What does this print?
\`\`\`java
class Sku {
    final String code;
    Sku(String code) { this.code = code; }
}

Set<Sku> seen = new HashSet<>();
seen.add(new Sku("trailblazer-backpack"));
seen.add(new Sku("trailblazer-backpack"));
System.out.println(seen.size());
\`\`\``,
      options: ['1', '2', '0', 'Compile error'],
      answer: 1,
      why: '`Sku` does not override `equals`/`hashCode`, so the set uses `Object`\'s identity versions: two `new` objects are always different, and the size is **2**. Duplicate detection quietly fails. A `record Sku(String code)` (or overriding both methods) gives **1**.',
    },
    {
      q: `What happens on the last line?
\`\`\`java
List<String> expectedNames = List.of("Junior Onesie", "Pulse Bike Light");
List<String> copy = expectedNames;
copy.add("Retro Red Tee");
\`\`\``,
      options: [
        'Both lists now contain three names',
        'Only copy contains three names',
        'UnsupportedOperationException',
        'Compile error',
      ],
      answer: 2,
      why: '`List.of` creates an **unmodifiable** list, and `copy` is just another reference to the same list, so `add` throws **UnsupportedOperationException** at run time (it compiles fine, because the `List` interface has `add`). That is a feature for expected data: nobody can accidentally change it.',
    },
  ],
  hints: [
    'A method receives a COPY of the variable. For objects, that copy is a reference to the same object.',
    'Reassigning a parameter never affects the caller; calling methods on the object it points to does.',
  ],
  explanation: `**Java is always pass-by-value.** The trick is knowing *what* the value is:

* For primitives (\`int\`, \`double\`, \`boolean\`), the value is the number itself. The method works on a copy.
* For objects (\`List\`, \`WebDriver\`, \`String\`), the value is a **reference**, like a house address. The method gets a copy of the address:
  * calling methods through it (\`cart.add(...)\`, \`driver.get(...)\`) changes **the same object** the caller sees,
  * reassigning it (\`cart = new ArrayList<>()\`) only changes where the *local copy* points.

The same idea explains \`List<Double> expected = actual;\`: assignment copies the reference, so you now have **two names for one list**. To get a second list you need \`new ArrayList<>(actual)\`, \`List.copyOf(actual)\` or a stream \`.toList()\`.

Collection rules that go with it:
* Don't remove from a list while looping over it with for-each. Use \`removeIf\` or an explicit \`Iterator\`.
* \`HashSet\`/\`HashMap\` rely on \`equals\` + \`hashCode\`. Classes without them compare by identity.
* \`List.of\`, \`Set.of\`, \`Map.of\` and \`.toList()\` are unmodifiable. Great for expected data, but you can't build on them.`,
  mistakes: [
    'Writing void helpers that reassign a parameter and expecting the caller to see the new value. Return it instead.',
    'Using expected = actual and believing a sorted copy was created.',
    'Removing elements inside a for-each loop instead of using removeIf.',
    'Putting objects without equals/hashCode into a Set to find duplicates.',
  ],
  interview: [
    { q: 'Is Java pass-by-value or pass-by-reference?', a: 'Always pass-by-value. For objects the value passed is a copy of the reference, so a method can change the object\'s state through it, but it can\'t make the caller\'s variable point at a different object. That is why page methods that modify a passed-in list work, while reassigning a parameter doesn\'t.' },
    { q: 'How do you safely remove items from a list while iterating?', a: 'Use list.removeIf(predicate), an explicit Iterator with iterator.remove(), or build a new filtered list with streams. Removing directly inside a for-each loop throws ConcurrentModificationException.' },
    { q: 'Shallow copy vs deep copy?', a: 'A shallow copy (new ArrayList<>(list)) creates a new list holding the same element references. A deep copy also copies each element. With immutable elements (Strings, records) a shallow copy is enough. That\'s one more reason to keep test data immutable.' },
  ],
}
