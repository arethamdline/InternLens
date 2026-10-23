/** Return an evidence quote only when it occurs verbatim in the supplied posting. */
export function exactQuote(value: unknown, jobDescription: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return jobDescription.includes(value) ? value : null;
}
