import type { Config } from '@netlify/functions';
import { removeExpiredAnalysisJobs } from '../../lib/analysis-job-store';

export default async function cleanupAnalysisJobs(): Promise<void> {
  const removed = await removeExpiredAnalysisJobs();
  if (removed > 0) console.info(`[InternLens] Removed ${removed} expired analysis reports.`);
}

export const config: Config = {
  schedule: '*/5 * * * *',
  region: 'sin',
};
