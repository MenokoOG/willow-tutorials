import { describe, it, expect } from "vitest";
import { classifyTurn, respond } from "./engine";

describe("classifyTurn", () => {
  it("is case and whitespace insensitive", () => {
    expect(classifyTurn("  HELLO  ").intent).toBe("greeting");
  });

  it("matches whole words only", () => {
    // "hi" hides inside "this" and "which".
    expect(classifyTurn("this is my question").intent).toBe("unknown");
    expect(classifyTurn("which doctor").intent).toBe("unknown");
  });

  it("finds an appointment request", () => {
    expect(classifyTurn("I want to book an appointment").intent).toBe("appointment_request");
    expect(classifyTurn("scheduling a visit").intent).toBe("appointment_request");
  });

  it("returns unknown with zero confidence when nothing matches", () => {
    expect(classifyTurn("banana")).toEqual({ intent: "unknown", confidence: 0 });
  });

  it("scores an emergency at 0.8 or higher", () => {
    const turn = classifyTurn("I have chest pain");
    expect(turn.intent).toBe("emergency");
    expect(turn.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

describe("respond", () => {
  const ctx = { role: "guest" as const };

  it("lets an emergency beat a greeting", () => {
    const ans = respond("hi, I think I'm having a stroke", ctx);
    expect(ans.text).toContain("911");
  });

  it("never claims to book or confirm an appointment", () => {
    const ans = respond("I want to book an appointment", ctx);
    expect(ans.text).toContain("/request");
    expect(ans.text).toMatch(/staff review/i);
    expect(ans.text).not.toMatch(/\b(booked|confirmed|scheduled for you)\b/i);
  });

  it("walks through a two-turn status flow", () => {
    const first = respond("what is my appointment status", ctx);
    expect(first.nextState).toBe("awaiting_status_detail");

    const second = respond("yes", { ...ctx, state: first.nextState });
    expect(second.text).toContain("/patient/calendar");
    expect(second.nextState).toBeUndefined();
  });

  it("always offers quick replies, even for gibberish", () => {
    const ans = respond("asdfgh", ctx);
    expect(ans.quickReplies?.length).toBeGreaterThan(0);
  });
});
