import sourceData from '../data/sources.json';
import type { SourceRecord } from './types';

export function listSources(): SourceRecord[] {
  return (sourceData as SourceRecord[])
    .map((source) => ({ ...source }))
    .sort((left, right) => {
      if (left.trustLevel !== right.trustLevel) return left.trustLevel < right.trustLevel ? -1 : 1;
      if (left.name !== right.name) return left.name < right.name ? -1 : 1;
      return 0;
    });
}

export function sourceForUrl(url: string | undefined): SourceRecord | undefined {
  if (!url) return undefined;
  let hostname: string;
  try { hostname = new URL(url).hostname.toLowerCase(); } catch { return undefined; }
  let pathname: string;
  try { pathname = new URL(url).pathname.replace(/\/$/, '') || '/'; } catch { return undefined; }
  return listSources().find((source) => {
    try {
      const sourceUrl = new URL(source.url);
      const sourceHost = sourceUrl.hostname.toLowerCase();
      const sameHost = hostname === sourceHost || hostname === `www.${sourceHost}`;
      const sourcePath = sourceUrl.pathname.replace(/\/$/, '') || '/';
      const samePath = sourcePath === '/' || pathname === sourcePath || pathname.startsWith(`${sourcePath}/`);
      return sameHost && samePath;
    } catch { return false; }
  });
}
