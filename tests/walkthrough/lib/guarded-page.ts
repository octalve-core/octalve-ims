import type { Locator, Page } from "@playwright/test";

/**
 * Wraps a Playwright Page so journey steps never see the raw page (template
 * rule: "steps never see raw page"). `gotoOnce` may be called exactly once
 * per wrapped tab — a second call throws, enforcing "no page.goto() after
 * the first load of each tab." Every other method here is an *actor*
 * (something a real person could do by clicking/typing); observers
 * (console/pageerror/requestfailed/response/axe) are wired separately in
 * tests/walkthrough/observers/ and never go through this wrapper.
 */
export class GuardedPage {
  private hasNavigated = false;

  constructor(private readonly page: Page) {}

  /** The one-and-only navigation a tab is allowed: its first load. */
  async gotoOnce(url: string): Promise<void> {
    if (this.hasNavigated) {
      throw new Error(
        `GuardedPage: goto() called a second time for this tab (url: ${url}). ` +
          "A real person does not re-type a URL mid-journey — use a click, " +
          "a link, or browser back/forward instead.",
      );
    }
    this.hasNavigated = true;
    await this.page.goto(url);
  }

  locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  getByRole(...args: Parameters<Page["getByRole"]>): Locator {
    return this.page.getByRole(...args);
  }

  getByText(...args: Parameters<Page["getByText"]>): Locator {
    return this.page.getByText(...args);
  }

  getByLabel(...args: Parameters<Page["getByLabel"]>): Locator {
    return this.page.getByLabel(...args);
  }

  getByPlaceholder(...args: Parameters<Page["getByPlaceholder"]>): Locator {
    return this.page.getByPlaceholder(...args);
  }

  async click(selector: string | Locator): Promise<void> {
    const locator = typeof selector === "string" ? this.page.locator(selector) : selector;
    await locator.click();
  }

  /** Real key presses at human speed — never page.fill()'s instant paste. */
  async typeHumanlike(
    target: Locator,
    text: string,
    delayMs = 50 + Math.random() * 70,
  ): Promise<void> {
    await target.click();
    await target.pressSequentially(text, { delay: delayMs });
  }

  /** Select-all + backspace — how a person clears a field, never .fill(""). */
  async clearHumanlike(target: Locator): Promise<void> {
    await target.click();
    await target.press("ControlOrMeta+a");
    await target.press("Backspace");
  }

  async selectOption(target: Locator, value: string): Promise<void> {
    await target.selectOption(value);
  }

  async check(target: Locator): Promise<void> {
    await target.check();
  }

  async uncheck(target: Locator): Promise<void> {
    await target.uncheck();
  }

  /** Native file dialog — the one legitimate way to choose a file. */
  async chooseFile(target: Locator, filePath: string | string[]): Promise<void> {
    await target.setInputFiles(filePath);
  }

  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  async goForward(): Promise<void> {
    await this.page.goForward();
  }

  async reload(): Promise<void> {
    // A real person can hit refresh; this is not a second goto().
    await this.page.reload();
  }

  get url(): string {
    return this.page.url();
  }
}

export function wrapPage(page: Page): GuardedPage {
  return new GuardedPage(page);
}
