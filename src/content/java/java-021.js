export default {
  id: 'java-021',
  category: 'java',
  kind: 'code',
  title: 'LocalDate and DateTimeFormatter: check order and delivery dates',
  level: 'INTERMEDIATE',
  tags: ['dates', 'localdate', 'datetimeformatter', 'java-time'],
  estMinutes: 25,
  scenario: `Story SHOP-1204: "Estimated delivery is 5 days after the order date." The orders API (\`POST /api/orders\`) returns \`createdAt\` as an ISO timestamp like \`2026-11-19T10:15:30.000Z\`. The confirmation page shows \`Estimated delivery: 24 Nov 2026\`.
The first version of the test compared the two as Strings and used \`SimpleDateFormat\`. It failed at month end, when \`"28 Nov"\` plus 5 days had to become \`"03 Dec"\`, and it failed again on a laptop with a German locale.
You'll rewrite it with **java.time**. The same class also has to produce the value for the seller form's \`#start-date\` field (\`form.html\`), which must be a future date.`,
  description: `Complete \`DeliveryDateCheck\`. \`today\` is passed in as a parameter (not \`LocalDate.now()\` inside the methods), so the test always gets the same result.

**Acceptance**
* \`LocalDate orderDate(String createdAt)\`: turn \`"2026-11-19T10:15:30.000Z"\` into the date \`2026-11-19\` (\`LocalDate.parse(createdAt.substring(0, 10))\` or \`OffsetDateTime.parse(createdAt).toLocalDate()\`).
* \`LocalDate shownDelivery(String uiText)\`: parse \`"Estimated delivery: 24 Nov 2026"\` with \`DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)\` after removing the label.
* \`boolean deliveryIsCorrect(String createdAt, String uiText)\`: expected = order date **\`plusDays(5)\`**, compared with \`equals\`/\`isEqual\`.
* \`String startDateValue(LocalDate today)\`: today + 7 days in the \`yyyy-MM-dd\` format that \`<input type="date">\` uses (\`format(DateTimeFormatter.ISO_LOCAL_DATE)\`).
* \`boolean isInFuture(LocalDate date, LocalDate today)\` uses \`isAfter\`.
* No \`java.util.Date\` and no \`SimpleDateFormat\`.`,
  hints: [
    'LocalDate.parse("2026-11-19") understands the ISO format with no formatter. For "24 Nov 2026" you need ofPattern("d MMM yyyy", Locale.ENGLISH).',
    'LocalDate is immutable: orderDate.plusDays(5) returns a NEW date, so store it.',
    'Remove the label first: uiText.replace("Estimated delivery:", "").trim()',
  ],
  language: 'java',
  starterCode: `package com.shop.tests;

import java.text.SimpleDateFormat;
import java.util.Date;

public class DeliveryDateCheck {

    public static boolean deliveryIsCorrect(String createdAt, String uiText) throws Exception {
        // Old approach: string surgery on dates. Breaks at month end and on other locales.
        int day = Integer.parseInt(createdAt.substring(8, 10)) + 5;
        String expected = "Estimated delivery: " + day + " Nov 2026";
        return expected == uiText;
    }

    public static String startDateValue() {
        return new SimpleDateFormat("yyyy-MM-dd").format(new Date());
    }

    // TODO: LocalDate orderDate(String createdAt)
    // TODO: LocalDate shownDelivery(String uiText)
    // TODO: rewrite deliveryIsCorrect with plusDays(5)
    // TODO: String startDateValue(LocalDate today)  -> today + 7 days, yyyy-MM-dd
    // TODO: boolean isInFuture(LocalDate date, LocalDate today)
}
`,
  solution: `package com.shop.tests;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public class DeliveryDateCheck {

    // "24 Nov 2026": English month names whatever the machine's locale is
    private static final DateTimeFormatter UI_DATE =
            DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);
    private static final int DELIVERY_DAYS = 5;

    /** "2026-11-19T10:15:30.000Z" -> 2026-11-19 */
    public static LocalDate orderDate(String createdAt) {
        return LocalDate.parse(createdAt.substring(0, 10));   // ISO date needs no formatter
    }

    /** "Estimated delivery: 24 Nov 2026" -> 2026-11-24 */
    public static LocalDate shownDelivery(String uiText) {
        String datePart = uiText.replace("Estimated delivery:", "").trim();
        return LocalDate.parse(datePart, UI_DATE);
    }

    public static boolean deliveryIsCorrect(String createdAt, String uiText) {
        LocalDate expected = orderDate(createdAt).plusDays(DELIVERY_DAYS);   // handles month/year ends
        LocalDate shown = shownDelivery(uiText);
        return expected.isEqual(shown);
    }

    /** Value to type into input#start-date: yyyy-MM-dd */
    public static String startDateValue(LocalDate today) {
        return today.plusDays(7).format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    public static boolean isInFuture(LocalDate date, LocalDate today) {
        return date.isAfter(today);
    }

    public static void main(String[] args) {
        LocalDate today = LocalDate.of(2026, 11, 19);   // fixed "today" = the same result every run
        System.out.println(deliveryIsCorrect("2026-11-19T10:15:30.000Z", "Estimated delivery: 24 Nov 2026")); // true
        System.out.println(deliveryIsCorrect("2026-11-28T09:00:00.000Z", "Estimated delivery: 3 Dec 2026"));  // true
        String start = startDateValue(today);   // "2026-11-26"
        System.out.println(start + " in future: " + isInFuture(LocalDate.parse(start), today));
    }
}
`,
  checks: [
    { label: 'Parses dates with LocalDate.parse', pattern: 'LocalDate\\.parse\\s*\\(', hint: 'LocalDate.parse(createdAt.substring(0, 10))' },
    { label: 'Defines a pattern with DateTimeFormatter.ofPattern', pattern: 'DateTimeFormatter\\.ofPattern\\s*\\(\\s*"[^"]*MMM[^"]*"', hint: 'DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)' },
    { label: 'Fixes the locale for month names', pattern: 'Locale\\.(ENGLISH|US|UK)', hint: 'Without a Locale, "Nov" fails to parse on a machine set to another language.' },
    { label: 'Adds days with plusDays', pattern: '\\.plusDays\\s*\\(', hint: 'orderDate.plusDays(5)' },
    { label: 'Compares dates with isEqual/equals/isAfter', pattern: '\\.(isEqual|isAfter|isBefore)\\s*\\(|LocalDate[\\s\\S]*\\.equals\\s*\\(', hint: 'expected.isEqual(shown) and date.isAfter(today)' },
    { label: 'Formats the date for the input field', pattern: '\\.format\\s*\\(\\s*(DateTimeFormatter\\.ISO_LOCAL_DATE|\\w+)\\s*\\)', hint: 'today.plusDays(7).format(DateTimeFormatter.ISO_LOCAL_DATE)' },
    { label: 'No legacy Date / SimpleDateFormat', pattern: '(SimpleDateFormat|new\\s+Date\\s*\\()', mustNot: true, hint: 'Use java.time (LocalDate, DateTimeFormatter) instead.' },
  ],
  explanation: `**java.time** (Java 8+) is the modern date API, and \`LocalDate\` is the type for a date with no time of day. That's what a delivery date or a date field on a form is.

* **Parsing**: \`LocalDate.parse("2026-11-19")\` reads the ISO format directly. For anything else, describe the format with \`DateTimeFormatter.ofPattern\`: \`d\` = day, \`MMM\` = short month name, \`yyyy\` = year. Use \`d\` rather than \`dd\` when the page shows "3 Dec" without a leading zero.
* **Locale**: \`MMM\` depends on the language, so "Nov" only parses with an English locale. Fixing \`Locale.ENGLISH\` makes the test behave the same on every machine and CI agent.
* **Date arithmetic**: \`plusDays(5)\` knows calendar rules, so 28 Nov + 5 days is 3 Dec and 30 Dec + 5 days lands in January. String surgery gets these wrong.
* **Comparing**: \`isEqual\`, \`isBefore\`, \`isAfter\` (or \`equals\`) compare dates by value. Never compare formatted Strings: "3 Dec" vs "03 Dec" are equal dates but different text.
* **Formatting**: \`<input type="date">\` stores its value as \`yyyy-MM-dd\`, which is \`DateTimeFormatter.ISO_LOCAL_DATE\`.
* **Testability**: \`today\` comes in as a parameter, so the expected values never change with the date the test runs. Frameworks often inject a \`java.time.Clock\` for the same reason.

\`LocalDate\` can't be changed (like String), which is why \`plusDays\` returns a new date.`,
  mistakes: [
    'Calling date.plusDays(5); without storing the result, so the original date is unchanged.',
    'Using MM (month number) when you meant mm (minutes), or YYYY (week-based year) instead of yyyy, which gives the wrong year in the last days of December.',
    'Parsing month names without Locale.ENGLISH, so the test passes locally and fails on a CI agent with another locale.',
    'Calling LocalDate.now() deep inside the logic, which makes expected values change every day and the test impossible to reproduce.',
  ],
  interview: [
    { q: 'Why prefer java.time over java.util.Date and SimpleDateFormat?', a: 'java.time types can\'t be changed after creation, are thread-safe, and have clear names (LocalDate, LocalDateTime, ZonedDateTime, Instant). SimpleDateFormat is not thread-safe, which causes random failures in parallel tests, and Date mixes date, time and time zone in confusing ways.' },
    { q: 'LocalDate vs LocalDateTime vs ZonedDateTime vs Instant?', a: 'LocalDate is a calendar date, LocalDateTime is a date and time with no time zone, ZonedDateTime adds a time zone, and Instant is a point on the UTC timeline (what an API timestamp ending in Z represents). Use the simplest type that matches what the UI shows.' },
    { q: 'How do you test date-dependent features reliably?', a: 'Never hard-code today\'s date in expected values. Compute expected dates from a known base date with plusDays, pass "today" or a Clock in as a parameter, and include boundary data such as month end, year end and February 29.' },
  ],
}
