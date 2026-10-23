import { NextResponse } from 'next/server';
import { analyzeWithAI } from '@/lib/ai';
import type { StudentProfile } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maxBodyBytes = 80000;
const maxDescriptionLength = 24000;

function asString(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validUrl(value: string): boolean {
  if (!value) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBodyBytes) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const rawProfile = body.profile && typeof body.profile === 'object' ? body.profile as Record<string, unknown> : {};
  const profile: StudentProfile = {
    degree: asString(rawProfile.degree),
    yearOfStudy: asString(rawProfile.yearOfStudy, 80),
    expectedGraduation: asString(rawProfile.expectedGraduation, 80),
    skills: asString(rawProfile.skills, 2000),
    workAuthorization: asString(rawProfile.workAuthorization, 500),
  };
  const jobDescription = asString(body.jobDescription, maxDescriptionLength);
  const jobUrl = asString(body.jobUrl, 1000);
  const locale = body.locale === 'zh-Hant' ? 'zh-Hant' : 'en';

  if (!jobDescription) return NextResponse.json({ error: 'Paste the internship description to continue.' }, { status: 400 });
  if (!validUrl(jobUrl)) return NextResponse.json({ error: 'Enter a valid HTTP or HTTPS job link.' }, { status: 400 });

  try {
    const result = await analyzeWithAI({ profile, jobDescription, jobUrl: jobUrl || undefined, locale });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Never log request bodies or provider error payloads: they can contain profile details or secrets.
    const message = error instanceof Error ? error.message : '';
    const status = message === 'AI configuration is incomplete. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL.' ? 503 : 502;
    const clientMessage = status === 503
      ? (locale === 'zh-Hant' ? 'AI 服務尚未設定，請先配置伺服器環境變數。' : 'AI service is not configured. Set the server environment variables first.')
      : (locale === 'zh-Hant' ? '暫時無法完成分析，請稍後再試。你的資料沒有被保存。' : 'Analysis failed temporarily. Please try again. Your input was not saved.');
    return NextResponse.json({ error: clientMessage }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
