// Chat guard: MyTICX chat is only for talking about the ticket. Anything that
// shares personal contact details or moves the deal off-platform is refused
// (never stored, never shown to the other person). Runs on the server (the
// real enforcement) and on the client (instant feedback).

const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9'
};

const BLOCKED_COMPACT = [
  'whatsapp', 'whatsap', 'watsapp', 'telegram', 'instagram', 'snapchat',
  'facebook', 'gpay', 'googlepay', 'phonepe', 'paytm', 'signalapp'
];

const BLOCKED_PHRASES = [
  /\b(call|text|ping|dm|msg)\s+me\b/i,
  /\b(my|your)\s+(phone|mobile|contact|cell|whats?app)\s*(no|number|num|#)?\b/i,
  /\b(phone|mobile|contact)\s*(no|number|num)\b/i,
  /\bupi\s*id\b/i,
  /\b(outside|off)\s+(the\s+)?(app|platform|tic?x)\b/i,
  /\bpay\s+(me\s+)?(directly|cash|outside)\b/i
];

export const MODERATION_MESSAGE =
  "This message wasn't sent. Chat is only for questions about the ticket — sharing phone numbers, emails, links, social handles or payment details isn't allowed.";

export function checkMessage(body: string): { ok: true } | { ok: false; reason: string } {
  const text = body.trim();
  const lower = text.toLowerCase();

  // Spelled-out digits ("nine eight seven six ...") become real digits.
  const wordsToDigits = lower.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, w => DIGIT_WORDS[w]);

  // 8+ digits in a run, allowing spaces / dots / dashes / brackets between
  // them (so "98 76-54.32 10" is caught but "row 12 seat 14, ₹350" is not).
  if (/(?:\d[\s.\-_()+*]*){8,}/.test(wordsToDigits)) return { ok: false, reason: MODERATION_MESSAGE };

  if (lower.includes('@')) return { ok: false, reason: MODERATION_MESSAGE };
  if (/\b[a-z0-9._-]+\s*(\(|\[)?\s*(at|dot)\s*(\)|\])?\s*[a-z0-9-]+\s*(\(|\[)?\s*dot\s*(\)|\])?\s*(com|in|net|org|co)\b/i.test(lower)) {
    return { ok: false, reason: MODERATION_MESSAGE };
  }
  if (/(https?:\/\/|www\.)\S+/i.test(text) || /\b[a-z0-9-]+\.(com|in|me|io|net|org|co|app|link|gl|ly|be)\b/i.test(lower)) {
    return { ok: false, reason: MODERATION_MESSAGE };
  }

  const compact = lower.replace(/[^a-z0-9]/g, '');
  if (BLOCKED_COMPACT.some(k => compact.includes(k))) return { ok: false, reason: MODERATION_MESSAGE };
  if (BLOCKED_PHRASES.some(re => re.test(text))) return { ok: false, reason: MODERATION_MESSAGE };

  return { ok: true };
}
