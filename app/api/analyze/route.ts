import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { AIProviderError, analyzeWithAI } from '@/lib/ai';
import { createPendingAnalysisJob, isValidAnalysisJobId, saveFailedAnalysisJob } from '@/lib/analysis-job-store';
import { parseAnalyzeInput } from '@/lib/analyze-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maxBodyBytes = 80000;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBodyBytes) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const parsed = parseAnalyzeInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const input = parsed.input;
  let backgroundRequestId: string | undefined;

  try {
    if (process.env.SITE_ID) {
      // Reuse the client-supplied id when valid; otherwise generate one so older cached pages still work.
      const clientRequestId = body && typeof body === 'object' && 'requestId' in body && typeof body.requestId === 'string'
        ? body.requestId
        : null;
      const requestId = isValidAnalysisJobId(clientRequestId) ? clientRequestId : randomUUID();
      backgroundRequestId = requestId;
      await createPendingAnalysisJob(requestId);
      // The browser starts the background function itself with a same-origin request.
      // A server redirect here pointed at the deploy permalink domain, which browsers block as cross-origin.
      return NextResponse.json({ requestId }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    }

    const result = await analyzeWithAI(input);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (backgroundRequestId) {
      try {
        await saveFailedAnalysisJob(backgroundRequestId, input.locale === 'zh-Hant'
          ? '無法啟動背景分析，請稍後再試。'
          : 'Could not start background analysis. Please try again.');
      } catch {
        console.error('[InternLens] Could not record failed background analysis submission.');
      }
    }
    // Never log request bodies or provider error payloads: they can contain profile details or secrets.
    const message = error instanceof Error ? error.message : '';
    const status = message === 'AI configuration is incomplete. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL.' ? 503 : 502;
    const diagnostic = error instanceof AIProviderError
      ? error.diagnostic
      : { category: error instanceof SyntaxError ? 'invalid-provider-response' : 'analysis-failed' };
    if (status !== 503) {
      console.error('[InternLens] AI analysis failed', diagnostic);
    }
    const clientMessage = status === 503
      ? (input.locale === 'zh-Hant' ? 'AI 服務尚未設定，請先配置伺服器環境變數。' : 'AI service is not configured. Set the server environment variables first.')
      : (input.locale === 'zh-Hant' ? '暫時無法完成分析，請稍後再試。你的資料沒有被保存。' : 'Analysis failed temporarily. Please try again. Your input was not saved.');
    return NextResponse.json({
      error: clientMessage,
      ...(process.env.NODE_ENV === 'development' && status !== 503 ? { diagnostic } : {}),
    }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
