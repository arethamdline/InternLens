import type { Locale, StudentProfile } from './types';

export interface AnalyzeInput {
  profile: StudentProfile;
  jobDescription: string;
  jobUrl?: string;
  locale: Locale;
}

export type AnalyzeInputResult =
  | { input: AnalyzeInput }
  | { error: string; status: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validUrl(value: string): boolean {
  if (!value) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function parseAnalyzeInput(value: unknown): AnalyzeInputResult {
  if (!isRecord(value)) return { error: 'Request body must be a JSON object.', status: 400 };

  const rawProfile = isRecord(value.profile) ? value.profile : {};
  const profile: StudentProfile = {
    degree: asString(rawProfile.degree),
    yearOfStudy: asString(rawProfile.yearOfStudy, 80),
    expectedGraduation: asString(rawProfile.expectedGraduation, 80),
    skills: asString(rawProfile.skills, 2000),
    workAuthorization: asString(rawProfile.workAuthorization, 500),
  };
  const jobDescription = asString(value.jobDescription, 24000);
  const jobUrl = asString(value.jobUrl, 1000);
  const locale: Locale = value.locale === 'zh-Hant' ? 'zh-Hant' : 'en';

  if (!jobDescription) return { error: 'Paste the internship description to continue.', status: 400 };
  if (!validUrl(jobUrl)) return { error: 'Enter a valid HTTP or HTTPS job link.', status: 400 };

  return {
    input: {
      profile,
      jobDescription,
      jobUrl: jobUrl || undefined,
      locale,
    },
  };
}
