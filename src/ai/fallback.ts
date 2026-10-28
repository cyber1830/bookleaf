import type { Category, Priority } from "../domain.js";

/**
 * Cheap deterministic triage. Used (a) immediately at ticket creation so the queue is
 * sortable before the LLM answers, and (b) as the fallback when the AI API is down.
 */
const RULES: [Category, RegExp][] = [
  ["ISBN & Metadata Issues", /isbn|metadata|wrong book|duplicate/i],
  [
    "Printing & Quality",
    /print|blurry|binding|misprint|misalign|colou?r|defect|reprint|damaged/i,
  ],
  [
    "Royalty & Payments",
    /royalt|payout|payment|\bpaid\b|bank|earning|commission/i,
  ],
  [
    "Distribution & Availability",
    /unavailable|out of stock|not showing|not available|not (yet )?(live|listed)/i,
  ],
  [
    "Book Status & Production Updates",
    /typeset|cover design|proof|production|editing|when will|status|stuck/i,
  ],
];

export function heuristicTriage(
  subject: string,
  description: string,
): { category: Category; priority: Priority } {
  const text = `${subject}\n${description}`;
  const isBio = /\bbio\b|update.*(description|bio)/i.test(text); // cosmetic updates are General even if they mention a listing
  const category = isBio
    ? "General Inquiry"
    : (RULES.find(([, re]) => re.test(text))?.[0] ?? "General Inquiry");

  let priority: Priority = "Medium";
  if (/legal|lawyer|fraud|scam|consumer court|cheat/i.test(text))
    priority = "Critical";
  else if (
    category === "ISBN & Metadata Issues" ||
    /\b(\d+|several|many)\s+months?\b|never received|not received|haven'?t received|urgent|terrible|unavailable/i.test(
      text,
    )
  )
    priority = "High";
  else if (
    category === "General Inquiry" &&
    /\bbio\b|update.*(description|bio)|how (do|can) i/i.test(text)
  )
    priority = "Low";
  return { category, priority };
}
