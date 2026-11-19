export default {
  id: 'java-019',
  category: 'java',
  kind: 'code',
  title: 'Arrays and 2D table data: check the employee directory by column name',
  level: 'BEGINNER',
  tags: ['arrays', '2d-arrays', 'arraylist', 'tables'],
  estMinutes: 20,
  scenario: `The back-office **Employee directory** (\`table.html\`) is a paged table: Name, Department, Salary, Status, Action. A helper already reads page 1 into a \`String[][]\`, one inner array per row.
The old check used \`rows[3][3]\` to find "the inactive one". Then the product team added an "Id" column in a feature branch, every index moved by one, and the test started asserting on salaries.
The team lead wants checks that look up columns **by header name**.`,
  description: `Complete \`EmployeeTableCheck.main\` using the data below (page 1 of \`#employee-table\`, default order).

**Acceptance**
1. Find the column positions of \`"Name"\`, \`"Department"\`, \`"Salary"\` and \`"Status"\` by turning \`headers\` into a List (\`Arrays.asList(headers)\` or \`List.of(headers)\`) and calling \`indexOf\`. No hard-coded \`[3]\`.
2. Check that the page shows exactly **5** rows, using \`rows.length\` (arrays have a \`length\` *field*, not a \`size()\` method).
3. Loop over the rows and collect the names of everyone whose status is not \`Active\` into an \`ArrayList<String>\`. Expected: \`[James Wilson]\`.
4. Add up the salaries of the \`Engineering\` rows (\`"$85,000"\` → \`85000\` with \`Integer.parseInt\`). Expected: \`177000\`.
5. Throw an \`AssertionError\` if any of the three results is wrong.`,
  hints: [
    'int statusCol = Arrays.asList(headers).indexOf("Status");',
    'for (String[] row : rows) { String status = row[statusCol]; ... }  // each row is itself a String[]',
    'Integer.parseInt(row[salaryCol].replace("$", "").replace(",", ""))',
  ],
  language: 'java',
  starterCode: `package com.shop.tests;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class EmployeeTableCheck {

    public static void main(String[] args) {
        String[] headers = {"Name", "Department", "Salary", "Status", "Action"};
        String[][] rows = {
            {"Aarav Mehta", "Engineering", "$85,000", "Active", "Edit"},
            {"Emily Carter", "Marketing", "$62,000", "Active", "Edit"},
            {"Priya Sharma", "Engineering", "$92,000", "Active", "Edit"},
            {"James Wilson", "Finance", "$71,000", "Inactive", "Edit"},
            {"Sofia Rossi", "HR", "$58,000", "Active", "Edit"},
        };

        // Old check: magic positions - breaks as soon as a column is added
        System.out.println("Inactive: " + rows[3][0] + " -> " + rows[3][3]);

        // TODO 1: find column indexes by header name
        // TODO 2: check there are 5 rows (rows.length)
        // TODO 3: collect names of non-Active employees in an ArrayList
        // TODO 4: sum the Engineering salaries
        // TODO 5: throw AssertionError if anything is wrong
    }
}
`,
  solution: `package com.shop.tests;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class EmployeeTableCheck {

    public static void main(String[] args) {
        String[] headers = {"Name", "Department", "Salary", "Status", "Action"};
        String[][] rows = {
            {"Aarav Mehta", "Engineering", "$85,000", "Active", "Edit"},
            {"Emily Carter", "Marketing", "$62,000", "Active", "Edit"},
            {"Priya Sharma", "Engineering", "$92,000", "Active", "Edit"},
            {"James Wilson", "Finance", "$71,000", "Inactive", "Edit"},
            {"Sofia Rossi", "HR", "$58,000", "Active", "Edit"},
        };

        // 1. column positions by name: adding a column no longer breaks the test
        List<String> headerList = Arrays.asList(headers);
        int nameCol = headerList.indexOf("Name");
        int deptCol = headerList.indexOf("Department");
        int salaryCol = headerList.indexOf("Salary");
        int statusCol = headerList.indexOf("Status");

        // 2. arrays have a length FIELD (no brackets)
        int rowCount = rows.length;

        List<String> notActive = new ArrayList<>();
        int engineeringTotal = 0;

        // 3 + 4. each row is a String[]; read cells by column index
        for (String[] row : rows) {
            if (!row[statusCol].equals("Active")) {
                notActive.add(row[nameCol]);
            }
            if (row[deptCol].equals("Engineering")) {
                engineeringTotal += Integer.parseInt(row[salaryCol].replace("$", "").replace(",", ""));
            }
        }

        System.out.println("Rows: " + rowCount + ", not active: " + notActive + ", engineering total: " + engineeringTotal);

        // 5. one decision at the end
        if (rowCount != 5 || !notActive.equals(List.of("James Wilson")) || engineeringTotal != 177000) {
            throw new AssertionError("Employee table check failed: rows=" + rowCount
                    + " notActive=" + notActive + " engineeringTotal=" + engineeringTotal);
        }
        System.out.println("PASS");
    }
}
`,
  checks: [
    { label: 'Converts the header array to a List', pattern: '(Arrays\\.asList|List\\.of)\\s*\\(\\s*headers\\s*\\)', hint: 'List<String> headerList = Arrays.asList(headers);' },
    { label: 'Finds the Status column by name', pattern: '\\.indexOf\\s*\\(\\s*"Status"\\s*\\)', hint: 'int statusCol = headerList.indexOf("Status");' },
    { label: 'No hard-coded column index like [3]', pattern: '\\]\\s*\\[\\s*\\d+\\s*\\]|row\\s*\\[\\s*\\d+\\s*\\]', mustNot: true, hint: 'Use row[statusCol], not rows[3][3] or row[3].' },
    { label: 'Uses the array length field', pattern: 'rows\\.length\\b(?!\\s*\\()', hint: 'int rowCount = rows.length;' },
    { label: 'Collects names in an ArrayList', pattern: 'new\\s+ArrayList\\s*<[^>]*>\\s*\\(\\s*\\)[\\s\\S]*\\.add\\s*\\(', hint: 'List<String> notActive = new ArrayList<>(); ... notActive.add(row[nameCol]);' },
    { label: 'Parses salary text to a number', pattern: 'Integer\\.(parseInt|valueOf)\\s*\\(', hint: 'Integer.parseInt(row[salaryCol].replace("$", "").replace(",", ""))' },
    { label: 'Fails with an AssertionError', pattern: 'throw\\s+new\\s+AssertionError', hint: 'throw new AssertionError("Employee table check failed: ...");' },
  ],
  explanation: `**Arrays** are Java's most basic container: a fixed number of slots of one type.

| | \`String[]\` (array) | \`ArrayList<String>\` |
|---|---|---|
| Size | fixed when created | grows with \`add\` |
| Length | \`arr.length\` (field) | \`list.size()\` (method) |
| Read | \`arr[i]\` | \`list.get(i)\` |
| Search | none built in | \`indexOf\`, \`contains\` |

A **2D array** \`String[][]\` is an array of arrays, which is how a table looks: \`rows[i]\` is one row (a \`String[]\`), and \`rows[i][j]\` is one cell. A for-each over \`rows\` gives you each \`String[] row\` in turn.

The main point of this exercise is **column lookup by name**. \`Arrays.asList(headers)\` gives a List view of the header array, so you can call \`indexOf("Status")\`. When someone inserts an "Id" column, \`statusCol\` simply becomes 4 and the test keeps working. A hard-coded \`[3]\` would quietly read the wrong cell, which is worse than failing.

In a real Selenium test the 2D data comes from \`driver.findElements(By.cssSelector("#employee-table tbody tr"))\` and, for each row, \`row.findElements(By.tagName("td"))\`. The checking logic stays exactly the same.`,
  mistakes: [
    'Writing rows.length() or list.length: arrays use the length field, lists use size().',
    'Hard-coding column indexes, so the test silently reads the wrong cell after a column is added.',
    'Going one past the end with i <= rows.length, which throws ArrayIndexOutOfBoundsException. The last index is length - 1.',
    'Calling add() on Arrays.asList(...): that list has a fixed size and throws UnsupportedOperationException.',
  ],
  interview: [
    { q: 'What is the difference between an array and an ArrayList?', a: 'An array has a fixed size, can hold primitive values (int[]), and exposes length as a field. An ArrayList holds objects, grows automatically, and offers methods like add, remove, indexOf and contains. Test code mostly uses lists, but arrays still show up in method parameters, String.split results and TestNG data providers (Object[][]).' },
    { q: 'How would you read an HTML table into Java?', a: 'findElements for the header cells to build a column-name to index lookup, then findElements for the body rows, and for each row its td cells. Store the result as a List of Maps or a List of objects, and assert by column name rather than by index.' },
    { q: 'What does Arrays.asList return?', a: 'A fixed-size List backed by the original array: set() works and writes through to the array, but add/remove throw UnsupportedOperationException. Wrap it in new ArrayList<>(...) if you need to grow it.' },
  ],
}
