export type RequirementStatus = 'Met' | 'Not Met' | 'Unclear';
export type SignalStatus = 'Verified signal' | 'Warning' | 'Unclear';
export type Locale = 'en' | 'zh-Hant';

export interface StudentProfile {
  degree: string;
  yearOfStudy: string;
  expectedGraduation: string;
  skills: string;
  workAuthorization: string;
}

export interface RequirementResult {
  requirement: string;
  status: RequirementStatus;
  explanation: string;
  evidence: string | null;
}

export interface CredibilitySignal {
  signal: string;
  status: SignalStatus;
  explanation: string;
  evidence: string | null;
  sourceUrl: string | null;
}

export interface AnalysisResult {
  eligibility: { summary: string; requirements: RequirementResult[] };
  credibility: { summary: string; signals: CredibilitySignal[]; disclaimer: string };
}

export interface SourceRecord {
  id: string;
  name: string;
  nameZh: string;
  url: string;
  category: string;
  categoryZh: string;
  trustLevel: 'official-channel' | 'official-government' | 'university-network';
  storagePolicy: 'link-only' | 'page-review-required' | 'licensed';
  policyEvidence: string;
  policyUrl: string;
  lastReviewed: string;
}
