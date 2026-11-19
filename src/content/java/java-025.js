export default {
  id: 'java-025',
  category: 'java',
  kind: 'code',
  title: 'Records for expected vs actual cart data: equals, immutability and BigDecimal',
  level: 'ADVANCED',
  tags: ['records', 'equals-hashcode', 'immutability', 'bigdecimal', 'test-data'],
  estMinutes: 30,
  scenario: `The cart test reads every \`.cart-item\` on \`cart.html\` into \`CartItem\` objects and asserts \`assertEquals(actual, expected)\`. It failed with
\`expected [CartItem@5e9f23b4, CartItem@4783da3f] but found [CartItem@1b6d3586, CartItem@4554617c]\` even though the data was identical.
In the same sprint, one test called \`expected.get(0).setPrice(0)\` on shared expected data, and three other tests failed at random depending on run order.
Both bugs have the same fix in Java 17: model test data as **records**, which can't be changed after creation and compare by value.`,
  description: `Replace the mutable \`CartItem\` class and add a \`Cart\`.

**Acceptance**
* \`record CartItem(String name, BigDecimal price, int quantity)\`.
* A **compact constructor** that validates and normalizes:
  * name not null/blank → otherwise \`IllegalArgumentException\`; store it trimmed,
  * price not negative (\`compareTo(BigDecimal.ZERO) < 0\` → throw),
  * quantity at least 1,
  * price normalized to 2 decimals (\`setScale(2, RoundingMode.HALF_UP)\`) so \`29.9\` and \`29.90\` are equal.
* \`static CartItem fromUi(String name, String priceText)\` builds an item from \`getText()\` values like \`"$29.99"\` with \`new BigDecimal(...)\`, quantity 1.
* \`record Cart(List<CartItem> items)\` whose compact constructor stores \`List.copyOf(items)\` (no outside changes can leak in), plus \`BigDecimal subtotal()\` summing \`price × quantity\` with \`BigDecimal.ZERO\` + \`add\`/\`multiply\` (or \`reduce\`).
* No setters and no \`class CartItem\` left.`,
  hints: [
    'record CartItem(String name, BigDecimal price, int quantity) { public CartItem { ...checks...; name = name.trim(); } }: in a compact constructor you assign to the parameter names.',
    'new BigDecimal(priceText.replace("$", "").replace(",", "").trim())',
    'BigDecimal total = BigDecimal.ZERO; for (CartItem i : items) total = total.add(i.price().multiply(BigDecimal.valueOf(i.quantity())));',
  ],
  language: 'java',
  starterCode: `package com.shop.data;

import java.util.ArrayList;
import java.util.List;

public class CartData {

    // equals() is not overridden -> two identical items are never "equal"
    static class CartItem {
        private String name;
        private double price;
        private int quantity;

        CartItem(String name, double price, int quantity) {
            this.name = name;
            this.price = price;
            this.quantity = quantity;
        }

        public String getName() { return name; }
        public double getPrice() { return price; }
        public void setPrice(double price) { this.price = price; }   // anyone can change shared data
    }

    public static void main(String[] args) {
        List<CartItem> expected = new ArrayList<>();
        expected.add(new CartItem("Trailblazer Backpack", 29.99, 1));
        expected.add(new CartItem("Pulse Bike Light", 9.99, 1));

        List<CartItem> actual = new ArrayList<>();
        actual.add(new CartItem("Trailblazer Backpack", 29.99, 1));
        actual.add(new CartItem("Pulse Bike Light", 9.99, 1));

        System.out.println(expected.equals(actual));   // false!

        // TODO: record CartItem(String name, BigDecimal price, int quantity) with a validating compact constructor
        // TODO: static CartItem fromUi(String name, String priceText)
        // TODO: record Cart(List<CartItem> items) with List.copyOf and subtotal()
    }
}
`,
  solution: `package com.shop.data;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

public class CartData {

    record CartItem(String name, BigDecimal price, int quantity) {

        // compact constructor: runs before the fields are assigned
        public CartItem {
            if (name == null || name.isBlank()) {
                throw new IllegalArgumentException("Cart item name is required");
            }
            if (price == null || price.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Price must be >= 0 for " + name + " but was " + price);
            }
            if (quantity < 1) {
                throw new IllegalArgumentException("Quantity must be >= 1 for " + name + " but was " + quantity);
            }
            name = name.trim();
            price = price.setScale(2, RoundingMode.HALF_UP);   // 29.9 and 29.90 become equal
        }

        /** Build from texts read on cart.html: ".item-name" and ".item-price" ("$29.99"). */
        static CartItem fromUi(String name, String priceText) {
            String digits = priceText.replace("$", "").replace(",", "").trim();
            return new CartItem(name, new BigDecimal(digits), 1);
        }
    }

    record Cart(List<CartItem> items) {

        public Cart {
            items = List.copyOf(items);   // cannot be changed from outside, rejects null elements
        }

        BigDecimal subtotal() {
            return items.stream()
                    .map(item -> item.price().multiply(BigDecimal.valueOf(item.quantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }

    public static void main(String[] args) {
        Cart expected = new Cart(List.of(
                new CartItem("Trailblazer Backpack", new BigDecimal("29.99"), 1),
                new CartItem("Pulse Bike Light", new BigDecimal("9.99"), 1)));

        // what the cart page returned via getText()
        Cart actual = new Cart(List.of(
                CartItem.fromUi(" Trailblazer Backpack ", "$29.99"),
                CartItem.fromUi("Pulse Bike Light", "$9.99")));

        System.out.println(expected.equals(actual));        // true: records compare field by field
        System.out.println(actual);                         // Cart[items=[CartItem[name=Trailblazer Backpack, price=29.99, quantity=1], ...]]
        System.out.println("Subtotal: $" + actual.subtotal()); // 39.98
    }
}
`,
  checks: [
    { label: 'CartItem is a record with name, BigDecimal price and int quantity', pattern: 'record\\s+CartItem\\s*\\(\\s*String\\s+\\w+\\s*,\\s*BigDecimal\\s+\\w+\\s*,\\s*int\\s+\\w+\\s*\\)', hint: 'record CartItem(String name, BigDecimal price, int quantity) { ... }' },
    { label: 'Compact constructor validates input', pattern: '(public\\s+)?CartItem\\s*\\{[\\s\\S]*?throw\\s+new\\s+IllegalArgumentException', hint: 'public CartItem { if (quantity < 1) throw new IllegalArgumentException(...); }' },
    { label: 'Normalizes the price scale', pattern: '\\.setScale\\s*\\(\\s*2', hint: 'price = price.setScale(2, RoundingMode.HALF_UP);' },
    { label: 'Parses UI price text into BigDecimal', pattern: 'new\\s+BigDecimal\\s*\\(\\s*\\w+', hint: 'new BigDecimal(priceText.replace("$", "").trim())' },
    { label: 'Cart stores an unmodifiable copy of the list', pattern: 'List\\.copyOf\\s*\\(', hint: 'public Cart { items = List.copyOf(items); }' },
    { label: 'Sums money with BigDecimal', pattern: 'BigDecimal\\.ZERO[\\s\\S]*(\\.add\\b|BigDecimal::add)', hint: '.reduce(BigDecimal.ZERO, BigDecimal::add) or total = total.add(...)' },
    { label: 'No mutable CartItem class or setters left', pattern: '(class\\s+CartItem\\b|void\\s+set\\w+\\s*\\()', mustNot: true, hint: 'Replace the class with a record. Records have no setters.' },
  ],
  explanation: `A **record** (Java 16+) is a class whose job is to hold data. From one line \`record CartItem(String name, BigDecimal price, int quantity)\` Java generates:

* \`private final\` fields and a constructor,
* accessors \`name()\`, \`price()\`, \`quantity()\` (no \`get\` prefix, and **no setters**),
* \`equals\` and \`hashCode\` that compare **every field**,
* a readable \`toString()\`: \`CartItem[name=Pulse Bike Light, price=9.99, quantity=1]\`.

That fixes both bugs:
1. **Expected vs actual**: \`List.equals\` calls \`equals\` on each element. Without an override, \`Object.equals\` compares references, so two identical items are "different" and the report shows \`CartItem@5e9f23b4\`. Records compare values and print the values.
2. **Shared data that changes**: records can't be modified, and \`List.copyOf\` makes the cart's list unmodifiable too. A test can't change data another test relies on.

The **compact constructor** (\`public CartItem { ... }\`) runs before the fields are assigned. Validate there, and reassign the *parameters* (\`name = name.trim()\`) to normalize. Every \`CartItem\` that exists is then valid.

**BigDecimal** stores money exactly. Watch one subtlety: \`BigDecimal.equals\` also compares the **scale** (number of decimals), so \`29.9\` is *not* equal to \`29.90\`. Normalizing with \`setScale(2, ...)\` in the constructor makes record equality behave like the business expects. (\`compareTo\` ignores the scale.)

If you write a normal class instead, you must override **both** \`equals\` and \`hashCode\` (IDE-generated or \`Objects.equals\`/\`Objects.hash\`). Overriding only \`equals\` breaks \`HashSet\` and \`HashMap\`.`,
  mistakes: [
    'Overriding equals without hashCode, so equal objects end up in different HashSet buckets and contains() returns false.',
    'Using double for prices and getting 39.980000000000004 in a subtotal assertion.',
    'Comparing BigDecimals with equals when the scale differs ("29.9" vs "29.90"). Normalize the scale or use compareTo.',
    'Storing the caller\'s list directly in an object, so a later list.add() elsewhere silently changes the "expected" data.',
  ],
  interview: [
    { q: 'What is the contract between equals and hashCode?', a: 'If two objects are equal by equals(), they must return the same hashCode(). Hash-based collections first look in the hashCode bucket, then call equals. Breaking the contract makes HashSet/HashMap miss elements that are logically present. Records and IDE-generated methods follow the contract.' },
    { q: 'What is a record and when would you use one in a test framework?', a: 'A record is a compact, immutable data carrier with constructor, accessors, equals, hashCode and toString generated. Use it for test data and expected values: users, products, cart lines, API response models. Not for page objects, which have behaviour and a driver.' },
    { q: 'Why does immutability matter in test code?', a: 'Test data is often shared between tests, steps or threads. If any of them can change it, the results depend on execution order and break randomly in parallel runs. Immutable objects (records, List.copyOf, final fields) remove that whole class of bugs.' },
  ],
}
