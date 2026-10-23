import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askWillow } from "../src/chatbot/aiClient";
import type { ChatMessage } from "../src/chatbot/types";

function msg(i: number, sender: ChatMessage["sender"] = "user"): ChatMessage {
  return { id: String(i), sender, text: `message ${i}`, ts: i };
}

describe("askWillow", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the trimmed text on 200", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ text: "  hello  " })));
    await expect(askWillow([msg(1)], "guest")).resolves.toBe("hello");
  });

  it("throws on a non-200", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 501 }));
    await expect(askWillow([msg(1)], "guest")).rejects.toThrow("willow_ai_501");
  });

  it("throws on an empty answer", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ text: " " })));
    await expect(askWillow([msg(1)], "guest")).rejects.toThrow("willow_ai_empty");
  });

  it("sends the last 12 messages, skips system messages, and nothing else", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ text: "ok" })));
    const history = [
      ...Array.from({ length: 14 }, (_, i) => msg(i + 1, i % 2 ? "bot" : "user")),
      msg(99, "system"),
    ];

    await askWillow(history, "patient");

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(sent).sort()).toEqual(["chatRole", "messages"]);
    expect(sent.messages).toHaveLength(12);
    expect(sent.messages[0].content).toBe("message 3");
    expect(sent.messages[1].role).toBe("assistant");
  });

  it("aborts after 15 seconds", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    );

    const pending = askWillow([msg(1)], "guest");
    const assertion = expect(pending).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
