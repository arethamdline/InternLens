'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { LiquidGlass } from 'simple-liquid-glass';
import { LiquidGlassScene } from 'simple-liquid-glass/backdrop';
import type { AnalysisResult, Locale, SourceRecord, StudentProfile } from '@/lib/types';

const emptyProfile: StudentProfile = { degree: '', yearOfStudy: '', expectedGraduation: '', skills: '', workAuthorization: '' };
const sampleDescription = `Summer Data Analyst Intern\n\nEligibility\n• Currently pursuing an undergraduate degree in Data Science, Statistics, Computer Science or a related discipline.\n• Expected graduation between December 2026 and June 2028.\n• Available to work full-time for 10 weeks from June 2026.\n\nWhat you bring\n• Comfortable using Python and SQL for data analysis.\n• Strong written and spoken English.\n\nThis fictional sample is for product demonstration only.`;
const lensOptions = { strength: 0.075, depth: 0.3, curvature: 0.48, bend: 0.24, bendWidth: 0.12, sheen: 0.9, sheenWidth: 3, specular: 1.5, glow: 0.1 } as const;

function GlassControl({ children, height = 44, radius = 14 }: { children: ReactNode; height?: number; radius?: number }) {
  return <LiquidGlass className="field-glass" renderer="svg" material="clear" refraction="lens" lensProfile="material" lensOptions={{ ...lensOptions, strength: 0.035, bend: 0.12 }} quality="high" scale={24} radius={radius} blur={0.8} frost={0.025} saturation={112} dispersion={10} aberrationIntensity={0.06} glassColor="rgba(255,255,255,0.07)" borderColor="rgba(255,255,255,0.76)" style={{ width: '100%', height, borderRadius: radius }}>{children}</LiquidGlass>;
}

const copy = {
  en: {
    eyebrow: 'HKU STUDENT TOOL · EARLY ACCESS', title: 'Read the requirements.\nKnow where you stand.', intro: 'A clear comparison between your profile and the words in an internship posting. No offer predictions.', profile: 'Your profile', degree: 'Degree / discipline', year: 'Year of study', graduation: 'Expected graduation', skills: 'Skills', work: 'Work authorization', immigration: 'Check HK Immigration guidance ↗', profileHint: 'Only share details you are comfortable entering for this check.', jd: 'Internship description', jdHint: 'Paste the full job description. It is analyzed for this request and not saved.', url: 'Posting link (optional)', urlHint: 'Used to check whether the domain is in the source directory.', analyze: 'Check eligibility', analyzing: 'Reading requirements…', example: 'Fill example', clear: 'Clear', results: 'Your report', eligibility: 'Eligibility', credibility: 'Source signals', sources: 'HKU & public internship sources', sourcesHint: 'A source listing confirms a channel, not that every employer or posting is genuine.', privacy: 'Sent to your configured AI provider; not stored by InternLens.', disclaimer: 'This tool explains explicit posting requirements. It does not predict hiring decisions or provide legal advice.', empty: 'Add your profile and a job description to get a requirement-by-requirement review.', requirement: 'Requirement', status: 'Status', evidence: 'Evidence from the posting', explanation: 'Why', warning: 'Review this signal', unknown: 'Unclear', verified: 'Verified signal', storage: 'Listing policy', reviewed: 'Reviewed', linkOnly: 'Link only', pageReview: 'Page review required', licensed: 'Licensed records', emptySignals: 'No additional signals returned.', lang: '繁體中文', role: 'Student details', directory: 'SOURCE DIRECTORY', error: 'Something went wrong.', validation: 'Please add the internship description.', noSaving: 'No account. No saved profile. No stored reports.', supported: 'Eligibility guidance for HKU students', selectYear: 'Select year', selectDegree: 'Select discipline', workPlaceholder: 'e.g. HKU local student / non-local student with NOL / unsure', skillsPlaceholder: 'Python, SQL, research, communication…', degreePlaceholder: 'e.g. BSc in Computer Science', yearPlaceholder: 'e.g. Year 3', gradPlaceholder: 'e.g. June 2027', reportSummary: 'The report separates explicit requirements from profile facts, and flags anything that needs checking.', startAgain: 'Check another role',
  },
  'zh-Hant': {
    eyebrow: '港大學生工具 · 早期版本', title: '看清職位要求，\n了解自己符合哪些條件。', intro: '逐項對照個人資料與實習招聘文字，不預測錄取結果。', profile: '你的資料', degree: '學位／主修', year: '就讀年級', graduation: '預計畢業日期', skills: '技能', work: '工作許可', immigration: '查看香港入境處指引 ↗', profileHint: '只需提供本次檢查所需、且你願意輸入的資料。', jd: '實習職位描述', jdHint: '貼上完整招聘內容。文字只用於本次分析，不會保存。', url: '職位連結（選填）', urlHint: '用於檢查網域是否列於來源目錄。', analyze: '檢查資格', analyzing: '正在整理要求…', example: '填入範例', clear: '清除', results: '分析報告', eligibility: '資格要求', credibility: '來源訊號', sourcesHint: '來源列入目錄只代表發布渠道可辨識，不代表每個僱主或職位都真實。', privacy: '資料會傳送至已設定的 AI 服務，但 InternLens 不會保存。', disclaimer: '本工具只解釋職位明確列出的要求，不預測錄取結果，也不提供法律意見。', empty: '填寫資料並貼上職位描述，即可逐項檢視要求。', requirement: '要求', status: '狀態', evidence: '招聘文字原文', explanation: '判斷依據', warning: '請留意此訊號', unknown: '不確定', verified: '已核實訊號', sources: '港大與公共實習來源', storage: '刊登內容政策', reviewed: '最近核查', linkOnly: '只列連結', pageReview: '需逐頁核實', licensed: '已獲授權', emptySignals: '沒有其他訊號。', lang: 'English', role: '學生資料', directory: '來源目錄', error: '暫時無法完成。', validation: '請先貼上實習職位描述。', noSaving: '無需帳戶，不保存個人資料或報告。', supported: '為港大學生提供資格要求解讀', selectYear: '選擇年級', selectDegree: '選擇學科', workPlaceholder: '例如：本地生／持有 NOL 的非本地生／不確定', skillsPlaceholder: 'Python、SQL、研究、溝通…', degreePlaceholder: '例如：計算機科學理學士', yearPlaceholder: '例如：三年級', gradPlaceholder: '例如：2027 年 6 月', reportSummary: '報告將職位明確要求與你的資料逐項對照，並標示需要確認的內容。', startAgain: '檢查另一個職位',
  },
} as const;

function Mark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M20 4 35 12.5v15L20 36 5 27.5v-15L20 4Z" stroke="currentColor" strokeWidth="1.2"/><path d="m20 10 9.5 16H10.5L20 10Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="20" cy="20" r="2" fill="currentColor"/></svg></span>;
}

function StatusPill({ status, locale }: { status: string; locale: Locale }) {
  const cls = status === 'Met' || status === 'Verified signal' ? 'good' : status === 'Not Met' || status === 'Warning' ? 'warn' : 'unknown';
  const label = locale === 'zh-Hant' ? ({ Met: '符合', 'Not Met': '不符合', Unclear: '不確定', 'Verified signal': '已核實', Warning: '警示' } as Record<string, string>)[status] : status;
  return <span className={`status ${cls}`}><i />{label || status}</span>;
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>('en');
  const [profile, setProfile] = useState<StudentProfile>(emptyProfile);
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [report, setReport] = useState<AnalysisResult | null>(null);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const t = copy[locale];

  useEffect(() => {
    fetch('/api/sources').then((response) => response.json()).then((data) => setSources(data.sources || [])).catch(() => setSources([]));
  }, []);

  const groupedSources = useMemo(() => sources, [sources]);

  function setField(key: keyof StudentProfile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setReport(null);
    if (!jobDescription.trim()) { setError(t.validation); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, jobDescription, jobUrl, locale }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || t.error);
      setReport(payload as AnalysisResult);
      window.setTimeout(() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.error);
    } finally { setLoading(false); }
  }

  function clearForm() {
    setProfile(emptyProfile); setJobDescription(''); setJobUrl(''); setReport(null); setError('');
  }

  return <LiquidGlassScene className="liquid-glass-scene">
   <main>
    <nav className="topbar-frame" aria-label="Main navigation">
      <LiquidGlass className="topbar-glass" renderer="webgl" material="clear" refraction="lens" lensProfile="material" lensOptions={lensOptions} quality="high" scale={76} radius={17} blur={0.8} frost={0.02} saturation={118} dispersion={12} aberrationIntensity={0.08} glassColor="rgba(255,255,255,0.055)" borderColor="rgba(255,255,255,0.78)" style={{ width: '100%', height: '100%', borderRadius: 17 }}>
        <div className="topbar-content"><a className="brand" href="#top"><Mark /><span>InternLens</span><b>HKU</b></a>
        <div className="nav-right"><span className="nav-note">{t.supported}</span><button className="language" onClick={() => setLocale(locale === 'en' ? 'zh-Hant' : 'en')}>{t.lang}</button></div></div>
      </LiquidGlass>
    </nav>

    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow"><span className="live-dot" />{t.eyebrow}</p>
        <h1>{t.title.split('\n').map((line, index) => <span key={line}>{line}{index === 0 && <br />}</span>)}</h1>
        <p className="intro">{t.intro}</p>
        <div className="hero-meta"><span>{locale === 'zh-Hant' ? '01 — 閱讀' : '01 — READ'}</span><span>{locale === 'zh-Hant' ? '02 — 對照' : '02 — COMPARE'}</span><span>{locale === 'zh-Hant' ? '03 — 核對' : '03 — REVIEW'}</span></div>
      </div>
      <div className="hero-orbit" aria-hidden="true"><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><LiquidGlass className="orbit-center liquid-lens" renderer="webgl" material="clear" refraction="lens" lensProfile="material" lensOptions={lensOptions} quality="high" scale={68} radius={68} blur={0.8} frost={0.02} saturation={118} dispersion={12} aberrationIntensity={0.08} glassColor="rgba(255,255,255,0.045)" borderColor="rgba(255,255,255,0.82)" style={{ width: 136, height: 136, borderRadius: 68 }}><Mark /></LiquidGlass><span className="orbit-label label-a">EXPLICIT REQUIREMENTS</span><span className="orbit-label label-b">YOUR PROFILE</span></div>
    </section>

    <div className="workspace">
      <form onSubmit={submit} className="input-column">
        <section className="form-section">
          <div className="section-heading"><div><p className="section-index">01 / {t.role}</p><h2>{t.profile}</h2></div><button type="button" className="text-button" onClick={() => { setProfile({ degree: 'BSc Computer Science', yearOfStudy: 'Year 3', expectedGraduation: 'June 2027', skills: 'Python, SQL, data analysis', workAuthorization: 'Non-local student; unsure whether this role qualifies under my current conditions.' }); setJobDescription(sampleDescription); }}>{t.example} <span>↗</span></button></div>
          <p className="section-note">{t.profileHint}</p>
          <div className="fields-grid">
            <label className="field"><span>{t.degree}</span><GlassControl><input value={profile.degree} onChange={(e) => setField('degree', e.target.value)} placeholder={t.degreePlaceholder} autoComplete="off" /></GlassControl></label>
            <label className="field"><span>{t.year}</span><GlassControl><input value={profile.yearOfStudy} onChange={(e) => setField('yearOfStudy', e.target.value)} placeholder={t.yearPlaceholder} autoComplete="off" /></GlassControl></label>
            <label className="field"><span>{t.graduation}</span><GlassControl><input value={profile.expectedGraduation} onChange={(e) => setField('expectedGraduation', e.target.value)} placeholder={t.gradPlaceholder} autoComplete="off" /></GlassControl></label>
            <label className="field"><span>{t.work} <a className="inline-source" href="https://www.immd.gov.hk/eng/services/visas/study.html" target="_blank" rel="noreferrer">{t.immigration}</a></span><GlassControl><input value={profile.workAuthorization} onChange={(e) => setField('workAuthorization', e.target.value)} placeholder={t.workPlaceholder} autoComplete="off" /></GlassControl></label>
            <label className="field span-two"><span>{t.skills}</span><GlassControl><input value={profile.skills} onChange={(e) => setField('skills', e.target.value)} placeholder={t.skillsPlaceholder} autoComplete="off" /></GlassControl></label>
          </div>
        </section>

        <section className="form-section job-section">
          <div className="section-heading"><div><p className="section-index">02 / {locale === 'zh-Hant' ? '職位資訊' : 'JOB POSTING'}</p><h2>{t.jd}</h2></div><button type="button" className="text-button" onClick={clearForm}>{t.clear} <span>×</span></button></div>
          <p className="section-note">{t.jdHint}</p>
          <label className="field"><span>{t.url}</span><GlassControl><input type="url" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="https://…" autoComplete="off" /></GlassControl></label>
          <label className="field textarea-field"><GlassControl height={210} radius={18}><textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder={locale === 'zh-Hant' ? '在此貼上職位描述…' : 'Paste the job description here…'} rows={12} /></GlassControl></label>
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="submit-row"><button type="submit" className="submit-button" disabled={loading}>{loading ? t.analyzing : t.analyze}<span aria-hidden="true">↗</span></button><span className="privacy-note"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2m-9 0h10v7H3V7Z"/></svg>{t.privacy}</span></div>
        </section>
      </form>

      <aside className="report-column" id="report">
        <div className="report-head"><p className="section-index">03 / {locale === 'zh-Hant' ? '結果' : 'RESULTS'}</p><h2>{t.results}</h2><p>{report ? t.reportSummary : t.empty}</p></div>
        {report ? <div className="report-content">
          <section className="result-group"><div className="result-title"><span className="result-number">A</span><div><p className="section-index">{locale === 'zh-Hant' ? '個人資料 × 招聘要求' : 'PROFILE × POSTING'}</p><h3>{t.eligibility}</h3></div></div><p className="result-summary">{report.eligibility.summary}</p>
            <div className="requirement-list">{report.eligibility.requirements.map((item, index) => <article className="requirement-row" key={`${item.requirement}-${index}`}><div className="requirement-top"><span className="row-number">{String(index + 1).padStart(2, '0')}</span><h4>{item.requirement}</h4><StatusPill status={item.status} locale={locale} /></div><p className="explanation">{item.explanation}</p>{item.evidence && <blockquote><span>{t.evidence}</span><q>{item.evidence}</q></blockquote>}</article>)}</div>
          </section>
          <section className="result-group credibility-group"><div className="result-title"><span className="result-number">B</span><div><p className="section-index">{locale === 'zh-Hant' ? '公開資訊' : 'PUBLIC INFORMATION'}</p><h3>{t.credibility}</h3></div></div><p className="result-summary">{report.credibility.summary}</p>
            <div className="requirement-list">{report.credibility.signals.map((signal, index) => <article className="requirement-row signal-row" key={`${signal.signal}-${index}`}><div className="requirement-top"><span className="row-number">S{String(index + 1).padStart(2, '0')}</span><h4>{signal.signal}</h4><StatusPill status={signal.status} locale={locale} /></div><p className="explanation">{signal.explanation}</p>{signal.evidence && <blockquote><span>{t.evidence}</span><q>{signal.evidence}</q></blockquote>}{signal.sourceUrl && <a className="source-proof" href={signal.sourceUrl} target="_blank" rel="noreferrer">{locale === 'zh-Hant' ? '查看來源 ↗' : 'View source ↗'}</a>}</article>)}</div><p className="disclaimer">{report.credibility.disclaimer}</p>
          </section><button className="text-button restart" onClick={clearForm}>{t.startAgain} ↗</button>
        </div> : <div className="report-placeholder"><div className="placeholder-lines"><span/><span/><span/><span/><span/></div><div className="placeholder-note"><span>—</span><p>{t.noSaving}</p></div></div>}
      </aside>
    </div>

    <section className="sources-section" id="sources"><div className="sources-intro"><p className="section-index">{t.directory} / {String(groupedSources.length).padStart(2, '0')}</p><h2>{t.sources}</h2><p>{t.sourcesHint}</p></div><div className="source-list">{groupedSources.map((source, index) => <article className="source-item" key={source.id}><span className="source-index">{String(index + 1).padStart(2, '0')}</span><div className="source-name"><a href={source.url} target="_blank" rel="noreferrer">{locale === 'zh-Hant' ? source.nameZh : source.name} <span>↗</span></a><p>{locale === 'zh-Hant' ? source.categoryZh : source.category}</p></div><div className="source-policy"><span>{t.storage}</span><p>{source.storagePolicy === 'link-only' ? t.linkOnly : source.storagePolicy === 'licensed' ? t.licensed : t.pageReview}</p></div><div className="source-policy source-date"><span>{t.reviewed}</span><p>{source.lastReviewed}</p></div><a className="policy-link" href={source.policyUrl} target="_blank" rel="noreferrer" aria-label="Review source policy">↗</a></article>)}</div></section>

    <footer className="footer"><a className="brand" href="#top"><Mark /><span>InternLens</span><b>HKU</b></a><p>{t.disclaimer}</p><a href="#sources">{t.directory} ↑</a></footer>
   </main>
  </LiquidGlassScene>;
}
