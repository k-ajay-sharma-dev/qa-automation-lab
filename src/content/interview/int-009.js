export default {
  id: 'int-009',
  category: 'interview',
  kind: 'quiz',
  title: 'Selenium limitations: CAPTCHA, OTP, desktop pop-ups and more',
  level: 'BEGINNER',
  tags: ['limitations', 'captcha', 'otp', 'file-upload', 'robot', 'api'],
  estMinutes: 10,
  scenario: `"What are the limitations of Selenium?" sounds simple, but the follow-up is always *"So how did you handle that in your project?"* — "How did you test the OTP login?", "What about file upload?", "Captcha?". Knowing the **workaround each team uses** is what earns the points.`,
  description: `Pick the best answer. Each \`why\` gives you the "in my project we…" sentence.`,
  hints: [
    'Selenium only automates the browser\'s web content via WebDriver.',
    'CAPTCHA and OTP are solved by environment configuration, not by "cracking" them.',
  ],
  questions: [
    {
      q: 'Suppose the ShopEasy login had a CAPTCHA on the QA environment (the practice site has none). What is the professional approach?',
      options: [
        'Use an OCR library to read the CAPTCHA image',
        'Pause the test so a human can type it',
        'Ask developers to disable CAPTCHA on test environments or use the provider\'s test keys (e.g. reCAPTCHA test site key that always passes), and verify CAPTCHA presence separately/manually',
        'Skip login tests entirely',
      ],
      answer: 2,
      why: 'CAPTCHA exists to stop automation, so bypassing it is a test-environment configuration matter. Google publishes reCAPTCHA test keys for exactly this. Manual pauses break CI; OCR is unreliable and defeats the purpose.',
    },
    {
      q: 'Login requires an OTP sent by SMS/email. How do teams automate it?',
      options: [
        'It cannot be automated',
        'Use a test-environment bypass/static OTP, read the OTP from a test mailbox/SMS API (e.g. Mailosaur, a test inbox), or fetch it from the backend/DB via an API — agreed with developers',
        'Guess random 6-digit codes',
        'Use Thread.sleep and hope',
      ],
      answer: 1,
      why: 'Any of the three is acceptable in real projects; mention which one yours used. It shows you collaborate with devs on testability instead of saying "not possible".',
    },
    {
      q: 'How do you upload a file through `<input type="file">` with Selenium?',
      options: [
        'Use the Robot class to type in the OS file dialog',
        'Call sendKeys with the absolute file path on the input element (no dialog opens); with RemoteWebDriver/Grid, set a LocalFileDetector',
        'It is impossible',
        'Drag and drop from the desktop',
      ],
      answer: 1,
      why: 'sendKeys("/abs/path/invoice.pdf") on the file input is the standard way and works headless. Robot/AutoIt only interact with the OS dialog, break in headless/CI, and are a last resort for non-input uploads.',
    },
    {
      q: 'Which of these CANNOT be done with Selenium WebDriver alone?',
      options: [
        'Handling JavaScript alerts',
        'Switching to iframes',
        'Automating a Windows desktop application or the native OS print dialog',
        'Taking a screenshot',
      ],
      answer: 2,
      why: 'Selenium automates web content in browsers. Alerts, frames and screenshots are supported. Desktop apps need tools like WinAppDriver/FlaUI; mobile needs Appium; OS dialogs need Robot/AutoIt or avoiding them by design.',
    },
    {
      q: 'Which limitation is usually solved by combining Selenium with another tool?',
      options: [
        'Selenium has no built-in reporting, test runner or API testing — teams add TestNG/Cucumber, Extent/Allure reports and REST Assured',
        'Selenium cannot click buttons',
        'Selenium cannot open URLs',
        'Selenium cannot use CSS selectors',
      ],
      answer: 0,
      why: 'Selenium is a browser automation library, not a full framework. That is why we build frameworks around it. Also mention: no performance testing (JMeter), limited visual testing (use tools like Applitools/Percy), and image/canvas-based UIs are hard.',
    },
  ],
  explanation: `**Model answer:**
> "Selenium automates browsers only, so it can't handle desktop applications, OS dialogs or mobile native apps — we'd use WinAppDriver or Appium for those. It has no runner, reporting or API testing built in, so our framework adds TestNG/Cucumber, Extent reports and REST Assured. CAPTCHA and OTP are deliberately anti-automation — in my project developers configured the QA environment with a test CAPTCHA key and a fixed OTP for test users, and we verified the real OTP flow manually once per release. File uploads we handle with sendKeys on the file input, so no OS dialog is needed. Canvas, charts and image validation are limited, so those checks are partly manual or API-based."`,
  mistakes: [
    'Saying "Selenium can automate everything".',
    'Proposing OCR for CAPTCHA.',
    'Using Robot class for file uploads that have a normal file input.',
    'Answering "not possible" without a workaround.',
  ],
  interview: [
    { q: 'What are the limitations of Selenium?', a: 'It only automates web browsers — no desktop or native mobile apps, no OS dialogs — and has no built-in runner, reporting, API or performance testing, so we combine it with TestNG/Cucumber, reporting tools and REST Assured. CAPTCHA and OTP need environment support, and canvas or image-based UIs are hard to validate.' },
    { q: 'How did you automate OTP login?', a: 'Developers provided a test-environment configuration where test users get a fixed OTP, and for the end-to-end check we read the OTP from a test mailbox through its API. The real SMS delivery was verified manually during release testing.' },
    { q: 'How do you handle file upload and download?', a: 'Upload with sendKeys of the absolute path on the file input, plus LocalFileDetector on Grid. For download we set Chrome preferences for the download directory, wait until the file exists and is complete, then validate name and size or content.' },
  ],
}
