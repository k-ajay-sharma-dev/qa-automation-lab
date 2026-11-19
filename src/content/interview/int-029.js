export default {
  id: 'int-029',
  category: 'interview',
  kind: 'quiz',
  title: 'Manual to automation: "Why automation?" and "What can\'t be automated?"',
  level: 'BEGINNER',
  tags: ['career', 'manual-to-automation', 'soft-skills', 'limitations'],
  estMinutes: 10,
  scenario: `Your CV says six years of manual testing and one year of automation practice on a project like ShopEasy. The interviewer leans in: *"Why do you want to move into automation? Will automation replace manual testers? What can't be automated?"* These questions decide whether you sound like someone **escaping** manual testing or someone **bringing** it with them. Your testing experience is the strongest card you hold — play it.`,
  description: `Pick the answer you would want the interviewer to hear. Each \`why\` explains what the other options signal.`,
  hints: [
    'Automation is a tool that executes checks you design; the test thinking still comes from you.',
    'What cannot be automated is anything that needs human judgement: is it usable, does it look right, is this the right feature?',
  ],
  questions: [
    {
      q: '"Why do you want to move from manual testing to automation?" Which answer is strongest?',
      options: [
        '"Manual testing is boring and automation pays more."',
        '"On my last release we spent three days per cycle re-running the same login, cart and checkout regression by hand. I wanted those checks running every night so I could spend my time on exploratory testing of new features. My test design experience tells me *what* to automate; I am learning the coding to do it well."',
        '"Because everybody says manual testing is dying."',
        '"My manager told me to."',
      ],
      answer: 1,
      why: 'The strong answer starts from a **real problem** (repetitive regression), names the **benefit** (fast feedback, time for exploration) and positions manual experience as an **asset**. Answers that criticise manual testing make the interviewer wonder how you will treat manual colleagues — and they hint you might automate without thinking about value.',
    },
    {
      q: 'Which of these **cannot** be meaningfully automated?',
      options: [
        'Checking that the order total on the overview page equals subtotal + 8% tax',
        'Verifying that a locked_out_user sees the error "Error: Sorry, this user has been locked out."',
        'Judging whether a first-time shopper finds the checkout flow confusing',
        'Checking that GET /api/products returns 200 and six products',
      ],
      answer: 2,
      why: 'The first, second and fourth items have a **clear expected result**, so they are perfect automated checks. "Is it confusing?" needs human judgement, empathy and context — usability and exploratory testing stay manual. Other examples: whether a new design *looks* right, whether a feature solves the user\'s real problem, ad-hoc investigation of a strange bug.',
    },
    {
      q: '"Will automation replace manual testers?" Best answer?',
      options: [
        '"Yes, in a few years all testing will be automated."',
        '"No — automation replaces repetitive **execution**, not **testing**. Someone still decides what is worth checking, explores what nobody scripted and judges risk. Automation frees testers to do more of that."',
        '"No, because automation never works."',
        '"Only AI can decide that."',
      ],
      answer: 1,
      why: 'A useful distinction is **testing vs checking**: a check is a scripted yes/no comparison a machine can repeat; testing is the investigation and judgement around it. Interviewers want to hear that you value both and know where each one belongs.',
    },
    {
      q: 'All 120 automated tests are green, but users report the "Add to cart" button is hidden behind a cookie banner on small laptops. What does this teach you?',
      options: [
        'The automation framework is broken and must be rewritten',
        'Automated checks only verify what they were written to verify — here they ran at one window size and clicked through the DOM. Green means "the scripted checks passed", not "no bugs". Exploratory and cross-device testing still matter.',
        'Users are using the site wrongly',
        'You should add Thread.sleep before every click',
      ],
      answer: 1,
      why: 'Selenium can click an element a human cannot easily see, and a fixed viewport hides layout problems. A mature answer: "I would add a test at a laptop resolution for this journey, but I would also keep exploratory sessions on real devices, because automation only finds the bugs we predicted."',
    },
    {
      q: 'How does your manual testing experience help you as an automation engineer?',
      options: [
        'It does not — automation is a coding job',
        'It only helps with writing test cases in Excel',
        'I know how to design tests (boundaries, equivalence classes, negative paths), where the business risk is, and what a good bug report looks like — so my automated suites check the right things and their failures are easy to diagnose',
        'It means I can avoid writing code',
      ],
      answer: 2,
      why: 'Many automation suites are full of happy-path clicks because they were written by people who never learned test design. Your edge is knowing *which* checks matter: boundary values in quantity fields, the locked-out user, the out-of-stock product. Say this confidently.',
    },
  ],
  explanation: `**Model answer — "Why automation?"**
> "In my last project the regression cycle took three days of manual execution before every release, and it was mostly the same login, cart and checkout steps. I started automating those with Selenium and Java so they could run every night. That gave the team feedback within an hour and gave me time for exploratory testing of new features, which is where I found the most interesting bugs. My manual background is why my tests check the right things — boundaries, negative paths, the risky flows."

**Model answer — "What can't be automated?"**
> "Anything that needs human judgement: usability, whether a design looks right, exploratory testing of a new feature, and one-off checks that cost more to script than to run. Some things are *technically* blocked on purpose — CAPTCHA, real OTPs — and there we use test hooks or API bypasses in lower environments. And automation only finds the bugs we predicted, so green doesn't mean bug-free."

**Testing vs checking:** a *check* is a repeatable comparison with an expected result (machine-friendly). *Testing* is learning about the product by exploring, questioning and judging (human). Automation scales checks; testers still own testing.`,
  mistakes: [
    'Talking negatively about manual testing — it sounds like you will undervalue half the team.',
    'Claiming "everything can be automated" — it shows no sense of cost or judgement.',
    'Treating a green pipeline as proof that there are no bugs.',
    'Hiding your manual years instead of presenting them as test-design strength.',
  ],
  interview: [
    { q: 'Why do you want to move into automation?', a: 'Because I saw the cost of repeating the same regression by hand every release. Automating stable, high-risk checks gives the team fast feedback and frees me for exploratory testing. My manual experience tells me what is worth automating; I have been building the Java and Selenium skills to do it properly.' },
    { q: 'What cannot be automated?', a: 'Human-judgement work — usability, look and feel, exploratory testing, deciding whether a feature meets the real need — plus one-off checks with poor return on investment. CAPTCHA and real OTPs are blocked by design, so we use test hooks or API shortcuts in test environments instead.' },
    { q: 'Will automation replace manual testers?', a: 'It replaces repetitive execution, not testing. Someone still designs the checks, explores the product and judges risk. Automation lets testers spend more time on that thinking work.' },
  ],
}
