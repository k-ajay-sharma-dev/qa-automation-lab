export default {
  id: 'java-033',
  category: 'java',
  kind: 'quiz',
  title: 'equals and hashCode: why the duplicate-product check let duplicates through',
  level: 'ADVANCED',
  tags: ['equals-hashcode', 'hashset', 'collections', 'oop', 'interview', 'output-prediction'],
  estMinutes: 15,
  scenario: `Bug SHOP-1187: after a double click on Add to cart, ShopEasy showed **Retro Red Tee** twice in the cart. Your regression check reads the cart rows into \`Product\` objects and puts them in a \`HashSet\` to detect duplicates, and it passed on the buggy build.
The \`Product\` class was written by hand by a teammate before the team moved to records. Work out why.`,
  description: `Answer each question. Unless a question says otherwise, \`Product\` is a plain class with \`private final String name\` and \`private final double price\` and a constructor.`,
  questions: [
    {
      q: `The class overrides \`equals\` (comparing name and price) but **not** \`hashCode\`. What does this print?
\`\`\`java
Set<Product> rows = new HashSet<>();
rows.add(new Product("Retro Red Tee", 15.99));
rows.add(new Product("Retro Red Tee", 15.99));
System.out.println(rows.size());
\`\`\``,
      options: [
        '1, because equals says they are the same',
        '2 in practice, because the default hashCode differs per object and HashSet never calls equals across different buckets',
        'Compile error: hashCode must be overridden when equals is',
        'It throws IllegalStateException',
      ],
      answer: 1,
      why: 'HashSet first uses `hashCode()` to pick a bucket and only calls `equals` on items in the same bucket. Without an override, `hashCode` comes from `Object` and is (almost always) different for two separate objects, so the "duplicate" lands elsewhere and is kept. This is exactly why the SHOP-1187 check passed.',
    },
    {
      q: 'Neither `equals` nor `hashCode` is overridden. What does `List.of(new Product("Junior Onesie", 7.99)).contains(new Product("Junior Onesie", 7.99))` return?',
      options: ['true', 'false', 'It depends on the JVM', 'NullPointerException'],
      answer: 1,
      why: '`List.contains` uses `equals`. Object\'s default `equals` is `==`: same object in memory. Two separate `new Product(...)` calls are two objects, so the answer is false even though the data is identical. `assertEquals(expectedProduct, actualProduct)` fails for the same reason.',
    },
    {
      q: `A teammate "fixed" it like this. Both methods compare name and price. Does the HashSet now report size 1?
\`\`\`java
public boolean equals(Product other) {
    return name.equals(other.name) && price == other.price;
}

@Override
public int hashCode() {
    return Objects.hash(name, price);
}
\`\`\``,
      options: [
        'Yes, both methods are now implemented',
        'No: equals(Product) is an overload, not an override of equals(Object), so HashSet still uses Object.equals',
        'No, because Objects.hash cannot hash a double',
        'It does not compile',
      ],
      answer: 1,
      why: 'Collections call `equals(Object)`. A method with a `Product` parameter is a different method (an **overload**), so it is never called by HashSet. Now the hashes match but `Object.equals` (==) still says false, so the size is 2. Adding `@Override` would have made the compiler reject this mistake immediately.',
    },
    {
      q: 'Which statement about the equals/hashCode contract is correct?',
      options: [
        'If two objects have the same hashCode, they must be equal',
        'If two objects are equal by equals, they must return the same hashCode',
        'hashCode must be unique for every object',
        'equals only needs to be overridden if the class is used as a Map value',
      ],
      answer: 1,
      why: 'The rule only goes one way: **equal objects → equal hash codes**. Different objects may share a hash code (a collision); HashSet handles that by calling equals inside the bucket. Breaking the rule makes HashSet, HashMap keys and `contains` behave randomly.',
    },
    {
      q: 'The class is replaced by `record Product(String name, double price) { }`. What does the code from question 1 print now?',
      options: ['1', '2', 'Compile error: records cannot be stored in a HashSet', 'It depends on insertion order'],
      answer: 0,
      why: 'A record automatically gets `equals`, `hashCode` and `toString` based on **all** its components. Two records with the same name and price are equal and hash the same, so the set keeps one. Records are the simplest way to get correct value equality for test data.',
    },
  ],
  hints: [
    'HashSet looks at hashCode first and only then at equals.',
    'Collections call equals(Object o). Check the parameter type.',
  ],
  explanation: `Hash-based collections (\`HashSet\`, \`HashMap\` keys) find items in two steps: **hashCode** picks the bucket, then **equals** compares inside that bucket. Both must agree:

* Override **both** \`equals(Object)\` and \`hashCode()\`, using the same fields, e.g. \`Objects.equals(name, o.name) && Double.compare(price, o.price) == 0\` and \`Objects.hash(name, price)\`.
* Always add \`@Override\`. It turns the \`equals(Product)\` overload bug into a compile error.
* Prefer **records** for test data: Java generates a correct pair for you.
* Do not include fields that change after the object is put in a set (mutable hash keys get "lost" in their old bucket).

For SHOP-1187 a better duplicate check is to compare the cart row count with the set size, which now only works because equality is defined correctly.`,
  mistakes: [
    'Overriding equals but not hashCode, so HashSet and HashMap ignore your equality.',
    'Writing equals(Product other) instead of equals(Object o) and skipping @Override.',
    'Using a mutable field in hashCode and then changing it while the object is inside a HashSet.',
    'Asserting equality of hand-written data classes that never overrode equals, so the test compares references.',
  ],
  interview: [
    { q: 'What happens if you override equals but not hashCode?', a: 'Equal objects can get different hash codes, so HashSet keeps "duplicates" and HashMap.get with an equal key returns null. It breaks the contract that equal objects must have equal hash codes.' },
    { q: 'What is the difference between == and equals for objects?', a: '== checks whether two references point to the same object in memory. equals checks logical equality as defined by the class; Object.equals defaults to ==, so you must override it for value comparison.' },
    { q: 'How would you write equals for a class with a double field?', a: 'Check identity, null and class first, then compare fields with Objects.equals for objects and Double.compare(a, b) == 0 for doubles, which handles NaN and -0.0 correctly. Generate hashCode with Objects.hash over the same fields, or simply use a record.' },
  ],
}
