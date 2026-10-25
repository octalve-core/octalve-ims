import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Passive observers (template section 1 "actors versus observers" / 7.7):
 * these never change app state and never drive the journey. They only
 * watch and record. This file is the one allowlisted exception the guard
 * test (walkthrough.guard.spec.ts) does not scan — everything here is a
 * listener, not a step.
 */

export type ObserverEvent =
  | { kind: "console"; level: string; text: string; location?: string; timestampMs: number }
  | { kind: "pageerror"; message: string; stack?: string; timestampMs: number }
  | { kind: "requestfailed"; url: string; method: string; failure: string | null; timestampMs: number }
  | { kind: "response"; url: string; status: number; statusText: string; timestampMs: number };

export type AxeViolation = {
  id: string;
  impact: string | null;
  description: string;
  nodes: number;
  url: string;
};

export class WalkthroughObservers {
  readonly events: ObserverEvent[] = [];
  readonly axeViolations: AxeViolation[] = [];

  /** Attaches passive listeners to a page. Call once per tab. */
  attach(page: Page): void {
    page.on("console", (msg) => {
      this.events.push({
        kind: "console",
        level: msg.type(),
        text: msg.text(),
        location: msg.location()?.url,
        timestampMs: Date.now(),
      });
    });

    page.on("pageerror", (err) => {
      this.events.push({
        kind: "pageerror",
        message: err.message,
        stack: err.stack,
        timestampMs: Date.now(),
      });
    });

    page.on("requestfailed", (req) => {
      this.events.push({
        kind: "requestfailed",
        url: req.url(),
        method: req.method(),
        failure: req.failure()?.errorText ?? null,
        timestampMs: Date.now(),
      });
    });

    page.on("response", (res) => {
      if (res.status() >= 400) {
        this.events.push({
          kind: "response",
          url: res.url(),
          status: res.status(),
          statusText: res.statusText(),
          timestampMs: Date.now(),
        });
      }
    });
  }

  /** Scans the current page with axe-core. Call after every new route loads. */
  async scanAccessibility(page: Page, routeLabel: string): Promise<AxeViolation[]> {
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      description: v.description,
      nodes: v.nodes.length,
      url: routeLabel,
    }));
    this.axeViolations.push(...violations);
    return violations;
  }

  /** Blocking findings per template section 5: serious/critical axe violations. */
  blockingAxeViolations(): AxeViolation[] {
    return this.axeViolations.filter((v) => v.impact === "serious" || v.impact === "critical");
  }

  /** Console errors, hydration errors, failed requests, and 4xx/5xx responses so far. */
  errorEvents(): ObserverEvent[] {
    return this.events.filter(
      (e) =>
        e.kind === "pageerror" ||
        e.kind === "requestfailed" ||
        (e.kind === "console" && e.level === "error") ||
        e.kind === "response",
    );
  }
}
