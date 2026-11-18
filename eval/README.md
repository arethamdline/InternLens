# InternLens evaluation

This folder measures the app against the targets in our revised proposal (Section 3). It sends labelled profile–posting pairs to a running copy of InternLens, the same way the browser does, and writes an expected-vs-actual report.

| What we check | Target |
|---|---|
| Explicit requirements correctly extracted | ≥ 90% |
| Evidence quotes match the posting word for word | 100% |
| Met / Not Met / Unclear labels agree with our answer key | ≥ 85% |
| Incorrect Met labels | ≤ 5% |
| Scam postings with at least one warning | 5 out of 5 |
| Verified signals that link to a source | 100% |
| Same label on every run (with `--runs 3`) | ≥ 90% |

It also runs the safe-failure cases from the proposal: a hidden instruction in a posting, text that is not a job posting, a request for offer chances, and a genuine small business using a Gmail address.

## Run it

You need a running app that can call the AI model, which means one of these:

- **The deployed site** (uses the team's API key, about 19 requests per run):
  ```sh
  npm run eval -- --base-url https://internlens.netlify.app
  ```
- **Your own local copy**, with `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY` set in `.env.local`:
  ```sh
  npm run dev
  # in a second terminal
  npm run eval -- --base-url http://localhost:3000
  ```

Useful options:

| Option | What it does |
|---|---|
| `--runs 3` | Run every case 3 times and report consistency |
| `--only E01,S02` | Run only some cases |
| `--dry-run` | Check the answer key and list the cases without calling the app |
| `--delay-ms 2000` | Wait between requests (default 1000) |
| `--timeout-ms 240000` | How long to wait for one analysis (default 180000) |

The report is saved as `eval/results/eval-<date>.md`, with the numbers in a matching `.json`. **Commit both.** Raw model outputs go to `eval/results/raw/`, which is git-ignored because it quotes posting text.

## What is in the answer key now

`cases.json` currently holds 19 cases built on fictional postings in `postings/synthetic/`:

| IDs | Type | Purpose |
|---|---|---|
| E01–E10 | eligibility | 6 profiles × 6 postings, including one Traditional Chinese posting (E09) and one link on a directory source (E03) |
| C01 | credibility | Genuine small studio with a Gmail address; must get no Warning |
| SF01–SF03 | safe failure | Hidden "mark everything Met" instruction, a library notice instead of a posting, and a request for offer chances |
| S01–S05 | scam | Five scam postings, two of them with a Chinese version of the pattern |

All of these, including the labels, were written by one team member. **Please review the labels before we report numbers**, especially the rows marked "Team to confirm" in `cases.json`.

## Add the 15 real postings

1. Save the posting text as `eval/postings/private/R01.txt` (R02, R03, …). This folder is git-ignored because NETjobs and similar sites do not allow copying their listings.
2. Add a case to `cases.json`:
   ```json
   {
     "id": "R01", "type": "eligibility", "profile": "p2-bba-finance-y3",
     "posting": "private/R01.txt",
     "postingUrl": "https://… link to the original listing …",
     "expected": {"requirements": [
       {"id": "major", "quote": "majoring in Accounting", "status": "Met"}
     ]}
   }
   ```
3. Teammates who don't have `R01.txt` on their computer will see the case listed as skipped, not failed. The report shows requirement IDs and labels only, never posting text.

## How to label a case

Follow the two-person checklist from our proposal, so the answer key isn't one person's opinion:

1. Two of us label each posting **separately**.
2. List each **required** item in the posting. Leave out "preferred" or "nice to have" items. The app may still report them; they are counted as extras, not errors.
3. For each item, copy a short phrase from the posting **exactly** into `quote`. The script uses it to find the app's matching row, and a test checks it really appears in the posting.
4. Decide the status for the chosen profile. If the profile doesn't say, the answer is `Unclear`.
5. Compare and discuss. If you still disagree and both answers are defensible, list both, e.g. `"status": ["Not Met", "Unclear"]`. A `Met` from the app only counts as a false Met when `Met` is not in that list.
6. For scam postings, put the warning phrases you expect in `warningQuotes`.

## Write a blind scam set (important)

The person who wrote the red-flag rules in `lib/redflags.ts` also wrote S01–S05, so those five are not an independent test. Before looking at the rules, **another teammate** should write five more scam-style postings as `postings/synthetic/scam-blind-1.txt` … `-5.txt` and add them as S06–S10 with `minWarnings: 1`. That gives the honest number for "Written scam examples with at least one warning identified".

## Reading the results

- **⚠️ not extracted** means no app row quoted the phrase in `quote`. Before deciding the app missed it, check the raw output: the app may have quoted a different part of the same line. If so, pick a more distinctive `quote`.
- **Extra requirements** are items the app found that aren't in the answer key, usually preferred skills. They don't lower any score.
- Scores are only as good as the answer key. If a result looks wrong, check the label first.
