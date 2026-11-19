import { FRAMEWORK_FILES, FRAMEWORK_TREE, RUN_COMMANDS } from '../framework.js'

// Shape shared by every blueprint in this folder (see FrameworkPage):
// { id, order, label, stack, intro, tree, files: [{ path, why, lang, code }], commands: [[label, cmd]] }
export default {
  id: 'selenium-cucumber',
  order: 1,
  label: 'Selenium + Cucumber (Java)',
  stack: 'Java 17 · Selenium 4 · Cucumber 7 · TestNG · Maven',
  intro:
    'A complete Java + Selenium + Cucumber + TestNG + Page Object Model framework for the ShopEasy practice site — the structure interviewers expect when they say “explain your framework”.',
  tree: FRAMEWORK_TREE,
  files: FRAMEWORK_FILES,
  commands: RUN_COMMANDS,
}
