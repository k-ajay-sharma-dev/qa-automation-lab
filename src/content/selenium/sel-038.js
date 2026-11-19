export default {
  id: 'sel-038',
  category: 'selenium',
  kind: 'quiz',
  title: 'Downloads and prompt dialogs: ChromeOptions prefs, file waits and sendKeys',
  level: 'ADVANCED',
  tags: ['downloads', 'ChromeOptions', 'prefs', 'alerts', 'prompt', 'FluentWait'],
  estMinutes: 12,
  scenario: `Two tickets land on your board in the same sprint. SHOP-451: the new "Export orders (CSV)" button must be covered by automation — Jenkins runs headless Chrome and the file must end up somewhere the test can check. SHOP-455: the coupon flow on \`alerts.html\` asks for the code in a native \`prompt()\` ("Enter your coupon code") and the result is shown in \`#result\`. Before writing code, check your understanding of both.`,
  description: `Answer the questions. Assume Selenium 4, Java 17 and Chrome.`,
  hints: [
    'Chrome download behaviour is controlled with experimental option "prefs".',
    'A prompt is an Alert: switchTo().alert(), then sendKeys and accept.',
  ],
  questions: [
    {
      q: 'How do you make Chrome save downloads into `target/downloads` without asking?',
      options: [
        '`options.addArguments("--download-dir=target/downloads")`',
        '`options.setExperimentalOption("prefs", Map.of("download.default_directory", absolutePath, "download.prompt_for_download", false))`',
        '`driver.manage().downloads().setFolder("target/downloads")`',
        'Selenium cannot change the download folder',
      ],
      answer: 1,
      why: 'Download settings are Chrome profile preferences, passed through the `prefs` experimental option. The directory must be an **absolute** path (e.g. `Paths.get("target/downloads").toAbsolutePath().toString()`). There is no such command-line argument or driver API.',
    },
    {
      q: 'After clicking Export, what is the reliable way to verify the CSV was downloaded?',
      options: [
        'Thread.sleep(5000) then check the folder',
        'Wait (WebDriverWait/FluentWait on the driver, or Awaitility) until a file matching `orders*.csv` exists in the folder **and** no `.crdownload` temp file remains, then assert its size/content',
        'Check that the button text changed',
        'Assert driver.getCurrentUrl() ends with .csv',
      ],
      answer: 1,
      why: 'Chrome writes to `name.csv.crdownload` and renames it when finished. Polling for the final file and the absence of the temp file avoids reading a half-written file. Then open it and assert the header row / row count — existence alone is a weak check.',
    },
    {
      q: 'The download test passes locally but on Selenium Grid the folder is always empty. Why?',
      options: [
        'Grid does not support Chrome',
        'The browser runs on the Grid node, so the file is saved on the node\'s disk, not on the machine running the test; enable managed downloads (`se:downloadsEnabled`) and fetch it via the Grid, or verify the export via the API instead',
        'prefs are ignored in headless mode',
        'You need implicitlyWait for downloads',
      ],
      answer: 1,
      why: 'With RemoteWebDriver, the browser and its file system live on the node. Selenium 4.8+ offers managed downloads (`options.setEnableDownloads(true)`, then `HasDownloads` to list/download files). Many teams instead verify the export endpoint with RestAssured and keep only a smoke UI check.',
    },
    {
      q: `Which code correctly enters the coupon in the native prompt on \`alerts.html\`?`,
      options: [
        '`driver.findElement(By.tagName("input")).sendKeys("BRIGHT25");`',
        '`Alert a = wait.until(ExpectedConditions.alertIsPresent()); a.sendKeys("BRIGHT25"); a.accept();`',
        '`driver.switchTo().alert().accept(); driver.switchTo().alert().sendKeys("BRIGHT25");`',
        '`((JavascriptExecutor) driver).executeScript("prompt.value=\'BRIGHT25\'");`',
      ],
      answer: 1,
      why: 'A native prompt is not part of the DOM, so findElement cannot see it. Switch to the Alert, call `sendKeys`, then `accept()`; `#result` then shows "You entered: BRIGHT25". Accepting first closes the dialog, so the following switchTo().alert() throws NoAlertPresentException.',
    },
    {
      q: 'What does `#result` show if the test calls `dismiss()` on that prompt?',
      options: [
        '"You entered: " with an empty value',
        '"You cancelled the prompt" — dismiss() is Cancel, and prompt() returns null',
        'Nothing, dismiss() throws on a prompt',
        '"You clicked: Cancel"',
      ],
      answer: 1,
      why: 'In `alerts.html`, `prompt()` returns null on Cancel and the page writes "You cancelled the prompt". Testing both accept and dismiss covers the two code paths of the feature.',
    },
  ],
  explanation: `**Downloads:** configure Chrome with \`prefs\` (\`download.default_directory\` as an absolute path, \`download.prompt_for_download=false\`), clear the folder before the test, wait for the final file (no \`.crdownload\`), then assert the content. On Grid the file lives on the node — use managed downloads or test the export via the API.

**Prompts:** \`wait.until(alertIsPresent())\` → \`sendKeys\` → \`accept()\` or \`dismiss()\`, then assert the page result. Native dialogs are outside the DOM, so locators and JavaScript on the page cannot fill them.`,
  interview: [
    { q: 'How do you test a file download with Selenium?', a: 'Set Chrome prefs for the download directory and disable the prompt, clear the folder, click the link, poll until the file exists and is complete, then validate content. Often a cleaner option is to call the download URL with an HTTP client and validate the response.' },
    { q: 'Why must the download directory be absolute?', a: 'Chrome resolves the preference in its own process, not relative to your project working directory, so a relative path is ignored or ends up somewhere unexpected.' },
    { q: 'Can you type into a JavaScript alert or confirm?', a: 'No — only prompt dialogs accept text. Calling sendKeys on an alert or confirm fails with "element not interactable" (the W3C WebDriver spec only allows text for prompts).' },
  ],
}
