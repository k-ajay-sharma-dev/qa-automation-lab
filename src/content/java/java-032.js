export default {
  id: 'java-032',
  category: 'java',
  kind: 'quiz',
  title: 'Streams on product data: filter, map, anyMatch and allMatch traps',
  level: 'INTERMEDIATE',
  tags: ['streams', 'lambdas', 'anymatch', 'allmatch', 'interview', 'output-prediction'],
  estMinutes: 12,
  scenario: `Your team replaced the loops in the ShopEasy inventory checks with streams. The code got shorter, and one check got wrong: "every product has a price above zero" passed on a build where the inventory page showed **no products at all**.
Before you review more stream code, predict what these snippets really do.`,
  description: `All questions use the six ShopEasy products in page order:

\`\`\`java
record Product(String name, double price) { }

List<Product> products = List.of(
        new Product("Trailblazer Backpack", 29.99),
        new Product("Pulse Bike Light", 9.99),
        new Product("Classic Crew T-Shirt", 15.99),
        new Product("Storm Fleece Jacket", 49.99),
        new Product("Junior Onesie", 7.99),
        new Product("Retro Red Tee", 15.99));
\`\`\``,
  questions: [
    {
      q: `What does this print?
\`\`\`java
List<String> cheap = products.stream()
        .filter(p -> p.price() < 16)
        .map(Product::name)
        .collect(Collectors.toList());
System.out.println(cheap);
\`\`\``,
      options: [
        '[Junior Onesie, Pulse Bike Light, Classic Crew T-Shirt, Retro Red Tee]',
        '[Pulse Bike Light, Classic Crew T-Shirt, Junior Onesie, Retro Red Tee]',
        '[Pulse Bike Light, Junior Onesie]',
        '[9.99, 15.99, 7.99, 15.99]',
      ],
      answer: 1,
      why: '`filter` keeps items whose price is below 16 (both 15.99 products pass) and **keeps the source order**. A stream never sorts unless you call `sorted()`. `map(Product::name)` turns each product into its name, so you get Strings, not prices.',
    },
    {
      q: `What does this print?
\`\`\`java
long tees = products.stream()
        .filter(p -> p.name().contains("Tee"))
        .count();
System.out.println(tees);
\`\`\``,
      options: ['0', '1', '2', '3'],
      answer: 1,
      why: '`contains` is case-sensitive and literal. "Retro Red Tee" contains "Tee"; "Classic Crew T-Shirt" does not. Streams do not make text matching smarter. If the requirement is "all t-shirts", the test data or the predicate needs to say so explicitly.',
    },
    {
      q: 'The page showed **no products**, so `products` is an empty list. What does `products.stream().allMatch(p -> p.price() > 0)` return?',
      options: [
        'false, because there is nothing to match',
        'true',
        'It throws NoSuchElementException',
        'null',
      ],
      answer: 1,
      why: '`allMatch` on an empty stream is **true** (there is no item that breaks the rule). That is exactly how the check passed on an empty page. Assert the list is not empty first, e.g. `assertFalse(products.isEmpty(), "No products shown")`. By the same logic `anyMatch` on an empty stream is false and `noneMatch` is true.',
    },
    {
      q: 'Which line best expresses "the inventory contains a product called Junior Onesie"?',
      options: [
        '`products.stream().allMatch(p -> p.name().equals("Junior Onesie"))`',
        '`products.stream().filter(p -> p.name().equals("Junior Onesie")).count() > 1`',
        '`products.stream().anyMatch(p -> p.name().equals("Junior Onesie"))`',
        '`products.stream().map(Product::name).equals("Junior Onesie")`',
      ],
      answer: 2,
      why: '`anyMatch` returns true as soon as one item matches and stops there. `allMatch` would require every product to be the onesie; `count() > 1` misses the single match; and the last option compares a Stream object with a String, which is always false.',
    },
    {
      q: `What happens?
\`\`\`java
Stream<String> names = products.stream().map(Product::name);
System.out.println(names.count());
List<String> list = names.collect(Collectors.toList());
\`\`\``,
      options: [
        'Prints 6, then list holds the six names',
        'Prints 6, then the list is empty',
        'Prints 6, then throws IllegalStateException: stream has already been operated upon or closed',
        'Compile error: a stream cannot be stored in a variable',
      ],
      answer: 2,
      why: 'A stream can be consumed **once**. `count()` is a terminal operation that uses it up, so the second terminal call throws `IllegalStateException`. Keep the **list** in a variable and call `.stream()` again whenever you need a new pipeline.',
    },
  ],
  hints: [
    'filter/map keep the order of the source list unless you sort.',
    'Ask: what should allMatch say when there is nothing to check?',
  ],
  explanation: `A stream is a one-time pipeline over a collection: **intermediate** steps (\`filter\`, \`map\`, \`sorted\`) describe the work, and one **terminal** step (\`collect\`, \`count\`, \`anyMatch\`, \`allMatch\`) runs it.

* \`filter\` keeps matching items, \`map\` turns each item into something else; source order is kept.
* \`anyMatch\` = "at least one", \`allMatch\` = "every", \`noneMatch\` = "not a single one". All three stop early once the answer is known.
* On an **empty** stream \`allMatch\` and \`noneMatch\` are true. Always assert the data is not empty before an "every item…" check, or an empty page passes.
* A stream cannot be reused. Store the list, not the stream.`,
  mistakes: [
    'Writing allMatch checks without first asserting the list is not empty.',
    'Expecting filter or map to return items sorted.',
    'Storing a Stream in a field or variable and using it twice.',
  ],
  interview: [
    { q: 'What is the difference between intermediate and terminal operations?', a: 'Intermediate operations like filter, map and sorted return a new stream and are lazy: nothing runs yet. A terminal operation like collect, count, forEach or anyMatch triggers the whole pipeline and produces a result. Without a terminal operation nothing happens.' },
    { q: 'anyMatch vs filter(...).findFirst().isPresent()?', a: 'They give the same answer, but anyMatch states the intent directly and is shorter. Both are short-circuiting and stop at the first match.' },
    { q: 'Why can allMatch be dangerous in tests?', a: 'It is vacuously true on an empty collection. If the locator breaks and findElements returns an empty list, "all prices are positive" passes. Guard it with a non-empty assertion or an expected count.' },
  ],
}
