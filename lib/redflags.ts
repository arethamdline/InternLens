import type { CredibilitySignal } from './types';

/**
 * Cautious phrase checks that supplement the model. They raise review signals only;
 * they never classify a posting as fake. Every evidence value is an exact substring
 * of the posting, so it passes the same verbatim-quote rule as model output.
 */

interface FlagRule {
  key: string;
  patterns: RegExp[];
  /** Skip a match when the same sentence, before the match, negates it ("We never charge a fee"). */
  negationGuard: boolean;
}

// Words that mean "this does not happen" or "this only happens after an offer", checked
// in the text between the start of the sentence and the match.
const negationContext = /\b(?:no|not|never|without|free of|don['’]t|do not|does not|doesn['’]t|will not|won['’]t|cannot|can['’]t)\b|(?:after\s+(?:you\s+)?(?:have\s+)?(?:sign|accept|receiv)|upon\s+(?:signing|accepting|acceptance)|once\s+(?:you\s+)?(?:have\s+)?(?:sign|accept))|不會|不收|毋須|無須|無需|不需|不用|免收|免費|簽約後|入職後|錄取後|獲聘後|接受聘用後/i;

// Chinese clause commas also end the window, so 「無需經驗，只限WhatsApp」 is not read as a negation.
const sentenceBoundary = /[.!?。！？;；，、\n]/;

const money = String.raw`(?:HK\$|HKD\s?|\$)\s?[\d,]+(?:\.\d+)?`;

const flagRules: FlagRule[] = [
  {
    key: 'fee',
    negationGuard: true,
    patterns: [
      /\b(?:application|registration|recruitment|admin(?:istrative|istration)?|processing|handling|training|onboarding|placement|enrol(?:l)?ment|certification|uniform|material(?:s)?)\s+(?:fee|fees|charge|charges)\b/i,
      new RegExp(String.raw`\bpay\s+(?:an?\s+|the\s+)?${money}\s+(?:for|to|as|before)\b`, 'i'),
      /\b(?:must|need to|needs to|required to|have to|has to|asked to)\s+pay\b/i,
      /\bpay\s+(?:a|an|the)\s+(?:\w+\s+)?fee\b/i,
      /(?:申請|報名|手續|行政|培訓|訓練|登記|制服|資料|教材|認證|入職)費/,
      /(?:需|須|必須|要|請先|請)\s?先?\s?(?:繳付|繳交|支付|付款)/,
    ],
  },
  {
    key: 'deposit',
    negationGuard: true,
    patterns: [
      /\b(?:refundable|security|commitment|good[- ]faith)\s+deposit\b/i,
      new RegExp(String.raw`\bdeposit\s+of\s+${money}`, 'i'),
      /\bdeposit\s+(?:is|will be)\s+(?:required|needed|payable)\b/i,
      /\bpay\s+(?:a|an|the)\s+deposit\b/i,
      /按金|保證金|押金/,
    ],
  },
  {
    key: 'transfer',
    negationGuard: true,
    patterns: [
      /\b(?:transfer|wire|deposit)\s+(?:the\s+)?(?:money|funds|fee|payment)\b/i,
      new RegExp(String.raw`\btransfer\s+${money}`, 'i'),
      /\b(?:via|by|through)\s+(?:FPS|PayMe|bank transfer)\s+to\b/i,
      /轉帳|轉賬|過數|入數|轉數快/,
    ],
  },
  {
    key: 'purchase',
    negationGuard: true,
    patterns: [
      /\b(?:buy|purchase)\s+(?:(?:a|an|the|your|any|our)\s+)?(?:gift\s+cards?|equipment|laptop|computer|starter\s+kit|training\s+(?:package|course|kit))\b/i,
      /\bthrough\s+our\s+(?:assigned|designated|appointed)\s+vendor\b/i,
      /(?:購買|自購|自費購買)(?:指定)?的?(?:器材|電腦|手提電腦|筆記本電腦|課程|套裝|禮品卡)/,
    ],
  },
  {
    key: 'crypto',
    negationGuard: true,
    patterns: [
      /\b(?:buy|purchase|send|transfer|deposit|pay)\b[^.!?\n]{0,40}?\b(?:crypto(?:currency)?|bitcoin|BTC|USDT|USDC)\b/i,
      /\b(?:crypto(?:currency)?|bitcoin)\s+(?:wallet|payment|deposit)\b/i,
      /\bcompany\s+wallet\b/i,
      /(?:購買|轉|存入|發送)[^。！？\n]{0,15}?(?:加密貨幣|虛擬貨幣|比特幣|USDT)/,
    ],
  },
  {
    key: 'banking-credentials',
    negationGuard: true,
    patterns: [
      /\b(?:online|internet)\s+banking\s+(?:login|password|PIN|username|credentials?)\b/i,
      /\bbank(?:ing)?\s+(?:password|PIN)\b/i,
      /\b(?:share|send|provide|give|forward|tell)\b[^.!?\n]{0,30}?\b(?:one-time password|OTP|SMS code|verification code)\b/i,
      /(?:網上銀行|網銀)(?:密碼|登入|帳號|賬號)/,
      /(?:提供|發送|告訴|轉發)[^。！？\n]{0,10}?(?:一次性密碼|驗證碼|OTP)/,
    ],
  },
  {
    key: 'bank-account',
    negationGuard: true,
    patterns: [
      /\b(?:provide|send|submit|share|give)\s+(?:us\s+)?(?:with\s+)?(?:your\s+)?(?:bank\s+account|bank\s+card|ATM\s+card|account\s+number)/i,
      /(?:提供|交出|發送|傳送)(?:你的|閣下的)?[^。！？\n]{0,8}?(?:銀行戶口|銀行賬戶|銀行帳戶|提款卡|銀行卡)/,
    ],
  },
  {
    key: 'identity-document',
    negationGuard: true,
    patterns: [
      /\b(?:send|submit|provide|upload|share)\s+(?:us\s+)?(?:a\s+)?(?:(?:scanned\s+)?cop(?:y|ies)\s+of\s+)?(?:your\s+)?(?:passport|HKID(?:\s+card)?|ID\s+card|identity\s+(?:card|document))/i,
      /(?:提供|發送|傳送|上載|交)[^。！？\n]{0,6}?(?:身份證|身分證|護照)/,
    ],
  },
  {
    key: 'messaging-only',
    negationGuard: true,
    patterns: [
      /\b(?:only|solely|exclusively)\s+(?:via|through|on|by)\s+(?:WhatsApp|Telegram|WeChat|Signal)\b/i,
      /\b(?:WhatsApp|Telegram|WeChat)\s+only\b/i,
      /\badd\s+(?:our|the|my)\s+(?:HR|recruiter|manager|agent|supervisor|team)(?:\s+\w+)?\s+on\s+(?:WhatsApp|Telegram|WeChat)\b/i,
      /(?:只限|僅限|只可|只能|只透過|僅透過)(?:透過|經|用)?\s?(?:WhatsApp|Telegram|微信|WeChat)/i,
      /(?:加|添加)(?:我們的)?(?:HR|人事部?|招聘人員|主管)?的?\s?(?:WhatsApp|Telegram|微信)/i,
    ],
  },
  {
    key: 'no-interview',
    negationGuard: false,
    patterns: [
      /\bno\s+interview\s+(?:needed|required|necessary)\b/i,
      /\bwithout\s+(?:an?\s+)?interview\b/i,
      /免面試|毋須面試|無需面試|不用面試|不需面試/,
    ],
  },
];

// Unusually high pay is only flagged together with "no experience" or "from home",
// so a normal allowance or a skilled day rate is not flagged on its own.
const highPayPatterns: Array<{ pattern: RegExp; unit: 'day' | 'hour' }> = [
  { pattern: /(?:HK\$|HKD\s?|\$)\s?(\d[\d,]*\d|\d)(?:\.\d+)?\s*(?:\/\s*|per\s+|a\s+|each\s+)(day|hour|hr)\b/i, unit: 'day' },
  { pattern: /\b(?:daily|per[- ]day)\s+(?:pay|salary|wage|income|earnings?)\s*(?:of\s*|:\s*)?(?:HK\$|HKD\s?|\$)\s?(\d[\d,]*\d|\d)/i, unit: 'day' },
  { pattern: /\b(?:hourly|per[- ]hour)\s+(?:pay|salary|wage|rate)\s*(?:of\s*|:\s*)?(?:HK\$|HKD\s?|\$)\s?(\d[\d,]*\d|\d)/i, unit: 'hour' },
  { pattern: /日薪\s*(?:HK)?\$?\s?(\d[\d,]*\d|\d)/, unit: 'day' },
  { pattern: /時薪\s*(?:HK)?\$?\s?(\d[\d,]*\d|\d)/, unit: 'hour' },
];
const lowBarrier = /\b(?:no|without)\s+(?:prior\s+|previous\s+)?experience\b|\bfrom\s+home\b|無需經驗|毋須經驗|不需經驗|不用經驗|在家工作|在家/i;
const highPayThreshold = { day: 1000, hour: 200 };

const descriptions: Record<string, { en: [string, string]; zh: [string, string] }> = {
  fee: { en: ['Request for a fee', 'The posting asks the applicant to pay a fee. Genuine internships rarely charge applicants; verify the request through official channels before paying.'], zh: ['要求繳費', '招聘內容要求申請人繳費。正當實習一般不會向申請人收費，付款前請先透過官方渠道核實。'] },
  deposit: { en: ['Deposit requested', 'The posting asks for a deposit, even if described as refundable. Verify the recipient and purpose independently before paying.'], zh: ['要求繳交按金', '招聘內容要求繳交按金（即使聲稱可退還）。付款前請先獨立核實收款方和用途。'] },
  transfer: { en: ['Request to transfer money', 'The posting asks the applicant to transfer money. Verify the recipient and purpose independently.'], zh: ['要求轉帳', '招聘內容要求申請人轉帳，請先獨立核實收款方和用途。'] },
  purchase: { en: ['Required purchase before employment', 'The posting asks the applicant to buy something. Verify the arrangement independently before spending money.'], zh: ['要求先行購買物品', '招聘內容要求申請人購買物品，消費前請先獨立核實安排。'] },
  crypto: { en: ['Cryptocurrency payment request', 'The posting asks for a cryptocurrency purchase, transfer or wallet payment. Verify the request independently.'], zh: ['加密貨幣付款要求', '招聘內容要求購買或轉移加密貨幣，請先獨立核實。'] },
  'banking-credentials': { en: ['Request for banking login or one-time password', 'The posting asks for banking login details or a one-time password. Banks and genuine employers do not need these; do not share them.'], zh: ['索取網上銀行登入資料或一次性密碼', '招聘內容索取網上銀行登入資料或一次性密碼。銀行及正當僱主不需要這些資料，切勿提供。'] },
  'bank-account': { en: ['Bank account details requested', 'The posting asks for bank account details. Employers usually collect payroll details after a signed offer; check why they are needed now.'], zh: ['要求提供銀行戶口資料', '招聘內容要求提供銀行戶口資料。僱主一般在簽約後才收集出糧資料，請確認為何現在需要。'] },
  'identity-document': { en: ['Identity document requested early', 'The posting asks for an identity document before a confirmed offer. Check why it is needed and verify the recipient.'], zh: ['過早要求身份證明文件', '招聘內容在確認聘用前要求提供身份證明文件，請確認用途並核實收件方。'] },
  'messaging-only': { en: ['Contact only through a messaging app', 'The posting directs applicants to a messaging app instead of an official email or careers page. Check the employer through its official website.'], zh: ['只限透過即時通訊程式聯絡', '招聘內容只提供即時通訊程式聯絡，而非官方電郵或招聘網頁。請透過僱主官方網站核實。'] },
  'no-interview': { en: ['No interview', 'The posting says no interview is needed. Genuine internships usually include some selection step; verify the employer independently.'], zh: ['毋須面試', '招聘內容表示毋須面試。正當實習通常有甄選程序，請獨立核實僱主。'] },
  'high-pay': { en: ['Unusually high pay for little or no experience', 'The pay is much higher than typical internship allowances and no experience is needed. Verify the employer independently.'], zh: ['薪酬異常高而毋須經驗', '薪酬遠高於一般實習津貼，且毋須經驗，請獨立核實僱主。'] },
};

function isNegated(text: string, index: number): boolean {
  let start = index;
  while (start > 0 && !sentenceBoundary.test(text[start - 1])) start -= 1;
  return negationContext.test(text.slice(start, index));
}

function firstMatch(text: string, patterns: RegExp[], negationGuard: boolean): string | null {
  for (const pattern of patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    for (const match of text.matchAll(new RegExp(pattern.source, flags))) {
      if (match.index === undefined) continue;
      if (negationGuard && isNegated(text, match.index)) continue;
      return match[0];
    }
  }
  return null;
}

function highPayMatch(text: string): string | null {
  if (!lowBarrier.test(text)) return null;
  for (const { pattern, unit } of highPayPatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = Number(match[1].replace(/,/g, ''));
    const resolvedUnit = /hour|hr/i.test(match[2] ?? '') ? 'hour' : unit;
    if (amount >= highPayThreshold[resolvedUnit]) return match[0];
  }
  return null;
}

export function detectRedFlags(jobDescription: string, locale: string): CredibilitySignal[] {
  const zh = locale === 'zh-Hant';
  const found: Array<{ key: string; evidence: string }> = [];
  for (const rule of flagRules) {
    const evidence = firstMatch(jobDescription, rule.patterns, rule.negationGuard);
    if (evidence) found.push({ key: rule.key, evidence });
  }
  const pay = highPayMatch(jobDescription);
  if (pay) found.push({ key: 'high-pay', evidence: pay });

  return found.map(({ key, evidence }) => {
    const [signal, explanation] = descriptions[key][zh ? 'zh' : 'en'];
    return { signal, status: 'Warning' as const, explanation, evidence, sourceUrl: null };
  });
}
