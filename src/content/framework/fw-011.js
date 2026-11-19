export default {
  id: 'fw-011',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Logging with Log4j2 instead of System.out.println',
  level: 'INTERMEDIATE',
  tags: ['logging', 'log4j2', 'debugging'],
  estMinutes: 15,
  scenario: `A CI run with 4 parallel threads failed and the console is a wall of \`System.out.println("clicked")\` lines
from four tests interleaved — no timestamps, no thread names, no idea which line belongs to which test. Your lead asks
for proper logging with **Log4j2**: levels, timestamps, thread names, and a log file archived by CI.`,
  description: `Add Log4j2 logging to \`BasePage\`.

**Rules**
- \`private static final Logger log = LogManager.getLogger(...)\` from \`org.apache.logging.log4j\`.
- Replace every \`System.out.println\` with the right level: \`debug\` for low-level actions (click/type),
  \`info\` for business steps, \`error\` with the exception for failures.
- Use \`{}\` placeholders, not string concatenation.
- Never log the password value; mask it.

(The \`log4j2.xml\` config is shown in the explanation — Log4j2 needs it in \`src/test/resources\`.)`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

public abstract class BasePage {
    protected final WebDriver driver;

    protected BasePage(WebDriver driver) { this.driver = driver; }

    protected void click(By locator) {
        System.out.println("Clicking " + locator);
        driver.findElement(locator).click();
    }

    protected void type(By locator, String text, boolean sensitive) {
        System.out.println("Typing " + text + " into " + locator);
        driver.findElement(locator).sendKeys(text);
    }
}
`,
  solution: `package com.shopeasy.pages;

import java.time.Duration;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public abstract class BasePage {
    private static final Logger log = LogManager.getLogger(BasePage.class);

    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    protected void click(By locator) {
        log.debug("Click {}", locator);
        try {
            wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
        } catch (TimeoutException e) {
            log.error("Element not clickable after 10s: {} on {}", locator, driver.getCurrentUrl(), e);
            throw e;
        }
    }

    protected void type(By locator, String text, boolean sensitive) {
        log.debug("Type '{}' into {}", sensitive ? "*****" : text, locator);
        WebElement el = wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
        el.clear();
        el.sendKeys(text);
    }

    protected void step(String description) {
        log.info("STEP: {}", description);
    }
}
`,
  checks: [
    { label: 'Log4j2 Logger declared', pattern: 'Logger\\s+\\w+\\s*=\\s*LogManager\\.getLogger\\s*\\(', hint: 'private static final Logger log = LogManager.getLogger(BasePage.class);' },
    { label: 'Imports from org.apache.logging.log4j', pattern: 'import\\s+org\\.apache\\.logging\\.log4j\\.(Logger|LogManager)', hint: 'Not java.util.logging, not log4j 1.x (org.apache.log4j)' },
    { label: 'No System.out.println', pattern: 'System\\.out\\.print', mustNot: true, hint: 'Replace every println with a logger call' },
    { label: 'Uses {} placeholders', pattern: '\\w+\\.(debug|info|warn|error)\\s*\\(\\s*"[^"]*\\{\\}', hint: 'log.debug("Click {}", locator);' },
    { label: 'Password is masked', pattern: 'sensitive\\s*\\?\\s*"\\*+"', hint: 'sensitive ? "*****" : text' },
    { label: 'Errors logged with the exception', pattern: '\\w+\\.error\\s*\\([^;]*,\\s*e\\s*\\)', hint: 'log.error("...", ..., e); passes the stack trace' },
  ],
  hints: [
    'import org.apache.logging.log4j.LogManager; import org.apache.logging.log4j.Logger;',
    'Placeholders: log.info("Opened {} in {} ms", url, ms) — no string building when the level is off.',
    'Pass the exception as the last argument to log.error to get the stack trace.',
  ],
  explanation: `Logging gives you a **timeline per thread** you can read after a 3 a.m. failure. Levels let CI run at INFO
(business steps) while you debug locally at DEBUG (every click).

\`src/test/resources/log4j2.xml\`:
\`\`\`xml
<Configuration status="WARN">
  <Appenders>
    <Console name="Console">
      <PatternLayout pattern="%d{HH:mm:ss.SSS} [%t] %-5level %c{1} - %msg%n"/>
    </Console>
    <File name="File" fileName="target/logs/test-run.log">
      <PatternLayout pattern="%d{ISO8601} [%t] %-5level %c{1} - %msg%n"/>
    </File>
  </Appenders>
  <Loggers>
    <Logger name="com.shopeasy" level="debug"/>
    <Root level="info">
      <AppenderRef ref="Console"/>
      <AppenderRef ref="File"/>
    </Root>
  </Loggers>
</Configuration>
\`\`\`
\`[%t]\` prints the **thread name** — that is what untangles parallel runs. Dependency:
\`org.apache.logging.log4j:log4j-core\` (+ \`log4j-api\`). Keep it updated (Log4Shell, CVE-2021-44228, hit versions < 2.17).

Placeholders (\`{}\`) avoid building strings for disabled levels and keep code clean. Never log secrets — logs are
archived by CI and readable by many people.`,
  mistakes: [
    'Using log4j 1.x (org.apache.log4j), which is end-of-life and vulnerable.',
    'Logging passwords and tokens in plain text.',
    'Logging everything at INFO so the important lines drown.',
    'Catching an exception, logging it and swallowing it, so the test passes.',
  ],
  interview: [
    { q: 'Why use a logging framework instead of System.out?', a: 'Levels, timestamps, thread names, multiple outputs (console and file), configuration without code changes, and better performance. It makes parallel CI failures traceable.' },
    { q: 'What log levels do you use in automation?', a: 'DEBUG for low-level actions (clicks, locators), INFO for business steps and test start/end, WARN for retries or recoverable problems, ERROR for failures with the stack trace.' },
  ],
}
