export default {
  id: 'java-005',
  category: 'java',
  kind: 'code',
  title: 'Model test data as a User object with constructors',
  level: 'BEGINNER',
  tags: ['classes', 'objects', 'constructors', 'test-data'],
  estMinutes: 20,
  scenario: `Your registration tests pass test data around as five loose Strings: \`register("Asha", "Rao", "asha@test.com", "Secret#1", "customer")\`.
Last week someone swapped first and last name in one call and the test "passed" with wrong data for a month. The team lead wants test data
modelled as **objects**: one \`User\` class that bundles the fields, built through a **constructor**, so a test reads \`new User(...)\` and passes one thing around.`,
  description: `Write the \`User\` class and use it in \`main\`.

**Acceptance**
* Private fields: \`firstName\`, \`lastName\`, \`email\`, \`password\`, \`role\`.
* A constructor taking all five values that assigns them with \`this.field = field\`.
* A second, **overloaded** constructor without \`role\` that defaults the role to \`"customer"\` by calling the first one with \`this(...)\`.
* Getters at least for \`getEmail()\` and \`getRole()\`, plus \`getFullName()\` returning \`firstName + " " + lastName\`.
* In \`main\`, create an admin and a customer with \`new User(...)\` and print their full name and role.`,
  hints: [
    'Inside the constructor, this.email means "the field", email alone means "the parameter".',
    'public User(String firstName, String lastName, String email, String password) { this(firstName, lastName, email, password, "customer"); }',
    'Getter shape: public String getEmail() { return email; }',
  ],
  language: 'java',
  starterCode: `package com.shop.data;

public class RegistrationData {

    // TODO: create a class User with private fields firstName, lastName, email, password, role
    // TODO: a 5-argument constructor using this.field = field
    // TODO: a 4-argument constructor that defaults role to "customer"
    // TODO: getters getEmail(), getRole(), getFullName()

    public static void main(String[] args) {
        String firstName = "Asha";
        String lastName = "Rao";
        String email = "asha.rao@test.shop.com";
        String password = "Secret#123";
        String role = "admin";
        System.out.println(firstName + " " + lastName + " " + role);
    }
}
`,
  solution: `package com.shop.data;

public class RegistrationData {

    static class User {
        private final String firstName;
        private final String lastName;
        private final String email;
        private final String password;
        private final String role;

        public User(String firstName, String lastName, String email, String password, String role) {
            this.firstName = firstName;
            this.lastName = lastName;
            this.email = email;
            this.password = password;
            this.role = role;
        }

        // overloaded constructor: most test users are plain customers
        public User(String firstName, String lastName, String email, String password) {
            this(firstName, lastName, email, password, "customer");
        }

        public String getFirstName() { return firstName; }
        public String getLastName()  { return lastName; }
        public String getEmail()     { return email; }
        public String getPassword()  { return password; }
        public String getRole()      { return role; }

        public String getFullName() {
            return firstName + " " + lastName;
        }

        @Override
        public String toString() {
            // never print the password into test reports
            return "User{" + email + ", role=" + role + "}";
        }
    }

    public static void main(String[] args) {
        User admin = new User("Asha", "Rao", "asha.rao@test.shop.com", "Secret#123", "admin");
        User customer = new User("Ben", "Ortiz", "ben.ortiz@test.shop.com", "Secret#456");

        System.out.println(admin.getFullName() + " -> " + admin.getRole());
        System.out.println(customer.getFullName() + " -> " + customer.getRole());
        System.out.println(customer);
    }
}
`,
  checks: [
    { label: 'Defines a User class', pattern: 'class\\s+User\\b', hint: 'class User { ... } (or record User(...) for the bonus)' },
    { label: 'Fields are private', pattern: 'private\\s+(final\\s+)?String\\s+email\\s*;', hint: 'private String email;' },
    { label: 'Constructor assigns fields with this.', pattern: 'this\\.\\w+\\s*=\\s*\\w+\\s*;', hint: 'this.email = email;' },
    { label: 'Overloaded constructor delegates with this(...)', pattern: 'this\\s*\\([^)]*"customer"\\s*\\)', hint: 'this(firstName, lastName, email, password, "customer");' },
    { label: 'Has getEmail() and getFullName()', pattern: 'String\\s+getEmail\\s*\\(\\s*\\)[\\s\\S]*String\\s+getFullName\\s*\\(\\s*\\)|String\\s+getFullName\\s*\\(\\s*\\)[\\s\\S]*String\\s+getEmail\\s*\\(\\s*\\)', hint: 'public String getEmail() { return email; }' },
    { label: 'Creates User objects in main', pattern: 'new\\s+User\\s*\\(', hint: 'User admin = new User("Asha", ...);' },
  ],
  explanation: `A **class** is a blueprint; an **object** is one concrete instance built from it with \`new\`. For test data this gives you:

* **One parameter instead of five** — \`registrationPage.register(user)\` cannot mix up first and last name.
* **Constructors** guarantee an object starts in a valid state. \`this.email = email\` copies the parameter into the field; without \`this.\` you would assign the parameter to itself.
* **Constructor overloading + \`this(...)\`** gives sensible defaults (role = customer) without duplicating assignments.
* **Getters** expose data read-only; with \`private final\` fields the object can't be changed halfway through a test.
* \`toString()\` controls what appears in logs and reports — deliberately leaving the password out.

In real frameworks this class lives in \`src/test/java/.../data/User.java\`, is often filled from JSON/Excel or a builder (\`User.builder().role("admin").build()\`), and in Java 17 can be a one-line \`record User(String firstName, ...)\`.`,
  mistakes: [
    'Writing email = email; in the constructor (assigns the parameter to itself, field stays null).',
    'Adding a return type to the constructor (public void User(...)) — that makes it a regular method, not a constructor.',
    'Making the fields public so tests modify them mid-run.',
    'Printing the password in toString(), which then leaks into Extent/Allure reports.',
  ],
  interview: [
    { q: 'What is a constructor and how is it different from a method?', a: 'A constructor has the class name and no return type; it runs once when new creates the object and initializes its fields. A method has a return type (or void) and can be called any number of times on an existing object.' },
    { q: 'What does the this keyword mean?', a: 'It refers to the current object. this.email is the field, distinguishing it from a parameter with the same name; this(...) calls another constructor of the same class.' },
    { q: 'How do you manage test data in your framework?', a: 'As POJOs/records (User, Address, Product) created by factories or builders, often loaded from JSON or properties per environment. Tests ask for data by intent (TestUsers.admin()) instead of hard-coding strings.' },
  ],
}
