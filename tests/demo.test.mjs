import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demoJobDescription, demoProfile, demoReport } from '../lib/demo.ts';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

function readJsonSection(title) {
  const section = readme.split(`### ${title}`)[1];
  assert.ok(section, `README section "${title}" exists`);
  const match = section.match(/```json\s*([\s\S]*?)```/);
  assert.ok(match, `README section "${title}" contains a JSON example`);
  return JSON.parse(match[1]);
}

test('README example input matches the no-key demo input', () => {
  assert.deepEqual(readJsonSection('Sample input'), {
    profile: demoProfile,
    jobDescription: demoJobDescription,
  });
});

test('README expected output matches the no-key demo report', () => {
  assert.deepEqual(readJsonSection('Expected output'), demoReport);
});
