const PERSONAL_DATA_PATTERNS = [
  /\b[A-Z]{1,2}\d{6}\s*\(?\s*[0-9A]\s*\)?\b/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /(?<!\w)(?:\+?852[\s-]?)?[5-9]\d{3}[\s-]?\d{4}(?!\w)/g,
];

export function redactPersonalData(value: string): string {
  return PERSONAL_DATA_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[REDACTED]'), value);
}
