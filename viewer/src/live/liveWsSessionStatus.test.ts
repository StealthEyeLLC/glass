import { describe, expect, it } from "vitest";
import {
  buildWsStatusJson,
  formatLastCloseLine,
  formatWsPhaseLine,
  resolveCloseInitiator,
  type WsLastCloseDisplay,
} from "./liveWsSessionStatus.js";

describe("resolveCloseInitiator", () => {
  it("prefers explicit operator attribution", () => {
    expect(resolveCloseInitiator("operator", false)).toBe("operator_disconnect");
  });

  it("uses reconnect attribution without implying peer", () => {
    expect(resolveCloseInitiator("reconnect", false)).toBe("replaced_by_new_connect");
  });

  it("uses error bit when no attribution", () => {
    expect(resolveCloseInitiator(null, true)).toBe("after_error_event");
  });

  it("defaults to remote_or_peer", () => {
    expect(resolveCloseInitiator(null, false)).toBe("remote_or_peer");
  });
});

describe("formatLastCloseLine", () => {
  it("includes raw code and reason without inventing semantics", () => {
    const c: WsLastCloseDisplay = {
      initiator: "remote_or_peer",
      code: 4000,
      reason: "bye",
      wasClean: true,
    };
    expect(formatLastCloseLine(c)).toContain("code=4000");
    expect(formatLastCloseLine(c)).toContain("bye");
    expect(formatLastCloseLine(c)).toContain("wasClean=true");
  });

  it("notes empty reason string honestly", () => {
    const c: WsLastCloseDisplay = {
      initiator: "operator_disconnect",
      code: 1000,
      reason: "",
      wasClean: true,
    };
    expect(formatLastCloseLine(c)).toContain("no close reason string");
  });
});

describe("buildWsStatusJson", () => {
  it("round-trips structured status for Copy JSON", () => {
    const j = buildWsStatusJson({
      phase: "open",
      lastClose: null,
      hadUnhandledErrorEvent: false,
    });
    const o = JSON.parse(j) as { phase: string };
    expect(o.phase).toBe("open");
  });
});

describe("formatWsPhaseLine", () => {
  it("covers idle connecting open", () => {
    expect(formatWsPhaseLine("idle")).toContain("idle");
    expect(formatWsPhaseLine("connecting")).toContain("connecting");
    expect(formatWsPhaseLine("open")).toContain("open");
  });
});
