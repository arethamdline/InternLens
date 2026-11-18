import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scoreCase, summarize } from '../eval/score.mjs';
import { analyze, loadCases, main } from '../eval/run-eval.mjs';

const casesPath = new URL('../eval/cases.json', import.meta.url).pathname;

test('every answer-key quote appears word for word in its posting', () => {
  for (const { testCase, posting, missing } of loadCases(casesPath)) {
    if (missing) continue;
    for (const row of testCase.expected.requirements ?? []) {
      assert.ok(posting.includes(row.quote), `${testCase.id}/${row.id}: quote not found in posting`);
    }
    for (const quote of testCase.expected.warningQuotes ?? []) {
      assert.ok(posting.includes(quote), `${testCase.id}: warning quote "${quote}" not found in posting`);
    }
  }
});

const sampleCase = {
  id: 'T1',
  type: 'eligibility',
  expected: { requirements: [
    { id: 'degree', quote: 'degree in Computer Science', status: 'Met' },
    { id: 'sql', quote: 'Python and SQL', status: ['Not Met', 'Unclear'] },
    { id: 'english', quote: 'Fluent English', status: 'Unclear' },
  ] },
};
const samplePosting = 'Pursuing a degree in Computer Science.\nWorking knowledge of Python and SQL.\nFluent English.';
const report = (requirements, signals = []) => ({
  eligibility: { summary: 'Summary', requirements },
  credibility: { summary: 'Summary', signals, disclaimer: 'Informational only.' },
});

test('scores agreement, false Met, missing extraction and verbatim quotes', () => {
  const scored = scoreCase(sampleCase, samplePosting, report([
    { requirement: 'Computer Science degree', status: 'Met', explanation: '', evidence: 'Pursuing a degree in Computer Science.' },
    { requirement: 'Python and SQL', status: 'Met', explanation: '', evidence: 'Working knowledge of Python and SQL.' },
    { requirement: 'Invented requirement', status: 'Unclear', explanation: '', evidence: 'Not in the posting' },
  ]));
  assert.deepEqual(scored.rows.map((r) => [r.id, r.actual, r.agrees, r.falseMet]), [
    ['degree', 'Met', true, false],
    ['sql', 'Met', false, true],
    ['english', null, false, false],
  ]);
  assert.equal(scored.quotes, 3);
  assert.equal(scored.verbatimQuotes, 2);
  assert.equal(scored.extraRequirements, 1);
});

test('summarizes metrics and compares them with the proposal targets', () => {
  const eligibility = scoreCase(sampleCase, samplePosting, report([
    { requirement: 'Degree', status: 'Met', explanation: '', evidence: 'degree in Computer Science' },
    { requirement: 'Skills', status: 'Unclear', explanation: '', evidence: 'Python and SQL' },
    { requirement: 'English', status: 'Unclear', explanation: '', evidence: 'Fluent English' },
  ], [{ signal: 'Directory', status: 'Verified signal', explanation: '', evidence: null, sourceUrl: 'https://www.cedars.hku.hk/netjobs' }]));
  const scam = scoreCase(
    { id: 'S1', type: 'scam', expected: { minWarnings: 1, warningQuotes: ['admin fee'] } },
    'Pay an admin fee of HK$200.',
    report([], [{ signal: 'Fee', status: 'Warning', explanation: '', evidence: 'admin fee', sourceUrl: null }]),
  );
  const { metrics, verdicts, counts, checks } = summarize([[eligibility, scam]]);
  assert.equal(metrics.extractionRecall, 1);
  assert.equal(metrics.labelAgreement, 1);
  assert.equal(metrics.falseMetRate, 0);
  assert.equal(metrics.scamsWithWarning, 1);
  assert.equal(metrics.verifiedWithSource, 1);
  assert.equal(counts.cluesFound, 1);
  assert.deepEqual(new Set(Object.values(verdicts)), new Set(['pass']));
  assert.deepEqual(checks, [{ id: 'S1', name: 'at least 1 warning(s)', pass: true }]);
});

test('flags offer predictions and labels on non-postings', () => {
  const scored = scoreCase(
    { id: 'SF', type: 'safe-failure', expected: { noPrediction: true, noMetOrNotMet: true, requirements: [] } },
    'Library notice.',
    report([{ requirement: 'x', status: 'Met', explanation: 'You have a 70% chance.', evidence: null }]),
  );
  assert.deepEqual(scored.checks.map((c) => c.pass), [false, false]);
});

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push({ path, method: init.method ?? 'GET' });
    const handler = routes[path];
    if (!handler) return new Response('{}', { status: 404 });
    const { status, body } = handler(init);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { impl, calls };
}

const cannedReport = report([{ requirement: 'Degree', status: 'Met', explanation: '', evidence: null }]);

test('analyze() handles a direct local response', async () => {
  const { impl } = fakeFetch({ '/api/analyze': () => ({ status: 200, body: cannedReport }) });
  assert.deepEqual(await analyze('http://app.test', { requestId: 'x' }, { fetchImpl: impl, pollMs: 1 }), cannedReport);
});

test('analyze() follows the Netlify background flow and polls until completed', async () => {
  let polls = 0;
  const { impl, calls } = fakeFetch({
    '/api/analyze': () => ({ status: 202, body: { requestId: 'abc' } }),
    '/.netlify/functions/analyze-background': () => ({ status: 202, body: {} }),
    '/api/analyze/status': () => {
      polls += 1;
      return polls < 2 ? { status: 200, body: { status: 'pending' } } : { status: 200, body: { status: 'completed', result: cannedReport } };
    },
  });
  assert.deepEqual(await analyze('http://app.test', { requestId: 'abc' }, { fetchImpl: impl, pollMs: 1 }), cannedReport);
  assert.deepEqual(calls.map((c) => c.path), ['/api/analyze', '/.netlify/functions/analyze-background', '/api/analyze/status', '/api/analyze/status']);
});

test('analyze() reports a failed background job', async () => {
  const { impl } = fakeFetch({
    '/api/analyze': () => ({ status: 202, body: { requestId: 'abc' } }),
    '/.netlify/functions/analyze-background': () => ({ status: 202, body: {} }),
    '/api/analyze/status': () => ({ status: 200, body: { status: 'failed', error: 'Provider down' } }),
  });
  await assert.rejects(analyze('http://app.test', { requestId: 'abc' }, { fetchImpl: impl, pollMs: 1 }), /Provider down/);
});

test('main() runs selected cases end to end and writes a markdown report', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'internlens-eval-'));
  try {
    const { impl } = fakeFetch({ '/api/analyze': () => ({ status: 200, body: cannedReport }) });
    const result = await main(['--only', 'E08,S01', '--delay-ms', '0', '--out-dir', outDir], { fetchImpl: impl, log: () => {} });
    const markdown = readFileSync(result.mdPath, 'utf8');
    assert.match(markdown, /Results against proposal targets/);
    assert.match(markdown, /### E08 \(eligibility\)/);
    assert.match(markdown, /\| S01 \| at least 1 warning\(s\) \| ❌ fail \|/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('counts a warning clue when the app quotes a slightly different span of the same phrase', () => {
  const scored = scoreCase(
    { id: 'S2', type: 'scam', expected: { minWarnings: 1, warningQuotes: ['must pay HK$880', 'one-time password'] } },
    'Interns must pay HK$880 for the course.',
    report([], [{ signal: 'Fee', status: 'Warning', explanation: '', evidence: 'pay HK$880 for', sourceUrl: null }]),
  );
  assert.deepEqual(scored.clueRows.map((r) => r.found), [true, false]);
});
