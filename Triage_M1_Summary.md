# Triage — M1 Summary: The comparison application

**Milestone:** M1 — The comparison application
**Author:** Muhammad Haris Khokhar
**Date:** 2026-08-19
**Status:** Complete. Deployed.
**Depends on:** `Triage_M1_Spec.md`, `Triage_M0_Summary.md`

---

## 1. Exit criterion

M1 asked:

> **Can a visitor who knows nothing about this project discover the finding by
> using the interface, without reading the README?**

**Yes.** The landing view is the capacity control and the method comparison. A
visitor sets a capacity and sees, in one screen, that age performs barely above
random, that one column performs three times better, and that the model's higher
number carries a badge reading *not distinguishable* and an interval spanning 1.0.

Nothing has to be read first for the finding to land.

| | |
|---|---|
| Application | https://triage-brown.vercel.app |
| API | https://triage-jws2.onrender.com |
| Database | Neon PostgreSQL, free tier |

---

## 2. What was built

| Task | Status |
|---|---|
| M1-T1 Scoring export | Done. 19,765 patients, tie-averaged curves for k = 1…2000, calibration, odds ratios. |
| M1-T2 Schema and loader | Done. 194,399 rows across five tables. Read-only role created and verified. |
| M1-T3 API | Done. Five endpoints, 15 tests. |
| M1-T4 Application | Done. Four views, Next.js 16. |
| M1-T5 Deployment | Done. Vercel + Render + Neon, all free tier. |
| M1-T6 Summary | This document. |

The M0 split is reproduced exactly by replaying the same generator call sequence,
asserted on every run: `(len(tr), len(te)) == (79578, 19765)`. The gradient
boosting model reproduces AUC 0.6680 to four decimals. **No model was retrained,
retuned or reinterpreted in M1.**

---

## 3. Verification performed

### 3.1 The application serves the published numbers

`api/test_api.py` reads `analysis/m0_results.json` and asserts the API returns the
same figures. If the export ever drifts from the published measurements, the
suite fails rather than the site quietly disagreeing with the paper.

15 tests, all passing, covering: row counts, captured@200 for every method
against M0, base rate, NFR-12 (model never recommended), NFR-13 (averaged and
single-draw counts as separate fields), NFR-10 (notices on every view), the CORS
boundary in both directions, and that the API role cannot write.

### 3.2 The read-only grant is tested, not assumed

`analysis/m1_load.py` creates `triage_app` with `SELECT` only, then **connects as
that role and attempts a `DELETE`**, aborting the load if it succeeds. The API
additionally opens every transaction `READ ONLY`. Two locks; the grant is the
real one.

### 3.3 Deployed, end to end

All four routes return 200. All five endpoints return 200, sub-1.5s once warm.
CORS returns `access-control-allow-origin: https://triage-brown.vercel.app` for
the real origin. At 375px there is no page-level horizontal overflow; wide tables
scroll inside their own container.

---

## 4. Problems found

### 4.1 The loader rotated the application password on every run

`m1_load.py` minted a fresh password with `secrets.token_urlsafe` each time it
executed. A routine data reload therefore **silently invalidated the credential
already configured in Render**.

The failure mode is the interesting part. Immediately after the rotation the
deployed API kept answering `200`, because Neon's pooler was still holding an
authenticated connection. It only failed **46 seconds into the next cold start**,
long after the change that caused it. A reload and an outage were separated by
hours and by a restart, which is precisely the kind of gap that makes a fault
hard to attribute.

Fixed: the loader reuses the existing password when the role already exists.
Rotation is now explicit — `python analysis/m1_load.py --rotate` — and the flag's
help text states that the deployed service must be updated afterwards.

### 4.2 Reason labels ignored the direction of the coefficient

The call list rendered **"0 outpatient visit(s) in the past year"** as a reason a
patient was *high* risk.

Arithmetically correct: outpatient visits carry an odds ratio of 0.991, so the
factor contributes to risk when it is *low*. But presented as a bare value it
reads as a bug, and a reader who spots one apparent bug reasonably doubts the
rest.

Fixed with two label sets chosen by the sign of the fitted coefficient:
protective factors now read *"little or no outpatient follow-up (0 visits)"*.

**Only visible by reading the rendered page.** The API response was correct
throughout, and every test passed.

### 4.3 Neon's pooled endpoint rejects connection options

`options=-c default_transaction_read_only=on` fails outright against the pooled
host — PgBouncer answers `unsupported startup parameter`. Session-level `SET`
does not reliably survive transaction pooling either. `SET TRANSACTION READ ONLY`
as the first statement of each transaction is the form that works through both.

### 4.4 `CREATE ROLE` does not accept bind parameters

`CREATE ROLE ... PASSWORD %s` raises `syntax error at or near "$1"`. Utility
statements take no parameters. The password is composed with
`psycopg.sql.Literal`, never concatenated. This is the same class of failure as
the `DO $$` block in GridCast M0.

### 4.5 Deployment took four attempts, each a different cause

| Attempt | Cause |
|---|---|
| 1 | Render defaulted to Python 3.14.3; `psycopg[binary]` and `pydantic-core` ship no wheels for it |
| 2 | `.python-version` alone did not take; `PYTHON_VERSION` env var did |
| 3 | Render's default build command reads `requirements.txt` at the repo root, which did not exist |
| 4 | Succeeded |

Fixed in the repository rather than the dashboard: a root `requirements.txt`
forwarding to `api/requirements.txt`, so the default build command works on a
fresh service with no configuration.

### 4.6 CORS excluded the loopback address used by the preview

The regex allowed `localhost:3000` and `*.vercel.app`. The preview ran on
`127.0.0.1:3111` and every request failed with an opaque `TypeError: Failed to
fetch`. Widened to either loopback name on any port, with six parametrised tests
asserting the boundary — including that `https://vercel.app.evil.com` is refused,
which holds because Starlette *fullmatches* the Origin header.

### 4.7 Next.js 15.1.6 was flagged as vulnerable

Vercel's build log flagged it. Upgraded to 16.3.1 with React 19.2.8;
`npm audit --omit=dev` reports zero vulnerabilities.

---

## 5. Decisions taken during M1

### 5.1 The API refuses to hand out the model's number bare

`/comparison` sorts by captured events, so the model sorts **first** — 94.0
against 88.9. That ordering is factually correct and is exactly the misreading
this project exists to argue against.

Rather than reorder the list dishonestly, the model's record carries
`distinguishable_from_recommended: false`, its lift, its interval, an advisory,
and a `display_rule` forbidding the point estimate without the interval. Two
tests fail if any of that is removed.

A frontend can still ignore it. It cannot claim it was not told.

### 5.2 The patient list is served from prior admissions, not the model

The inversion of the original plan, and the point of it. An application serving
the model's list while a page elsewhere conceded the model does not work would be
dishonest by construction.

### 5.3 No cost layer was built

SRS FR-18 allowed a user-supplied cost and effectiveness input. It was dropped.
The data cannot support an effectiveness figure, and a slider producing a dollar
number would be the exact failure NFR-11 exists to prevent — an assumption
wearing a measurement's authority. **There is no money figure anywhere in the
deployed application.**

---

## 6. What M1 did not do

- No repeated cross-validation. The single-split limitation in `METHODS.md` §1.2
  stands unchanged.
- No calibration of the gradient boosting model. Displayed risks come from the
  logistic model, whose Brier score (0.0995 against 0.1026 for base-rate-only)
  justifies showing them as numbers.
- No authentication, no patient lookup, no live data. All out of scope by design.

---

## 7. Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-19 | M1 complete and deployed. |
