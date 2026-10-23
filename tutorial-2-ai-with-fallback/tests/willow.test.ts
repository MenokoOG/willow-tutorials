import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../netlify/functions/willow";

const KEY = "sk-test-not-a-real-key";

function post(body: unknown): Request {
  return new Request("http://localhost/api/willow", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = { messages: [{ role: "user", content: "How do I request a visit?" }] };

function upstreamOk(text: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
  });
}

describe("willow function", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.OPENAI_API_KEY = KEY;
    delete process.env.WILLOW_MODEL;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it("rejects anything but POST", async () => {
    const res = await handler(new Request("http://localhost/api/willow"));
    expect(res.status).toBe(405);
  });

  it("returns 501 and never calls OpenAI when the key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await handler(post(valid));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ error: "ai_unconfigured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates input before spending a token", async () => {
    expect((await handler(post("{not json"))).status).toBe(400);
    expect((await handler(post({ messages: [] }))).status).toBe(400);
    expect((await handler(post({ messages: [{ role: "system", content: "x" }] }))).status).toBe(400);

    const tooMany = Array.from({ length: 21 }, () => ({ role: "user", content: "hi" }));
    expect((await handler(post({ messages: tooMany }))).status).toBe(413);

    const tooLong = [{ role: "user", content: "a".repeat(1001) }];
    expect((await handler(post({ messages: tooLong }))).status).toBe(413);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 when OpenAI answers with an error", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const res = await handler(post(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_error", status: 500 });
  });

  it("returns 502 when OpenAI is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await handler(post(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_unreachable" });
  });

  it("returns 502 on an empty completion", async () => {
    fetchMock.mockResolvedValue(upstreamOk("   "));
    const res = await handler(post(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "empty_completion" });
  });

  it("returns the trimmed text on success and never leaks the key", async () => {
    fetchMock.mockResolvedValue(upstreamOk("  Use the request page.  "));
    const res = await handler(post(valid));
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(JSON.parse(raw)).toEqual({ text: "Use the request page." });
    expect(raw).not.toContain(KEY);
  });

  it("sends the guardrails and the default model upstream", async () => {
    fetchMock.mockResolvedValue(upstreamOk("ok"));
    await handler(post({ ...valid, chatRole: "patient" }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);

    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("gpt-4o-mini");
    expect(sent.messages[0].role).toBe("system");
    expect(sent.messages[0].content).toContain("call 911");
    expect(sent.messages[0].content).toContain("NEVER claim to book");
    expect(sent.messages[0].content).toContain("the role: patient");
  });

  it("treats an unknown chatRole as guest", async () => {
    fetchMock.mockResolvedValue(upstreamOk("ok"));
    await handler(post({ ...valid, chatRole: "root" }));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.messages[0].content).toContain("the role: guest");
  });
});
