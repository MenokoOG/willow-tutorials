import type { BotAnswer, BotContext, BotIntent, BotTurn } from "./types";
import { KB, answerCard, baseQuickReplies } from "./kb";

function normalize(s: string) {
  return (s ?? "").trim().toLowerCase();
}

// Whole-word match. "hi" must not fire inside "this" or "which".
function hasWord(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

const RULES: Record<BotIntent, { words: string[]; score: number }[]> = {
  greeting: [{ words: ["hi", "hello", "hey", "good morning", "good afternoon"], score: 0.9 }],
  hours: [{ words: ["hours", "open", "close", "when are you open"], score: 0.8 }],
  appointment_request: [
    {
      words: ["request appointment", "book", "booking", "schedule", "scheduling", "make an appointment"],
      score: 0.9,
    },
  ],
  appointment_status: [{ words: ["status", "approved", "rejected", "my appointment"], score: 0.8 }],
  emergency: [{ words: ["emergency", "chest pain", "stroke", "call 911"], score: 0.95 }],
  unknown: [],
};

function scoreIntent(text: string, intent: BotIntent): number {
  const t = normalize(text);
  let best = 0;
  for (const rule of RULES[intent]) {
    if (rule.words.some((w) => hasWord(t, w))) best = Math.max(best, rule.score);
  }
  return best;
}

export function classifyTurn(text: string): BotTurn {
  const intents: BotIntent[] = [
    "emergency",
    "greeting",
    "appointment_request",
    "appointment_status",
    "hours",
  ];

  let bestIntent: BotIntent = "unknown";
  let bestScore = 0;

  for (const i of intents) {
    const s = scoreIntent(text, i);
    if (s > bestScore) {
      bestScore = s;
      bestIntent = i;
    }
  }

  return { intent: bestIntent, confidence: bestScore };
}

export function respond(text: string, ctx: BotContext): BotAnswer {
  // Flow state: the previous turn asked a question, so any reply gets the walkthrough.
  if (ctx.state === "awaiting_status_detail") {
    return answerCard(
      [
        "To check your appointment status:",
        `1) Go to the Patient Portal: ${KB.portalPaths.patient}`,
        `2) Open Calendar: ${KB.portalPaths.patientCalendar}`,
      ].join("\n"),
      baseQuickReplies()
    );
  }

  const turn = classifyTurn(text);

  // Emergency always wins if detected strongly.
  if (turn.intent === "emergency" && turn.confidence >= 0.8) {
    return answerCard(KB.clinicInfo.emergencyText, baseQuickReplies());
  }

  switch (turn.intent) {
    case "greeting":
      return answerCard(
        `Hi, I'm Willow, the ${KB.brand} care assistant. I can help you navigate scheduling and the portal.`,
        baseQuickReplies()
      );

    case "hours":
      return answerCard(KB.clinicInfo.hoursText, baseQuickReplies());

    case "appointment_request":
      return answerCard(
        [
          "To request an appointment:",
          `1) Go to: ${KB.portalPaths.request}`,
          "2) Enter your name, email, date, and time.",
          "3) Submit the request.",
          "",
          "Clinic staff review every request. Nothing is final until they approve it.",
        ].join("\n"),
        baseQuickReplies()
      );

    case "appointment_status":
      return answerCard(
        "Do you want to check your appointment status in the Patient Portal?",
        [
          { id: "qr_status_yes", label: "Yes, show me where", payload: "show appointment status" },
          { id: "qr_status_no", label: "No, something else", payload: "hours" },
        ],
        "awaiting_status_detail"
      );

    default:
      return answerCard(
        "I can help with navigation and scheduling inside this app. Try one of these:",
        baseQuickReplies()
      );
  }
}
