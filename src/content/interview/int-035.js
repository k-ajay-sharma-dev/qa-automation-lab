export default {
  id: 'int-035',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: check balanced brackets in a JSON payload template',
  level: 'INTERMEDIATE',
  tags: ['java', 'live-coding', 'stack', 'deque', 'strings'],
  estMinutes: 15,
  scenario: `Your team keeps RestAssured request bodies as template files, e.g. \`{"items":[{"productId":1,"quantity":2}]}\`. Last sprint someone deleted one \`]\` while editing and 20 API tests failed with a confusing 400. The interviewer says: *"Write a quick pre-check: are the brackets (), [] and {} balanced and correctly nested?"* This is the classic stack question — they want to hear the word **stack** and see you handle the wrong-closer and leftover-opener cases.`,
  description: `Implement \`isBalanced(String text)\` in \`BracketChecker\`.

- \`isBalanced("{\\"items\\":[{\\"productId\\":1}]}")\` → \`true\`
- \`isBalanced("{[}]")\` → \`false\` (wrong nesting)
- \`isBalanced("{\\"items\\":[")\` → \`false\` (unclosed)
- \`isBalanced("]")\` → \`false\` (closer with nothing open)

**Rules / Acceptance**
- Use a stack — prefer \`Deque<Character>\` with \`ArrayDeque\` over the legacy \`Stack\` class.
- Push every opener; on a closer, the stack must be non-empty and the top must be the matching opener.
- At the end the stack must be **empty**.
- Ignore all other characters. \`null\` returns \`false\`.`,
  hints: [
    'Deque<Character> stack = new ArrayDeque<>(); — push for (, [, {.',
    'For a closer: if (stack.isEmpty() || stack.pop().charValue() != expectedOpener) return false;',
    'The last line is return stack.isEmpty(); — "{[" has no wrong closer but is still unbalanced.',
  ],
  language: 'java',
  starterCode: String.raw`public class BracketChecker {

    public static boolean isBalanced(String text) {
        int open = 0;
        int close = 0;
        for (char c : text.toCharArray()) {
            if (c == '(' || c == '[' || c == '{') open++;
            if (c == ')' || c == ']' || c == '}') close++;
        }
        // TODO: counting is not enough - "{[}]" has equal counts
        return open == close;
    }

    public static void main(String[] args) {
        System.out.println(isBalanced("{\"items\":[{\"productId\":1}]}")); // true
        System.out.println(isBalanced("{[}]"));                           // false
    }
}
`,
  solution: String.raw`import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;

public class BracketChecker {

    private static final Map<Character, Character> PAIRS = Map.of(
            ')', '(',
            ']', '[',
            '}', '{');

    public static boolean isBalanced(String text) {
        if (text == null) {
            return false;
        }
        Deque<Character> stack = new ArrayDeque<>();
        for (char c : text.toCharArray()) {
            if (c == '(' || c == '[' || c == '{') {
                stack.push(c);
            } else if (PAIRS.containsKey(c)) {
                if (stack.isEmpty() || stack.pop().charValue() != PAIRS.get(c)) {
                    return false;   // closer with nothing open, or wrong nesting
                }
            }
        }
        return stack.isEmpty();     // leftover openers mean unclosed brackets
    }

    public static void main(String[] args) {
        System.out.println(isBalanced("{\"items\":[{\"productId\":1}]}")); // true
        System.out.println(isBalanced("{[}]"));                           // false
        System.out.println(isBalanced("{\"items\":["));                   // false
        System.out.println(isBalanced("]"));                              // false
    }
}
`,
  checks: [
    { label: 'Uses a stack (Deque/ArrayDeque or Stack)', pattern: 'ArrayDeque|Deque<|new\\s+Stack|LinkedList<', hint: 'Deque<Character> stack = new ArrayDeque<>();' },
    { label: 'Pushes openers', pattern: '\\.push\\s*\\(|\\.addFirst\\s*\\(|\\.offerFirst\\s*\\(', hint: 'stack.push(c) for (, [ and {' },
    { label: 'Pops and compares on a closer', pattern: '\\.pop\\s*\\(|\\.removeFirst\\s*\\(|\\.pollFirst\\s*\\(', hint: 'stack.pop() must be the matching opener' },
    { label: 'Checks for an empty stack before popping', pattern: 'isEmpty\\s*\\(\\s*\\)\\s*\\|\\||==\\s*null', hint: 'if (stack.isEmpty() || stack.pop() != ...) return false;' },
    { label: 'Returns whether the stack is empty at the end', pattern: 'return\\s+\\w+\\.isEmpty\\s*\\(\\s*\\)', hint: 'return stack.isEmpty(); catches unclosed openers like "{["' },
  ],
  explanation: `**Why a stack:** brackets close in **reverse order** of opening — last opened, first closed. That is exactly LIFO. Counting openers and closers (the starter) passes \`{[}]\`, which is wrong.

**The three failure cases to name before coding**
1. A closer when nothing is open → \`"]"\` (empty-stack check, otherwise \`pop()\` throws \`NoSuchElementException\`).
2. A closer that does not match the top → \`"{[}]"\`.
3. Openers left at the end → \`"{\\"items\\":["\` (the final \`isEmpty()\`).

**Why \`ArrayDeque\` over \`Stack\`:** \`Stack\` extends \`Vector\`, is synchronized for no reason and is documented as legacy; the Javadoc itself recommends \`Deque\`.

**Honest limitation to mention:** this ignores brackets inside JSON strings, so \`{"name":"Tee ]"}\` would be flagged. For real payloads I would just parse with Jackson (\`new ObjectMapper().readTree(json)\`) — the bracket checker is the interview version of that idea.`,
  mistakes: [
    'Only counting openers and closers, which accepts wrongly nested input like "{[}]".',
    'Calling pop() on an empty stack and crashing on input such as "]".',
    'Forgetting the final isEmpty() check, so "{[" is reported as balanced.',
    'Comparing two boxed Character objects with != (a reference comparison) — unbox one side with charValue() or use equals().',
  ],
  interview: [
    { q: 'What is the time and space complexity?', a: 'O(n) time — one pass over the characters — and O(n) space in the worst case, when the input is all openers.' },
    { q: 'Where would this be useful in a test framework?', a: 'As a fast sanity check on payload templates or generated JSON before sending, or on locator strings built dynamically. In practice I would parse the JSON with Jackson, which validates far more than brackets.' },
    { q: 'How would you handle brackets inside quoted strings?', a: 'Track an inString flag that flips on an unescaped double quote, and skip bracket logic while it is true. That is the start of a real tokenizer — which is why I would reach for a JSON library in production.' },
  ],
}
