import { describe, expect, it } from "vitest";
import { provisionFirstAdmin } from "./seed-admin";

describe("provisionFirstAdmin", () => {
  it("refuses any database name but octalve_ims_test, without connecting", async () => {
    await expect(provisionFirstAdmin("postgresql://roji:roji@127.0.0.1:5432/some_other_db")).rejects.toThrow(
      /refuses to seed database/,
    );
  });
});
