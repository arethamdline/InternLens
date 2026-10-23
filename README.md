# InternLens

InternLens helps HKU students compare their profile with explicit internship requirements. It returns requirement-by-requirement explanations and source credibility signals. It does not rank applicants, predict hiring outcomes, or label an employer or posting “safe” or “fake”.

## Run locally

Requirements: Node.js 22+ (22.22 recommended).

```sh
cp .env.example .env.local
# Edit .env.local and set AI_API_KEY and AI_MODEL.
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The UI supports English and Traditional Chinese. The sample job description is fictional.

## Configure the model gateway

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
