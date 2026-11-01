import type { AnalysisResult, StudentProfile } from './types';

export const demoProfile = {
  degree: 'BSc Computer Science',
  yearOfStudy: 'Year 3',
  expectedGraduation: 'June 2027',
  skills: 'Python, SQL, data analysis',
  workAuthorization: 'Non-local student; unsure whether this role qualifies under my current conditions.',
} satisfies StudentProfile;

export const demoJobDescription = `Summer Data Analyst Intern

Eligibility
• Currently pursuing an undergraduate degree in Data Science, Statistics, Computer Science or a related discipline.
• Expected graduation between December 2026 and June 2028.
• Available to work full-time for 10 weeks from June 2026.

What you bring
• Comfortable using Python and SQL for data analysis.
• Strong written and spoken English.

This fictional sample is for product demonstration only.`;

export const demoReport = {
  eligibility: {
    summary: 'The profile matches the degree, expected graduation, and Python/SQL requirements. Availability and English proficiency are unclear based on the provided profile.',
    requirements: [
      {
        requirement: 'Currently pursuing an undergraduate degree in Data Science, Statistics, Computer Science or a related discipline.',
        status: 'Met',
        explanation: 'The profile states BSc Computer Science and Year 3, which matches the undergraduate degree requirement.',
        evidence: 'Currently pursuing an undergraduate degree in Data Science, Statistics, Computer Science or a related discipline.',
      },
      {
        requirement: 'Expected graduation between December 2026 and June 2028.',
        status: 'Met',
        explanation: 'The profile states June 2027, which falls within the stated graduation window.',
        evidence: 'Expected graduation between December 2026 and June 2028.',
      },
      {
        requirement: 'Available to work full-time for 10 weeks from June 2026.',
        status: 'Unclear',
        explanation: 'The profile does not state whether the student is available for this period.',
        evidence: 'Available to work full-time for 10 weeks from June 2026.',
      },
      {
        requirement: 'Comfortable using Python and SQL for data analysis.',
        status: 'Met',
        explanation: 'The profile lists Python, SQL, and data analysis.',
        evidence: 'Comfortable using Python and SQL for data analysis.',
      },
      {
        requirement: 'Strong written and spoken English.',
        status: 'Unclear',
        explanation: 'The profile does not include information about English proficiency.',
        evidence: 'Strong written and spoken English.',
      },
    ],
  },
  credibility: {
    summary: 'This is a fictional example. No posting URL was supplied, so the source cannot be checked.',
    signals: [
      {
        signal: 'No posting source link provided',
        status: 'Unclear',
        explanation: 'Only the pasted text can be reviewed; the platform and employer website cannot be checked without a link.',
        evidence: null,
        sourceUrl: null,
      },
      {
        signal: 'Fictional demonstration posting',
        status: 'Warning',
        explanation: 'The description identifies itself as fictional and for product demonstration only.',
        evidence: 'This fictional sample is for product demonstration only.',
        sourceUrl: null,
      },
    ],
    disclaimer: 'This is a fixed demonstration report, not a live AI analysis or verification of a real vacancy.',
  },
} satisfies AnalysisResult;
