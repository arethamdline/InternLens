import { NextResponse } from 'next/server';
import { listSources } from '@/lib/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ sources: listSources() }, { headers: { 'Cache-Control': 'no-store' } });
}
