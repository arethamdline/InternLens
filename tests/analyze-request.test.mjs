import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnalyzeInput } from '../lib/analyze-request.ts';
import { isValidAnalysisJobId } from '../lib/analysis-job-store.ts';

test('requires a JSON object with an internship description', () => {
  assert.deepEqual(parseAnalyzeInput([]), {
    error: 'Request body must be a JSON object.',
    status: 400,
  });
  assert.deepEqual(parseAnalyzeInput({ profile: {} }), {
    error: 'Paste the internship description to continue.',
    status: 400,
  });
});

test('normalizes valid analysis input and locale', () => {
  assert.deepEqual(parseAnalyzeInput({
    profile: { degree: ' Computer Science ', skills: ' Python ' },
    jobDescription: '  Summer internship  ',
    jobUrl: ' https://example.com/jobs/1 ',
    locale: 'zh-Hant',
  }), {
    input: {
      profile: {
        degree: 'Computer Science',
        yearOfStudy: '',
        expectedGraduation: '',
        skills: 'Python',
        workAuthorization: '',
      },
      jobDescription: 'Summer internship',
      jobUrl: 'https://example.com/jobs/1',
      locale: 'zh-Hant',
    },
  });
});

test('rejects non-HTTP posting URLs', () => {
  assert.deepEqual(parseAnalyzeInput({ jobDescription: 'Internship', jobUrl: 'javascript:alert(1)' }), {
    error: 'Enter a valid HTTP or HTTPS job link.',
    status: 400,
  });
});

test('truncates fields to the API limits', () => {
  const parsed = parseAnalyzeInput({
    profile: { skills: 's'.repeat(2100) },
    jobDescription: 'd'.repeat(25000),
    jobUrl: `https://example.com/${'x'.repeat(1100)}`,
  });
  assert.ok('input' in parsed);
  assert.equal(parsed.input.profile.skills.length, 2000);
  assert.equal(parsed.input.jobDescription.length, 24000);
  assert.equal(parsed.input.jobUrl.length, 1000);
});

test('accepts only version-4 UUIDs as analysis job IDs', () => {
  assert.equal(isValidAnalysisJobId('c8abf976-f63b-46c9-810c-a3211a863f42'), true);
  assert.equal(isValidAnalysisJobId('not-a-uuid'), false);
  assert.equal(isValidAnalysisJobId(null), false);
});
