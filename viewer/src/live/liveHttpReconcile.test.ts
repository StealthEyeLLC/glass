import { describe, expect, it } from "vitest";
import { makeReconcileRecord } from "./liveHttpReconcile.js";

describe("makeReconcileRecord", () => {
  it("records operator vs resync trigger", () => {
    const a = makeReconcileRecord("operator", "ok", { eventsCount: 3 }, 1_700_000_000_000);
    expect(a.trigger).toBe("operator");
    expect(a.status).toBe("ok");
    expect(a.eventsCount).toBe(3);
    const b = makeReconcileRecord(
      "session_resync_required",
      "error",
      { errorMessage: "x" },
      1_700_000_000_000,
    );
    expect(b.trigger).toBe("session_resync_required");
    expect(b.status).toBe("error");
    expect(b.errorMessage).toBe("x");
  });
});
