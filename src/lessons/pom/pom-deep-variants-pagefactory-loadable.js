export default {
  slug: 'pom-deep-variants-pagefactory-loadable',
  category: 'pom',
  order: 11,
  title: 'Deep dive: POM variants compared — classic By, PageFactory internals, LoadableComponent and fluent pages',
  minutes: 30,
  summary: 'Know exactly what PageFactory does at runtime (field decorators, JDK dynamic proxies, element locators, AjaxElementLocator polling, @CacheLookup), extend it with a custom FieldDecorator for typed components, use LoadableComponent and SlowLoadableComponent where they fit, model multiple outcomes with a sealed result type, compare every POM style in one table, and migrate a PageFactory-heavy suite to By locators without a big-bang rewrite.',
  manualAnalogy: `Two experienced testers can execute the same test case very differently: one re-reads the screen before every step, another trusts a note made ten minutes ago; one checks "am I on the right screen?" before starting, another only notices on step 9. Both "follow the test case", but only one produces reliable results. POM variants are the same: they all wrap the screen in a class, but they differ in when elements are looked up, who checks the page is ready and how outcomes are reported — and those differences decide how flaky and how maintainable the suite is.`,
  body: `## Where the earlier lessons stop

The beginner lessons showed the basics: \`initElements\`, \`@FindBy\`, the \`@CacheLookup\` trap and the \`@FindAll\`/\`@FindBys\` semantics (*PageFactory and @FindBy vs plain By locators*, lesson 6), returning the next page or \`this\` and writing two methods for two outcomes (*Fluent page objects*, lesson 3), and a constructor that checks URL plus a unique element (*Knowing where you are*, lesson 9). Composition vs inheritance for pages is in \`java-deep-oop-and-solid\`; the action layer and locator management are in \`selenium-deep-framework-design\`.

This lesson goes one level down and one level up:

- **down** — what PageFactory really builds at runtime, why its failure modes look the way they do, and how to extend it;
- **up** — the design choice between POM variants, with a recommendation you can defend in an architecture review, and a safe migration plan.

\`\`\`
                ┌───────────── how elements are found ─────────────┐
                │  By fields + explicit waits      (classic)        │
                │  PageFactory proxies             (DefaultElementLocator)
                │  PageFactory + polling proxies   (AjaxElementLocator)
                └───────────────────────────────────────────────────┘
                ┌───────────── how the page is entered ────────────┐
                │  constructor check  ·  LoadableComponent.get()    │
                └───────────────────────────────────────────────────┘
                ┌───────────── how outcomes are returned ──────────┐
                │  void  ·  this  ·  next page  ·  result type      │
                └───────────────────────────────────────────────────┘
                ┌───────────── unit of reuse ──────────────────────┐
                │  page  ·  component  ·  task / Screenplay         │
                └───────────────────────────────────────────────────┘
\`\`\`

The four axes are independent. "We use PageFactory" says nothing about outcomes or reuse; that is why comparisons in interviews go wrong when people treat "POM style" as one choice.

## PageFactory internals

### What happens in \`initElements\`

The overloads funnel into one another (current Selenium source; older releases took a \`WebDriver\` where the current one takes a \`SearchContext\`, so \`initElements(driver, this)\` compiles with both):

\`\`\`
PageFactory.initElements(driver, page)
  └─ initElements(new DefaultElementLocatorFactory(driver), page)
      └─ initElements(new DefaultFieldDecorator(factory), page)
          └─ for each class from page.getClass() up to (not incl.) Object:
               for each declared field:
                 value = decorator.decorate(classLoader, field)
                 if value != null → field.setAccessible(true); field.set(page, value)

DefaultFieldDecorator.decorate(loader, field)
  ├─ field type is WebElement
  │     → Proxy.newProxyInstance(loader, {WebElement, WrapsElement, Locatable},
  │                               new LocatingElementHandler(locator))
  ├─ field type is List<WebElement> AND has @FindBy / @FindBys / @FindAll
  │     → Proxy.newProxyInstance(loader, {List}, new LocatingElementListHandler(locator))
  └─ anything else → null  (field left untouched)
\`\`\`

The participants:

| Participant | Role |
|---|---|
| \`FieldDecorator\` | decides *what object* goes into a field (\`decorate(ClassLoader, Field)\`) |
| \`ElementLocatorFactory\` | creates one \`ElementLocator\` per field (\`createLocator(Field)\`) |
| \`ElementLocator\` | knows the \`By\` and the search context; \`findElement()\` / \`findElements()\` |
| \`Annotations\` | turns \`@FindBy\`/\`@FindBys\`/\`@FindAll\`/\`@CacheLookup\` into a \`By\` and a cache flag |
| \`LocatingElementHandler\` | the JDK \`InvocationHandler\` behind a \`WebElement\` proxy |
| \`LocatingElementListHandler\` | the handler behind a \`List<WebElement>\` proxy |

### What happens on every call

\`sortDropdown.click()\` on a PageFactory field is a call on a **JDK dynamic proxy**. Its handler does, in essence:

\`\`\`java
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    WebElement element;
    try {
        element = locator.findElement();                 // a real lookup, every time
    } catch (NoSuchElementException e) {
        if ("toString".equals(method.getName())) {
            return "Proxy element for: " + locator;      // only toString survives a missing element
        }
        throw e;
    }
    if ("getWrappedElement".equals(method.getName())) {
        return element;                                  // WrapsElement → the real element
    }
    try {
        return method.invoke(element, args);             // forward click(), getText(), ...
    } catch (InvocationTargetException e) {
        throw e.getCause();                              // unwrap so callers see the Selenium exception
    }
}
\`\`\`

And \`DefaultElementLocator.findElement()\` is:

\`\`\`java
if (cachedElement != null && shouldCache()) return cachedElement;   // @CacheLookup
WebElement element = searchContext.findElement(by);
if (shouldCache()) cachedElement = element;
return element;
\`\`\`

Step by step, the consequences a senior should be able to derive from those few lines:

1. **Every method call is at least two WebDriver commands**: find, then the action. \`username.clear(); username.sendKeys(u);\` is four commands, not three.
2. **\`toString\`, \`equals\` and \`hashCode\` are forwarded too.** Logging a proxy, hovering over it in a debugger, putting it in a \`HashSet\` or comparing it with \`equals\` all trigger a browser lookup. If the element is absent, \`equals\`/\`hashCode\` throw \`NoSuchElementException\`; \`toString\` returns "Proxy element for: …" — but only *after* the lookup failed, which with an implicit wait or an Ajax locator costs the full timeout. A debugger that calls \`toString\` on every visible variable can freeze for seconds per proxy.
3. **The proxy is not a \`RemoteWebElement\`.** \`instanceof RemoteWebElement\` is false, casts fail. Unwrap with \`((WrapsElement) proxy).getWrappedElement()\` — the handler special-cases that method.
4. **An uncached proxy never goes stale — and therefore never *becomes* stale.** \`ExpectedConditions.stalenessOf(proxy)\` re-locates on each poll, finds the new element (or keeps throwing a not-found exception the wait ignores) and never returns true. Use a real element captured before the action, or a \`By\`-based condition.
5. **List proxies re-run \`findElements\` on every \`List\` method.** \`for (int i = 0; i < items.size(); i++) items.get(i).getText()\` makes \`2N + 1\` \`findElements\` calls and the indices can shift between them while the page renders. Take one snapshot: \`List<WebElement> snapshot = new ArrayList<>(items);\` (one \`toArray\`, one lookup), then iterate.
6. **Unannotated \`WebElement\` fields are decorated anyway.** The default \`Annotations\` falls back to id-or-name of the field name, so \`private WebElement password;\` silently finds \`#password\`. That "magic" makes renaming a field a behaviour change. Unannotated \`List<WebElement>\` fields and lists of any other type are *not* decorated — they stay \`null\`.
7. **Inherited fields are decorated**, because the loop walks the superclasses. Calling \`initElements\` in both \`BasePage\` and the subclass constructor decorates everything twice (harmless, wasteful). Calling it in the base constructor and giving a subclass field an explicit initializer (\`= null\`) overwrites the proxy, because subclass initializers run after the super constructor.

### @CacheLookup: the precise rule

The cache lives in the \`ElementLocator\`, which lives as long as the **page object instance**. That gives a more precise rule than "never use it":

- A cached element is safe exactly as long as the DOM node it points to lives at least as long as the page object.
- Short-lived page objects (created by the navigation method, discarded after a few calls) reduce the risk; a page object held in a field across a whole Cucumber scenario maximises it.
- A cached \`List\` caches the *snapshot*: on ShopEasy's \`inventory.html\` a cached list of cards keeps working after sorting (the script re-appends the same nodes), but on \`table.html\` a cached list of rows goes stale after any search, sort or page change because \`render()\` rebuilds \`tbody\` with \`innerHTML = ''\`.

That is the senior answer: caching is a **lifetime contract between a reference and a DOM node**. Most teams do not have the information to sign that contract per element, which is why "no \`@CacheLookup\`" is the sensible default. The few milliseconds saved per lookup are rarely the bottleneck.

### Annotations as \`By\` composition

| Annotation | Built \`By\` | Semantics |
|---|---|---|
| \`@FindBy(id = "x")\` or \`@FindBy(how = How.ID, using = "x")\` | the single strategy | one locator; \`How\` has \`ID\`, \`NAME\`, \`ID_OR_NAME\`, \`CLASS_NAME\`, \`CSS\`, \`TAG_NAME\`, \`LINK_TEXT\`, \`PARTIAL_LINK_TEXT\`, \`XPATH\` (and \`UNSET\` as the default) |
| \`@FindBys({...})\` | \`ByChained\` | AND by nesting: each locator searches inside the results of the previous one |
| \`@FindAll({...})\` | \`ByAll\` | OR: results of every locator concatenated in declaration order — not a fallback |

Two things that bite in reviews:

- \`ByAll\` concatenates; it does not de-duplicate in the general case, so an element matching two inner locators can be counted twice. Check counts before relying on them.
- Combining \`@FindBy\` with \`@FindBys\` or \`@FindAll\` on one field, or giving one \`@FindBy\` two strategies, fails during \`initElements\` with an \`IllegalArgumentException\` — a constructor failure that every test using the page reports.

You can build the same composites without annotations: \`new ByChained(By.id("inventory-list"), By.cssSelector(".item-price"))\` and \`new ByAll(...)\` from \`org.openqa.selenium.support.pagefactory\`. In practice a single CSS selector (\`#inventory-list .item-price\`) is clearer and one command instead of several.

## AjaxElementLocatorFactory: polling proxies

\`PageFactory.initElements(new AjaxElementLocatorFactory(driver, 10), this)\` swaps \`DefaultElementLocator\` for \`AjaxElementLocator\`. Internally each \`findElement()\` creates a small \`SlowLoadableComponent\` whose \`isLoaded()\` calls the normal lookup and then \`isElementUsable(element)\`; \`get()\` retries until the timeout, sleeping \`sleepFor()\` between attempts (250 ms by default).

What the javadoc and source tell you:

| Behaviour | Detail | Consequence |
|---|---|---|
| "Found" means | present in the DOM, because \`isElementUsable\` returns \`true\` by default | a hidden or disabled element is "found" instantly — clicks still fail |
| \`findElement\` timeout | \`NoSuchElementException("Timed out after N seconds. …")\` | clearer than a raw miss, but no "what were we waiting for" |
| \`findElements\` | polls until **at least one** element is present **and every element** is usable; on timeout returns an **empty list** | an assertion that a list is empty (cart after "Remove") waits the **full timeout** before passing |
| Polling interval | \`sleepFor()\`, 250 ms | overridable |
| Implicit wait | each inner lookup still honours it | timeouts multiply — never combine the two |
| Exceptions | only \`NoSuchElementException\` is retried | a \`StaleElementReferenceException\` thrown in \`isElementUsable\` escapes immediately |

The fix for "found but not visible" is the documented extension point — override \`isElementUsable\`. \`AjaxElementLocatorFactory\` has no hook for it, so write your own factory; \`ElementLocatorFactory\` is a single-method interface:

\`\`\`java
package com.shopeasy.framework.pagefactory;

import java.lang.reflect.Field;
import org.openqa.selenium.SearchContext;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.pagefactory.AjaxElementLocator;
import org.openqa.selenium.support.pagefactory.ElementLocator;
import org.openqa.selenium.support.pagefactory.ElementLocatorFactory;

/** Like AjaxElementLocatorFactory, but an element only counts as found when it is displayed. */
public final class VisibleElementLocatorFactory implements ElementLocatorFactory {
    private final SearchContext context;
    private final int timeoutSeconds;

    public VisibleElementLocatorFactory(SearchContext context, int timeoutSeconds) {
        this.context = context;
        this.timeoutSeconds = timeoutSeconds;
    }

    @Override
    public ElementLocator createLocator(Field field) {
        return new AjaxElementLocator(context, field, timeoutSeconds) {
            @Override
            protected boolean isElementUsable(WebElement element) {
                try {
                    return element.isDisplayed();
                } catch (StaleElementReferenceException e) {
                    return false;                     // re-rendered between find and check: poll again
                }
            }

            @Override
            protected long sleepFor() {
                return 200;
            }
        };
    }
}
\`\`\`

- The anonymous subclass is the cheapest way to override two protected methods; a named class is better once you add logging.
- Catching staleness inside \`isElementUsable\` matters: only \`NoSuchElementException\` is retried by the locator, so a stale element would otherwise abort the poll on the first re-render.
- The trade-off: \`findElements\` now requires **every** matched element to be displayed. A list locator that also matches a hidden template row will never be "usable" and always waits the full timeout. Scope list locators tightly.

**Where Ajax locators are still reasonable:** a legacy suite with hundreds of PageFactory pages that has \`Thread.sleep\` sprinkled around. Switching the factory in one base class removes most sleeps in one change. It is a stepping stone, not a target design: the wait is still "present (or displayed)", never "clickable", "text changed" or "count stable" — those are conditions the \`Waiter\` in \`selenium-deep-synchronization\` expresses and PageFactory cannot.

## Extending PageFactory: a custom FieldDecorator for typed components

PageFactory's real extension point is the \`FieldDecorator\`. With it, fields can be typed wrappers (\`Button\`, \`TextInput\`) or whole components found by a root — useful when you inherit a PageFactory suite and want better abstractions *without* rewriting every page.

The goal:

\`\`\`java
public class LoginForm {
    @FindBy(id = "user-name")    TextInput username;
    @FindBy(id = "password")     TextInput password;
    @FindBy(id = "login-button") Button login;
}

public class InventoryView {
    @FindBy(css = "[data-testid='inventory-item']")
    List<ProductTile> tiles;                              // one component per card, lazily re-found
}
\`\`\`

### The building blocks

\`\`\`java
package com.shopeasy.framework.pagefactory;

import org.openqa.selenium.WebElement;

/** Base for typed fields. The element is a PageFactory proxy, so it is re-located on every call. */
public abstract class ElementWrapper {
    protected final WebElement element;

    protected ElementWrapper(WebElement element) {
        this.element = element;
    }

    public boolean isDisplayed() {
        try {
            return element.isDisplayed();
        } catch (org.openqa.selenium.NoSuchElementException e) {
            return false;
        }
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.pagefactory;

import org.openqa.selenium.WebElement;

public class Button extends ElementWrapper {
    public Button(WebElement element) { super(element); }

    public void click() { element.click(); }

    public String label() { return element.getText().trim(); }

    public boolean isEnabled() { return element.isEnabled(); }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.pagefactory;

import org.openqa.selenium.WebElement;

public class TextInput extends ElementWrapper {
    public TextInput(WebElement element) { super(element); }

    public void set(String value) {
        element.clear();
        element.sendKeys(value);
    }

    public String value() { return element.getDomProperty("value"); }
}
\`\`\`

A component is a wrapper whose **own** annotated fields are searched inside its root:

\`\`\`java
package com.shopeasy.framework.pagefactory;

import org.openqa.selenium.WebElement;

/** Marker base: fields of a PageComponent are decorated relative to its root element. */
public abstract class PageComponent extends ElementWrapper {
    protected PageComponent(WebElement root) { super(root); }

    protected WebElement root() { return element; }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.pagefactory;

import java.math.BigDecimal;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;

public class ProductTile extends PageComponent {
    @FindBy(css = ".item-name")     private WebElement name;
    @FindBy(css = ".item-price")    private WebElement price;
    @FindBy(css = ".btn-inventory") private Button cartButton;

    public ProductTile(WebElement root) { super(root); }

    public String name() { return name.getText().trim(); }

    public BigDecimal price() { return new BigDecimal(price.getText().replace("$", "").trim()); }

    public void toggleCart() { cartButton.click(); }

    public boolean inCart() { return "Remove".equals(cartButton.label()); }

    @Override
    public String toString() { return "ProductTile"; }   // never touch the browser in toString
}
\`\`\`

### The decorator

\`\`\`java
package com.shopeasy.framework.pagefactory;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Proxy;
import java.lang.reflect.Type;
import java.util.List;
import org.openqa.selenium.SearchContext;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindAll;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.FindBys;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.pagefactory.DefaultElementLocatorFactory;
import org.openqa.selenium.support.pagefactory.DefaultFieldDecorator;
import org.openqa.selenium.support.pagefactory.ElementLocator;
import org.openqa.selenium.support.pagefactory.ElementLocatorFactory;

public class TypedFieldDecorator extends DefaultFieldDecorator {

    public TypedFieldDecorator(ElementLocatorFactory factory) {
        super(factory);
    }

    /** Entry point: decorate a page (or component) against a search context. */
    public static void init(SearchContext context, Object target) {
        PageFactory.initElements(new TypedFieldDecorator(new DefaultElementLocatorFactory(context)), target);
    }

    @Override
    public Object decorate(ClassLoader loader, Field field) {
        if (field.getDeclaringClass() == ElementWrapper.class) {
            return null;                    // never overwrite the wrapper's own root field
        }
        Class<?> type = field.getType();

        if (ElementWrapper.class.isAssignableFrom(type)) {                 // Button, TextInput, ProductTile
            requireAnnotation(field);
            ElementLocator locator = factory.createLocator(field);
            if (locator == null) return null;
            WebElement lazy = proxyForLocator(loader, locator);             // the built-in lazy proxy
            return wrap(type, lazy);
        }

        Class<?> itemType = listItemType(field);
        if (itemType != null && ElementWrapper.class.isAssignableFrom(itemType)) {   // List<ProductTile>
            requireAnnotation(field);
            ElementLocator locator = factory.createLocator(field);
            if (locator == null) return null;
            InvocationHandler handler = (proxy, method, args) -> {
                List<Object> fresh = locator.findElements().stream()        // re-find on every List call
                        .map(e -> wrap(itemType, e))
                        .toList();
                try {
                    return method.invoke(fresh, args);
                } catch (InvocationTargetException e) {
                    throw e.getCause();
                }
            };
            return Proxy.newProxyInstance(loader, new Class<?>[] {List.class}, handler);
        }

        return super.decorate(loader, field);                               // plain WebElement / List<WebElement>
    }

    private static Object wrap(Class<?> type, WebElement element) {
        try {
            Object wrapper = type.getDeclaredConstructor(WebElement.class).newInstance(element);
            if (wrapper instanceof PageComponent) {
                init(element, wrapper);                                     // nested fields search inside the root
            }
            return wrapper;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(type.getSimpleName()
                    + " needs a public constructor taking a WebElement", e);
        }
    }

    private static Class<?> listItemType(Field field) {
        if (!List.class.isAssignableFrom(field.getType())) return null;
        Type generic = field.getGenericType();
        if (!(generic instanceof ParameterizedType parameterized)) return null;
        Type arg = parameterized.getActualTypeArguments()[0];
        return arg instanceof Class<?> c ? c : null;
    }

    private static void requireAnnotation(Field field) {
        if (!field.isAnnotationPresent(FindBy.class) && !field.isAnnotationPresent(FindBys.class)
                && !field.isAnnotationPresent(FindAll.class)) {
            throw new IllegalStateException("Typed field " + field.getDeclaringClass().getSimpleName()
                    + "." + field.getName() + " needs @FindBy/@FindBys/@FindAll (no id-or-name magic)");
        }
    }
}
\`\`\`

Step by step:

1. The first guard is not cosmetic: \`initElements\` walks superclasses, so it would reach \`ElementWrapper.element\` — an unannotated \`WebElement\` field — and the default decorator would replace the component's root with an id-or-name proxy for "element". Framework-owned fields must be excluded explicitly.
2. \`factory\` is a \`protected\` field of \`DefaultFieldDecorator\`, and \`proxyForLocator\` is \`protected\`, so the subclass reuses the built-in lazy proxy instead of re-implementing it.
3. For a single wrapper the wrapper receives the **proxy**, not a found element: \`Button.click()\` re-locates every time, so the wrapper never goes stale.
4. For a component the decorator recursively decorates the component's own fields with the root as \`SearchContext\`. Because \`DefaultElementLocatorFactory\` accepts any \`SearchContext\`, \`.item-name\` is searched *inside* that card. When the root is itself a proxy (a single component field), every inner lookup first re-finds the root — **lazy root re-finding for free**.
5. For a \`List<ProductTile>\` the handler re-runs \`findElements\` and re-wraps on every \`List\` call — the same semantics as the built-in list proxy. The roots inside the list are *real* elements, so a tile you keep in a variable across a re-render can go stale; components taken from a list are for immediate use.
6. \`requireAnnotation\` removes the id-or-name fallback for typed fields — a deliberate "fail at construction, not at the first click".
7. \`listItemType\` needs the generic signature (\`getGenericType\`), which survives erasure for fields; \`isDecoratableList\` in the base class does the same and only accepts \`WebElement\` as the element type, which is why the base decorator ignores \`List<ProductTile>\`.

A page then needs one line: \`TypedFieldDecorator.init(driver, this);\`

**When this is worth it:** a large PageFactory suite where rewriting is not on the table, and you want typed widgets and scoped components with zero changes to existing \`WebElement\` fields. **When it is not:** a new framework. Two hundred lines of reflection buy what plain component classes with a root \`By\` give you without reflection (see \`pom-deep-components-and-reusable-methods\`). Reflection-based magic is also what new joiners debug least successfully: the stack trace of a failed lookup goes through \`Proxy\`, the handler and the locator before it reaches your code.

## LoadableComponent and SlowLoadableComponent

### What they are

\`org.openqa.selenium.support.ui.LoadableComponent<T extends LoadableComponent<T>>\` is a template-method base class:

\`\`\`
get():
    try { isLoaded(); return this; }        // already there? done
    catch (Error e) { load(); }             // otherwise navigate / act
    isLoaded();                             // must pass now, or the Error propagates
    return this;

SlowLoadableComponent.get():  same start, then
    until timeout: try { isLoaded(); return this; }
                   catch (Error e) { isError(); wait sleepFor() }
    isLoaded();                             // final attempt, Error propagates
\`\`\`

\`SlowLoadableComponent\`'s current constructor is \`(java.time.Clock clock, java.time.Duration timeOut)\`; \`isError()\` is a hook for "loading finished but failed" (fail fast instead of waiting out the timeout), and \`sleepFor()\` sets the poll interval.

Three design facts drive everything else:

- **\`isLoaded()\` signals "not loaded" by throwing \`java.lang.Error\`** (the javadoc suggests assertion methods, i.e. \`AssertionError\`). \`get()\` catches \`Error\` only. A \`NoSuchElementException\` thrown from \`isLoaded()\` is a \`RuntimeException\`: it is **not** caught, so \`load()\` never runs and \`get()\` fails with a lookup error. Convert lookup failures into \`AssertionError\` yourself.
- **Self-typed generics**: \`class InventoryPage extends SlowLoadableComponent<InventoryPage>\` so that \`get()\` returns \`InventoryPage\`.
- **It occupies the superclass slot.** A loadable page cannot also extend your \`BasePage\`, so helpers must be composed (a \`UiActions\`/\`Waiter\` field) — which is the better design anyway.

### Full example: ShopEasy LoginPage → InventoryPage with parent chaining

\`\`\`java
package com.shopeasy.pages.loadable;

public record Credentials(String username, String password) {
    public static Credentials standardUser() {
        return new Credentials("standard_user", "secret_sauce");
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.pages.loadable;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.LoadableComponent;

public class LoginPage extends LoadableComponent<LoginPage> {
    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN_BUTTON = By.id("login-button");

    private final WebDriver driver;
    private final String baseUrl;

    public LoginPage(WebDriver driver, String baseUrl) {
        this.driver = driver;
        this.baseUrl = baseUrl;
    }

    @Override
    protected void load() {
        driver.get(baseUrl + "login.html");
    }

    @Override
    protected void isLoaded() throws Error {
        String url = driver.getCurrentUrl();
        if (url == null || !url.contains("login.html")) {
            throw new AssertionError("Expected login.html but was on " + url);
        }
        if (driver.findElements(LOGIN_BUTTON).isEmpty()) {      // findElements: no exception when absent
            throw new AssertionError("login.html is open but #login-button is missing");
        }
    }

    /** Package-private: only components in this package (InventoryPage.load) submit raw credentials. */
    void submit(Credentials credentials) {
        type(USERNAME, credentials.username());
        type(PASSWORD, credentials.password());
        driver.findElement(LOGIN_BUTTON).click();
    }

    private void type(By locator, String text) {
        WebElement field = driver.findElement(locator);
        field.clear();
        field.sendKeys(text);
    }

    @Override
    public String toString() { return "LoginPage(login.html)"; }
}
\`\`\`

\`\`\`java
package com.shopeasy.pages.loadable;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.SlowLoadableComponent;

public class InventoryPage extends SlowLoadableComponent<InventoryPage> {
    private static final By INVENTORY_LIST = By.id("inventory-list");
    private static final By LOGGED_IN_USER = By.cssSelector("[data-testid='logged-in-user']");
    private static final By LOGIN_ERROR = By.id("login-error-message");
    private static final By CART_BADGE = By.cssSelector("[data-testid='shopping-cart-badge']");

    private final WebDriver driver;
    private final LoginPage parent;
    private final Credentials credentials;

    public InventoryPage(WebDriver driver, LoginPage parent, Credentials credentials) {
        super(Clock.systemDefaultZone(), Duration.ofSeconds(10));
        this.driver = driver;
        this.parent = parent;
        this.credentials = credentials;
    }

    @Override
    protected void load() {
        parent.get().submit(credentials);          // parent chaining: make sure we are on login, then log in
    }

    @Override
    protected void isLoaded() throws Error {
        try {
            String url = driver.getCurrentUrl();
            if (url == null || !url.contains("inventory.html")) {
                throw new AssertionError("Expected inventory.html but was on " + url);
            }
            if (!driver.findElement(INVENTORY_LIST).isDisplayed()) {
                throw new AssertionError("#inventory-list is not displayed yet");
            }
            String user = driver.findElement(LOGGED_IN_USER).getText().trim();
            if (!credentials.username().equals(user)) {          // guests can open inventory.html too
                throw new AssertionError("Inventory shown for '" + user + "', expected " + credentials.username());
            }
        } catch (NoSuchElementException | StaleElementReferenceException e) {
            throw new AssertionError("Inventory not ready: " + e.getMessage(), e);   // RuntimeException → Error
        }
    }

    @Override
    protected void isError() throws Error {
        List<WebElement> errors = driver.findElements(LOGIN_ERROR);
        if (!errors.isEmpty() && errors.get(0).isDisplayed()) {
            throw new AssertionError("Login failed for " + credentials.username() + ": " + errors.get(0).getText());
        }
    }

    public int cartCount() {
        List<WebElement> badge = driver.findElements(CART_BADGE);
        return badge.isEmpty() ? 0 : Integer.parseInt(badge.get(0).getText().trim());
    }

    @Override
    public String toString() { return "InventoryPage(as " + credentials.username() + ")"; }
}
\`\`\`

Usage in a test:

\`\`\`java
InventoryPage inventory = new InventoryPage(driver,
        new LoginPage(driver, "http://localhost:5180/practice-site/"),
        Credentials.standardUser()).get();
\`\`\`

Step by step:

1. \`get()\` first calls \`isLoaded()\`. On a fresh browser the URL is \`about:blank\` (or \`data:,\`), the \`AssertionError\` is caught, and \`load()\` runs.
2. \`load()\` calls \`parent.get()\` — the **parent chain**: \`LoginPage\` is not loaded either, so it navigates. Chains can be as deep as your journey (checkout → cart → inventory → login).
3. After \`submit\`, \`SlowLoadableComponent\` polls \`isLoaded()\`. Between polls it calls \`isError()\`: with \`locked_out_user\` the banner "Sorry, this user has been locked out" appears and the test fails in about a second with that message instead of after 10 seconds with "Expected inventory.html".
4. The **identity check includes the user**. ShopEasy serves \`inventory.html\` to guests ("Hi, guest"), so URL + list alone would declare the page "already loaded" when the previous test left the browser there as a guest — and silently skip the login. This is the most common subtle bug with \`LoadableComponent\`: \`isLoaded\` must describe the **state you need**, not just the URL.
5. Lookup exceptions are converted to \`AssertionError\` so that "not rendered yet" means "poll again", not "abort".

### When it is elegant and when it is awkward

| Elegant | Awkward |
|---|---|
| Entry points: "make sure I am on X, wherever I am" (deep-link pages, admin screens) | Pages you only reach by an action with data (checkout after adding items) — \`load()\` needs that data, so constructors grow parameters |
| Fail-fast loading with \`isError()\` (error banners, 500 pages) | Using \`Error\` for control flow: \`catch (Error)\` also swallows real \`AssertionError\`s and, in theory, VM errors |
| Precondition logic in one place, reusable from many tests | Two ways to create a page (\`new X(...)\` and \`new X(...).get()\`): forgetting \`get()\` gives an unchecked page |
| Parent chains document the navigation graph | Chains hide navigation cost: \`get()\` on a deep page may silently log in, browse and add to cart |
| | Occupies the superclass, generic self-type noise, no built-in waits beyond polling \`isLoaded\` |

**Recommendation:** use the **idea** (a page verifies its identity; entry pages know how to load themselves) everywhere, and the **class** sparingly — for a handful of deep-linkable entry pages. For pages reached by actions, the constructor/factory check from lesson 9 plus a navigation method that returns the page is simpler and makes cost visible. Arrange state (login, cart contents) through APIs or session seeding, not through \`load()\` chains — see *Scaling: Screenplay and shared state* (lesson 10).

## Fluent pages and outcome modelling

Lesson 3 covered \`void\` vs \`this\` vs "next page" and two methods for two outcomes. The senior questions are: what do you return when an action has **three or more outcomes**, or when the **test** must branch on the outcome (a data-driven login matrix)?

### The options

| Style | Signature | Strength | Weakness |
|---|---|---|---|
| \`void\` | \`void login(u, p)\` | simple | test must know where it is; \`new XPage(driver)\` everywhere |
| \`this\` | \`LoginPage typeUser(u)\` | chaining on one screen | lies if the action navigates |
| next page | \`InventoryPage loginAs(u, p)\` | compiler-checked journey | one outcome only |
| expectation-named methods | \`loginAs\` / \`loginExpectingError\` | honest, simple, still typed | method explosion for N outcomes; caller must know the outcome in advance |
| result object | \`LoginResult attemptLogin(u, p)\` | one method, all outcomes, the page *reports* what happened | more types; tempting to branch in tests |

### A sealed result type (Java 17)

\`\`\`java
package com.shopeasy.pages;

public sealed interface LoginResult
        permits LoginResult.LoggedIn, LoginResult.Rejected, LoginResult.LockedOut {

    record LoggedIn(InventoryPage inventory) implements LoginResult {}

    record Rejected(LoginPage page, String message) implements LoginResult {}

    record LockedOut(LoginPage page, String message) implements LoginResult {}

    /** For happy-path tests: unwrap or fail with what actually happened. */
    default InventoryPage expectLoggedIn() {
        if (this instanceof LoggedIn ok) {
            return ok.inventory();
        }
        throw new IllegalStateException("Expected to be logged in, but login ended as " + this);
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class LoginPage {
    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN_BUTTON = By.id("login-button");
    private static final By ERROR = By.id("login-error-message");

    private final WebDriver driver;
    private final WebDriverWait wait;

    public LoginPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public LoginResult attemptLogin(String user, String password) {
        type(USERNAME, user);
        type(PASSWORD, password);
        driver.findElement(LOGIN_BUTTON).click();

        wait.until(ExpectedConditions.or(                         // wait for ANY terminal outcome
                ExpectedConditions.urlContains("inventory.html"),
                ExpectedConditions.visibilityOfElementLocated(ERROR)));

        if (driver.getCurrentUrl().contains("inventory.html")) {
            return new LoginResult.LoggedIn(new InventoryPage(driver));   // the By-based InventoryPage of lesson 3
        }
        String message = driver.findElement(ERROR).getText().trim();
        return message.contains("locked out")
                ? new LoginResult.LockedOut(this, message)
                : new LoginResult.Rejected(this, message);
    }

    private void type(By locator, String text) {
        WebElement field = wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
        field.clear();
        field.sendKeys(text);
    }

    @Override
    public String toString() { return "LoginPage"; }
}
\`\`\`

Tests stay assertion-owning and branch-free:

\`\`\`java
InventoryPage inventory = login.attemptLogin("standard_user", "secret_sauce").expectLoggedIn();

LoginResult result = login.attemptLogin("locked_out_user", "secret_sauce");
assertTrue(result instanceof LoginResult.LockedOut, "Unexpected outcome: " + result);
\`\`\`

Step by step:

1. **\`sealed ... permits\`** (Java 17) closes the set of outcomes: nobody adds a fourth implementation elsewhere, and readers see every outcome in one file.
2. **Records** give immutable carriers with a useful \`toString\` — "LockedOut[page=LoginPage, message=Error: Sorry, this user has been locked out.]" is a ready-made failure message. Keep page \`toString\` methods free of browser calls for exactly this reason.
3. **The wait covers every terminal state** with \`ExpectedConditions.or\`. A result-returning method must never classify too early (reading "no error yet" as success).
4. **Classification by text** is a compromise because ShopEasy exposes only text. If the app offers a stable signal (\`data-error-code\`, an \`aria\` attribute), classify on that.
5. **Java 17 vs 21:** in Java 17 you use \`instanceof\` patterns as above (pattern matching for \`switch\` was still a preview). From Java 21, an exhaustive \`switch (result) { case LoggedIn l -> …; case Rejected r -> …; case LockedOut lo -> …; }\` compiles without \`default\` and **fails to compile** when someone adds a fourth outcome — the strongest form of type-safe outcome handling.

**When to use which:** expectation-named methods (\`loginAs\` / \`loginExpectingError\`) stay the default for ordinary tests — they read best and fail at the right line. A result type pays off for **data-driven outcome matrices** (one test method, a data provider of credentials → expected outcome type) and for flows with genuinely open outcomes (payment: approved / declined / 3-D Secure challenge / fraud review). Do not use it to let tests write \`if (result instanceof X) … else …\` — a test with branches tests nothing in particular.

## The master comparison of POM styles

| Style | How it works | Advantages | Disadvantages | Performance | Maintainability | Scalability | When to use |
|---|---|---|---|---|---|---|---|
| **Classic \`By\` POM** | private \`By\` constants, explicit waits per action | explicit lookup timing, every \`ExpectedConditions\` works, dynamic locators | a little more code per element | lookup only when you ask | high: no hidden behaviour | good up to large pages; then needs components | default for new Selenium 4 frameworks |
| **PageFactory** | \`@FindBy\` fields, lazy JDK proxies | concise, familiar | hidden lookups, \`WebElement\`-only waits, no dynamic locators, proxy gotchas | extra find per call; list proxies re-find on each call | medium: magic and reflection | weak beyond simple pages | reading/maintaining existing suites |
| **PageFactory + Ajax locators** | polling proxies (presence, or \`isElementUsable\`) | removes sleeps in legacy suites | presence ≠ ready, empty lists wait full timeout, timeouts multiply with implicit wait | slow negatives | medium-low | weak | stepping stone in a legacy suite |
| **LoadableComponent** | \`get()\` = \`isLoaded\` / \`load\` / \`isError\` | self-loading entry pages, fail-fast | \`Error\` for control flow, superclass slot, hidden navigation chains | can navigate unexpectedly | medium | medium | deep-linkable entry pages |
| **Fluent POM** | methods return next page / \`this\` / result | compiler-guided journeys, readable chains | over-long chains; return types can lie | neutral | high when return types are honest | good | together with any of the above |
| **Component-based POM** | root-scoped components composed into pages | reuse of widgets, small classes, matches design systems | more classes, root/staleness design | neutral, scoped searches | high | best for large UIs | any app built from a component library |
| **Screenplay** | actors, tasks, interactions, questions | reuse of *flows*, multi-actor, roles | learning curve, more indirection | neutral | high for big teams | best for many teams/flows | large suites with repeated business flows — see the Screenplay deep dive (\`pom-deep-screenplay-pattern\`) and lesson 10 |

**What the Selenium project itself says (verified on selenium.dev):** the *Page object models* page in the documentation does not mention PageFactory at all; PageFactory appears only in the documentation's *Legacy* section. That page does say page objects should not make assertions apart from a single verification that the page loaded, and that a page object can be composed of page component objects. Do not claim more than that in an interview — "the Selenium team forbids PageFactory" is folklore; "the current docs only list it under Legacy" is checkable.

### Recommended approach for a new Selenium 4 framework, and why

**Classic \`By\` locators + component-based POM + honest fluent return types**, with waits in a \`Waiter\`/action layer, identity checks in page constructors or factories, and a thin task layer on top once flows repeat:

1. **Explicit is debuggable.** You can point at the line where the browser is queried and at the condition you waited for. Proxies hide both.
2. **Waits need \`By\`.** Presence, count, text-change and staleness-based conditions all need re-locatable descriptions; \`selenium-deep-synchronization\` builds on them.
3. **Dynamic locators are first-class** (a product by name, a row by key) — annotations need compile-time constants.
4. **Components scale with the UI**, which is built from components (next lesson).
5. **Nothing to unlearn for Playwright**: locators there are lazy descriptions too, so a \`By\`-based mental model transfers directly.

A senior communicates it like this in a design review: *"We'll standardise on private \`By\` constants and root-scoped components. PageFactory stays readable for legacy pages, but new pages won't use it: its lookups are invisible, it can't express the waits we need, and the current Selenium docs only list it under Legacy. LoadableComponent only for the three deep-linkable admin pages."*

## Migrating a PageFactory-heavy suite to By locators

A big-bang rewrite of 150 pages is the classic way to lose six months and the team's trust. Migrate like a refactoring: behaviour-preserving, small steps, green suite throughout.

**Step 0 — Baseline and measure.** Stabilise or quarantine current failures so red means "I broke it". Record suite duration and flaky rate; you will want the before/after numbers.

**Step 1 — Inventory the risk.** Grep for \`@CacheLookup\`, \`AjaxElementLocatorFactory\`, unannotated \`WebElement\` fields (id-or-name fallback), proxies stored in collections or passed to \`stalenessOf\`, and \`implicitlyWait\`. Rank pages by test count × flakiness × change frequency — migrate the hot pages first, leave stable cold pages for last (or forever).

**Step 2 — Remove the dangerous parts first, without changing style.** Delete \`@CacheLookup\` (one-line changes, often fixes staleness flakes), set the implicit wait to zero where Ajax locators are used, add annotations to fields relying on the name fallback. Each is a small PR.

**Step 3 — Introduce the target building blocks next to the old ones.** A \`Waiter\`, a \`Component\` base, a \`BasePage\` (or composed helpers) that work with \`By\`. Nothing is migrated yet; new pages already use them.

**Step 4 — Migrate one page per PR, inside the page.** The public API stays identical, so no test changes:

\`\`\`java
// before
@FindBy(id = "product-sort") private WebElement sort;
public InventoryPage sortBy(String value) { new Select(sort).selectByValue(value); return this; }

// after
private static final By SORT = By.id("product-sort");
public InventoryPage sortBy(String value) {
    new Select(waiter.visible(SORT)).selectByValue(value);
    return this;
}
\`\`\`

Remove \`initElements\` from the page when its last field is migrated. A mixed page during the PR is fine; a mixed page merged for months is not — set a rule ("touch it, finish it").

**Step 5 — Extract components while migrating.** When the same three \`@FindBy\` header fields appear in twelve pages, migrate them once into a \`HeaderComponent\` and delete the copies.

**Step 6 — Guard against regression.** An ArchUnit rule or a simple CI grep that fails on new \`@FindBy\` outside a \`legacy\` package; code-review checklist item.

**Step 7 — Delete the scaffolding.** When the last page is migrated, remove PageFactory-specific base classes and custom decorators; keep the measurements for the retrospective.

Run the full suite (or at least every test touching the migrated page, found via the page's usages) for each PR, ideally several times in parallel to flush out timing differences: a \`By\` + explicit wait is usually *stricter* (visible/clickable) than a proxy's presence check, which occasionally exposes a real bug the old suite hid.

## Common mistakes and when NOT to use these patterns

- **Custom decorators in a new framework.** If you are writing a \`FieldDecorator\` from scratch on a greenfield project, you are rebuilding plain components with reflection.
- **\`LoadableComponent\` for every page.** Most pages are reached by actions; \`load()\` then needs data and hides navigation.
- **Result types everywhere.** Two outcomes are better served by two well-named methods.
- **"Fixing" PageFactory flakiness with Ajax locators and a bigger timeout.** It makes negative checks slow and still waits for the wrong thing.
- **Mixing styles inside one page indefinitely.** Readers must know two mental models for one class.

## Best practices for experienced engineers

- Keep \`toString\` of pages, components and results **static** (page name, user) — logs, debuggers and record \`toString\` call it.
- In \`isLoaded()\`, convert lookup exceptions into \`AssertionError\`, describe the *state* you need (user, not just URL), and use \`isError()\` to fail fast on known error screens.
- Never let a proxy reach \`equals\`/\`hashCode\`-based collections, \`stalenessOf\`, or reflection-based reporting.
- Snapshot list proxies once before iterating.
- Choose return types per method: \`this\`, next page, value object, or a sealed result — and make the type tell the truth.
- Write down the framework's POM decisions in a one-page ADR; most "style wars" in reviews end when the decision is written.

## Playwright (TypeScript) equivalent

Playwright has no PageFactory because it does not need one: a \`Locator\` *is* a lazy, re-resolving description, so every field is effectively an uncached proxy with auto-waiting actions. The equivalents of this lesson's topics are readonly locator fields, \`expect(...).toBeVisible()\` in a \`waitForLoaded()\` method instead of \`LoadableComponent\`, and discriminated unions instead of sealed interfaces:

\`\`\`ts
type LoginResult =
  | { kind: 'loggedIn'; inventory: InventoryPage }
  | { kind: 'lockedOut'; message: string };
\`\`\`

The full TypeScript treatment is in \`pw-deep-fixtures-pom-components\`.

## Interview questions

### Q: What does \`PageFactory.initElements\` actually do?

**Short answer (30–60 s):** It walks the declared fields of the page and its superclasses and asks a \`FieldDecorator\` for a value. The default decorator replaces \`WebElement\` fields, and annotated \`List<WebElement>\` fields, with JDK dynamic proxies backed by an \`ElementLocator\`. Nothing is searched at that point; each method call on a proxy runs \`findElement\` and then forwards the call.

**Detailed answer:** \`initElements(driver, page)\` builds a \`DefaultElementLocatorFactory\` for the search context and a \`DefaultFieldDecorator\`. For \`WebElement\` fields it creates a proxy implementing \`WebElement\`, \`WrapsElement\` and \`Locatable\` with a \`LocatingElementHandler\`; for \`List<WebElement>\` fields with \`@FindBy\`/\`@FindBys\`/\`@FindAll\` a \`List\` proxy with a \`LocatingElementListHandler\`. Consequences: a lookup per call, \`toString\`/\`equals\`/\`hashCode\` go to the browser, \`getWrappedElement\` unwraps, unannotated \`WebElement\` fields use id-or-name of the field name, list proxies re-find on every \`List\` method. Extension points are \`ElementLocatorFactory\` (how to find, e.g. Ajax or scoped to a root) and \`FieldDecorator\` (what to inject, e.g. typed wrappers).

### Q: Why can \`@CacheLookup\` cause \`StaleElementReferenceException\`, and is it ever safe?

**Short answer (30–60 s):** The locator stores the first element it found and returns it forever. When the app re-renders that node, the stored reference points to a detached node and throws stale. It is safe only when the node lives at least as long as the page object — static chrome on short-lived page objects.

**Detailed answer:** The cache is per \`ElementLocator\`, i.e. per page object instance and field. On ShopEasy, sorting the inventory re-appends the same card nodes (cached cards survive), while \`table.html\` rebuilds \`tbody\` on search, sort and paging (cached rows go stale). Because most teams cannot know node lifetimes per element and the saving is a few milliseconds per lookup, the default is no caching; if profiling shows lookups matter, cache inside a component with an explicit lifetime rather than via an annotation.

### Q: How does \`AjaxElementLocatorFactory\` wait, and what are its pitfalls?

**Short answer (30–60 s):** Each lookup polls (250 ms by default) until the element is present and \`isElementUsable\` returns true — which by default is just "in the DOM". Pitfalls: not visible/clickable, empty lists wait the full timeout and return empty, implicit waits multiply.

**Detailed answer:** \`AjaxElementLocator\` wraps lookups in a \`SlowLoadableComponent\`; only \`NoSuchElementException\` is retried. Override \`isElementUsable\` (e.g. \`isDisplayed()\`, catching staleness) via your own \`ElementLocatorFactory\`, but note that for lists every element must be usable. It is a migration aid for legacy suites, not a replacement for explicit conditions like text change or count stability.

### Q: Explain \`LoadableComponent\`. Would you use it?

**Short answer (30–60 s):** A template-method base: \`get()\` calls \`isLoaded()\`; if that throws an \`Error\`, it calls \`load()\` and checks again. \`SlowLoadableComponent\` polls until a timeout and calls \`isError()\` between polls. I use it for a few deep-linkable entry pages, not for every page.

**Detailed answer:** Strengths: idempotent "get me to X", fail-fast with \`isError()\`, parent chaining that documents navigation. Weaknesses: \`Error\` as control flow (and a \`RuntimeException\` from \`isLoaded\` bypasses \`load()\` entirely), the superclass slot is taken, two ways to construct a page, and hidden navigation cost. The key implementation detail is that \`isLoaded()\` must describe the needed **state** — on ShopEasy, inventory as the right user, because guests see \`inventory.html\` too.

### Q: An action has three outcomes. How do you model it?

**Short answer (30–60 s):** For ordinary tests, expectation-named methods: \`loginAs\` returns \`InventoryPage\`, \`loginExpectingError\` returns \`LoginPage\`. For data-driven matrices, one method returning a sealed \`LoginResult\` with records per outcome, plus an \`expectLoggedIn()\` helper.

**Detailed answer:** The method waits for any terminal state (\`ExpectedConditions.or\`) and classifies on the most stable signal. Sealed interfaces close the set; in Java 21 an exhaustive \`switch\` makes adding an outcome a compile error at every consumer. Records give a descriptive \`toString\` for failure messages. Tests must not branch on the result — they assert the expected type.

### Q: Which POM style would you choose for a new Selenium 4 framework?

**Short answer (30–60 s):** Private \`By\` constants, root-scoped components composed into pages, honest fluent return types, waits in a dedicated layer, identity checks on page creation, and a task layer once flows repeat.

**Detailed answer:** Reasons: explicit lookup timing, all wait conditions available, dynamic locators, components match how UIs are built, and the model transfers to Playwright. PageFactory stays readable for legacy code; the current selenium.dev POM page does not mention it, and it is listed only under Legacy. LoadableComponent for a few entry pages; Screenplay when many teams share many flows.

### Q: How would you migrate 150 PageFactory pages to \`By\`?

**Short answer (30–60 s):** Not in one go. Green baseline, remove \`@CacheLookup\`/implicit-wait conflicts first, introduce the new building blocks, then migrate one page per PR behind an unchanged public API, extracting components on the way, with a CI rule against new \`@FindBy\`.

**Detailed answer:** Prioritise by test count × flakiness × change rate; measure duration and flake rate before and after; run affected tests repeatedly in parallel per PR; expect the stricter waits to surface a few real bugs; keep "touch it, finish it" so pages are not half-migrated for months.

## Scenario-based questions

**1. A PageFactory suite: tests pass locally and on CI, but debugging is unbearably slow — every breakpoint freezes the IDE for 10+ seconds.**
Reason: the debugger renders variables by calling \`toString\`; PageFactory proxies forward \`toString\` to a lookup, and with \`AjaxElementLocatorFactory(driver, 10)\` a missing element costs the full timeout per variable. Act: disable "toString object view" for the page classes in the IDE as a stopgap, add static \`toString\` overrides to page classes (the page object, not the proxy), and in the medium term migrate hot pages to \`By\`.

**2. After switching from \`DefaultElementLocatorFactory\` to \`AjaxElementLocatorFactory\`, the cart suite is 4 minutes slower.**
Reason: negative checks like \`cartItems.isEmpty()\` on a list proxy now poll until at least one element appears — which never happens — and return an empty list only after the timeout. Act: for "absence" checks use \`driver.findElements(By)\` directly (immediate empty list) or a dedicated \`invisibilityOfElementLocated\`/count condition with a short timeout; keep the Ajax factory only for presence-type fields.

**3. A teammate wants every page to extend \`LoadableComponent\` "so tests never start on the wrong page".**
Reason through cost: most ShopEasy pages need state (cart contents, checkout data) that \`load()\` cannot produce without hidden flows; self-typed generics and \`Error\`-based control flow spread everywhere; \`BasePage\` inheritance is lost. Propose: identity checks in every page's creation path (cheap, explicit), \`LoadableComponent\` only for entry pages like login and inventory, state arranged through API/session seeding.

## Tricky follow-ups

- **Q: Does \`initElements\` fail on the wrong page?** No — it searches nothing. The first proxy call fails, often far from the cause; that is why a separate identity check is still needed.
- **Q: Why does \`stalenessOf(proxyField)\` time out?** An uncached proxy re-locates on every call, so it never refers to a detached node. Capture a real element (\`getWrappedElement()\` or \`driver.findElement\`) before the action.
- **Q: Is \`@FindAll\` a fallback locator?** No — it is a union of all inner locators' results, in declaration order.
- **Q: What does \`get()\` do if \`isLoaded()\` throws \`NoSuchElementException\`?** It propagates immediately; \`get()\` only catches \`Error\`, so \`load()\` is never called. Convert to \`AssertionError\`.
- **Q: Can a proxy be cast to \`RemoteWebElement\`?** No; it implements only \`WebElement\`, \`WrapsElement\` and \`Locatable\`. Unwrap with \`getWrappedElement()\`.`,
  keyPoints: [
    'initElements injects JDK dynamic proxies via DefaultFieldDecorator; every proxy call runs ElementLocator.findElement() first — including toString, equals and hashCode — and list proxies re-run findElements on every List method.',
    '@CacheLookup caches per ElementLocator (per page object instance): safe only when the DOM node outlives the page object, which most teams cannot guarantee — default to no caching.',
    'AjaxElementLocator polls for presence (isElementUsable defaults to true); empty lists wait the full timeout; override isElementUsable through your own ElementLocatorFactory and never combine with an implicit wait.',
    'FieldDecorator and ElementLocatorFactory are the extension points: typed wrappers and root-scoped components are possible, but in a new framework plain components without reflection are simpler.',
    'LoadableComponent.get() catches only Error: isLoaded must convert lookup exceptions to AssertionError and check the state you need (right user, not just URL); SlowLoadableComponent adds polling and isError for fail-fast.',
    'Model outcomes honestly: two expectation-named methods for ordinary tests, a sealed result type with records for outcome matrices (exhaustive switch from Java 21).',
    'Recommended for new Selenium 4 frameworks: By locators + components + honest fluent return types + a wait layer; the current selenium.dev POM page does not mention PageFactory, which appears only under Legacy.',
    'Migrate PageFactory suites incrementally: baseline, remove @CacheLookup and implicit-wait conflicts, one page per PR behind an unchanged API, extract components, block new @FindBy in CI.',
  ],
  mistakes: [
    'Iterating a PageFactory list field with index-based loops (size()/get(i)) — 2N+1 findElements calls and shifting indices. Fix: snapshot once with new ArrayList<>(field) and iterate the copy.',
    'Using AjaxElementLocatorFactory for absence checks (cart is empty) — each one waits the full timeout before returning an empty list. Fix: use driver.findElements(By) or an invisibility/count condition with a deliberate timeout.',
    'Throwing NoSuchElementException (or letting findElement throw) inside LoadableComponent.isLoaded — get() does not catch it, so load() never runs. Fix: use findElements or catch lookup exceptions and rethrow as AssertionError with context.',
    'An isLoaded() that checks only the URL on an app that serves the same URL to guests — get() decides the page is already loaded and skips the login. Fix: check the state the test needs (logged-in user, cart contents), not just the address.',
    'Logging or debugging PageFactory proxies, or putting them in HashSets — every toString/equals/hashCode is a browser lookup and may throw. Fix: static toString on pages and components, never use proxies as map keys, unwrap with getWrappedElement when a real element is needed.',
    'Planning a big-bang rewrite from PageFactory to By — months of parallel work and a suite nobody trusts. Fix: incremental, behaviour-preserving page-by-page migration with an unchanged public API and a CI guard against new @FindBy.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`):

1. Write a tiny PageFactory page for \`inventory.html\` with \`@FindBy(css = "[data-testid='inventory-item'] .item-name") List<WebElement> names\`, wrap the driver with a \`WebDriverListener\` that counts \`findElements\` calls (see \`selenium-deep-framework-design\`), and compare the count for an index-based loop vs iterating \`new ArrayList<>(names)\`.
2. Initialise the same page with \`AjaxElementLocatorFactory(driver, 5)\`, open \`cart.html\` with an empty cart and time a call to \`isEmpty()\` on a \`@FindBy(css = "[data-testid='cart-item']") List<WebElement>\` field. Explain the number.
3. Implement \`LoginPage\` and \`InventoryPage\` as \`LoadableComponent\`/\`SlowLoadableComponent\` with parent chaining. First open \`inventory.html\` as a guest, then call \`get()\` — check that your \`isLoaded()\` does not treat the guest view as loaded. Then try \`locked_out_user\` and confirm \`isError()\` fails within about a second with the banner text.
4. Add \`attemptLogin\` returning a sealed \`LoginResult\` and write one TestNG data-driven test with rows \`standard_user\` → \`LoggedIn\`, wrong password → \`Rejected\`, \`locked_out_user\` → \`LockedOut\`, asserting only the outcome type.`,
  problems: ['pom-006', 'pom-025', 'pom-026', 'pom-014'],
}
