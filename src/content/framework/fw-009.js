export default {
  id: 'fw-009',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'RetryAnalyzer for flaky tests (and why it is a band-aid)',
  level: 'ADVANCED',
  tags: ['testng', 'retry', 'flaky-tests', 'listeners'],
  estMinutes: 25,
  scenario: `The QA environment is shared with performance testing on Tuesdays, and ~3% of UI tests fail randomly with
timeouts. The release manager asks for "green builds" and someone proposes \`invocationCount = 3\`. You propose a
controlled retry: max 1–2 retries, every retry visible in the report, and a ticket for each flaky test.`,
  description: `Implement a retry mechanism.

**Rules**
- \`RetryAnalyzer implements IRetryAnalyzer\` with a max retry count (read from config, default 1) and a counter per instance.
- \`retry(ITestResult)\` returns \`true\` while \`count < max\` and logs which test is being retried and the attempt number.
- \`RetryTransformer implements IAnnotationTransformer\` sets the analyzer on every test (\`annotation.setRetryAnalyzer(...)\`) so nobody has to annotate 300 tests.
- Register the transformer as a listener in testng.xml.`,
  starterCode: `package com.shopeasy.listeners;

import org.testng.IRetryAnalyzer;
import org.testng.ITestResult;

public class RetryAnalyzer {

    public boolean retry(ITestResult result) {
        return true; // TODO: this retries forever!
    }
}

// TODO: IAnnotationTransformer that applies RetryAnalyzer to all tests
`,
  solution: `package com.shopeasy.listeners;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.testng.IAnnotationTransformer;
import org.testng.IRetryAnalyzer;
import org.testng.ITestResult;
import org.testng.annotations.ITestAnnotation;

public class RetryAnalyzer implements IRetryAnalyzer {

    private static final Logger log = LogManager.getLogger(RetryAnalyzer.class);
    private static final int MAX_RETRIES = Integer.parseInt(System.getProperty("retries", "1"));

    private int count = 0;

    @Override
    public boolean retry(ITestResult result) {
        if (count < MAX_RETRIES) {
            count++;
            log.warn("Retrying {} (attempt {} of {}) after: {}",
                    result.getMethod().getMethodName(), count, MAX_RETRIES,
                    result.getThrowable() == null ? "unknown" : result.getThrowable().getMessage());
            return true;
        }
        return false;
    }
}

class RetryTransformer implements IAnnotationTransformer {
    @Override
    public void transform(ITestAnnotation annotation, Class testClass,
                          Constructor testConstructor, Method testMethod) {
        annotation.setRetryAnalyzer(RetryAnalyzer.class);
    }
}

// testng.xml
// <listeners>
//   <listener class-name="com.shopeasy.listeners.RetryTransformer"/>
// </listeners>
`,
  checks: [
    { label: 'Implements IRetryAnalyzer', pattern: 'class\\s+RetryAnalyzer\\s+implements\\s+IRetryAnalyzer', hint: 'public class RetryAnalyzer implements IRetryAnalyzer' },
    { label: 'Has a max retry limit', pattern: '(MAX|max)\\w*\\s*=[^;]*\\d', hint: 'private static final int MAX_RETRIES = 1;' },
    { label: 'Retries only while below the limit', pattern: 'if\\s*\\(\\s*\\w+\\s*<\\s*\\w+\\s*\\)[\\s\\S]*?\\+\\+[\\s\\S]*?return\\s+true', hint: 'if (count < MAX) { count++; return true; }' },
    { label: 'Never retries forever', pattern: 'boolean\\s+retry\\s*\\([^)]*\\)\\s*\\{\\s*return\\s+true\\s*;\\s*\\}', mustNot: true, hint: 'Return false once the limit is reached' },
    { label: 'Logs the retry', pattern: '(log|logger|LOG)\\.(warn|info)\\s*\\([^;]*[Rr]etry', hint: 'Every retry must be visible in the logs/report' },
    { label: 'Applied globally via IAnnotationTransformer', pattern: 'implements\\s+IAnnotationTransformer[\\s\\S]*?setRetryAnalyzer\\s*\\(\\s*RetryAnalyzer\\.class', hint: 'annotation.setRetryAnalyzer(RetryAnalyzer.class)' },
  ],
  hints: [
    'TestNG creates one analyzer instance per test method, so an instance counter works.',
    'retry(): if (count < MAX) { count++; log; return true; } return false;',
    'IAnnotationTransformer.transform(...) receives every @Test annotation; call setRetryAnalyzer there.',
  ],
  explanation: `How TestNG retry works: when a test fails, TestNG asks its \`IRetryAnalyzer\`. If \`retry()\` returns \`true\`
the failed attempt is marked **SKIPPED** (newer TestNG versions flag it as retried) and the test runs again; the final
attempt decides PASS/FAIL. The transformer attaches the analyzer to all tests without touching them.

**Why it is a band-aid** (this is what interviewers want to hear):
- Retries **hide** real problems: race conditions in the app, missing waits in your framework, test-data collisions
  in parallel runs. A test that passes on attempt 2 may be revealing a genuine intermittent production bug.
- They **cost time**: each retry is a full browser test.
- The healthy process: retry at most 1, **report** every retried test (flaky dashboard), open a ticket, fix the root
  cause (usually synchronisation or data isolation), or quarantine the test into a \`flaky\` group until fixed.

Never retry assertion failures on business logic blindly; some teams only retry on \`TimeoutException\` /
\`StaleElementReferenceException\` by checking \`result.getThrowable()\`.`,
  mistakes: [
    'Returning true unconditionally, creating an infinite loop.',
    'Using a static counter shared across all tests and threads.',
    'Retrying silently, so nobody notices the suite is becoming flaky.',
    'Raising the retry count instead of fixing waits and test data.',
  ],
  interview: [
    { q: 'How do you handle flaky tests?', a: 'First find the cause: synchronisation (replace sleeps with explicit waits), test data collisions, environment instability, or a real intermittent bug. Track flaky tests, quarantine them if needed, and use at most one automatic retry with full visibility as a temporary safety net.' },
    { q: 'Is a retry analyzer a good practice?', a: 'It is acceptable as a limited, visible safety net for infrastructure noise, but it is a band-aid. It can mask real defects and slows the suite, so every retried test should be reported and root-caused.' },
    { q: 'How do you apply a retry analyzer to all tests?', a: 'Implement IAnnotationTransformer and call annotation.setRetryAnalyzer(RetryAnalyzer.class) in transform(), then register it as a listener in testng.xml (annotation transformers must be registered in XML or via ServiceLoader, not via @Listeners on a class).' },
  ],
}
