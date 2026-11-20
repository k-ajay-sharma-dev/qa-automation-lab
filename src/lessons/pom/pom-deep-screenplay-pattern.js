export default {
  slug: 'pom-deep-screenplay-pattern',
  category: 'pom',
  order: 13,
  title: 'Deep dive: the Screenplay pattern — actors, abilities, tasks, interactions and questions',
  minutes: 30,
  summary: 'Understand Screenplay well enough to build it and to argue for or against it: the problems it solves at scale, the model (actor, abilities, tasks, interactions, questions, targets, notes), a complete plain-Java implementation for the ShopEasy checkout with TestNG, the same journey in Serenity BDD, multi-actor and API + UI scenarios, Cucumber integration, a comparison with POM and flow layers, an incremental migration path, the Playwright/TypeScript world and the mistakes that make Screenplay suites worse than the POM they replaced.',
  manualAnalogy: `A good manual test case reads like a script: "Asha, a registered customer, logs in, adds the backpack, checks out — and sees a total of $32.39." It names who acts, what they want, and what they check; the clicks are an appendix. When a second person is involved ("then the support agent opens Asha's order"), you simply add a second role. Screenplay structures automation code exactly like that script, instead of around the screens the clicks happen on.`,
  body: `## Where the earlier lessons stop

The *Scaling page objects: task layers, Screenplay and shared state* lesson (lesson 10) introduced the vocabulary in one table and one line of code. The structural-patterns deep dive \`pom-deep-structural-behavioural-patterns\` covers the **Facade** (a flow layer over page objects) and the **Command** pattern that Screenplay interactions are built on; \`pom-deep-components-and-reusable-methods\` covers component granularity and reusable method design; \`pom-deep-creational-patterns\` covers builders and Object Mothers for the data an actor uses; \`pom-deep-variants-pagefactory-loadable\` compares POM styles. Driver lifecycle and \`ThreadLocal\` are in \`selenium-deep-parallel-execution\`, SOLID with framework examples in \`java-deep-oop-and-solid\`.

This lesson goes all the way down: you will **build** Screenplay in plain Java (so you understand what a library does for you), then write the same ShopEasy journey in **Serenity BDD**, and then decide — like a senior — when it is worth it.

## The problem Screenplay solves

Page objects answer one question: *where is this thing on the page?* At a few hundred tests and several squads, the pains are no longer about locators:

1. **Bloated pages.** \`InventoryPage\` collects every action anybody ever needed on that URL — sort, filter, add, remove, open details, read badge, check promo banner, wishlist drag-and-drop. Eighty methods, five reasons to change.
2. **Journeys duplicated across tests.** "Log in, add two items, open the cart, check out with valid details" exists in 60 tests and 12 step classes, each slightly different (one waits for the overview, one does not).
3. **"What" and "how" mixed.** A test about tax reads: \`loginPage.typeUser(..); loginPage.typePassword(..); loginPage.clickLogin(); inventory.clickAdd("trailblazer-backpack"); header.clickCart(); cart.clickCheckout(); ...\` — twelve lines of *how* before one line of *what* the test is about.
4. **Multi-actor and multi-channel scenarios have nowhere to live.** "Asha places an order; Vera, another customer, must not be able to read it" involves two identities and an API. Page objects are bound to one driver; there is no natural home for *who* is acting or *through which channel*.
5. **Reports describe clicks, not intent.** A failure says "TimeoutException waiting for #continue" — not "Asha could not enter her shipping details while checking out".

A flow/Facade layer (see \`pom-deep-structural-behavioural-patterns\`) fixes 2 and part of 3. Screenplay addresses all five by changing the **unit of design**: from *pages* to *actors pursuing goals*.

## The model

| Concept | Responsibility | Knows | ShopEasy example |
|---|---|---|---|
| **Actor** | the person (or system) acting; holds abilities and notes | its name, abilities, memory | \`Asha\`, \`Vera\` |
| **Ability** | an adapter to a system/channel | a driver, an HTTP client, a DB pool | \`BrowseTheWeb\`, \`CallAnApi\` |
| **Task** | a business-level goal, composed of tasks/interactions | **what** the user wants | \`Login.as(standardUser)\`, \`Checkout.withDetails(..)\` |
| **Interaction** | one low-level action through one ability | **how** to act on the system | \`Click.on(..)\`, \`Enter.theValue(..).into(..)\`, \`Post.to(..)\` |
| **Question** | reads state, returns a value — no side effects | how to read one fact | \`TheCartBadge.count()\`, \`OrderTotal.displayed()\` |
| **Target** | a named locator | **where** on the screen | \`Target.the("cart icon").locatedBy("[data-testid='shopping-cart-link']")\` |
| **Notes (memory)** | values the actor learns and reuses later in the scenario | key → value | the order number shown after *Finish* |

\`\`\`
                ┌────────────────────── Actor "Asha" ──────────────────────┐
                │ abilities: BrowseTheWeb, CallAnApi                        │
                │ notes:     "order number" = "SE-482913"                   │
                └──────────┬───────────────────────────────┬───────────────┘
              attemptsTo() │                               │ asksFor()
                           ▼                               ▼
               Tasks  (WHAT the user wants)        Questions (read state)
          Login · AddToCart · Checkout           TheCartBadge · OrderTotal
                           │ composed of                   │
                           ▼                               │
          Interactions (HOW: one action)                   │
          Open · Click · Enter · WaitUntil · Post · Get    │
                           │  use                          │ use
                           ▼                               ▼
          Abilities ───────────────────────────►  WebDriver  /  HttpClient
                           ▲
          Targets (WHERE): name + locator, no behaviour
\`\`\`

The call flow is always the same: the test calls \`actor.attemptsTo(task)\`, the actor calls \`task.performAs(actor)\`, the task calls \`actor.attemptsTo(interactions...)\`, each interaction fetches an **ability** from the actor (\`BrowseTheWeb.as(actor)\`) and does exactly one thing with it. Because every step passes through \`attemptsTo\`, the actor is a natural **interception point**: narration, reporting, screenshots and error context are implemented once, in the actor — this is where Serenity hooks its reporting.

Two things to notice:

- **Tasks and interactions are Command objects** (see the Command section of \`pom-deep-structural-behavioural-patterns\`): data captured at construction (\`theProduct("Trailblazer Backpack")\`), execution deferred to \`performAs\`. That is why they can be composed, logged and described before running.
- **Page objects disappear as a behavioural unit.** Locators move to *Target* holders (a UI map, often one per page or component), behaviour moves to interactions and tasks. "Where" and "what" are separated by construction.

### SOLID alignment

- **S**: each task does one business thing; each interaction one action; each question reads one fact. Classes have one reason to change — a new checkout field changes \`EnterShippingDetails\`, nothing else.
- **O**: adding a capability means adding a class (\`ApplyCouponCode\`), not editing a 900-line page. Existing tasks are closed for modification, the vocabulary is open for extension.
- **L**: any \`Performable\` can stand where another is expected — a task can contain tasks or interactions; \`attemptsTo\` does not care.
- **I**: an interaction depends only on the ability it uses (\`BrowseTheWeb\`), not on a fat \`BasePage\` with 40 helpers.
- **D**: tasks depend on the \`Ability\` abstraction obtained from the actor; swapping \`BrowseTheWeb\` (Selenium) for a Playwright-based ability does not touch tasks.

The *cost* side is equally SOLID-shaped: many small classes, more indirection, more names to learn. The detailed SOLID before/after treatment is in \`java-deep-oop-and-solid\`; here the point is that Screenplay is SRP applied to *test behaviour* rather than to pages.

## A complete Screenplay in plain Java

Building it yourself — about 400 lines — is the best way to understand any library implementation and to answer "how does Serenity do X?" in an interview. The design below is deliberately small: CSS-only targets, one wait strategy, console narration.

Project layout:

\`\`\`
src/test/java/com/shopeasy/screenplay/
├── core/          Actor, Ability, Performable, Task, Interaction, Question, Target, ScreenplayException
├── abilities/     BrowseTheWeb, CallAnApi
├── interactions/  Open, Click, Enter, WaitUntil, Post, Get
├── ui/            LoginForm, Inventory, Header, Cart, CheckoutForm, CheckoutOverview   (targets only)
├── tasks/         Login, AddToCart, Checkout, PlaceTheOrder, LogInToTheApi, PlaceAnOrder
├── questions/     TheCartBadge, OrderTotal, TheOrderNumber, LastResponse
└── model/         Credentials, CheckoutDetails
\`\`\`

### Core: the vocabulary

\`\`\`java
// core/Ability.java
package com.shopeasy.screenplay.core;

/** Marker: an adapter that lets an actor use one system or channel. */
public interface Ability {
}
\`\`\`

\`\`\`java
// core/Performable.java
package com.shopeasy.screenplay.core;

public interface Performable {

    void performAs(Actor actor);

    /** Narration template; {0} is replaced with the actor's name. */
    default String description() {
        return "{0} performs " + getClass().getSimpleName();
    }
}
\`\`\`

\`\`\`java
// core/Interaction.java
package com.shopeasy.screenplay.core;

/** One low-level action through one ability. Knows HOW, never WHY. */
public interface Interaction extends Performable {
}
\`\`\`

\`\`\`java
// core/Task.java
package com.shopeasy.screenplay.core;

/** A business goal composed of tasks and interactions. Knows WHAT, never HOW. */
public interface Task extends Performable {

    /** Ad-hoc task for small compositions that do not deserve a class. */
    static Task where(String description, Performable... steps) {
        return new Task() {
            @Override
            public void performAs(Actor actor) {
                actor.attemptsTo(steps);
            }

            @Override
            public String description() {
                return description;
            }
        };
    }
}
\`\`\`

\`\`\`java
// core/Question.java
package com.shopeasy.screenplay.core;

import java.util.function.Function;

@FunctionalInterface
public interface Question<T> {

    T answeredBy(Actor actor);

    default String subject() {
        return getClass().getSimpleName();
    }

    static <T> Question<T> about(String subject, Function<Actor, T> reader) {
        return new Question<>() {
            @Override
            public T answeredBy(Actor actor) {
                return reader.apply(actor);
            }

            @Override
            public String subject() {
                return subject;
            }
        };
    }
}
\`\`\`

\`\`\`java
// core/ScreenplayException.java
package com.shopeasy.screenplay.core;

public class ScreenplayException extends RuntimeException {

    public ScreenplayException(String message) {
        super(message);
    }

    public ScreenplayException(String message, Throwable cause) {
        super(message, cause);
    }
}
\`\`\`

\`\`\`java
// core/Target.java
package com.shopeasy.screenplay.core;

import org.openqa.selenium.By;

/** WHERE: a human name plus a CSS locator. No behaviour. */
public record Target(String name, String css) {

    public static Builder the(String name) {
        return new Builder(name);
    }

    public By locator() {
        return By.cssSelector(css);
    }

    /** Fills {0}, {1} ... placeholders in both the name and the locator. */
    public Target of(String... values) {
        String filledName = name;
        String filledCss = css;
        for (int i = 0; i < values.length; i++) {
            filledName = filledName.replace("{" + i + "}", values[i]);
            filledCss = filledCss.replace("{" + i + "}", values[i]);
        }
        return new Target(filledName, filledCss);
    }

    @Override
    public String toString() {
        return name + " (" + css + ")";
    }

    public static final class Builder {
        private final String name;

        private Builder(String name) {
            this.name = name;
        }

        public Target locatedBy(String css) {
            return new Target(name, css);
        }
    }
}
\`\`\`

### Core: the Actor

\`\`\`java
// core/Actor.java
package com.shopeasy.screenplay.core;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class Actor {

    private final String name;
    private final Map<Class<? extends Ability>, Ability> abilities = new HashMap<>();
    private final Map<String, Object> notes = new HashMap<>();
    private final Deque<String> activity = new ArrayDeque<>();   // task > sub-task > interaction

    private Actor(String name) {
        this.name = Objects.requireNonNull(name, "name");
    }

    public static Actor named(String name) {
        return new Actor(name);
    }

    public Actor whoCan(Ability... newAbilities) {
        for (Ability ability : newAbilities) {
            abilities.put(ability.getClass(), ability);
        }
        return this;
    }

    public <A extends Ability> A abilityTo(Class<A> type) {
        Ability ability = abilities.get(type);
        if (ability == null) {
            throw new ScreenplayException(name + " does not have the ability " + type.getSimpleName()
                    + "; abilities: " + abilities.keySet().stream().map(Class::getSimpleName).toList());
        }
        return type.cast(ability);
    }

    public void attemptsTo(Performable... performables) {
        for (Performable performable : performables) {
            String step = performable.description().replace("{0}", name);
            narrate(step);
            activity.push(step);
            try {
                performable.performAs(this);
            } catch (ScreenplayException alreadyExplained) {
                throw alreadyExplained;                       // the innermost step already added context
            } catch (RuntimeException failure) {
                throw new ScreenplayException(name + " failed while: " + currentPath(), failure);
            } finally {
                activity.pop();
            }
        }
    }

    public <T> T asksFor(Question<T> question) {
        T answer = question.answeredBy(this);
        narrate(name + " sees that " + question.subject() + " is " + answer);
        return answer;
    }

    public void remember(String key, Object value) {
        notes.put(key, value);
    }

    @SuppressWarnings("unchecked")
    public <T> T recall(String key) {
        if (!notes.containsKey(key)) {
            throw new ScreenplayException(name + " has no note called '" + key + "'; notes: " + notes.keySet());
        }
        return (T) notes.get(key);
    }

    public String name() {
        return name;
    }

    private String currentPath() {
        List<String> steps = new ArrayList<>(activity);   // deque head = innermost step
        Collections.reverse(steps);
        return String.join(" > ", steps);
    }

    private void narrate(String line) {
        System.out.println("  ".repeat(activity.size()) + line);   // swap for SLF4J/Allure in a real framework
    }

    @Override
    public String toString() {
        return name;
    }
}
\`\`\`

**Step by step:**

- \`abilities\` is a **type-keyed map**: \`abilityTo(BrowseTheWeb.class)\` returns a typed instance with \`type.cast\` — no casts in tasks. A missing ability fails with *who* lacked *what*, which matters in multi-actor tests ("Vera does not have the ability BrowseTheWeb").
- \`attemptsTo\` is the **single choke point**. Every task and interaction is narrated with indentation that mirrors the composition depth, and the \`activity\` deque records the path. When a Selenium exception escapes the innermost interaction, it is wrapped once with the **business path** — "Asha failed while: Asha checks out as Asha Rao > Asha enters the shipping details > Asha clicks on the continue button" — and outer levels rethrow it untouched. Compare that with a bare \`TimeoutException\`.
- \`asksFor\` narrates questions and their answers, so the log shows what the actor *saw* before an assertion failed.
- \`remember\`/\`recall\` are per-actor notes. They are instance fields — no statics — so parallel tests with their own actors are isolated. The unchecked cast in \`recall\` is the price of a heterogeneous map; keep keys as constants next to the task that writes them.
- The actor does **not** own the driver's lifecycle. Whoever creates the session quits it (the base test or hook), exactly as in \`selenium-deep-framework-design\`.

### Abilities

\`\`\`java
// abilities/BrowseTheWeb.java
package com.shopeasy.screenplay.abilities;

import com.shopeasy.screenplay.core.Ability;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Target;
import java.time.Duration;
import java.util.List;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public final class BrowseTheWeb implements Ability {

    private final WebDriver driver;
    private final String baseUrl;
    private final WebDriverWait wait;

    private BrowseTheWeb(WebDriver driver, String baseUrl) {
        this.driver = driver;
        this.baseUrl = baseUrl;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public static BrowseTheWeb with(WebDriver driver, String baseUrl) {
        return new BrowseTheWeb(driver, baseUrl);
    }

    public static BrowseTheWeb as(Actor actor) {
        return actor.abilityTo(BrowseTheWeb.class);
    }

    public void open(String path) {
        driver.get(baseUrl + path);
    }

    public WebElement visible(Target target) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(target.locator()));
    }

    public WebElement clickable(Target target) {
        return wait.until(ExpectedConditions.elementToBeClickable(target.locator()));
    }

    public List<WebElement> all(Target target) {
        return driver.findElements(target.locator());   // no wait: "zero matches" is a valid answer
    }

    /** Escape hatch for migration: lets an interaction wrap an existing page object. */
    public WebDriver driver() {
        return driver;
    }
}
\`\`\`

\`\`\`java
// abilities/CallAnApi.java
package com.shopeasy.screenplay.abilities;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopeasy.screenplay.core.Ability;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.ScreenplayException;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public final class CallAnApi implements Ability {

    public record ApiResponse(int status, JsonNode body) {
    }

    private static final ObjectMapper JSON = new ObjectMapper();

    private final String baseUrl;
    private final HttpClient client = HttpClient.newHttpClient();
    private String bearerToken;
    private ApiResponse lastResponse;

    private CallAnApi(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public static CallAnApi at(String baseUrl) {
        return new CallAnApi(baseUrl);
    }

    public static CallAnApi as(Actor actor) {
        return actor.abilityTo(CallAnApi.class);
    }

    public void authenticateWith(String token) {
        this.bearerToken = token;
    }

    public ApiResponse send(String method, String path, Object body) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(baseUrl + path))
                    .header("Accept", "application/json");
            if (bearerToken != null) {
                request.header("Authorization", "Bearer " + bearerToken);
            }
            if (body == null) {
                request.method(method, HttpRequest.BodyPublishers.noBody());
            } else {
                request.header("Content-Type", "application/json")
                       .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
            }
            HttpResponse<String> response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode json = response.body().isBlank()
                    ? JSON.getNodeFactory().nullNode()
                    : JSON.readTree(response.body());
            lastResponse = new ApiResponse(response.statusCode(), json);
            return lastResponse;
        } catch (IOException e) {
            throw new UncheckedIOException(method + " " + path + " failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted during " + method + " " + path, e);
        }
    }

    public ApiResponse lastResponse() {
        if (lastResponse == null) {
            throw new ScreenplayException("No API call has been made yet");
        }
        return lastResponse;
    }
}
\`\`\`

An ability is an **adapter with state that belongs to one actor**: Asha's token and last response are not Vera's. That per-actor state is what makes multi-actor tests trivial later. Jackson (\`jackson-databind\`) is the only extra dependency; in a real framework this ability would wrap your RestAssured request specification instead.

### Interactions

\`\`\`java
// interactions/Open.java
package com.shopeasy.screenplay.interactions;

import com.shopeasy.screenplay.abilities.BrowseTheWeb;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Interaction;

public final class Open implements Interaction {

    private final String path;

    private Open(String path) {
        this.path = path;
    }

    public static Open thePage(String path) {
        return new Open(path);
    }

    @Override
    public void performAs(Actor actor) {
        BrowseTheWeb.as(actor).open(path);
    }

    @Override
    public String description() {
        return "{0} opens " + path;
    }
}
\`\`\`

\`\`\`java
// interactions/Click.java
package com.shopeasy.screenplay.interactions;

import com.shopeasy.screenplay.abilities.BrowseTheWeb;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Interaction;
import com.shopeasy.screenplay.core.Target;

public final class Click implements Interaction {

    private final Target target;

    private Click(Target target) {
        this.target = target;
    }

    public static Click on(Target target) {
        return new Click(target);
    }

    @Override
    public void performAs(Actor actor) {
        BrowseTheWeb.as(actor).clickable(target).click();
    }

    @Override
    public String description() {
        return "{0} clicks on the " + target.name();
    }
}
\`\`\`

\`\`\`java
// interactions/Enter.java
package com.shopeasy.screenplay.interactions;

import com.shopeasy.screenplay.abilities.BrowseTheWeb;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Interaction;
import com.shopeasy.screenplay.core.Target;
import org.openqa.selenium.WebElement;

public final class Enter implements Interaction {

    private final String value;
    private final Target target;
    private final boolean secret;

    private Enter(String value, Target target, boolean secret) {
        this.value = value;
        this.target = target;
        this.secret = secret;
    }

    public static Builder theValue(String value) {
        return new Builder(value, false);
    }

    public static Builder theSecret(String value) {
        return new Builder(value, true);
    }

    @Override
    public void performAs(Actor actor) {
        WebElement field = BrowseTheWeb.as(actor).visible(target);
        field.clear();
        field.sendKeys(value);
    }

    @Override
    public String description() {
        return "{0} enters " + (secret ? "******" : "'" + value + "'") + " into the " + target.name();
    }

    public static final class Builder {
        private final String value;
        private final boolean secret;

        private Builder(String value, boolean secret) {
            this.value = value;
            this.secret = secret;
        }

        public Enter into(Target target) {
            return new Enter(value, target, secret);
        }
    }
}
\`\`\`

\`\`\`java
// interactions/WaitUntil.java
package com.shopeasy.screenplay.interactions;

import com.shopeasy.screenplay.abilities.BrowseTheWeb;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Interaction;
import com.shopeasy.screenplay.core.Target;

/** Synchronisation, not verification: it waits for a state and fails only on timeout. */
public final class WaitUntil implements Interaction {

    private final Target target;

    private WaitUntil(Target target) {
        this.target = target;
    }

    public static WaitUntil visible(Target target) {
        return new WaitUntil(target);
    }

    @Override
    public void performAs(Actor actor) {
        BrowseTheWeb.as(actor).visible(target);
    }

    @Override
    public String description() {
        return "{0} waits until the " + target.name() + " is visible";
    }
}
\`\`\`

\`\`\`java
// interactions/Post.java
package com.shopeasy.screenplay.interactions;

import com.shopeasy.screenplay.abilities.CallAnApi;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Interaction;

public final class Post implements Interaction {

    private final String path;
    private final Object body;

    private Post(String path, Object body) {
        this.path = path;
        this.body = body;
    }

    public static Post to(String path) {
        return new Post(path, null);
    }

    public Post with(Object body) {
        return new Post(path, body);
    }

    @Override
    public void performAs(Actor actor) {
        CallAnApi.as(actor).send("POST", path, body);
    }

    @Override
    public String description() {
        return "{0} sends POST " + path;
    }
}
\`\`\`

\`\`\`java
// interactions/Get.java
package com.shopeasy.screenplay.interactions;

import com.shopeasy.screenplay.abilities.CallAnApi;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Interaction;

public final class Get implements Interaction {

    private final String path;

    private Get(String path) {
        this.path = path;
    }

    public static Get resource(String path) {
        return new Get(path);
    }

    @Override
    public void performAs(Actor actor) {
        CallAnApi.as(actor).send("GET", path, null);
    }

    @Override
    public String description() {
        return "{0} sends GET " + path;
    }
}
\`\`\`

Interactions are **immutable** (\`Post.with\` returns a new instance), so a static interaction constant can never carry state from one test to the next. Waits live in the ability (\`clickable\`, \`visible\`) and therefore in every interaction automatically — tasks never wait explicitly except for **state transitions** (\`WaitUntil\`), which are synchronisation, not assertion. \`Enter.theSecret\` keeps passwords out of the narration.

### Targets: the UI map

\`\`\`java
// ui/LoginForm.java
package com.shopeasy.screenplay.ui;

import com.shopeasy.screenplay.core.Target;

public final class LoginForm {
    public static final Target USERNAME = Target.the("username field").locatedBy("#user-name");
    public static final Target PASSWORD = Target.the("password field").locatedBy("#password");
    public static final Target LOGIN_BUTTON = Target.the("login button").locatedBy("#login-button");

    private LoginForm() {
    }
}
\`\`\`

\`\`\`java
// ui/Inventory.java
package com.shopeasy.screenplay.ui;

import com.shopeasy.screenplay.core.Target;

public final class Inventory {
    public static final Target PRODUCT_LIST = Target.the("product list").locatedBy("#inventory-list");
    public static final Target ADD_TO_CART =
            Target.the("add-to-cart button for {0}").locatedBy("[data-testid='add-to-cart-{0}']");

    private Inventory() {
    }
}
\`\`\`

\`\`\`java
// ui/Header.java
package com.shopeasy.screenplay.ui;

import com.shopeasy.screenplay.core.Target;

public final class Header {
    // The header also has a plain "Cart" text link (a[href='cart.html']) — target the icon by test id, not by href.
    public static final Target CART_ICON = Target.the("cart icon").locatedBy("[data-testid='shopping-cart-link']");
    public static final Target CART_BADGE =
            Target.the("cart badge").locatedBy("[data-testid='shopping-cart-link'] [data-testid='shopping-cart-badge']");

    private Header() {
    }
}
\`\`\`

\`\`\`java
// ui/Cart.java, ui/CheckoutForm.java, ui/CheckoutOverview.java — same shape
package com.shopeasy.screenplay.ui;

import com.shopeasy.screenplay.core.Target;

public final class Cart {
    public static final Target CHECKOUT_BUTTON = Target.the("checkout button").locatedBy("#checkout");

    private Cart() {
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.screenplay.ui;

import com.shopeasy.screenplay.core.Target;

public final class CheckoutForm {
    public static final Target FIRST_NAME = Target.the("first name field").locatedBy("#first-name");
    public static final Target LAST_NAME = Target.the("last name field").locatedBy("#last-name");
    public static final Target POSTAL_CODE = Target.the("postal code field").locatedBy("#postal-code");
    public static final Target CONTINUE = Target.the("continue button").locatedBy("#continue");

    private CheckoutForm() {
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.screenplay.ui;

import com.shopeasy.screenplay.core.Target;

public final class CheckoutOverview {
    public static final Target TOTAL = Target.the("order total").locatedBy("#summary-total");
    public static final Target FINISH = Target.the("finish button").locatedBy("#finish");
    public static final Target ORDER_NUMBER = Target.the("order number").locatedBy("#order-number");

    private CheckoutOverview() {
    }
}
\`\`\`

The badge is created by \`shop.js\` only when the cart is non-empty, so "no badge" means zero — the question below handles it without waiting. \`[data-testid='add-to-cart-{0}']\` uses the product slug (\`trailblazer-backpack\`), which the task derives from the business name.

### Model, tasks and questions

\`\`\`java
// model/Credentials.java
package com.shopeasy.screenplay.model;

public record Credentials(String username, String password) {

    public static Credentials standardUser() {
        return new Credentials("standard_user", System.getProperty("shop.password", "secret_sauce"));
    }

    public static Credentials visualUser() {      // a second customer — exists in the API only
        return new Credentials("visual_user", System.getProperty("shop.password", "secret_sauce"));
    }

    @Override
    public String toString() {
        return "Credentials[" + username + ", ******]";
    }
}
\`\`\`

\`\`\`java
// model/CheckoutDetails.java
package com.shopeasy.screenplay.model;

public record CheckoutDetails(String firstName, String lastName, String postalCode) {

    public static CheckoutDetails ashaInBengaluru() {
        return new CheckoutDetails("Asha", "Rao", "560001");
    }
}
\`\`\`

\`\`\`java
// tasks/Login.java
package com.shopeasy.screenplay.tasks;

import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Task;
import com.shopeasy.screenplay.interactions.Click;
import com.shopeasy.screenplay.interactions.Enter;
import com.shopeasy.screenplay.interactions.Open;
import com.shopeasy.screenplay.interactions.WaitUntil;
import com.shopeasy.screenplay.model.Credentials;
import com.shopeasy.screenplay.ui.Inventory;
import com.shopeasy.screenplay.ui.LoginForm;

public final class Login implements Task {

    private final Credentials user;

    private Login(Credentials user) {
        this.user = user;
    }

    public static Login as(Credentials user) {
        return new Login(user);
    }

    @Override
    public void performAs(Actor actor) {
        actor.attemptsTo(
                Open.thePage("login.html"),
                Enter.theValue(user.username()).into(LoginForm.USERNAME),
                Enter.theSecret(user.password()).into(LoginForm.PASSWORD),
                Click.on(LoginForm.LOGIN_BUTTON),
                WaitUntil.visible(Inventory.PRODUCT_LIST));
    }

    @Override
    public String description() {
        return "{0} logs in as " + user.username();
    }
}
\`\`\`

\`\`\`java
// tasks/AddToCart.java
package com.shopeasy.screenplay.tasks;

import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Task;
import com.shopeasy.screenplay.interactions.Click;
import com.shopeasy.screenplay.ui.Inventory;
import java.util.Locale;

public final class AddToCart implements Task {

    private final String productName;

    private AddToCart(String productName) {
        this.productName = productName;
    }

    public static AddToCart theProduct(String productName) {
        return new AddToCart(productName);
    }

    static String slugOf(String productName) {          // "Classic Crew T-Shirt" -> "classic-crew-t-shirt"
        return productName.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }

    @Override
    public void performAs(Actor actor) {
        actor.attemptsTo(Click.on(Inventory.ADD_TO_CART.of(slugOf(productName))));
    }

    @Override
    public String description() {
        return "{0} adds the " + productName + " to the cart";
    }
}
\`\`\`

\`\`\`java
// tasks/Checkout.java
package com.shopeasy.screenplay.tasks;

import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Task;
import com.shopeasy.screenplay.interactions.Click;
import com.shopeasy.screenplay.interactions.Enter;
import com.shopeasy.screenplay.interactions.WaitUntil;
import com.shopeasy.screenplay.model.CheckoutDetails;
import com.shopeasy.screenplay.ui.Cart;
import com.shopeasy.screenplay.ui.CheckoutForm;
import com.shopeasy.screenplay.ui.CheckoutOverview;
import com.shopeasy.screenplay.ui.Header;

/** Ends on the overview step (step 2 of 3): the order is NOT placed. */
public final class Checkout implements Task {

    private final CheckoutDetails details;

    private Checkout(CheckoutDetails details) {
        this.details = details;
    }

    public static Checkout withDetails(CheckoutDetails details) {
        return new Checkout(details);
    }

    @Override
    public void performAs(Actor actor) {
        actor.attemptsTo(
                Task.where("{0} goes to the checkout",
                        Click.on(Header.CART_ICON),
                        Click.on(Cart.CHECKOUT_BUTTON)),
                Task.where("{0} enters the shipping details",
                        Enter.theValue(details.firstName()).into(CheckoutForm.FIRST_NAME),
                        Enter.theValue(details.lastName()).into(CheckoutForm.LAST_NAME),
                        Enter.theValue(details.postalCode()).into(CheckoutForm.POSTAL_CODE),
                        Click.on(CheckoutForm.CONTINUE),
                        WaitUntil.visible(CheckoutOverview.TOTAL)));
    }

    @Override
    public String description() {
        return "{0} checks out as " + details.firstName() + " " + details.lastName();
    }
}
\`\`\`

\`\`\`java
// tasks/PlaceTheOrder.java
package com.shopeasy.screenplay.tasks;

import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.Task;
import com.shopeasy.screenplay.interactions.Click;
import com.shopeasy.screenplay.questions.TheOrderNumber;
import com.shopeasy.screenplay.ui.CheckoutOverview;

public final class PlaceTheOrder implements Task {

    public static final String ORDER_NUMBER = "order number";

    public static PlaceTheOrder andNoteItsNumber() {
        return new PlaceTheOrder();
    }

    @Override
    public void performAs(Actor actor) {
        actor.attemptsTo(Click.on(CheckoutOverview.FINISH));
        actor.remember(ORDER_NUMBER, actor.asksFor(TheOrderNumber.shown()));   // read, don't judge
    }

    @Override
    public String description() {
        return "{0} places the order";
    }
}
\`\`\`

\`\`\`java
// questions/TheCartBadge.java
package com.shopeasy.screenplay.questions;

import com.shopeasy.screenplay.abilities.BrowseTheWeb;
import com.shopeasy.screenplay.core.Question;
import com.shopeasy.screenplay.ui.Header;
import java.util.List;
import org.openqa.selenium.WebElement;

public final class TheCartBadge {

    public static Question<Integer> count() {
        return Question.about("the cart badge count", actor -> {
            List<WebElement> badges = BrowseTheWeb.as(actor).all(Header.CART_BADGE);
            return badges.isEmpty() ? 0 : Integer.parseInt(badges.get(0).getText().trim());
        });
    }

    private TheCartBadge() {
    }
}
\`\`\`

\`\`\`java
// questions/OrderTotal.java
package com.shopeasy.screenplay.questions;

import com.shopeasy.screenplay.abilities.BrowseTheWeb;
import com.shopeasy.screenplay.core.Question;
import com.shopeasy.screenplay.ui.CheckoutOverview;
import java.math.BigDecimal;

public final class OrderTotal {

    public static Question<BigDecimal> displayed() {
        return Question.about("the order total", actor -> {
            String text = BrowseTheWeb.as(actor).visible(CheckoutOverview.TOTAL).getText();   // "$32.39"
            return new BigDecimal(text.replace("$", "").trim());
        });
    }

    private OrderTotal() {
    }
}
\`\`\`

\`\`\`java
// questions/TheOrderNumber.java
package com.shopeasy.screenplay.questions;

import com.shopeasy.screenplay.abilities.BrowseTheWeb;
import com.shopeasy.screenplay.core.Question;
import com.shopeasy.screenplay.ui.CheckoutOverview;

public final class TheOrderNumber {

    public static Question<String> shown() {
        return Question.about("the order number",
                actor -> BrowseTheWeb.as(actor).visible(CheckoutOverview.ORDER_NUMBER).getText().trim());
    }

    private TheOrderNumber() {
    }
}
\`\`\`

### The TestNG test

\`\`\`java
// com/shopeasy/tests/CheckoutJourneyTest.java
package com.shopeasy.tests;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

import com.shopeasy.screenplay.abilities.BrowseTheWeb;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.model.CheckoutDetails;
import com.shopeasy.screenplay.model.Credentials;
import com.shopeasy.screenplay.questions.OrderTotal;
import com.shopeasy.screenplay.questions.TheCartBadge;
import com.shopeasy.screenplay.tasks.AddToCart;
import com.shopeasy.screenplay.tasks.Checkout;
import com.shopeasy.screenplay.tasks.Login;
import com.shopeasy.screenplay.tasks.PlaceTheOrder;
import java.math.BigDecimal;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class CheckoutJourneyTest {

    private static final String SHOP = System.getProperty("shop.url", "http://localhost:5180/practice-site/");

    private WebDriver driver;
    private Actor asha;

    @BeforeMethod
    public void castTheActor() {
        driver = new ChromeDriver();   // in a real framework: your DriverManager (selenium-deep-parallel-execution)
        asha = Actor.named("Asha").whoCan(BrowseTheWeb.with(driver, SHOP));
    }

    @AfterMethod(alwaysRun = true)
    public void quitTheBrowser() {
        if (driver != null) {
            driver.quit();
        }
    }

    @Test
    public void totalIncludesEightPercentTax() {
        asha.attemptsTo(
                Login.as(Credentials.standardUser()),
                AddToCart.theProduct("Trailblazer Backpack"));

        int badge = asha.asksFor(TheCartBadge.count());
        assertEquals(badge, 1, "cart badge after adding one product");

        asha.attemptsTo(Checkout.withDetails(CheckoutDetails.ashaInBengaluru()));

        assertEquals(asha.asksFor(OrderTotal.displayed()), new BigDecimal("32.39"),
                "29.99 + 8% tax (2.40)");
    }

    @Test
    public void placedOrderGetsAnOrderNumber() {
        asha.attemptsTo(
                Login.as(Credentials.standardUser()),
                AddToCart.theProduct("Trailblazer Backpack"),
                AddToCart.theProduct("Pulse Bike Light"),
                Checkout.withDetails(CheckoutDetails.ashaInBengaluru()));

        assertEquals(asha.asksFor(OrderTotal.displayed()), new BigDecimal("43.18"),
                "39.98 + 8% tax (3.20)");

        asha.attemptsTo(PlaceTheOrder.andNoteItsNumber());

        String orderNumber = asha.recall(PlaceTheOrder.ORDER_NUMBER);
        assertTrue(orderNumber.matches("SE-\\\\d{6}"), "unexpected order number: " + orderNumber);
    }
}
\`\`\`

The narration of the first test, printed by the actor:

\`\`\`
Asha logs in as standard_user
  Asha opens login.html
  Asha enters 'standard_user' into the username field
  Asha enters ****** into the password field
  Asha clicks on the login button
  Asha waits until the product list is visible
Asha adds the Trailblazer Backpack to the cart
  Asha clicks on the add-to-cart button for trailblazer-backpack
Asha sees that the cart badge count is 1
Asha checks out as Asha Rao
  Asha goes to the checkout
    Asha clicks on the cart icon
    Asha clicks on the checkout button
  Asha enters the shipping details
    ...
Asha sees that the order total is 32.39
\`\`\`

**What to notice:**

- The test body is **business language only**: no locators, no waits, no driver. A BA can read it; a reviewer sees what is under test (the total), and the setup is three task calls.
- **Assertions stay in the test** (rule from the *Assertions stay in tests* lesson); tasks and questions never judge. \`PlaceTheOrder\` *reads* the number and *notes* it — reading is allowed, deciding pass/fail is not.
- Totals are \`BigDecimal\` from the string the UI shows: \`29.99 + round(2.3992) = 32.39\`; \`39.98 + round(3.1984) = 43.18\` — ShopEasy rounds the tax to cents before adding.
- \`Checkout\` composes two ad-hoc \`Task.where\` sub-tasks. Use a class when the sub-task is reused or parameterised; \`Task.where\` when it only names a group for the narration.
- Parallel safety comes for free **if** each test creates its own actor and driver: there are no statics except immutable \`Target\` constants.

## The same journey with Serenity BDD Screenplay

Serenity BDD is the best-known Java implementation (it popularised the pattern). The API below uses names confirmed in the Serenity BDD documentation (\`serenity-bdd.github.io\`); version notes are at the end of the section.

\`\`\`java
// ui/ShopTargets.java
package com.shopeasy.serenity.ui;

import net.serenitybdd.screenplay.targets.Target;

public final class ShopTargets {
    public static final Target USERNAME = Target.the("username field").locatedBy("#user-name");
    public static final Target PASSWORD = Target.the("password field").locatedBy("#password");
    public static final Target LOGIN_BUTTON = Target.the("login button").locatedBy("#login-button");
    public static final Target ADD_TO_CART =
            Target.the("add-to-cart button for {0}").locatedBy("[data-testid='add-to-cart-{0}']");
    public static final Target CART_ICON = Target.the("cart icon").locatedBy("[data-testid='shopping-cart-link']");
    public static final Target CHECKOUT_BUTTON = Target.the("checkout button").locatedBy("#checkout");
    public static final Target FIRST_NAME = Target.the("first name field").locatedBy("#first-name");
    public static final Target LAST_NAME = Target.the("last name field").locatedBy("#last-name");
    public static final Target POSTAL_CODE = Target.the("postal code field").locatedBy("#postal-code");
    public static final Target CONTINUE = Target.the("continue button").locatedBy("#continue");
    public static final Target ORDER_TOTAL = Target.the("order total").locatedBy("#summary-total");

    private ShopTargets() {
    }
}
\`\`\`

\`\`\`java
// tasks/Login.java — a class-based task created through instrumented()
package com.shopeasy.serenity.tasks;

import static com.shopeasy.serenity.ui.ShopTargets.*;
import static net.serenitybdd.screenplay.Tasks.instrumented;

import net.serenitybdd.annotations.Step;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.Task;
import net.serenitybdd.screenplay.actions.Click;
import net.serenitybdd.screenplay.actions.Enter;
import net.serenitybdd.screenplay.actions.Open;

public class Login implements Task {              // not final: instrumented() creates a runtime subclass

    private final String username;
    private final String password;

    public Login(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public static Login as(String username, String password) {
        return instrumented(Login.class, username, password);
    }

    @Override
    @Step("{0} logs in as #username")
    public <T extends Actor> void performAs(T actor) {
        actor.attemptsTo(
                Open.url("http://localhost:5180/practice-site/login.html"),
                Enter.theValue(username).into(USERNAME),
                Enter.theValue(password).into(PASSWORD),
                Click.on(LOGIN_BUTTON));
    }
}
\`\`\`

\`\`\`java
// tasks/AddToCart.java and tasks/Checkout.java — ad-hoc tasks with Task.where
package com.shopeasy.serenity.tasks;

import static com.shopeasy.serenity.ui.ShopTargets.*;

import java.util.Locale;
import net.serenitybdd.screenplay.Performable;
import net.serenitybdd.screenplay.Task;
import net.serenitybdd.screenplay.actions.Click;
import net.serenitybdd.screenplay.actions.Enter;

public final class ShopTasks {

    public static Performable addToCart(String productName) {
        String slug = productName.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
        return Task.where("{0} adds the " + productName + " to the cart",
                Click.on(ADD_TO_CART.of(slug)));
    }

    public static Performable checkoutWithDetails(String first, String last, String postalCode) {
        return Task.where("{0} checks out as " + first + " " + last,
                Click.on(CART_ICON),
                Click.on(CHECKOUT_BUTTON),
                Enter.theValue(first).into(FIRST_NAME),
                Enter.theValue(last).into(LAST_NAME),
                Enter.theValue(postalCode).into(POSTAL_CODE),
                Click.on(CONTINUE));
    }

    private ShopTasks() {
    }
}
\`\`\`

\`\`\`java
// questions/ShopQuestions.java
package com.shopeasy.serenity.questions;

import static com.shopeasy.serenity.ui.ShopTargets.ORDER_TOTAL;

import java.math.BigDecimal;
import net.serenitybdd.screenplay.Question;
import net.serenitybdd.screenplay.abilities.BrowseTheWeb;
import net.serenitybdd.screenplay.questions.Text;

public final class ShopQuestions {

    public static Question<Integer> cartBadgeCount() {
        return actor -> {
            var badges = BrowseTheWeb.as(actor).findAll("[data-testid='shopping-cart-badge']");
            return badges.isEmpty() ? 0 : Integer.parseInt(badges.get(0).getText().trim());
        };
    }

    public static Question<BigDecimal> orderTotal() {
        return actor -> new BigDecimal(actor.asksFor(Text.of(ORDER_TOTAL)).replace("$", "").trim());
    }

    private ShopQuestions() {
    }
}
\`\`\`

\`\`\`java
// CheckoutJourneyTest.java — JUnit 5
package com.shopeasy.serenity;

import static com.shopeasy.serenity.questions.ShopQuestions.cartBadgeCount;
import static com.shopeasy.serenity.questions.ShopQuestions.orderTotal;
import static com.shopeasy.serenity.tasks.ShopTasks.addToCart;
import static com.shopeasy.serenity.tasks.ShopTasks.checkoutWithDetails;
import static net.serenitybdd.screenplay.GivenWhenThen.seeThat;
import static org.hamcrest.Matchers.equalTo;

import com.shopeasy.serenity.tasks.Login;
import com.shopeasy.serenity.ui.ShopTargets;
import java.math.BigDecimal;
import net.serenitybdd.junit5.SerenityJUnit5Extension;   // package differs between doc pages — check your version
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.annotations.CastMember;
import net.serenitybdd.screenplay.ensure.Ensure;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(SerenityJUnit5Extension.class)
class CheckoutJourneyTest {

    @CastMember(name = "Asha")          // an actor with a Serenity-managed browser (webdriver.driver in serenity.conf)
    Actor asha;

    @Test
    void totalIncludesEightPercentTax() {
        asha.attemptsTo(
                Login.as("standard_user", "secret_sauce"),
                addToCart("Trailblazer Backpack"));

        asha.should(seeThat(cartBadgeCount(), equalTo(1)));

        asha.attemptsTo(
                checkoutWithDetails("Asha", "Rao", "560001"),
                Ensure.that(ShopTargets.ORDER_TOTAL).text().isEqualTo("$32.39"),
                Ensure.thatTheAnswerTo("the order total", orderTotal()).isEqualTo(new BigDecimal("32.39")));
    }
}
\`\`\`

The explicit alternative to \`@CastMember\` is \`Actor.named("Asha").whoCan(BrowseTheWeb.with(driver))\` with a \`@Managed WebDriver driver\` field (or \`asha.can(BrowseTheWeb.with(driver))\` in a Cucumber hook).

**Step by step, and how it maps to your plain-Java version:**

- \`Target.the(..).locatedBy(..)\` and \`.of(..)\` with \`{0}\` placeholders are the same idea as your \`Target\` record; Serenity also accepts \`Target.the(..).located(By.id(..))\`.
- \`Tasks.instrumented(Login.class, args)\` creates the task through Serenity's instrumentation so that \`@Step("{0} logs in as #username")\` becomes a **report step**: \`{0}\` is the actor, \`#username\` is the field value. Because a subclass is generated at runtime, the class must not be \`final\` and needs an accessible constructor. \`Task.where("{0} ...", performables...)\` gives you a reported task without a class — the same as your \`Task.where\`.
- \`Click.on\`, \`Enter.theValue(..).into(..)\` and \`Open.url(..)\` live in \`net.serenitybdd.screenplay.actions\`; they wait for elements through Serenity's \`WebElementFacade\`, which is why there is no explicit \`WaitUntil\` here.
- Questions are functional: \`actor -> ...\` is a \`Question<T>\`; \`Text.of(target)\` is a built-in question returning the text; \`BrowseTheWeb.as(actor).findAll(..)\` gives raw access.
- Two assertion styles: \`actor.should(seeThat(question, matcher))\` (Hamcrest) and \`Ensure.that(...)\` (fluent, from the \`serenity-ensure\` module), which is itself a *performable* — so it is reported as a step inside \`attemptsTo\`. That is the one place where Serenity puts an assertion into the performable list, and it is explicit and named, not hidden inside a task.

**What Serenity adds over the plain version:**

| Area | Plain Java (yours) | Serenity BDD |
|---|---|---|
| Reporting | console narration you wrote | HTML report with nested steps per task/interaction, screenshots per step (configurable), timings |
| Living documentation | none | requirements/feature hierarchy, test results mapped to stories and acceptance criteria, readable by BAs/POs |
| Actors and casts | hand-written | \`OnStage\`, \`Cast\`/\`OnlineCast\`, \`@CastMember\`, \`theActorCalled(..)\`, spotlight |
| Built-in vocabulary | what you write | dozens of interactions (\`Open\`, \`Click\`, \`Enter\`, \`SelectFromOptions\`, \`Scroll\`, waits), questions (\`Text\`, \`Value\`, \`Visibility\`...), \`Ensure\` |
| REST | your \`CallAnApi\` | \`serenity-screenplay-rest\`: \`CallAnApi.at(url)\`, \`Get.resource(..)\`, \`Post.to(..).with(request -> ...)\`, \`SerenityRest.lastResponse()\`, \`seeThatResponse(..)\` |
| Playwright | write your own ability | \`serenity-screenplay-playwright\` with a \`BrowseTheWebWithPlaywright\` ability (Playwright for Java) |
| Runners | anything (TestNG here) | JUnit 5 (recommended; JUnit 4 is deprecated in recent versions) and Cucumber — TestNG is not among the documented runners |
| Cost | ~400 lines you own | framework lock-in, instrumentation "magic", report plugin in the build, upgrade work across major versions |

Version notes, verified in the Serenity docs while writing this lesson: the \`@Step\` annotation is imported from \`net.serenitybdd.annotations\` in current versions (older code uses \`net.thucydides.core.annotations\`); the Playwright page builds against Serenity 5.x. The \`SerenityJUnit5Extension\` import appears with two different packages on different doc pages — copy it from the docs for **your** version. \`@CastMember\` lives in \`net.serenitybdd.screenplay.annotations\` (javadoc). Everything else in the code above uses names shown in the docs; the \`net.serenitybdd.screenplay.abilities.BrowseTheWeb\`, \`...targets.Target\` and \`GivenWhenThen.seeThat\` package paths are from memory — let the IDE resolve them.

## Multi-actor scenarios

A second actor is just a second object with its own abilities and notes. On ShopEasy the API seeds three users: \`standard_user\` (id 1, Asha Rao), \`locked_out_user\` (id 2) and \`visual_user\` (id 3, Vera Visual — documented as "a second customer for someone else's order tests"). \`GET /api/orders/{id}\` returns **403 FORBIDDEN** for another user's order. That is a two-actor rule.

\`\`\`java
// tasks/LogInToTheApi.java
package com.shopeasy.screenplay.tasks;

import com.shopeasy.screenplay.abilities.CallAnApi;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.ScreenplayException;
import com.shopeasy.screenplay.core.Task;
import com.shopeasy.screenplay.interactions.Post;
import com.shopeasy.screenplay.model.Credentials;
import java.util.Map;

public final class LogInToTheApi implements Task {

    private final Credentials user;

    private LogInToTheApi(Credentials user) {
        this.user = user;
    }

    public static LogInToTheApi as(Credentials user) {
        return new LogInToTheApi(user);
    }

    @Override
    public void performAs(Actor actor) {
        actor.attemptsTo(Post.to("/api/auth/login")
                .with(Map.of("username", user.username(), "password", user.password())));
        CallAnApi api = CallAnApi.as(actor);
        CallAnApi.ApiResponse response = api.lastResponse();
        if (response.status() != 200) {                      // precondition guard, not a test assertion
            throw new ScreenplayException("API login failed for " + user.username() + ": " + response.body());
        }
        api.authenticateWith(response.body().path("token").asText());
    }

    @Override
    public String description() {
        return "{0} logs in to the API as " + user.username();
    }
}
\`\`\`

\`\`\`java
// tasks/PlaceAnOrder.java
package com.shopeasy.screenplay.tasks;

import com.shopeasy.screenplay.abilities.CallAnApi;
import com.shopeasy.screenplay.core.Actor;
import com.shopeasy.screenplay.core.ScreenplayException;
import com.shopeasy.screenplay.core.Task;
import com.shopeasy.screenplay.interactions.Post;
import com.shopeasy.screenplay.model.CheckoutDetails;
import java.util.List;
import java.util.Map;

public final class PlaceAnOrder implements Task {

    public static final String ORDER_ID = "order id";

    private final int productId;
    private final CheckoutDetails details;

    private PlaceAnOrder(int productId, CheckoutDetails details) {
        this.productId = productId;
        this.details = details;
    }

    public static PlaceAnOrder viaTheApi(int productId, CheckoutDetails details) {
        return new PlaceAnOrder(productId, details);
    }

    @Override
    public void performAs(Actor actor) {
        actor.attemptsTo(Post.to("/api/orders").with(Map.of(
                "firstName", details.firstName(),
                "lastName", details.lastName(),
                "postalCode", details.postalCode(),
                "items", List.of(Map.of("productId", productId, "quantity", 1)))));
        CallAnApi.ApiResponse response = CallAnApi.as(actor).lastResponse();
        if (response.status() != 201) {
            throw new ScreenplayException("Order was not created: " + response.status() + " " + response.body());
        }
        actor.remember(ORDER_ID, response.body().path("id").asInt());
    }

    @Override
    public String description() {
        return "{0} orders product " + productId + " through the API";
    }
}
\`\`\`

\`\`\`java
// questions/LastResponse.java
package com.shopeasy.screenplay.questions;

import com.shopeasy.screenplay.abilities.CallAnApi;
import com.shopeasy.screenplay.core.Question;

public final class LastResponse {

    public static Question<Integer> status() {
        return Question.about("the last response status", actor -> CallAnApi.as(actor).lastResponse().status());
    }

    private LastResponse() {
    }
}
\`\`\`

\`\`\`java
// in OrderPrivacyTest (TestNG)
private static final String API = System.getProperty("api.url", "http://localhost:5181");

@Test
public void aCustomerCannotReadAnotherCustomersOrder() {
    Actor asha = Actor.named("Asha").whoCan(CallAnApi.at(API));
    Actor vera = Actor.named("Vera").whoCan(CallAnApi.at(API));

    asha.attemptsTo(
            LogInToTheApi.as(Credentials.standardUser()),
            PlaceAnOrder.viaTheApi(1, CheckoutDetails.ashaInBengaluru()));      // product 1 = Trailblazer Backpack
    int ashasOrder = asha.recall(PlaceAnOrder.ORDER_ID);

    vera.attemptsTo(
            LogInToTheApi.as(Credentials.visualUser()),
            Get.resource("/api/orders/" + ashasOrder));

    int status = vera.asksFor(LastResponse.status());
    assertEquals(status, 403, "Vera must not see Asha's order " + ashasOrder);
}
\`\`\`

Notice the **hand-over**: Asha's note is read by the test and passed to Vera explicitly. Notes are private to an actor; resist a global "scenario notepad" that every actor writes to — it recreates the shared mutable state you removed.

**Customer + admin** is the classic multi-actor case on a typical e-commerce project (ShopEasy has no admin role, so this is a sketch): \`customer.attemptsTo(PlaceAnOrder...)\`, \`admin.attemptsTo(RefundTheOrder.number(id))\` with an admin \`BrowseTheWeb\` in its **own browser session**, then \`customer.asksFor(TheOrderStatus.of(id))\`. Each UI actor needs its own driver (cookies and \`sessionStorage\` are per session — ShopEasy keeps the cart there), so the cast must create and quit one browser per UI actor.

## API + UI abilities in one actor

One actor can hold several abilities and switch channel per step — arrange through the API, act and assert through the UI.

**Seeding a user.** \`POST /api/users\` registers a customer without auth; the server validates \`username\` (3–40 of \`[a-z0-9_.-]\`), \`password\` (at least 8 characters), \`firstName\`, \`lastName\`, \`email\` (optional \`phone\`, \`address\`) and returns **201** with the user (and a \`Location\` header), 409 \`USERNAME_TAKEN\`, 422 \`INVALID_EMAIL\`.

\`\`\`java
// tasks/RegisterCustomer.java (perform body only; same class shape as PlaceAnOrder)
@Override
public void performAs(Actor actor) {
    actor.attemptsTo(Post.to("/api/users").with(Map.of(
            "username", username,                    // unique per run, e.g. "asha." + System.nanoTime()
            "password", password,
            "firstName", "Asha",
            "lastName", "Rao",
            "email", username + "@shopeasy.test")));
    CallAnApi.ApiResponse response = CallAnApi.as(actor).lastResponse();
    if (response.status() != 201) {
        throw new ScreenplayException("Registration failed: " + response.status() + " " + response.body());
    }
    actor.remember("user id", response.body().path("id").asInt());
}
\`\`\`

An honest ShopEasy caveat: the web shop's login page is client-side and accepts only the demo users (\`standard_user\`, \`locked_out_user\`), so a freshly registered user can be verified through \`POST /api/auth/login\` and \`GET /api/users/{id}\`, but **not** through the browser. On a real application the next line would be \`asha.attemptsTo(Login.as(registered))\` in the same actor — that is the whole point of combining abilities.

**A cross-channel consistency check that does work on ShopEasy:** the API's price and the UI's total must agree.

\`\`\`java
@Test
public void uiTotalMatchesTheApiPricePlusTax() {
    Actor asha = Actor.named("Asha").whoCan(BrowseTheWeb.with(driver, SHOP), CallAnApi.at(API));

    asha.attemptsTo(Get.resource("/api/products?q=Trailblazer"));
    BigDecimal price = asha.asksFor(Question.about("the API price of the Trailblazer Backpack",
            actor -> CallAnApi.as(actor).lastResponse().body().path("data").path(0).path("price").decimalValue()));

    asha.attemptsTo(
            Login.as(Credentials.standardUser()),
            AddToCart.theProduct("Trailblazer Backpack"),
            Checkout.withDetails(CheckoutDetails.ashaInBengaluru()));

    BigDecimal tax = price.multiply(new BigDecimal("0.08")).setScale(2, RoundingMode.HALF_UP);
    assertEquals(asha.asksFor(OrderTotal.displayed()), price.add(tax), "UI total = API price + 8% tax");
}
\`\`\`

The tasks do not know or care which ability the *other* tasks use; the actor is the only place where channels meet. In POM terms you would need a page object, an API client and glue in the test; here the glue is the actor.

## Screenplay with Cucumber

Step definitions shrink to one line each because the vocabulary already exists — the step text and the task name say the same thing.

\`\`\`gherkin
Feature: Checkout totals

  Scenario: Tax is added to the order total
    Given Asha has logged in as a standard user
    When Asha adds the "Trailblazer Backpack" to the cart
    And Asha checks out with her Bengaluru address
    Then Asha should see 1 item in the cart badge
    And Asha should see an order total of "32.39"
\`\`\`

**Plain-Java version** — a per-scenario \`Cast\` injected by \`cucumber-picocontainer\` (state sharing between step classes is covered in lesson 10):

\`\`\`java
// Cast.java — one instance per scenario (PicoContainer)
public class Cast {
    private final Map<String, Actor> actors = new LinkedHashMap<>();
    private final List<WebDriver> drivers = new ArrayList<>();

    public Actor actorCalled(String name) {
        return actors.computeIfAbsent(name, n -> {
            WebDriver driver = new ChromeDriver();          // your DriverFactory; one browser per UI actor
            drivers.add(driver);
            return Actor.named(n).whoCan(
                    BrowseTheWeb.with(driver, ShopConfig.SHOP_URL),
                    CallAnApi.at(ShopConfig.API_URL));
        });
    }

    public void dismissEveryone() {
        drivers.forEach(WebDriver::quit);
        drivers.clear();
        actors.clear();
    }
}
\`\`\`

\`\`\`java
// ShoppingSteps.java
public class ShoppingSteps {
    private final Cast cast;

    public ShoppingSteps(Cast cast) {                        // injected, same instance for all step classes
        this.cast = cast;
    }

    @ParameterType("[A-Z][a-z]+")
    public Actor actor(String name) {
        return cast.actorCalled(name);
    }

    @Given("{actor} has logged in as a standard user")
    public void loggedIn(Actor actor) {
        actor.attemptsTo(Login.as(Credentials.standardUser()));
    }

    @When("{actor} adds the {string} to the cart")
    public void addsToCart(Actor actor, String product) {
        actor.attemptsTo(AddToCart.theProduct(product));
    }

    @When("{actor} checks out with her Bengaluru address")
    public void checksOut(Actor actor) {
        actor.attemptsTo(Checkout.withDetails(CheckoutDetails.ashaInBengaluru()));
    }

    @Then("{actor} should see {int} item(s) in the cart badge")
    public void badgeShows(Actor actor, int expected) {
        int badge = actor.asksFor(TheCartBadge.count());
        assertEquals(badge, expected);
    }

    @Then("{actor} should see an order total of {string}")
    public void totalIs(Actor actor, String expected) {
        assertEquals(actor.asksFor(OrderTotal.displayed()), new BigDecimal(expected));
    }

    @After
    public void dismiss() {
        cast.dismissEveryone();
    }
}
\`\`\`

The custom \`{actor}\` parameter type turns "Asha" into an \`Actor\`; a second name in another step ("Vera ...") creates a second actor with its own browser. A refinement for API-heavy suites: create the browser **lazily** on the first UI interaction, so API-only actors never start Chrome.

**Serenity version** — the framework provides the cast:

\`\`\`java
public class ShoppingSteps {

    @Before
    public void setTheStage() {
        OnStage.setTheStage(new OnlineCast());               // actors who can browse the web with a managed driver
    }

    @ParameterType("[A-Z][a-z]+")
    public Actor actor(String name) {
        return OnStage.theActorCalled(name);
    }

    @When("{actor} adds the {string} to the cart")
    public void addsToCart(Actor actor, String product) {
        actor.attemptsTo(ShopTasks.addToCart(product));
    }

    @Then("{actor} should see {int} item(s) in the cart badge")
    public void badgeShows(Actor actor, int expected) {
        actor.should(seeThat(ShopQuestions.cartBadgeCount(), equalTo(expected)));
    }
}
\`\`\`

\`OnStage.setTheStage(..)\`, \`new OnlineCast()\`, \`OnStage.theActorCalled(..)\` and \`Cast.whereEveryoneCan(..)\` are documented; \`OnStage.theActorInTheSpotlight()\` (for steps like "**she** should see...") is from memory. Use \`Cast.whereEveryoneCan(CallAnApi.at(..))\` for an API-only stage. Serenity's Cucumber integration (\`serenity-cucumber\`) then turns each Gherkin step *and* each nested task into the report hierarchy — the living documentation the BAs read.

## Classic POM vs flow layer vs Screenplay

| | Classic POM | POM + flow layer (Facade) | Screenplay (plain Java) | Serenity Screenplay |
|---|---|---|---|---|
| How it works | pages own locators and actions | flows compose page calls into journeys | actors perform tasks → interactions via abilities; questions read state | same, plus framework vocabulary, runners and reports |
| Learning curve | low; every SDET knows it | low | medium: 6 concepts, more indirection | medium–high: concepts + framework conventions + instrumentation |
| Verbosity / class count | few large classes | + a handful of flow classes | many small classes (one per task/question) | many small classes, but built-in interactions cut it |
| Reuse | page methods | journeys | tasks, interactions, questions at every level; across channels | same, plus a shared library ecosystem |
| Readability for non-coders | low (clicks) | medium (flow names) | high (actor + goal) | high, and visible in reports |
| Reporting | what you build | what you build | narration you build (actor is the hook) | rich HTML, step screenshots, living documentation |
| Debugging | direct: stack trace → page method | direct | one indirection; good if the actor adds context | more indirection (proxies, instrumentation); great reports, harder stepping |
| Multi-actor / multi-channel | awkward (pages bound to one driver) | awkward | natural | natural, with casts and REST module |
| Performance | same — Screenplay adds no measurable runtime cost; speed comes from waits and API setup | same | same | slightly more overhead for reporting/screenshots (configurable) |
| Team fit | small/medium teams, mixed skills | most teams | strong-coding teams who want control | BDD-driven orgs, many contributors, stakeholders who read reports |
| Lock-in | none | none | none (you own it) | high: runners, annotations, report pipeline |

**Recommended approach and why.** Default to **POM with components plus a thin flow layer** — it fixes the most common pains (duplicated journeys, god pages) at the lowest cost. Move to Screenplay when at least two of these are true:

- the suite is large (hundreds of tests) and **several squads** contribute, so a shared, fine-grained vocabulary beats per-team page methods;
- scenarios routinely involve **several actors** (customer/admin/support, buyer/seller) or **several channels** (UI + API + messaging) in one test;
- stakeholders consume **reports as documentation** (BDD with Cucumber, regulated domains) — then Serenity's reporting is the real payoff;
- page objects keep growing despite components, because the code is organised around screens while the business thinks in goals.

It is **overkill** for a 4-person team with 150 UI tests on one channel, for short-lived projects, for teams still learning Java, and as a cure for flakiness or slowness (those come from waits, data and infrastructure). Choose **plain-Java Screenplay** if you use TestNG, want no framework lock-in or already have reporting (Allure); choose **Serenity** if you are on JUnit 5 or Cucumber and want reports and living documentation out of the box.

How a senior phrases the decision in a design review: *"Our pain is duplicated journeys and two-actor scenarios, not locators. A flow layer handles the first; Screenplay handles both. I propose piloting plain-Java Screenplay on the returns feature — new tests only — and comparing authoring time, review time and failure diagnosis after two sprints before touching existing tests."*

## Migration path from POM

Never a big-bang rewrite. Wrap first, replace later.

**Step 1 — introduce the actor around the existing driver.** \`Actor.named("Asha").whoCan(BrowseTheWeb.with(DriverManager.getDriver(), SHOP))\` in the base test. Nothing else changes.

**Step 2 — wrap existing page objects inside interactions and tasks.** The escape hatch \`BrowseTheWeb.driver()\` lets a task delegate to the page you already have:

\`\`\`java
public final class Interactions {

    /** Adapts any existing page-object call into a narrated Screenplay step. */
    public static Interaction using(String description, Consumer<WebDriver> pageObjectCall) {
        return new Interaction() {
            @Override
            public void performAs(Actor actor) {
                pageObjectCall.accept(BrowseTheWeb.as(actor).driver());
            }

            @Override
            public String description() {
                return description;
            }
        };
    }

    private Interactions() {
    }
}

// a task built on the legacy pages, unchanged
public static Task addToCart(String slug) {
    return Task.where("{0} adds " + slug + " to the cart",
            Interactions.using("{0} uses InventoryPage.addToCart",
                    driver -> new InventoryPage(driver).addToCart(slug)));
}
\`\`\`

**Step 3 — new tests use tasks and questions only.** Existing tests keep working; code review enforces "no new page calls from tests".

**Step 4 — replace wrapped calls with real interactions and targets** when a page is touched for another reason (Boy Scout rule). Extract the \`By\` constants into a target class; delete page methods that lost their last caller.

**Step 5 — measure and decide.** Track: lines per test, time to write a new journey test, time to diagnose a failure, number of duplicated flows. If the pilot does not move these numbers, stop at step 2 — you still have a useful flow layer.

Risks to manage: two styles coexisting for months (document which is canonical for new code), contributors who route around tasks "just this once" (lint or ArchUnit rule: test packages may not import \`..pages..\`), and wrapping tasks that hide a god page instead of splitting it.

## The Playwright (TypeScript) world

Two options. **Serenity/JS** brings Screenplay to TypeScript and integrates with Playwright Test (\`@serenity-js/playwright-test\`), with packages \`@serenity-js/core\`, \`@serenity-js/web\`, \`@serenity-js/playwright\`, \`@serenity-js/assertions\` and \`@serenity-js/rest\`, and abilities \`BrowseTheWebWithPlaywright\`, \`CallAnApi\` and \`TakeNotes\`.

\`\`\`ts
import { describe, it } from '@serenity-js/playwright-test'
import { Task } from '@serenity-js/core'
import { Ensure, equals } from '@serenity-js/assertions'
import { By, Click, Enter, Navigate, PageElement, Text } from '@serenity-js/web'

const LoginForm = {
  username: () => PageElement.located(By.css('#user-name')).describedAs('username field'),
  password: () => PageElement.located(By.css('#password')).describedAs('password field'),
  submit:   () => PageElement.located(By.css('#login-button')).describedAs('login button'),
}
const Overview = {
  total: () => PageElement.located(By.css('#summary-total')).describedAs('order total'),
}

const loginAs = (user: string, password: string) =>
  Task.where('#actor logs in as ' + user,
    Navigate.to('/practice-site/login.html'),
    Enter.theValue(user).into(LoginForm.username()),
    Enter.theValue(password).into(LoginForm.password()),
    Click.on(LoginForm.submit()),
  )

describe('Checkout totals', () => {
  it('adds 8% tax', async ({ actorCalled }) => {
    await actorCalled('Asha').attemptsTo(
      loginAs('standard_user', 'secret_sauce'),
      // addToCart(...), checkoutWithDetails(...) built the same way
      Ensure.that(Text.of(Overview.total()), equals('$32.39')),
    )
  })
})
\`\`\`

Verified in the Serenity/JS docs: \`actorCalled\`, \`Task.where\`, \`Ensure.that\` + \`equals\`, \`Navigate.to\`, \`Enter.theValue(..).into(..)\`, \`PageElement.located(By.css(..)).describedAs(..)\`. From memory (check before use): \`Click.on\`, \`Text.of\`, the \`#actor\` placeholder and the \`actorCalled\` test fixture.

**Fixtures + POM** is the idiomatic Playwright answer and usually enough (\`pw-deep-fixtures-pom-components\`): fixtures *are* abilities with lifecycle (\`page\`, \`request\`, a logged-in \`storageState\`), page/component objects hold locators, plain async functions are tasks, \`test.step\` gives narration, and multiple actors are multiple browser contexts:

\`\`\`ts
test('two shoppers have separate carts', async ({ browser }) => {
  const asha = await (await browser.newContext()).newPage()
  const lars = await (await browser.newContext()).newPage()
  await test.step('Asha adds the backpack', () => addToCart(asha, 'Trailblazer Backpack'))
  await expect(lars.getByTestId('shopping-cart-badge')).toHaveCount(0)
})
\`\`\`

Choose Serenity/JS when you want the same Screenplay vocabulary across Java and TypeScript teams, multi-actor scenarios as a first-class concept, or its reporting; stay with fixtures + POM when the team is Playwright-native — the fixture system already solves dependency wiring and lifecycle, which is half of what Screenplay's actor does in Java.

## Common mistakes and when NOT to use Screenplay

- **Tasks that assert.** \`Checkout\` ending with \`assertEquals(total, ...)\` cannot be reused by a test that expects a *validation error*, and hides the check from the test reader. Fix: tasks act, questions read, tests (or an explicit, named \`Ensure\` step) decide.
- **Interactions or tests that leak locators.** \`Click.on("#continue")\` scattered in tests, or a task building \`By.xpath\` inline, rebuilds the duplication POM removed. Fix: every locator is a named \`Target\` in a UI map; string-locator overloads are for spikes only.
- **God tasks.** \`PurchaseFlow.with(user, products, coupon, giftWrap, express, skipLogin, expectError)\` with boolean flags is a god page in a new costume. Fix: small tasks composed in the test or in a named higher-level task; outcome variations are different tasks (\`TryToCheckout.withMissingPostalCode()\`).
- **Over-granular interactions.** \`ClickTheUsernameField\`, \`TypeIntoUsernameField\` as classes, or a test made of 14 interactions — no business vocabulary, all the class count. Fix: generic interactions (\`Click\`, \`Enter\`) + business tasks; tests call tasks.
- **Questions with side effects.** A question that clicks "show details" before reading changes state when someone just wants to *ask*. Fix: the click is an interaction in the task; the question only reads.
- **Static or shared actors and notes.** A \`static Actor ASHA\` or a global notepad makes parallel runs share abilities (one driver for two threads). Fix: actors per test/scenario, created by the base test or the cast.
- **Swallowing the cause.** An actor that catches and rethrows \`new RuntimeException(step)\` without the cause loses the Selenium details. Fix: wrap once with the business path and keep the cause (as \`Actor.attemptsTo\` does above).
- **Adopting Screenplay to fix flakiness or speed.** It reorganises code; it does not change waits, data or environments. Fix those first.

## Best practices for experienced engineers

- **Name tasks as user goals** (\`Checkout.withDetails\`), interactions as **verbs on targets** (\`Click.on\`), questions as **nouns** (\`OrderTotal.displayed()\`). If a task name contains "and", it is probably two tasks.
- **Keep factories static and data immutable.** Tasks capture parameters at construction and do not mutate during \`performAs\`; they can be reused and logged safely.
- **One choke point for cross-cutting concerns.** Logging, screenshots, timing and error context belong in the actor (or the library's event bus), never copy-pasted into tasks.
- **Abilities are adapters with per-actor state** (token, last response, driver). Never share an ability instance between actors.
- **Waits live in abilities/interactions**; tasks only add \`WaitUntil\` for business state transitions.
- **Arrange through the cheapest channel**: API abilities for setup, browser abilities for the behaviour under test — the same actor holds both.
- **Questions return typed values** (\`BigDecimal\`, enums, records like \`OrderSummary\`) — not strings the test must parse.
- **Enforce the layering** with an architecture test (tests may import \`tasks\`, \`questions\`, \`model\`; only \`interactions\` and \`questions\` may import \`abilities\`; nothing imports \`org.openqa.selenium\` outside \`abilities\`/\`interactions\`/\`questions\`).
- **Pilot, measure, then scale** — and write down the decision (ADR) so the next lead knows why.

## Interview questions

### Q: What problem does the Screenplay pattern solve that POM does not?
**Short answer (30–60 s):** POM organises code around pages and solves locator duplication. At scale the pains are different: bloated pages, journeys duplicated across tests, tests mixing what and how, and scenarios with several users or channels. Screenplay organises code around actors who perform business tasks made of small interactions and ask questions — so behaviour is composed, reused and reported in business language, and multiple actors or channels are natural.

**Detailed answer:** POM's unit is the screen, so every new need adds methods to a page — sort, filter, add, wishlist — and multi-page journeys end up re-implemented in tests or step classes. Screenplay splits responsibilities by role: targets hold *where*, interactions hold *how* (one action through one ability), tasks hold *what* (a goal), questions read state, and the actor is the composition and interception point. Consequences: tiny single-purpose classes (SRP/OCP), journeys written once, failures reported as "Asha could not enter her shipping details", and an actor that can hold \`BrowseTheWeb\` and \`CallAnApi\` together. Costs: more classes, more concepts, steeper onboarding. I would also say that a flow layer over POM gets much of the reuse benefit cheaply, and Screenplay pays off with many contributors, multi-actor/multi-channel scenarios or report-driven BDD.

### Q: Explain actor, ability, task, interaction and question. Where do locators live?
**Short answer (30–60 s):** The actor represents a user and holds abilities and notes. Abilities adapt a system — a browser, an API client. Interactions are single low-level actions using one ability (\`Click.on\`, \`Enter.theValue().into()\`). Tasks are business goals composed of interactions and other tasks. Questions read state and return values. Locators live in Targets — named locators grouped in UI-map classes — with no behaviour.

**Detailed answer:** The call chain is \`actor.attemptsTo(task)\` → \`task.performAs(actor)\` → \`actor.attemptsTo(interactions)\` → \`interaction.performAs(actor)\` → \`BrowseTheWeb.as(actor)\` → driver. Because everything passes through the actor, it can narrate, time, screenshot and wrap errors with the business path. Notes (\`remember\`/\`recall\`) carry values learned during the scenario, like an order number, without static state. Targets have a human name ("cart icon") used in narration and reports — that is why they are richer than a bare \`By\`.

### Q: Where is the boundary between a task and an interaction? Can a task contain an assertion?
**Short answer (30–60 s):** An interaction is one technical action through one ability and has no business meaning on its own; a task expresses a user goal and is composed of interactions or tasks. Tasks should not assert: they act, questions read, and the test decides. The exception is an explicit, named assertion step such as Serenity's \`Ensure\`, placed in the test, not hidden inside a reusable task.

**Detailed answer:** Test: "would a business person name this?" "Click the continue button" — no, interaction. "Enter shipping details", "check out" — yes, tasks. Hidden assertions make tasks non-reusable for negative tests (the checkout task asserting success breaks the validation-error test) and hide intent from the reader. Precondition guards are different: \`LogInToTheApi\` throwing when the login returns 401 is fail-fast setup, reported as a setup failure, not as the test's verdict. Synchronisation (\`WaitUntil.visible(overview)\`) is also allowed in tasks — it waits for a state, it does not judge it.

### Q: How does Screenplay relate to SOLID and to the Command pattern?
**Short answer (30–60 s):** Tasks and interactions are Command objects: parameters captured at construction, execution deferred to \`performAs\`, so they can be composed, logged and described. SOLID: each class has one reason to change, new behaviour is a new class (open/closed), any performable substitutes for another, interactions depend only on the ability they need, and tasks depend on ability abstractions rather than concrete drivers.

**Detailed answer:** The actor is the invoker, performables are commands, abilities are receivers. That is why \`Task.where("...", steps...)\` works — a composite command. Compared with a page object, where adding a capability means editing a growing class, Screenplay adds a class; the trade-off is navigation cost across many files. I would mention that "SOLID compliance" is not a goal in itself; it matters here because many contributors edit the same suite, and small closed classes reduce merge conflicts and regressions.

### Q: How do you write a test with two users, or with API setup and UI verification?
**Short answer (30–60 s):** Create two actors, each with their own abilities and their own browser session; values pass between them explicitly through the test. For API + UI, give one actor both \`CallAnApi\` and \`BrowseTheWeb\`: arrange through the API, act and assert through the UI.

**Detailed answer:** On ShopEasy: Asha logs in to the API and places an order (notes the id); Vera logs in as \`visual_user\` and requests \`GET /api/orders/{id}\` — expect 403. Abilities hold per-actor state (token, last response, driver), so there is no cross-talk. For UI actors, each needs its own driver — cookies and \`sessionStorage\` are per session — and the cast must quit all of them. For mixed channels the actor seeds data through \`POST /api/users\` or \`POST /api/orders\` and then verifies in the browser; a consistency check compares the API price with the UI total. I avoid a global notepad between actors because it reintroduces shared mutable state.

### Q: Would you introduce Screenplay into a 1,000-test POM suite? How?
**Short answer (30–60 s):** Only for a measured problem, and incrementally: wrap existing page objects in tasks and interactions first, write new tests with tasks, replace wrapped calls with targets and interactions when pages are touched, and measure authoring and diagnosis time before going further.

**Detailed answer:** First I'd identify the pain: duplicated journeys? multi-actor scenarios? stakeholder reporting? If it is flakiness or speed, Screenplay is the wrong tool. Then: (1) introduce the actor around the existing driver in the base test; (2) build tasks that delegate to existing pages through an adapter interaction; (3) new tests use only tasks/questions, enforced by review and an architecture test; (4) replace adapters with real interactions as pages change; (5) after two sprints compare metrics and decide. A big-bang rewrite freezes coverage for months, mixes refactoring bugs with product bugs and usually stalls half-way, leaving two frameworks.

### Q: Plain-Java Screenplay or Serenity BDD?
**Short answer (30–60 s):** Serenity gives a mature vocabulary, actor casts, REST and Playwright modules and — the real differentiator — rich reports and living documentation, at the cost of lock-in to its runners (JUnit 5, Cucumber), instrumentation and upgrade effort. A plain implementation is ~400 lines you own, works with TestNG and your existing reporting, but you build every interaction and the narration yourself.

**Detailed answer:** If stakeholders read reports and the suite is BDD-driven on JUnit 5/Cucumber, Serenity is hard to beat. If the organisation is on TestNG with Allure, has strong engineers and wants minimal magic, plain Screenplay (or just a flow layer) fits better. Debugging differs too: Serenity's instrumented tasks and proxies add frames to stack traces, but its reports usually make stepping through unnecessary. Either way, the test code looks almost the same — the vocabulary is portable, which reduces the risk of the decision.

### Q: How do you debug a failing Screenplay test?
**Short answer (30–60 s):** Start from the business path in the failure ("Asha failed while: checks out > enters the shipping details > clicks on the continue button"), then the cause, the narration of questions answered before the failure, and the screenshot at that step. That is why the actor must wrap errors with context and keep the cause.

**Detailed answer:** With a good actor the failure message tells you which goal, sub-goal and interaction failed, and the narration shows what the actor saw. Without it, Screenplay is *harder* to debug than POM, because the stack trace goes through generic \`Click\` and \`attemptsTo\` frames. So the debugging investment — context wrapping, step screenshots, logging targets with their locators — is part of the pattern, not an extra. In Serenity, the report's step tree and per-step screenshots do this; in plain Java, the actor is the place to add it.

## Scenario-based questions

**1. A new lead wants to "move to Screenplay" in a 4-person team with 150 Selenium tests on one web app.**
Reasoning: what is the measured pain? With 150 single-channel tests and one team, POM with components and a small flow layer is usually enough; Screenplay would add a learning curve and dozens of classes for little gain. Action: list the top three pains (e.g. duplicated checkout flow in 30 tests, slow UI setup), fix them with a flow class and API arrangement, and agree on criteria (multi-actor scenarios, more squads, BDD reporting) that would trigger a Screenplay pilot later. Communicate it as "not now, and here is when", not as "Screenplay is bad".

**2. A regulated client wants acceptance tests that business owners can read and sign off, with evidence per step; the team uses Cucumber and JUnit 5.**
Reasoning: here the reporting and living documentation are the main value — Serenity BDD Screenplay fits well. Action: Serenity with \`serenity-cucumber\`, \`OnStage\`/\`OnlineCast\`, tasks named in the domain language, \`Ensure\` steps for checks so they appear in the report, step screenshots configured for failures plus key states. Pilot on one epic; review the generated report with the business owners before rolling out.

**3. In a Screenplay codebase, \`PurchaseFlow\` has 11 parameters and 4 boolean flags; three teams depend on it and every change breaks someone.**
Reasoning: a god task — the same failure mode as a god page. Action: list the real variations from the call sites, split into composable tasks (\`AddToCart\`, \`ApplyCoupon\`, \`Checkout.withDetails\`, \`PlaceTheOrder\`), express outcome variations as separate tasks (\`TryToCheckout.withMissingPostalCode()\`), keep \`PurchaseFlow\` temporarily as a thin composition delegating to them, migrate callers with an IDE refactoring, then delete it.

## Tricky follow-ups

- **Q: Is Screenplay just POM with more classes?** A: No — the unit of design changes from screens to goals, and the actor adds abilities (multi-channel), notes and an interception point. But if your tasks just wrap one page method each, then yes, you have POM with more classes.
- **Q: Do you still need page objects in Screenplay?** A: Not as behaviour holders. Locators live in target classes (often one per page/component, so the "map" survives); behaviour lives in interactions and tasks. During migration, page objects can sit behind adapter interactions.
- **Q: Can a question perform an action?** A: It should not; questions must be safe to ask any number of times. If reading requires a click, the click is an interaction in a task before the question.
- **Q: Where do waits live?** A: In the ability/interactions (wait for clickable/visible before acting) and in explicit \`WaitUntil\` steps for business state transitions — never \`Thread.sleep\` in tasks, never waits in tests.
- **Q: Does Screenplay make tests slower?** A: No measurable runtime cost — object creation is negligible next to browser calls. Reporting with screenshots on every step can be slow; configure it for failures and key steps.`,
  keyPoints: [
    'Screenplay changes the unit of design from pages to actors pursuing goals: Targets say where, Interactions how, Tasks what, Questions read state, Abilities adapt channels, Notes carry values.',
    'Everything flows through actor.attemptsTo/asksFor — one choke point for narration, screenshots, timing and error context with the business path.',
    'Tasks act, questions read, tests decide; precondition guards and WaitUntil synchronisation are not assertions.',
    'Abilities hold per-actor state (driver, token, last response), which makes multi-actor and API + UI scenarios natural — one browser session per UI actor.',
    'Serenity BDD adds a vocabulary (Click, Enter, Open, Text, Ensure), casts (OnStage, OnlineCast, @CastMember), REST and Playwright modules, and rich living-documentation reports — at the cost of lock-in to JUnit 5/Cucumber and instrumentation.',
    'Default to POM + components + a flow layer; Screenplay pays off with many contributors, multi-actor or multi-channel scenarios, and report-driven BDD.',
    'Migrate incrementally: wrap existing page objects in interactions/tasks, new tests use tasks only, replace wrappers as pages change, measure before scaling.',
    'In Playwright, fixtures + POM already solve wiring and lifecycle; Serenity/JS brings the same Screenplay vocabulary to TypeScript when that consistency matters.',
  ],
  mistakes: [
    'Tasks that end with an assertion (Checkout asserting success) — unusable for negative tests and the check is hidden from the reader. Fix: tasks act, questions return values, the test (or an explicit Ensure step in the test) decides.',
    'Interactions and tests that use raw locator strings (Click.on("#continue") everywhere) — duplication returns. Fix: every locator is a named Target in a UI-map class; narration and reports use the target name.',
    'God tasks with many parameters and boolean flags (PurchaseFlow.with(..., skipLogin, expectError)). Fix: small composable tasks; outcome variations as separate tasks such as TryToCheckout.withMissingPostalCode().',
    'One class per click (ClickUsernameField) and tests built from 15 interactions — maximum class count, no business vocabulary. Fix: generic interactions (Click, Enter, Open) plus business-level tasks; tests call tasks.',
    'A static actor or a global notepad shared by actors — parallel tests share one driver or overwrite each other\'s notes. Fix: create actors per test/scenario (base test or cast), pass values between actors explicitly.',
    'An actor that wraps failures in a new exception without the cause, or not at all — Screenplay becomes harder to debug than POM. Fix: wrap once at the innermost step with the business path (task > sub-task > interaction) and keep the original exception as the cause.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`, API on \`http://localhost:5181\`): (1) build the plain-Java core (\`Actor\`, \`Performable\`, \`Task\`, \`Interaction\`, \`Question\`, \`Target\`) and \`BrowseTheWeb\`; (2) write \`Login\`, \`AddToCart\` and \`Checkout\` tasks plus \`TheCartBadge.count()\` and \`OrderTotal.displayed()\` questions, and a TestNG test that adds the Storm Fleece Jacket and the Junior Onesie and expects an overview total of \`$62.62\` (57.98 + 4.64 tax); (3) break the \`#continue\` target on purpose and check that the failure names the task path, the target and the cause; (4) add \`CallAnApi\` and write the two-actor test where Vera (\`visual_user\`) gets 403 for Asha's order; (5) write a \`RemoveFromCart.theProduct(..)\` task using the \`[data-testid='remove-<slug>']\` buttons on \`cart.html\` and decide — in one sentence — whether it is a task or an interaction, and why.`,
  problems: ['pom-026', 'pom-028', 'pom-033'],
}
