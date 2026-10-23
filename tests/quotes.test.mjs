import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exactQuote } from '../lib/evidence.ts';
import { redactPersonalData } from '../lib/privacy.ts';
import { canStoreJob } from '../lib/licensing.ts';
import { detectRedFlags } from '../lib/redflags.ts';
import { readFileSync } from 'node:fs';
const jobDescription = 'Currently pursuing an undergraduate degree in Computer Science.\nExpected graduation between December 2026 and June 2028.';

test('accepts exact evidence from the supplied job description', () => {
  assert.equal(exactQuote('undergraduate degree in Computer Science', jobDescription), 'undergraduate degree in Computer Science');
});

test('rejects paraphrased or invented evidence', () => {
  assert.equal(exactQuote('Must be a Computer Science student', jobDescription), null);
});

test('does not treat an empty quote as evidence', () => {
  assert.equal(exactQuote('', jobDescription), null);
});

test('redacts HKID, email, and Hong Kong phone numbers before model calls', () => {
  const text = 'Contact amy@example.com at 6123 4567. HKID A123456(7).';
  const safe = redactPersonalData(text);
  assert.equal(safe.includes('amy@example.com'), false);
  assert.equal(safe.includes('6123 4567'), false);
  assert.equal(safe.includes('A123456(7)'), false);
  assert.equal(safe.includes('[REDACTED]'), true);
});

test('only licensed source records can be persisted', () => {
  assert.equal(canStoreJob('licensed'), true);
  assert.equal(canStoreJob('link-only'), false);
  assert.equal(canStoreJob('page-review-required'), false);
});

test('keeps six synthetic profile cases and five scam examples for the MVP evaluation set', () => {
  const profiles = JSON.parse(readFileSync(new URL('./fixtures/profiles.json', import.meta.url), 'utf8'));
  const scams = JSON.parse(readFileSync(new URL('./fixtures/scams.json', import.meta.url), 'utf8'));
  assert.equal(profiles.length, 6);
  assert.equal(scams.length, 5);
  for (const sample of scams) {
    const warnings = detectRedFlags(sample.description, 'en');
    assert.ok(warnings.length > 0, `Expected a review signal for ${sample.name}`);
    assert.ok(sample.description.includes(warnings[0].evidence));
  }
});
