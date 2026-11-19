export default {
  id: 'sel-031',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Broken-link check: collect every href and verify it over HTTP',
  level: 'ADVANCED',
  tags: ['links', 'HttpClient', 'smoke', 'getDomProperty'],
  estMinutes: 30,
  scenario: `After the last deployment the "Frames" card on the ShopEasy home page pointed to a renamed file and returned 404 for two days — nobody clicks every link in regression. The PO asks for a smoke check that runs after each deployment: collect all links on \`index.html\` and verify each one answers with a non-error HTTP status. A first attempt clicked each link and pressed Back: 25 links, 90 seconds, and it still could not see status codes (a 404 page renders fine in the browser).`,
  description: `Write \`BrokenLinksTest\` for \`http://localhost:5180/practice-site/index.html\`:

1. Collect all \`a[href]\` elements with \`findElements\`, read each **absolute** URL with \`getDomProperty("href")\`, keep only \`http\`/\`https\` URLs, drop \`#fragments\`, and de-duplicate with a \`LinkedHashSet\`.
2. Create **one** \`java.net.http.HttpClient\` (connect timeout 5 s, follow redirects \`NORMAL\`).
3. For each URL send a **HEAD** request (\`method("HEAD", HttpRequest.BodyPublishers.noBody())\`); if the server answers 405/501 (HEAD not allowed), retry with **GET**.
4. Record every URL with status ≥ 400 — or an \`IOException\` / timeout — in a \`Map<String, Integer>\` (use \`-1\` for "no response").
5. After checking **all** links, assert the map is empty, printing the map in the message.

**Rules**: do not click the links; do not stop at the first broken link; no \`Thread.sleep\`.`,
  hints: [
    'getDomProperty("href") returns the resolved absolute URL; getDomAttribute("href") returns what is written in the HTML ("login.html").',
    'HttpResponse<Void> r = client.send(request, HttpResponse.BodyHandlers.discarding()); r.statusCode()',
    'client.send throws IOException and InterruptedException — catch IOException per link; re-set the interrupt flag on InterruptedException.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.List;

public class BrokenLinksTest extends BaseTest {

    @Test
    public void noBrokenLinks() {
        driver.get("http://localhost:5180/practice-site/index.html");
        List<WebElement> links = driver.findElements(By.tagName("a"));
        for (int i = 0; i < links.size(); i++) {
            driver.findElements(By.tagName("a")).get(i).click(); // slow, and a 404 page "passes"
            Assert.assertFalse(driver.getTitle().isEmpty());
            driver.navigate().back();
        }
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public class BrokenLinksTest extends BaseTest {

    private static final By LINKS = By.cssSelector("a[href]");

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    @Test
    public void noBrokenLinksOnHomePage() {
        driver.get("http://localhost:5180/practice-site/index.html");

        Set<String> urls = new LinkedHashSet<>();
        for (WebElement link : driver.findElements(LINKS)) {
            String href = link.getDomProperty("href");          // absolute, resolved by the browser
            if (href != null && href.startsWith("http")) {
                int hash = href.indexOf('#');
                urls.add(hash >= 0 ? href.substring(0, hash) : href);
            }
        }
        Assert.assertFalse(urls.isEmpty(), "No links found on the page");

        Map<String, Integer> broken = new LinkedHashMap<>();
        for (String url : urls) {
            int status = statusOf(url);
            if (status >= 400 || status < 0) {
                broken.put(url, status);
            }
        }
        System.out.println("Checked " + urls.size() + " unique links");
        Assert.assertTrue(broken.isEmpty(), "Broken links (url=status, -1 = no response): " + broken);
    }

    private int statusOf(String url) {
        try {
            int status = send(url, "HEAD");
            if (status == 405 || status == 501) {               // server does not support HEAD
                status = send(url, "GET");
            }
            return status;
        } catch (IOException e) {
            return -1;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return -1;
        }
    }

    private int send(String url, String method) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .method(method, HttpRequest.BodyPublishers.noBody())
                .build();
        return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
    }
}
`,
  checks: [
    { label: 'Collects links with findElements', pattern: 'findElements\\s*\\(\\s*(LINKS|By\\.(tagName\\s*\\(\\s*"a"|cssSelector\\s*\\(\\s*"a\\[href\\]"))', hint: 'driver.findElements(By.cssSelector("a[href]"))' },
    { label: 'Reads the absolute href', pattern: '(getDomProperty|getAttribute)\\s*\\(\\s*"href"', hint: 'link.getDomProperty("href")' },
    { label: 'De-duplicates with a Set', pattern: 'Set\\s*<\\s*String\\s*>', hint: 'Set<String> urls = new LinkedHashSet<>();' },
    { label: 'Uses java.net.http.HttpClient', pattern: 'HttpClient\\.(newBuilder|newHttpClient)\\s*\\(', hint: 'HttpClient.newBuilder().connectTimeout(...).build()' },
    { label: 'Sends HEAD requests', pattern: '"HEAD"|\\.HEAD\\s*\\(', hint: '.method("HEAD", HttpRequest.BodyPublishers.noBody())' },
    { label: 'Checks the status code', pattern: '\\.statusCode\\s*\\(\\s*\\)', hint: 'response.statusCode() >= 400 means broken' },
    { label: 'Does not click the links', pattern: '\\.click\\s*\\(', mustNot: true, hint: 'HTTP requests are faster and see real status codes' },
  ],
  explanation: `**Why not click?** A browser shows a 404 page like any other page — Selenium has no API for HTTP status codes. Clicking also costs a full page load plus Back per link. Selenium's job here is only to **collect** the URLs the user can see; a plain HTTP client checks them in milliseconds.

**Absolute URLs**: the HTML says \`href="login.html"\`. \`getDomAttribute("href")\` returns exactly that; \`getDomProperty("href")\` returns what the browser resolved: \`http://localhost:5180/practice-site/login.html\`. Only the second can be requested directly.

**Filtering**: skip \`mailto:\`, \`tel:\`, \`javascript:\` and pure \`#anchors\`; strip fragments so \`page.html#top\` and \`page.html\` are one URL; a \`LinkedHashSet\` removes duplicates (the navigation bar and the cards link to the same pages) while keeping the order for readable reports.

**HEAD first**: HEAD asks for headers only — fast and light. Some servers do not implement it (405/501), so fall back to GET. \`BodyHandlers.discarding()\` throws the body away.

**Collect, then assert once**: stopping at the first 404 hides the other broken links; the release manager wants the full list. That is a "soft assertion" pattern — TestNG's \`SoftAssert\` with \`assertAll()\` is the framework equivalent.

**Scope**: check external links with care — rate limits, bot protection and flaky third-party sites cause noise. Many teams check internal links on every build and external ones in a nightly job with retries.`,
  mistakes: [
    'Using getDomAttribute("href") and sending relative URLs like "login.html" to the HTTP client — IllegalArgumentException.',
    'Creating a new HttpClient per link — slow; one client reuses connections.',
    'Failing on the first broken link instead of reporting all of them.',
    'Treating redirects (301/302) as broken — follow them and judge the final status.',
  ],
  interview: [
    { q: 'How do you find broken links with Selenium?', a: 'Use Selenium to collect the href of every anchor (findElements + getDomProperty("href")), then send HTTP requests with an HTTP client (HttpClient, RestAssured) and treat status >= 400 or no response as broken. Selenium itself cannot read status codes.' },
    { q: 'Why HEAD instead of GET?', a: 'HEAD returns only headers, so it is faster and lighter. Some servers reject HEAD with 405, so fall back to GET for those.' },
    { q: 'What is a soft assertion?', a: 'An assertion that records a failure without stopping the test, so all checks run; at the end assertAll() fails with every recorded problem. TestNG has SoftAssert; collecting failures in a map and asserting once is the manual equivalent.' },
  ],
}
