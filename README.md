# InternLens

InternLens helps HKU students compare their profile with explicit internship requirements. It returns requirement-by-requirement explanations and source credibility signals. It does not rank applicants, predict hiring outcomes, or label an employer or posting “safe” or “fake”.

## Run locally

Requirements: Node.js 22+ (22.22 recommended).

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and select **Try an example** to see a fixed sample report without an API key. To run live AI analysis, configure the model gateway below. The UI supports English and Traditional Chinese.

## Try an example without an API key

The **Try an example** button fills in the fictional profile and internship description below, then shows a fixed demonstration report locally. It does not call an AI provider. This lets a fresh clone demonstrate the report format without credentials. Select **Check eligibility** to request a live analysis; that requires a configured AI provider and may take longer.

### Sample input

```json
{
  "profile": {
    "degree": "BSc Computer Science",
    "yearOfStudy": "Year 3",
    "expectedGraduation": "June 2027",
    "skills": "Python, SQL, data analysis",
    "workAuthorization": "Non-local student; unsure whether this role qualifies under my current conditions."
  },
  "jobDescription": "Summer Data Analyst Intern\n\nEligibility\n• Currently pursuing an undergraduate degree in Data Science, Statistics, Computer Science or a related discipline.\n• Expected graduation between December 2026 and June 2028.\n• Available to work full-time for 10 weeks from June 2026.\n\nWhat you bring\n• Comfortable using Python and SQL for data analysis.\n• Strong written and spoken English.\n\nThis fictional sample is for product demonstration only."
}
```

### Expected output

The fixed demo report shown by **Try an example**:

```json
{
  "eligibility": {
    "summary": "The profile matches the degree, expected graduation, and Python/SQL requirements. Availability and English proficiency are unclear based on the provided profile.",
    "requirements": [
      {
        "requirement": "Currently pursuing an undergraduate degree in Data Science, Statistics, Computer Science or a related discipline.",
        "status": "Met",
        "explanation": "The profile states BSc Computer Science and Year 3, which matches the undergraduate degree requirement.",
        "evidence": "Currently pursuing an undergraduate degree in Data Science, Statistics, Computer Science or a related discipline."
      },
      {
        "requirement": "Expected graduation between December 2026 and June 2028.",
        "status": "Met",
        "explanation": "The profile states June 2027, which falls within the stated graduation window.",
        "evidence": "Expected graduation between December 2026 and June 2028."
      },
      {
        "requirement": "Available to work full-time for 10 weeks from June 2026.",
        "status": "Unclear",
        "explanation": "The profile does not state whether the student is available for this period.",
        "evidence": "Available to work full-time for 10 weeks from June 2026."
      },
      {
        "requirement": "Comfortable using Python and SQL for data analysis.",
        "status": "Met",
        "explanation": "The profile lists Python, SQL, and data analysis.",
        "evidence": "Comfortable using Python and SQL for data analysis."
      },
      {
        "requirement": "Strong written and spoken English.",
        "status": "Unclear",
        "explanation": "The profile does not include information about English proficiency.",
        "evidence": "Strong written and spoken English."
      }
    ]
  },
  "credibility": {
    "summary": "This is a fictional example. No posting URL was supplied, so the source cannot be checked.",
    "signals": [
      {
        "signal": "No posting source link provided",
        "status": "Unclear",
        "explanation": "Only the pasted text can be reviewed; the platform and employer website cannot be checked without a link.",
        "evidence": null,
        "sourceUrl": null
      },
      {
        "signal": "Fictional demonstration posting",
        "status": "Warning",
        "explanation": "The description identifies itself as fictional and for product demonstration only.",
        "evidence": "This fictional sample is for product demonstration only.",
        "sourceUrl": null
      }
    ],
    "disclaimer": "This is a fixed demonstration report, not a live AI analysis or verification of a real vacancy."
  }
}
```

## Configure the model gateway

Live AI analysis uses server-side environment variables. Copy the example file and add the model and key provided to your group:

```sh
cp .env.example .env.local
```

Set these server-side environment variables:

- `AI_PROVIDER`: `openai-compatible` (default) or `anthropic-compatible`
- `AI_BASE_URL`: provider-compatible API base URL
- `AI_MODEL`: model ID enabled for your account
- `AI_API_KEY`: API key; keep it in `.env.local` or a secret manager

The browser never receives the key. Do not paste real credentials into source files, issues, logs, or PRs.

## Docker

```sh
cp .env.example .env.local
# Edit .env.local, then:
docker compose up --build
```

The `data/` directory is mounted for SQLite. The database contains only the source directory and a table reserved for postings whose reuse license has been confirmed. Student profiles, pasted job descriptions, and generated reports are not persisted.

## Source handling

`data/sources.json` is a source directory, not a job-posting dataset. Its `storagePolicy` field documents the current boundary:

- `link-only`: show the source link; do not crawl or store its listing text.
- `page-review-required`: check the specific page's terms and attribution requirements before importing a record. This status still blocks persistence until it is changed to `licensed`.
- `licensed`: permitted records may be stored with source and license evidence.

No automated importer is enabled until page-specific reuse permission is documented. LinkedIn and JobsDB are not integrated. Directory membership is a provenance signal only; it does not guarantee a particular employer or posting.

## API

### `GET /api/sources`
Returns the curated source directory and its storage policy metadata.

### `POST /api/analyze`
Accepts `{ profile, jobDescription, jobUrl?, locale? }`. `locale` is `en` or `zh-Hant`. Returns `eligibility.requirements[]` with `Met`, `Not Met`, or `Unclear`, exact job-description evidence, and a `credibility.signals[]` list. Invalid model quotes are discarded and the affected requirement is downgraded to `Unclear`. Requests are not cached or stored.

The analysis model is instructed to treat job text as untrusted input and ignore embedded instructions. Employment authorization rules can depend on individual circumstances; an unclear result should be checked with official guidance.

## Checks

```sh
npm test
npm run build
```

Tests use synthetic text and do not include unlicensed job listings.
