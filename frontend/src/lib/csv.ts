const EMAIL_RE = /[^\s,;"'<>]+@[^\s,;"'<>]+\.[^\s,;"'<>]+/g;

/** Pulls every unique email address out of a CSV/text file, whatever the column layout. */
export function extractEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) ?? [];
  return [...new Set(found.map((e) => e.toLowerCase()))];
}
