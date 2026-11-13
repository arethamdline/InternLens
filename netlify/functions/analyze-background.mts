import type { Config } from '@netlify/functions';
import { AIProviderError, analyzeWithAI } from '../../lib/ai';
import {
  isValidAnalysisJobId,
  saveCompletedAnalysisJob,
  saveFailedAnalysisJob,
} from '../../lib/analysis-job-store';
import { parseAnalyzeInput } from '../../lib/analyze-request';

const maxBodyBytes = 80000;
const missingConfiguration = 'AI configuration is incomplete. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL.';

export default async function analyzeBackground(request: Request): Promise<void> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBodyBytes) return;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;

  const requestId = 'requestId' in body && typeof body.requestId === 'string' ? body.requestId : null;
  if (!isValidAnalysisJobId(requestId)) return;

  const parsed = parseAnalyzeInput(body);
  if ('error' in parsed) {
    await saveFailedAnalysisJob(requestId, parsed.error);
    return;
  }

  try {
    const report = await analyzeWithAI(parsed.input);
    await saveCompletedAnalysisJob(requestId, report);
  } catch (error) {
    const diagnostic = error instanceof AIProviderError
      ? error.diagnostic
      : { category: error instanceof SyntaxError ? 'invalid-provider-response' : 'analysis-failed' };
    console.error('[InternLens] Background AI analysis failed', diagnostic);

    const message = error instanceof Error && error.message === missingConfiguration
      ? (parsed.input.locale === 'zh-Hant'
        ? 'AI 服務尚未設定，請先配置伺服器環境變數。'
        : 'AI service is not configured. Set the server environment variables first.')
      : (parsed.input.locale === 'zh-Hant'
        ? '暫時無法完成分析，請稍後再試。'
        : 'Analysis failed temporarily. Please try again.');
    await saveFailedAnalysisJob(requestId, message);
  }
}

export const config: Config = {
  background: true,
  method: 'POST',
};
