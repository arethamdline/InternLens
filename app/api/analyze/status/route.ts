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

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get('id');
  if (!isValidAnalysisJobId(requestId)) {
    return NextResponse.json({ error: 'Invalid analysis request.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const job = await readAnalysisJob(requestId);
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
