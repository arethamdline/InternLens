import { NextResponse } from 'next/server';
import {
  analysisJobStaleMs,
  deleteAnalysisJob,
  isValidAnalysisJobId,
  readAnalysisJob,
  saveFailedAnalysisJob,
} from '@/lib/analysis-job-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const readTimeoutMs = 8000;

// A stuck storage read otherwise holds the request until the platform's 30s limit and returns an opaque 502.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Analysis status read timed out.')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get('id');
  if (!isValidAnalysisJobId(requestId)) {
    return NextResponse.json({ error: 'Invalid analysis request.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const job = await withTimeout(readAnalysisJob(requestId), readTimeoutMs);
    if (!job) return NextResponse.json({ status: 'pending' }, { headers: { 'Cache-Control': 'no-store' } });

    if (job.expiresAt <= Date.now()) {
      await deleteAnalysisJob(requestId);
      return NextResponse.json({ error: 'This analysis result has expired. Please submit it again.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
    }

    if (job.status === 'pending' && Date.now() - job.createdAt > analysisJobStaleMs) {
      const error = 'Analysis could not finish. Please submit it again.';
      await saveFailedAnalysisJob(requestId, error);
      return NextResponse.json({ status: 'failed', error }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (job.status === 'completed') {
      return NextResponse.json({ status: job.status, result: job.result }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (job.status === 'failed') {
      return NextResponse.json({ status: job.status, error: job.error }, { headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ status: job.status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('[InternLens] Could not read background analysis status.');
    return NextResponse.json({ error: 'Could not check analysis status. Please retry.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
