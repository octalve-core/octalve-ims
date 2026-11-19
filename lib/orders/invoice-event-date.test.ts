import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveInvoiceSecondaryEvent } from "./invoice-event-date";

describe("resolveInvoiceSecondaryEvent", () => {
  it("prefers paidAt when paid", () => {
    expect(
      resolveInvoiceSecondaryEvent({
        status: "paid",
        paidAt: "2026-06-15T00:00:00.000Z",
        dueDate: "2026-07-15T00:00:00.000Z",
      }),
    ).toEqual({ date: "2026-06-15T00:00:00.000Z", kind: "paid" });
  });

  it("uses cancelledAt when cancelled", () => {
    expect(
      resolveInvoiceSecondaryEvent({
        status: "cancelled",
        cancelledAt: "2026-06-01T00:00:00.000Z",
        dueDate: "2026-07-15T00:00:00.000Z",
      }),
    ).toEqual({ date: "2026-06-01T00:00:00.000Z", kind: "cancelled" });
  });

  it("uses refunded kind with paidAt", () => {
    expect(
      resolveInvoiceSecondaryEvent({
        status: "refunded",
        paidAt: "2026-06-15T00:00:00.000Z",
      }),
    ).toEqual({ date: "2026-06-15T00:00:00.000Z", kind: "refunded" });
  });

  describe("falls back to due date for sent", () => {
    // isDueOverdue() in invoice-event-date.ts compares dueDate against the
    // real clock, so this fixture's "not yet due" expectation only holds
    // while "now" is before the hardcoded dueDate — it silently flipped to
    // "overdue" once CI ran past 2026-08-14 (the bug this pins down). The
    // clock is faked only for this block, not the other tests above, since
    // none of them go through isDueOverdue().
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-20T00:00:00.000Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("reports kind due while before the due date", () => {
      expect(
        resolveInvoiceSecondaryEvent({
          status: "sent",
          sentAt: "2026-07-15T00:00:00.000Z",
          dueDate: "2026-08-14T00:00:00.000Z",
        }),
      ).toMatchObject({ kind: "due", date: "2026-08-14T00:00:00.000Z" });
    });
  });
});
