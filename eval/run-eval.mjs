#!/usr/bin/env node
// Runs the labelled cases in eval/cases.json through a running InternLens app (local or deployed)
// and writes an expected-vs-actual report scored against the proposal targets.
//
//   npm run eval -- --base-url http://localhost:3000
//   npm run eval -- --base-url https://internlens.netlify.app --runs 3
//   npm run eval -- --dry-run
//
// See eval/README.md for how to add real postings and label them.

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreCase, summarize, targets } from './score.mjs';

const evalDir = dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv) {
  const options = { baseUrl: 'http://localhost:3000', runs: 1, only: null, delayMs: 1000, timeoutMs: 180000, pollMs: 2000, outDir: join(evalDir, 'results'), dryRun: false, cases: join(evalDir, 'cases.json') };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--base-url') options.baseUrl = next().replace(/\/+$/, '');
    else if (arg === '--runs') options.runs = Math.max(1, Number(next()) || 1);
    else if (arg === '--only') options.only = next().split(',').map((s) => s.trim());
    else if (arg === '--delay-ms') options.delayMs = Number(next()) || 0;
    else if (arg === '--timeout-ms') options.timeoutMs = Number(next()) || options.timeoutMs;
    else if (arg === '--out-dir') options.outDir = next();
    else if (arg === '--cases') options.cases = next();
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(response) {
  try { return await response.json(); } catch { return undefined; }
}

/**
 * Send one analysis request the same way the browser does. Locally the app answers with the
 * report directly; on Netlify it answers 202, the client starts the background function and
 * polls the status endpoint.
 */
export async function analyze(baseUrl, body, { timeoutMs = 180000, pollMs = 2000, fetchImpl = fetch } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const first = await fetchImpl(`${baseUrl}/api/analyze`, { method: 'POST', headers, body: JSON.stringify(body) });
  const firstPayload = await readJson(first);
  if (first.status === 200) return firstPayload;
  if (first.status !== 202) throw new Error(`POST /api/analyze returned HTTP ${first.status}${firstPayload?.error ? `: ${firstPayload.error}` : ''}`);

  const requestId = typeof firstPayload?.requestId === 'string' ? firstPayload.requestId : body.requestId;
  const started = await fetchImpl(`${baseUrl}/.netlify/functions/analyze-background`, { method: 'POST', headers, body: JSON.stringify({ ...body, requestId }) });
  if (started.status !== 202) throw new Error(`Background analysis did not start (HTTP ${started.status})`);

  const deadline = Date.now() + timeoutMs;
  let serverErrors = 0;
  while (Date.now() < deadline) {
    await sleep(pollMs);
    const response = await fetchImpl(`${baseUrl}/api/analyze/status?id=${encodeURIComponent(requestId)}`, { cache: 'no-store' });
    const payload = await readJson(response);
    if (response.status >= 500) {
      serverErrors += 1;
      if (serverErrors >= 5) throw new Error(`Status checks keep failing (HTTP ${response.status})`);
      continue;
    }
    serverErrors = 0;
    if (!response.ok) throw new Error(`Status check returned HTTP ${response.status}${payload?.error ? `: ${payload.error}` : ''}`);
    if (payload?.status === 'completed') return payload.result;
    if (payload?.status === 'failed') throw new Error(`Analysis failed: ${payload.error ?? 'no reason given'}`);
  }
  throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for the analysis`);
}

export function loadCases(casesPath) {
  const casesFile = JSON.parse(readFileSync(casesPath, 'utf8'));
  const profiles = JSON.parse(readFileSync(join(evalDir, 'profiles.json'), 'utf8'));
  return casesFile.cases.map((testCase) => {
    const postingPath = join(evalDir, 'postings', testCase.posting);
    const baseProfile = profiles[testCase.profile];
    if (!baseProfile) throw new Error(`Case ${testCase.id}: unknown profile "${testCase.profile}"`);
    const missing = !existsSync(postingPath);
    return {
      testCase,
      isPrivate: testCase.posting.startsWith('private/'),
      missing,
      posting: missing ? null : readFileSync(postingPath, 'utf8').trim(),
      profile: { ...baseProfile, ...(testCase.profileOverrides ?? {}) },
    };
  });
}

const pct = (value) => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`);
const targetText = (t) => (t.min === 1 ? '100%' : t.min !== undefined ? `≥ ${t.min * 100}%` : `≤ ${t.max * 100}%`);
const mark = (verdict) => ({ pass: '✅ pass', fail: '❌ below target', 'n/a': '— not measured' }[verdict]);
const statusText = (s) => (Array.isArray(s) ? s.join(' or ') : s ?? '—');

export function renderMarkdown({ options, startedAt, summary, scored, skipped, errors, totalCases }) {
  const { metrics, counts, checks, consistency, verdicts } = summary;
  const lines = [];
  lines.push(`# InternLens evaluation — ${startedAt.slice(0, 16).replace('T', ' ')} UTC`, '');
  lines.push(`- App tested: \`${options.baseUrl}\``);
  lines.push(`- Runs per case: ${options.runs}`);
  lines.push(`- Cases: ${totalCases} in answer key · ${totalCases - skipped.length} run · ${skipped.length} skipped (posting file not on this computer) · ${errors.length} request error(s)`, '');
  lines.push('## Results against proposal targets', '');
  lines.push('| What we check | Result | Count | Target | |', '|---|---|---|---|---|');
  const countText = {
    extractionRecall: `${counts.extracted}/${counts.requirements}`,
    quotesVerbatim: `${counts.verbatimQuotes}/${counts.quotes}`,
    labelAgreement: `${counts.agreeing}/${counts.extracted}`,
    falseMetRate: `${counts.falseMet}/${counts.extracted}`,
    scamsWithWarning: `${counts.scamsWithWarning}/${counts.scams}`,
    verifiedWithSource: `${counts.verifiedWithSource}/${counts.verified}`,
  };
  for (const [key, target] of Object.entries(targets)) {
    lines.push(`| ${target.label} | ${pct(metrics[key])} | ${countText[key]} | ${targetText(target)} | ${mark(verdicts[key])} |`);
  }
  if (consistency !== null) lines.push(`| Same label on every run | ${pct(consistency)} | | ≥ 90% | ${consistency >= 0.9 ? '✅ pass' : '❌ below target'} |`);
  lines.push('', `Expected scam clues found as warnings: ${counts.cluesFound}/${counts.clues} (no target; shows how many of the warning signs we labelled the app actually raised).`, '');

  if (checks.length) {
    lines.push('## Safe-failure and credibility checks', '', '| Case | Check | Result |', '|---|---|---|');
    for (const check of checks) lines.push(`| ${check.id} | ${check.name} | ${check.pass ? '✅ pass' : '❌ fail'} |`);
    lines.push('');
  }

  lines.push('## Expected vs actual (run 1)', '');
  lines.push('Requirement IDs only; posting text is not reproduced here.', '');
  for (const entry of scored[0] ?? []) {
    lines.push(`### ${entry.id} (${entry.type})`, '');
    if (entry.rows.length) {
      lines.push('| Requirement | Expected | App said | |', '|---|---|---|---|');
      for (const row of entry.rows) {
        const verdict = !row.extracted ? '⚠️ not extracted' : row.falseMet ? '❌ false Met' : row.agrees ? '✅' : '❌';
        lines.push(`| ${row.id} | ${statusText(row.expected)} | ${row.actual ?? '—'} | ${verdict} |`);
      }
      lines.push('');
    }
    const facts = [`${entry.warnings} warning(s)`, `${entry.extraRequirements} extra requirement(s) not in the answer key`];
    if (entry.clueRows.length) facts.push(`clues found: ${entry.clueRows.filter((c) => c.found).length}/${entry.clueRows.length}`);
    lines.push(facts.join(' · '), '');
  }

  if (skipped.length) lines.push('## Skipped', '', ...skipped.map((id) => `- ${id}: posting file not found in eval/postings/private/`), '');
  if (errors.length) lines.push('## Request errors', '', ...errors.map((e) => `- ${e.id} (run ${e.run}): ${e.message}`), '');
  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2), { fetchImpl = fetch, log = console.log } = {}) {
  const options = parseArgs(argv);
  if (options.help) {
    log('Usage: npm run eval -- [--base-url URL] [--runs N] [--only E01,S02] [--delay-ms MS] [--timeout-ms MS] [--out-dir DIR] [--dry-run]');
    return null;
  }

  let loaded = loadCases(options.cases);
  if (options.only) loaded = loaded.filter((c) => options.only.includes(c.testCase.id));
  const skipped = loaded.filter((c) => c.missing).map((c) => c.testCase.id);
  const runnable = loaded.filter((c) => !c.missing);

  if (options.dryRun) {
    log(`${loaded.length} case(s) in the answer key; ${runnable.length} runnable; ${skipped.length} skipped (missing posting): ${skipped.join(', ') || 'none'}`);
    for (const c of runnable) log(`  ${c.testCase.id.padEnd(5)} ${c.testCase.type.padEnd(12)} ${c.testCase.posting}`);
    return null;
  }

  const startedAt = new Date().toISOString();
  const stamp = startedAt.slice(0, 16).replace(/[:T]/g, '-');
  const rawDir = join(options.outDir, 'raw', stamp);
  mkdirSync(rawDir, { recursive: true });

  const scored = [];
  const errors = [];
  for (let run = 1; run <= options.runs; run += 1) {
    const runScores = [];
    for (const c of runnable) {
      const { testCase } = c;
      log(`Run ${run}/${options.runs} · ${testCase.id} …`);
      const body = { profile: c.profile, jobDescription: c.posting, jobUrl: testCase.jobUrl ?? '', locale: testCase.locale ?? 'en', requestId: randomUUID() };
      try {
        const report = await analyze(options.baseUrl, body, { timeoutMs: options.timeoutMs, pollMs: options.pollMs, fetchImpl });
        writeFileSync(join(rawDir, `${testCase.id}-run${run}.json`), JSON.stringify(report, null, 2));
        const score = scoreCase(testCase, c.posting, report);
        // Real postings cannot be republished, so keep their clue phrases out of the saved results.
        if (c.isPrivate) score.clueRows = score.clueRows.map(({ found }, index) => ({ quote: `clue ${index + 1}`, found }));
        runScores.push(score);
      } catch (error) {
        errors.push({ id: testCase.id, run, message: error instanceof Error ? error.message : String(error) });
        log(`  ${testCase.id} failed: ${errors.at(-1).message}`);
      }
      if (options.delayMs) await sleep(options.delayMs);
    }
    scored.push(runScores);
  }

  const summary = summarize(scored);
  const markdown = renderMarkdown({ options, startedAt, summary, scored, skipped, errors, totalCases: loaded.length });
  mkdirSync(options.outDir, { recursive: true });
  const mdPath = join(options.outDir, `eval-${stamp}.md`);
  const jsonPath = join(options.outDir, `eval-${stamp}.json`);
  writeFileSync(mdPath, markdown);
  writeFileSync(jsonPath, JSON.stringify({ startedAt, baseUrl: options.baseUrl, runs: options.runs, skipped, errors, summary, cases: scored }, null, 2));
  log(`\nReport: ${mdPath}\nRaw model outputs (not committed): ${rawDir}`);
  return { summary, mdPath, jsonPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
