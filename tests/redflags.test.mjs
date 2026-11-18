import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectRedFlags } from '../lib/redflags.ts';

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

// scams-realistic.json was written before the rules were changed, but the same person then
// tuned the rules against it, so it is a development set. For an unbiased number, score the
// full app on postings a different team member writes (see eval/README.md).
test('flags every realistic scam line with verbatim evidence (development set)', () => {
  for (const sample of load('scams-realistic.json')) {
    const warnings = detectRedFlags(sample.description, sample.locale);
    assert.ok(warnings.length > 0, `Expected a review signal for: ${sample.name}`);
    for (const warning of warnings) {
      assert.equal(warning.status, 'Warning');
      assert.ok(sample.description.includes(warning.evidence), `Evidence must be a verbatim substring for: ${sample.name}`);
    }
  }
});

test('does not flag legitimate lines, including negated fee and deposit statements', () => {
  for (const sample of load('legit-phrases.json')) {
    const warnings = detectRedFlags(sample.description, sample.locale);
    assert.deepEqual(warnings.map((w) => w.signal), [], `Unexpected warning for: ${sample.name}`);
  }
});

test('negation only applies within the same sentence', () => {
  const text = 'We never ask for bank details by phone. Pay an admin fee of HK$200 to confirm your offer.';
  assert.equal(detectRedFlags(text, 'en').length, 1);
});

test('high pay is flagged only together with a low barrier to entry', () => {
  assert.equal(detectRedFlags('Allowance: HK$1,200 per day for qualified engineers.', 'en').length, 0);
  assert.equal(detectRedFlags('HK$1,200 per day, no experience needed.', 'en').length, 1);
  assert.equal(detectRedFlags('HK$90 per hour, no experience needed.', 'en').length, 0);
});

test('returns one signal per rule and explains it in the requested language', () => {
  const [signal] = detectRedFlags('入職前需繳付HK$500培訓費。', 'zh-Hant');
  assert.equal(signal.signal, '要求繳費');
  assert.match(signal.explanation, /官方渠道/);
});
