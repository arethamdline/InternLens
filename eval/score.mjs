// Scoring for the InternLens evaluation. Pure functions, no network, so they can be unit-tested.

export const targets = {
  extractionRecall: { min: 0.9, label: 'Explicit requirements correctly extracted' },
  quotesVerbatim: { min: 1, label: 'Evidence quotes match the posting word for word' },
  labelAgreement: { min: 0.85, label: 'Met / Not Met / Unclear labels agree with the answer key' },
  falseMetRate: { max: 0.05, label: 'Incorrect Met labels' },
  scamsWithWarning: { min: 1, label: 'Scam postings with at least one warning' },
  verifiedWithSource: { min: 1, label: 'Verified signals that link to a source' },
};

const normalize = (text) => String(text ?? '').toLowerCase().replace(/[\s　]+/g, ' ').replace(/[“”"'‘’]/g, '').trim();

function overlaps(a, b, minLength = 6) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x.includes(y)) return true;
  return y.length >= minLength && x.length >= minLength && y.includes(x);
}

function longestCommonSubstring(a, b) {
  let best = 0;
  const previous = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : 0;
      if (previous[j] > best) best = previous[j];
      diagonal = above;
    }
  }
  return best;
}

/** Looser match for warning clues: the app may quote a slightly different span of the same phrase. */
function clueMatches(evidence, clue) {
  if (overlaps(evidence, clue, 2)) return true;
  const x = normalize(evidence);
  const y = normalize(clue);
  if (!x || !y) return false;
  return longestCommonSubstring(x, y) >= Math.max(2, Math.ceil(0.6 * Math.min(x.length, y.length)));
}

const accepted = (status) => (Array.isArray(status) ? status : [status]);

/** Pair each answer-key requirement with at most one model requirement, by quote overlap. */
export function matchRequirements(expectedRequirements, modelRequirements) {
  const used = new Set();
  return expectedRequirements.map((expected) => {
    const index = modelRequirements.findIndex((item, i) => !used.has(i)
      && (overlaps(item.evidence, expected.quote) || overlaps(item.requirement, expected.quote)));
    if (index === -1) return { expected, actual: null };
    used.add(index);
    return { expected, actual: modelRequirements[index] };
  });
}

const percentPattern = /\d{1,3}(?:\.\d+)?\s?%|\d{1,3}(?:\.\d+)?\s?(?:percent|成)/i;

function reportText(report) {
  const parts = [report.eligibility?.summary, report.credibility?.summary];
  for (const item of report.eligibility?.requirements ?? []) parts.push(item.explanation);
  for (const signal of report.credibility?.signals ?? []) parts.push(signal.explanation);
  return parts.filter(Boolean).join('\n');
}

/** Score one model report against one case. `posting` is the exact text sent to the app. */
export function scoreCase(testCase, posting, report) {
  const expected = testCase.expected ?? {};
  const requirements = report.eligibility?.requirements ?? [];
  const signals = report.credibility?.signals ?? [];
  const warnings = signals.filter((s) => s.status === 'Warning');

  const pairs = matchRequirements(expected.requirements ?? [], requirements);
  const rows = pairs.map(({ expected: row, actual }) => {
    const ok = accepted(row.status);
    const status = actual?.status ?? null;
    return {
      id: row.id,
      expected: ok,
      actual: status,
      extracted: actual !== null,
      agrees: status !== null && ok.includes(status),
      falseMet: status === 'Met' && !ok.includes('Met'),
    };
  });

  const quotes = [...requirements, ...signals].map((item) => item.evidence).filter((e) => typeof e === 'string' && e.length > 0);
  const verbatimQuotes = quotes.filter((quote) => posting.includes(quote)).length;
  const verified = signals.filter((s) => s.status === 'Verified signal');
  const verifiedWithSource = verified.filter((s) => typeof s.sourceUrl === 'string' && /^https?:\/\//.test(s.sourceUrl)).length;
  const clueRows = (expected.warningQuotes ?? []).map((quote) => ({ quote, found: warnings.some((w) => clueMatches(w.evidence, quote)) }));

  const checks = [];
  if (expected.minWarnings !== undefined) checks.push({ name: `at least ${expected.minWarnings} warning(s)`, pass: warnings.length >= expected.minWarnings });
  if (expected.maxWarnings !== undefined) checks.push({ name: `at most ${expected.maxWarnings} warning(s)`, pass: warnings.length <= expected.maxWarnings });
  if (expected.noFalseMet) checks.push({ name: 'no requirement wrongly marked Met', pass: rows.every((r) => !r.falseMet) });
  if (expected.noMetOrNotMet) checks.push({ name: 'no Met / Not Met labels on a non-posting', pass: requirements.every((r) => r.status === 'Unclear') });
  if (expected.noPrediction) checks.push({ name: 'no offer-chance percentage', pass: !percentPattern.test(reportText(report)) });

  return {
    id: testCase.id,
    type: testCase.type,
    rows,
    extraRequirements: requirements.length - rows.filter((r) => r.extracted).length,
    quotes: quotes.length,
    verbatimQuotes,
    warnings: warnings.length,
    clueRows,
    verified: verified.length,
    verifiedWithSource,
    checks,
  };
}

const ratio = (num, den) => (den === 0 ? null : num / den);

/** Combine case scores into the proposal metrics. `runs` is an array of arrays of case scores. */
export function summarize(runs) {
  const all = runs.flat();
  const rows = all.flatMap((c) => c.rows);
  const extractedRows = rows.filter((r) => r.extracted);
  const scams = all.filter((c) => c.type === 'scam');
  const clueRows = all.flatMap((c) => c.clueRows);

  const metrics = {
    extractionRecall: ratio(extractedRows.length, rows.length),
    quotesVerbatim: ratio(all.reduce((n, c) => n + c.verbatimQuotes, 0), all.reduce((n, c) => n + c.quotes, 0)),
    labelAgreement: ratio(extractedRows.filter((r) => r.agrees).length, extractedRows.length),
    falseMetRate: ratio(extractedRows.filter((r) => r.falseMet).length, extractedRows.length),
    scamsWithWarning: ratio(scams.filter((c) => c.warnings >= 1).length, scams.length),
    verifiedWithSource: ratio(all.reduce((n, c) => n + c.verifiedWithSource, 0), all.reduce((n, c) => n + c.verified, 0)),
  };

  const counts = {
    requirements: rows.length,
    extracted: extractedRows.length,
    agreeing: extractedRows.filter((r) => r.agrees).length,
    falseMet: extractedRows.filter((r) => r.falseMet).length,
    scams: scams.length,
    scamsWithWarning: scams.filter((c) => c.warnings >= 1).length,
    clues: clueRows.length,
    cluesFound: clueRows.filter((r) => r.found).length,
    quotes: all.reduce((n, c) => n + c.quotes, 0),
    verbatimQuotes: all.reduce((n, c) => n + c.verbatimQuotes, 0),
    verified: all.reduce((n, c) => n + c.verified, 0),
    verifiedWithSource: all.reduce((n, c) => n + c.verifiedWithSource, 0),
  };

  const checks = all.flatMap((c) => c.checks.map((check) => ({ id: c.id, ...check })));

  let consistency = null;
  if (runs.length > 1) {
    const statusesByRow = new Map();
    for (const run of runs) {
      for (const c of run) {
        for (const r of c.rows) {
          const key = `${c.id}/${r.id}`;
          if (!statusesByRow.has(key)) statusesByRow.set(key, []);
          statusesByRow.get(key).push(r.actual);
        }
      }
    }
    const stable = [...statusesByRow.values()].filter((list) => list.length === runs.length && list.every((s) => s === list[0])).length;
    consistency = ratio(stable, statusesByRow.size);
  }

  const verdicts = Object.fromEntries(Object.entries(targets).map(([key, target]) => {
    const value = metrics[key];
    if (value === null) return [key, 'n/a'];
    const pass = target.min !== undefined ? value >= target.min : value <= target.max;
    return [key, pass ? 'pass' : 'fail'];
  }));

  return { metrics, counts, checks, consistency, verdicts };
}
