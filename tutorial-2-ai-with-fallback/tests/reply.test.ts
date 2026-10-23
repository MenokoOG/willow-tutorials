import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getReply } from "../src/chatbot/reply";
import type { ChatMessage } from "../src/chatbot/types";

function ask(text: string): ChatMessage[] {
  return [{ id: "1", sender: "user", text, ts: 1 }];
}

describe("getReply", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the AI when the endpoint answers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ text: "Use /request." })));
    const reply = await getReply(ask("how do I get a visit"), "guest");
    expect(reply).toMatchObject({ text: "Use /request.", source: "ai" });
  });

  // The point of the whole design: every failure ends in a real answer.
  it.each([
    ["no key (501)", () => new Response("{}", { status: 501 })],
    ["upstream error (502)", () => new Response("{}", { status: 502 })],
    ["empty answer", () => new Response(JSON.stringify({ text: "" }))],
  ])("falls back to the offline engine on %s", async (_name, makeResponse) => {
    fetchMock.mockResolvedValue(makeResponse());
    const reply = await getReply(ask("when are you open"), "guest");
    expect(reply.source).toBe("offline");
    expect(reply.text).toContain("Clinic hours vary");
  });

  it("falls back when the network is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const reply = await getReply(ask("hello"), "guest");
    expect(reply.source).toBe("offline");
    expect(reply.text).toContain("Willow Bend Family Clinic");
  });

  it("falls back when the request times out", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    );

    const pending = getReply(ask("when are you open"), "guest");
    await vi.advanceTimersByTimeAsync(15_000);
    const reply = await pending;
    expect(reply.source).toBe("offline");
  });

  it("answers an emergency offline without touching the network", async () => {
    const reply = await getReply(ask("I have chest pain"), "guest");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reply.source).toBe("offline");
    expect(reply.text).toContain("911");
  });

  it("still answers an emergency in the middle of a flow", async () => {
    const reply = await getReply(ask("chest pain"), "guest", "awaiting_status_detail");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reply.text).toContain("911");
  });

  it("stays offline in the middle of a flow", async () => {
    const reply = await getReply(ask("yes"), "guest", "awaiting_status_detail");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reply.text).toContain("/patient/calendar");
  });
});
