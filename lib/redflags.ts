import type { CredibilitySignal } from './types';

const flagRules = [
  { pattern: /\b(?:application|registration|recruitment)\s+fee\b/i, key: 'application-fee' },
  { pattern: /\bpay\s+(?:a|the)\s+(?:training|application|registration)\s+fee\b/i, key: 'upfront-fee' },
  { pattern: /\b(?:transfer|wire|deposit)\s+(?:the\s+)?(?:money|funds|fee|payment)\b/i, key: 'transfer' },
  { pattern: /\b(?:buy|purchase)\s+(?:gift cards?|crypto(?:currency)?|equipment|a laptop)\b/i, key: 'purchase' },
  { pattern: /\b(?:crypto(?:currency)?|bitcoin)\s+(?:wallet|payment|deposit)\b/i, key: 'crypto' },
  { pattern: /\b(?:send|submit)\s+(?:your\s+)?(?:passport|HKID|identity document)\s+before\s+(?:the\s+)?interview\b/i, key: 'identity-before-interview' },
];

const descriptions: Record<string, { en: [string, string]; zh: [string, string] }> = {
  'application-fee': { en: ['Request for an application fee', 'The posting mentions an application fee. Verify the request independently before paying.'], zh: ['要求繳交申請費', '招聘內容提及申請費。付款前請先透過官方渠道獨立核實。'] },
  'upfront-fee': { en: ['Upfront fee request', 'The posting asks for a fee before the work begins. Verify the request independently.'], zh: ['預先收費要求', '招聘內容要求在工作開始前繳費，請先透過官方渠道獨立核實。'] },
  transfer: { en: ['Request to transfer money', 'The posting asks the applicant to transfer money or funds. Verify the recipient and purpose independently.'], zh: ['要求轉帳', '招聘內容要求申請人轉帳，請先獨立核實收款方和用途。'] },
  purchase: { en: ['Required purchase before employment', 'The posting asks the applicant to purchase an item. Verify the arrangement independently before spending money.'], zh: ['要求先行購買物品', '招聘內容要求申請人購買物品，消費前請先獨立核實安排。'] },
  crypto: { en: ['Cryptocurrency payment request', 'The posting mentions a cryptocurrency wallet or payment. Verify the request independently.'], zh: ['加密貨幣付款要求', '招聘內容提及加密貨幣錢包或付款，請先獨立核實。'] },
  'identity-before-interview': { en: ['Identity document requested before interview', 'The posting requests an identity document before an interview. Check why it is needed and verify the recipient.'], zh: ['面試前要求身份證明文件', '招聘內容要求在面試前提供身份證明文件，請確認用途並核實收件方。'] },
};

/** Cautious phrase checks supplement the model; they flag review signals, never classify a post as fake. */
export function detectRedFlags(jobDescription: string, locale: string): CredibilitySignal[] {
  const zh = locale === 'zh-Hant';
  return flagRules.flatMap(({ pattern, key }) => {
    const match = jobDescription.match(pattern);
    if (!match || match.index === undefined) return [];
    const [signal, explanation] = descriptions[key][zh ? 'zh' : 'en'];
    return [{ signal, status: 'Warning' as const, explanation, evidence: match[0], sourceUrl: null }];
  });
}
