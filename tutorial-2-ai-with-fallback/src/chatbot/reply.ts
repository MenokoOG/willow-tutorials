import { askWillow } from "./aiClient";
import { classifyTurn, respond } from "./engine";
import { baseQuickReplies } from "./kb";
import type { ChatMessage, ChatRole, QuickReply } from "./types";

export type Reply = {
  text: string;
  quickReplies: QuickReply[];
  nextState?: string;
  source: "ai" | "offline";
};

/** The decision the chat widget makes on every send, as one function.
 *  Order matters: emergency first, then flow state, then the AI, then offline. */
export async function getReply(
  history: ChatMessage[],
  chatRole: ChatRole,
  state?: string
): Promise<Reply> {
  const latest = history[history.length - 1]?.text ?? "";

  const offline = (): Reply => {
    const ans = respond(latest, { role: chatRole, state });
    return {
      text: ans.text,
      quickReplies: ans.quickReplies ?? [],
      nextState: ans.nextState,
      source: "offline",
    };
  };

  // Emergency short-circuit: instant offline answer, no network round-trip.
  const turn = classifyTurn(latest);
  if (turn.intent === "emergency" && turn.confidence >= 0.8) {
    return offline();
  }

  // Mid-flow (e.g. awaiting_status_detail): stay on the offline engine.
  if (state) {
    return offline();
  }

  try {
    const text = await askWillow(history, chatRole);
    return { text, quickReplies: baseQuickReplies(), source: "ai" };
  } catch {
    return offline();
  }
}
