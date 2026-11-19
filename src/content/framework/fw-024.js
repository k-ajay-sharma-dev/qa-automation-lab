export default {
  id: 'fw-024',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Allure: readable steps, severity labels and a screenshot attachment',
  level: 'ADVANCED',
  tags: ['reporting', 'allure', 'steps', 'attachments', 'listeners'],
  estMinutes: 25,
  scenario: `The team is moving from Extent to **Allure** because the product owner wants trends across nightly runs and
failures grouped by feature. The first Allure report is disappointing: every test is a single line called
\`removeBikeLightUpdatesBadge\` with a stack trace, no steps, no feature, no screenshot. The PO says: *"I can't read this.
Tell me what the test did, in words, and show me the screen."*`,
  description: `Make the cart test readable in Allure.

**Rules**
- \`CartPage\`: annotate the business methods with \`@Step\`, using \`{parameter}\` placeholders so the step text shows the
  real product name (e.g. \`"Remove {productName} from the cart"\`).
- The test gets \`@Feature("Cart")\`, \`@Severity(SeverityLevel.CRITICAL)\` and a \`@Description\`.
- \`AllureListener implements ITestListener\`: on failure attach a PNG screenshot through an \`@Attachment(value = ..., type = "image/png")\`
  method returning \`byte[]\` (\`OutputType.BYTES\`), using the thread-safe \`DriverManager.getDriver()\`.`,
  starterCode: `package com.shopeasy;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;
import org.testng.ITestListener;
import org.testng.ITestResult;
import org.testng.annotations.Test;

class CartPage extends BasePage {
    CartPage(WebDriver driver) { super(driver); }

    public CartPage removeProduct(String productName) {
        click(By.id("remove-" + slug(productName)));
        return this;
    }

    public int badgeCount() {
        return header().cartBadgeCount();
    }
}

class CartTest extends BaseTest {
    @Test(groups = {"regression"})
    public void removeBikeLightUpdatesBadge() {
        CartPage cart = loginAsStandardUser()
                .addToCart("Trailblazer Backpack")
                .addToCart("Pulse Bike Light")
                .header().openCart();

        cart.removeProduct("Pulse Bike Light");

        Assert.assertEquals(cart.badgeCount(), 1);
    }
}

class AllureListener implements ITestListener {
    @Override
    public void onTestFailure(ITestResult result) {
        // TODO screenshot into the Allure report
    }
}
`,
  solution: `package com.shopeasy;

import com.shopeasy.core.DriverManager;
import io.qameta.allure.Attachment;
import io.qameta.allure.Description;
import io.qameta.allure.Feature;
import io.qameta.allure.Severity;
import io.qameta.allure.SeverityLevel;
import io.qameta.allure.Step;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.openqa.selenium.By;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;
import org.testng.ITestListener;
import org.testng.ITestResult;
import org.testng.annotations.Test;

class CartPage extends BasePage {
    CartPage(WebDriver driver) { super(driver); }

    @Step("Remove {productName} from the cart")
    public CartPage removeProduct(String productName) {
        click(By.id("remove-" + slug(productName)));
        return this;
    }

    @Step("Read the cart badge count")
    public int badgeCount() {
        return header().cartBadgeCount();
    }
}

class CartTest extends BaseTest {

    @Test(groups = {"regression"})
    @Feature("Cart")
    @Severity(SeverityLevel.CRITICAL)
    @Description("Removing one of two products from the cart updates the header badge to 1")
    public void removeBikeLightUpdatesBadge() {
        CartPage cart = loginAsStandardUser()
                .addToCart("Trailblazer Backpack")
                .addToCart("Pulse Bike Light")
                .header().openCart();

        cart.removeProduct("Pulse Bike Light");

        Assert.assertEquals(cart.badgeCount(), 1, "Cart badge after removing the bike light");
    }
}

class AllureListener implements ITestListener {
    private static final Logger log = LogManager.getLogger(AllureListener.class);

    @Override
    public void onTestFailure(ITestResult result) {
        try {
            screenshot(result.getMethod().getMethodName());
        } catch (RuntimeException e) {
            log.warn("Allure screenshot failed: {}", e.getMessage());
        }
    }

    @Attachment(value = "Screenshot on failure: {name}", type = "image/png")
    public byte[] screenshot(String name) {
        return ((TakesScreenshot) DriverManager.getDriver()).getScreenshotAs(OutputType.BYTES);
    }
}
`,
  checks: [
    { label: 'Imports Allure annotations', pattern: 'import\\s+io\\.qameta\\.allure\\.(Step|Attachment|Feature|Severity)', hint: 'import io.qameta.allure.Step; (and the others)' },
    { label: '@Step with a parameter placeholder', pattern: '@Step\\s*\\(\\s*"[^"]*\\{productName\\}[^"]*"\\s*\\)\\s*public\\s+CartPage\\s+removeProduct', hint: '@Step("Remove {productName} from the cart") on removeProduct' },
    { label: 'Feature label on the test', pattern: '@Feature\\s*\\(\\s*"Cart"\\s*\\)', hint: '@Feature("Cart")' },
    { label: 'Severity on the test', pattern: '@Severity\\s*\\(\\s*SeverityLevel\\.(BLOCKER|CRITICAL)\\s*\\)', hint: '@Severity(SeverityLevel.CRITICAL)' },
    { label: 'PNG attachment method returning bytes', pattern: '@Attachment\\s*\\([^)]*type\\s*=\\s*"image/png"[^)]*\\)\\s*public\\s+byte\\s*\\[\\s*\\]\\s+\\w+', hint: '@Attachment(value = "Screenshot", type = "image/png") public byte[] screenshot(...)' },
    { label: 'Screenshot as BYTES from the thread-safe driver', pattern: 'DriverManager\\.getDriver\\s*\\(\\s*\\)\\s*\\)\\s*\\.getScreenshotAs\\s*\\(\\s*OutputType\\.BYTES\\s*\\)', hint: '((TakesScreenshot) DriverManager.getDriver()).getScreenshotAs(OutputType.BYTES)' },
  ],
  hints: [
    '@Step text can use the method parameter names in curly braces: {productName}.',
    'Allure stores the return value of an @Attachment method as the attachment; for a PNG return byte[].',
    'Call the @Attachment method from onTestFailure — Allure records it on the failing test.',
  ],
  explanation: `How Allure builds the report: while tests run, the \`allure-testng\` adapter writes JSON files into
\`target/allure-results\`. \`allure serve target/allure-results\` (or the Jenkins Allure plugin) turns them into the site.

- **\`@Step\`** turns a page method into a readable line in the test body, with parameters substituted:
  *Remove Pulse Bike Light from the cart*. Because steps live on **page objects**, every test using \`removeProduct\` gets
  them for free — the test code does not change. Nested steps (a step calling a step) show as a tree.
- **Labels** (\`@Epic\`, \`@Feature\`, \`@Story\`, \`@Severity\`, \`@Owner\`, \`@Link\`/\`@Issue\`) drive the Behaviors and Graphs
  pages: "Cart: 1 critical failure" is what the product owner wants to read.
- **Attachments**: an \`@Attachment\` method's return value (\`byte[]\` for images, \`String\` for text such as the page URL or an
  API response) is attached to the current test or step. \`Allure.addAttachment("Page URL", url)\` is the non-annotation version.
- **History and trends**: copy \`allure-report/history\` into the next run's \`allure-results\` (CI plugins do this) to get the
  trend graph and "flaky" / "new failure" markers.

Setup that makes \`@Step\` / \`@Attachment\` work: \`io.qameta.allure:allure-testng\` plus the **AspectJ weaver** as a
\`-javaagent\` in Surefire's \`<argLine>\` — without the agent the annotations are silently ignored (a classic "steps
don't show" question).`,
  mistakes: [
    'Forgetting the AspectJ javaagent in Surefire, so @Step and @Attachment do nothing.',
    'Putting @Step on test methods only, instead of on reusable page methods.',
    'Returning a File or a path from an @Attachment method instead of byte[] or String.',
    'Not archiving the history folder, so the trend graph never appears.',
  ],
  interview: [
    { q: 'How do you make reports readable for non-technical stakeholders?', a: 'Use Allure (or a similar tool) with @Step on page object methods so tests read as business steps, labels like @Feature and @Severity for grouping, screenshots and logs attached on failure, and history kept between CI runs for trends.' },
    { q: 'Allure vs ExtentReports?', a: 'Extent produces a self-contained HTML file driven by listener code. Allure collects result files and generates a richer site with steps from annotations, behaviours, categories, retries and history trends; it needs the Allure CLI or CI plugin to render.' },
  ],
}
