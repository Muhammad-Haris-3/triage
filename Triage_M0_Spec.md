# Triage — M0 Specification

**Milestone:** M0 — Lift proof and walking skeleton
**Author:** Muhammad Haris Khokhar
**Date:** 2026-08-19
**Status:** Not started
**Depends on:** `Triage_SRS_v1.0.md`

---

## 1. The one question

> **At a realistic follow-up capacity, does a model rank patients meaningfully
> better than simply counting how many times they have already been admitted?**

Everything else in Triage is engineering and presentation. This is the only thing
that can kill it. M0 exists to answer it in days rather than discover it in month
two, after an application has been built on top of a difference that is not
there.

**No feature engineering, no tuning, no interface work happens in M0.** M0 uses
the crudest defensible model on the crudest defensible feature set. If the lift
is real, a better model will widen it in M5. If the lift is absent at this level,
tuning is not going to rescue it, and §5 applies.

---

## 2. Scope

### In scope

- Acquire the source dataset, checksum it, commit the checksum.
- Load into PostgreSQL with `?` normalised to null.
- Apply the DC-2 exclusion (deceased / hospice) and count what it removes.
- Establish the grouped train/test split by `patient_nbr` and prove zero overlap.
- Measure the base rate before and after exclusions.
- Compute lift@k for a baseline-only ranking and for one untuned model.
- Bootstrap a confidence interval on lift@200.
- Commit `PREREGISTRATION.md` **before** any model is fitted.
- Stand up the walking skeleton: repository, CI, schema, deployed API, deployed
  page showing the single measured lift number.

### Explicitly out of scope

Feature engineering, ICD-9 grouping (DC-5 — M0 drops the diagnosis columns
entirely), hyperparameter tuning, calibration, odds ratios, per-patient
explanations, the capacity curve, the cost layer, styling, the decision memo.
All belong to M1 and later.

### Deliberate simplification

M0 uses **only numeric and low-cardinality categorical columns**, one-hot encoded
with no grouping and no interaction terms. Diagnosis codes are dropped. Any
model that cannot show lift on this feature set is unlikely to be saved by a
better one, and building the full feature pipeline before knowing that would be
the exact mistake this milestone exists to prevent.

---

## 3. Unverified facts to be measured

These are the numbers the SRS asserts or assumes but has not measured. Each M0
task resolves one or more.

| # | Unverified fact | Why it matters |
|---|---|---|
| **VER-1** | The 30-day readmission base rate after exclusions | Every downstream metric is read against it. The commonly quoted ~11% is pre-exclusion. |
| **VER-2** | How many encounters belong to patients with more than one encounter | Sizes the DC-1 leakage risk. If it is negligible the grouped split is cheap insurance; if it is large, a random split would have silently inflated everything. |
| **VER-3** | How many rows the DC-2 exclusion removes, and their readmission rate | Confirms these rows are guaranteed negatives and quantifies how much they would have flattered the model. |
| **VER-4** | Precision@200 and captured events for baseline B1 (`number_inpatient`) | The bar the project must clear. Unknown until measured. |
| **VER-5** | Precision@200, captured events, and lift@200 for an untuned model, with a bootstrap CI | **The kill question.** |

---

## 4. Tasks

### M0-T1 — Repository and CI skeleton

Create `Triage` as a **public** GitHub repository. Public is a requirement, not a
preference — unlimited Actions minutes depend on it.

```
triage/
  pipeline/            # Python: load, clean, split, evaluate
  api/                 # FastAPI, read-only role
  web/                 # Next.js
  sql/                 # schema.sql
  data/                # checksum manifest only, never the raw file
  scripts/             # bootstrap_database.py
  .github/workflows/   # ci.yml
```

CI runs lint, tests, and the leakage assertion from M0-T4 on every push. Pin
Python and every dependency version. Pin `RANDOM_SEED` in one place and import it
everywhere; no module calls a random function without it.

Add `.gitignore` for the raw data file. The dataset is CC-BY and redistributable,
but committing a 20 MB CSV to git is avoidable — commit the checksum and a
download script instead.

**Done when:** CI is green on an empty test suite and the repository is public.

---

### M0-T2 — Acquire and pin the source  *(resolves nothing on its own; enables all)*

Download dataset 296 from the UCI repository. Record:

- SHA-256 of the archive and of the extracted CSV
- Retrieval timestamp
- Row count and column count as read

Write these to `data/MANIFEST.json` and commit it. `pipeline/load.py` verifies the
checksum before reading and **fails loudly** on mismatch rather than continuing
with different data.

Load into `encounters_raw` with `?` normalised to null (DC-8). Assert 101,766
rows and 47 features on load; if the source has changed, stop and investigate
rather than adapting silently.

**Done when:** a clean clone runs one command, verifies the checksum, and lands
101,766 rows in Postgres.

---

### M0-T3 — Exclusions  *(resolves VER-1 and VER-3)*

Identify the `discharge_disposition_id` values corresponding to death and
hospice. **Read the mapping file shipped with the dataset — do not guess the
codes.** Record the exact code list in `PREREGISTRATION.md`.

Build `encounters_clean` excluding those rows, retaining the exclusion reason on
the excluded set rather than deleting it.

Publish:

- Rows before, rows excluded, rows after
- The 30-day readmission rate of the excluded rows — **expected to be zero or
  near-zero**. If it is not, the code list is wrong and must be corrected before
  proceeding.
- The 30-day base rate before and after exclusion (VER-1)

**Done when:** the excluded set has a readmission rate consistent with "cannot be
readmitted," and both base rates are recorded in the summary.

---

### M0-T4 — Grouped split  *(resolves VER-2 — the leakage guard)*

Count distinct `patient_nbr` and the number of encounters per patient. Publish
the distribution (VER-2).

Split **by patient**, 80/20, pinned seed. Write `patient_splits`.

Then write the assertion that runs in CI forever:

```
assert set(train.patient_nbr) & set(test.patient_nbr) == set()
```

Also compute, and record in the summary, what a naive random encounter-level
split would have leaked: how many test encounters would have shared a
`patient_nbr` with a training encounter. This number is not used by the pipeline.
It exists so the summary can state the size of the trap that was avoided, with
evidence.

**Done when:** the overlap assertion passes in CI and the counterfactual leakage
count is recorded.

---

### M0-T5 — Baseline measurement  *(resolves VER-4)*

On the **test set only**, rank patients by each pre-registered baseline and
compute captured events and precision at k ∈ {50, 100, 200, 500, 1000}:

- **B1** — `number_inpatient` descending *(primary)*
- **B2** — age band descending
- **B3** — `time_in_hospital` descending
- **B4** — random, averaged over 1,000 draws with the pinned seed

Ties matter. `number_inpatient` is a small integer and there will be large ties
at the cutoff. **Define the tie-breaking rule in `PREREGISTRATION.md` before
computing anything** — random within tie, averaged over draws — and state it in
the summary. An undeclared tie rule is an easy way to hand the baseline a worse
score than it deserves.

**Done when:** a table of captured events by method and k exists, and B1 is
identified as the number to beat.

---

### M0-T6 — Pre-registration  *(gate — must be committed before M0-T7)*

Write and commit `PREREGISTRATION.md` containing, at minimum:

1. Target definition (`<30` positive; `>30` and `NO` negative) and why.
2. The DC-2 discharge code list, explicitly enumerated.
3. Split strategy, ratio, and seed.
4. The four baselines and the tie-breaking rule.
5. Primary metric: **lift@200 against B1**.
6. Secondary metrics reported regardless of outcome.
7. Bootstrap procedure: resample count, level, what is resampled.
8. **The kill criterion from SRS §13.1, stated as a number, with the outcome
   that will be published if it fires.**
9. A statement that no model has been fitted at time of commit.

The git commit timestamp is the evidence. Nothing in M0-T7 begins until this is
committed and pushed.

**Done when:** `PREREGISTRATION.md` is on `main` and its commit precedes every
commit touching a model file.

---

### M0-T7 — The untuned model  *(resolves VER-5 — the critical task)*

Fit a gradient-boosted classifier with library defaults. No tuning, no search, no
class weighting, no resampling. Numeric columns plus low-cardinality
categoricals, one-hot encoded. Diagnosis columns dropped.

Score the test set. Rank. Compute captured events and precision at the same k
values as M0-T5.

Compute **lift@200 = model captured events / B1 captured events.**

Bootstrap the interval: resample the test set with replacement 2,000 times,
recomputing lift@200 on each resample, and report the 2.5th and 97.5th
percentiles. Resample **patients, not encounters** — resampling encounters would
understate the interval for the same reason a random split would leak.

Report AUC as a secondary number, for comparability with published work on this
dataset only.

**Done when:** lift@200 and its 95% interval are recorded, and the kill criterion
has been evaluated against them.

---

### M0-T8 — Walking skeleton

The thinnest deployable path, carrying exactly one number:

- **Schema** — `encounters_raw`, `encounters_clean`, `patient_splits`,
  `eval_metrics` in Neon. Application role has `SELECT` only.
- **API** — FastAPI on Render, one endpoint returning the contents of
  `eval_metrics`.
- **Web** — Next.js on Vercel, one page displaying: base rate, B1 captured
  events at k=200, model captured events at k=200, lift and its interval, and
  the row counts behind them.
- Both notices from NFR-10 present on that page from the first deploy. They are
  not added later.

No styling beyond legibility. No capacity control. No patient list.

**Done when:** the page is publicly reachable and its numbers match the
repository's output exactly.

---

### M0-T9 — Go / kill decision

Write `Triage_M0_Summary.md` recording:

- VER-1 through VER-5 as measured
- Everything that broke, and how it was diagnosed
- Decisions taken during M0 and what forced them
- **The kill criterion evaluation, stated plainly**
- Whether M1 proceeds

If the criterion fires, the summary becomes the project's primary artefact and
the milestone plan is replaced by a short write-up of the negative result. That
is a legitimate ending, decided in advance, and it is recorded here as such.

---

## 5. Acceptance criteria

| # | Criterion |
|---|---|
| AC-M0-1 | Repository public, CI green on a clean clone |
| AC-M0-2 | Checksum verified on load; mismatch fails loudly |
| AC-M0-3 | VER-1 through VER-5 measured and recorded in the summary |
| AC-M0-4 | Excluded (deceased/hospice) rows shown to have a near-zero readmission rate |
| AC-M0-5 | Patient-overlap assertion passing in CI; counterfactual leakage count recorded |
| AC-M0-6 | `PREREGISTRATION.md` committed before the first model commit, verifiable in git history |
| AC-M0-7 | Lift@200 against B1 reported with a bootstrap 95% interval, resampled at patient level |
| AC-M0-8 | Skeleton deployed; page numbers identical to repository output |
| AC-M0-9 | NFR-10 notices present on the deployed page from the first deploy |
| AC-M0-10 | Kill criterion evaluated in writing, whichever way it goes |

---

## 6. Kill criterion

**If the bootstrap 95% interval for lift@200 against B1 includes 1.0, M1 does not
start.**

The project becomes a written negative result: on this dataset, at realistic
capacity, an untuned gradient-boosted model does not reliably beat counting a
patient's prior admissions — with the measurement, the interval, and an account
of why that might be.

Three things must be true for that ending to be honest, and all three are
established before the model is fitted:

1. The criterion is committed in `PREREGISTRATION.md` in advance (M0-T6).
2. The baseline was given a fair tie-breaking rule, also declared in advance.
3. The interval is computed at patient level, not encounter level.

Without those, a null result is indistinguishable from a badly run analysis, and
publishing it would be worse than not publishing at all.

---

## 7. What M0 must not become

- A tuning exercise. If the instinct is "let me try `class_weight` and see if the
  lift improves," that is M5, and doing it here destroys the pre-registration.
- A feature-engineering exercise. Diagnosis grouping is M1.
- An interface exercise. One page, one number.
- A rescue mission. If the lift is not there at defaults, the answer is to report
  it, not to search until something clears the bar. Searching until it clears the
  bar is precisely the failure the pre-registration exists to prevent.

---

## 8. Estimated effort

| Task | Estimate |
|---|---|
| M0-T1 Repository and CI | 0.5 day |
| M0-T2 Acquire and pin | 0.5 day |
| M0-T3 Exclusions | 0.5 day |
| M0-T4 Grouped split | 0.5 day |
| M0-T5 Baselines | 1 day |
| M0-T6 Pre-registration | 0.5 day |
| M0-T7 Untuned model and bootstrap | 1 day |
| M0-T8 Walking skeleton | 1.5 days |
| M0-T9 Summary and decision | 0.5 day |
| **Total** | **~6.5 days** |

The ordering matters more than the estimates. **M0-T5 and M0-T7 answer the kill
question and can be done before the skeleton exists.** If the answer is bad, T8
is never built.
