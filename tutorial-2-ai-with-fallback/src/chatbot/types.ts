export type ChatRole = "patient" | "staff" | "guest";

export type QuickReply = {
  id: string;
  label: string;
  payload: string;
};

export type ChatMessage = {
  id: string;
  sender: "user" | "bot" | "system";
  text: string;
  ts: number;
  quickReplies?: QuickReply[];
};

export type BotAnswer = {
  text: string;
  quickReplies?: QuickReply[];
  nextState?: string;
};

export type BotContext = {
  role: ChatRole;
  state?: string;
};

export type BotIntent =
  | "greeting"
  | "hours"
  | "appointment_request"
  | "appointment_status"
  | "emergency"
  | "unknown";

export type BotTurn = {
  intent: BotIntent;
  confidence: number;
};
