import { getStore } from '@netlify/blobs';
import type { AnalysisResult } from './types';

export const analysisJobRetentionMs = 60 * 60 * 1000;
export const analysisJobStaleMs = 16 * 60 * 1000;
const storeName = 'internlens-analysis-jobs';
const keyPrefix = 'analysis-';

export type AnalysisJob =
  | { status: 'pending'; createdAt: number; expiresAt: number }
  | { status: 'completed'; createdAt: number; expiresAt: number; result: AnalysisResult }
  | { status: 'failed'; createdAt: number; expiresAt: number; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  return isRecord(value)
    && isRecord(value.eligibility)
    && typeof value.eligibility.summary === 'string'
    && Array.isArray(value.eligibility.requirements)
    && isRecord(value.credibility)
    && typeof value.credibility.summary === 'string'
    && Array.isArray(value.credibility.signals)
    && typeof value.credibility.disclaimer === 'string';
}

function isAnalysisJob(value: unknown): value is AnalysisJob {
  if (!isRecord(value) || typeof value.createdAt !== 'number' || typeof value.expiresAt !== 'number') return false;
  if (value.status === 'pending') return true;
  if (value.status === 'completed') return isAnalysisResult(value.result);
  return value.status === 'failed' && typeof value.error === 'string';
}

export function isValidAnalysisJobId(value: string | null): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getAnalysisStore() {
  return getStore(storeName, { consistency: 'strong', region: 'ap-southeast-1' });
}

function jobKey(id: string): string {
  return `${keyPrefix}${id}`;
}

export async function createPendingAnalysisJob(id: string): Promise<void> {
  const createdAt = Date.now();
  await getAnalysisStore().setJSON(jobKey(id), {
    status: 'pending',
    createdAt,
    expiresAt: createdAt + analysisJobRetentionMs,
  } satisfies AnalysisJob);
}

export async function saveCompletedAnalysisJob(id: string, result: AnalysisResult): Promise<void> {
  const createdAt = Date.now();
  await getAnalysisStore().setJSON(jobKey(id), {
    status: 'completed',
    createdAt,
    expiresAt: createdAt + analysisJobRetentionMs,
    result,
  } satisfies AnalysisJob);
}

export async function saveFailedAnalysisJob(id: string, error: string): Promise<void> {
  const createdAt = Date.now();
  await getAnalysisStore().setJSON(jobKey(id), {
    status: 'failed',
    createdAt,
    expiresAt: createdAt + analysisJobRetentionMs,
    error,
  } satisfies AnalysisJob);
}

export async function readAnalysisJob(id: string): Promise<AnalysisJob | null> {
  const value: unknown = await getAnalysisStore().get(jobKey(id), { type: 'json' });
  if (value === null) return null;
  if (!isAnalysisJob(value)) throw new Error('Stored analysis job has an invalid shape.');
  return value;
}

export async function deleteAnalysisJob(id: string): Promise<void> {
  await getAnalysisStore().delete(jobKey(id));
}

export async function removeExpiredAnalysisJobs(): Promise<number> {
  const store = getAnalysisStore();
  let removed = 0;
  for await (const page of store.list({ prefix: keyPrefix, paginate: true })) {
    for (const blob of page.blobs) {
      const value: unknown = await store.get(blob.key, { type: 'json' });
      if (value === null) continue;
      if (!isAnalysisJob(value)) {
        await store.delete(blob.key);
        removed += 1;
        continue;
      }
      const job = value;
      if (job && job.expiresAt <= Date.now()) {
        await store.delete(blob.key);
        removed += 1;
      }
    }
  }
  return removed;
}
