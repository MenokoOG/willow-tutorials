import type { BotAnswer, QuickReply } from "./types";

export const KB = {
  brand: "Willow Bend Family Clinic",
  portalPaths: {
    request: "/request",
    patient: "/patient",
    patientCalendar: "/patient/calendar",
  },
  clinicInfo: {
    hoursText:
      "Clinic hours vary. For the prototype, please use the Contact page to reach the office for availability.",
    emergencyText:
      "If this is a medical emergency, call 911 (or your local emergency number). This chatbot is for navigation and scheduling help only.",
  },
};

export function baseQuickReplies(): QuickReply[] {
  return [
    { id: "qr_request", label: "Request appointment", payload: "I want to request an appointment" },
    { id: "qr_status", label: "My appointment status", payload: "Check my appointment status" },
    { id: "qr_hours", label: "Clinic hours", payload: "When are you open?" },
  ];
}

export function answerCard(
  text: string,
  quickReplies?: QuickReply[],
  nextState?: string
): BotAnswer {
  return { text, quickReplies, nextState };
}
