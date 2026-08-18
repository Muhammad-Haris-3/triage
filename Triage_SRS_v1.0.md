# Triage — Software Requirements Specification v1.0

**Project:** Triage — Capacity-Constrained Readmission Targeting
**Author:** Muhammad Haris Khokhar
**Date:** 2026-08-19
**Status:** Approved for M0

---

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for **Triage**, a full-stack analytics
application that answers a question hospitals actually face:

> *We can follow up with 200 discharged patients this month. Which 200?*

The deliverable is **a targeting decision and a measured comparison against the
rule hospitals use today**, delivered through a working web application. The
model exists to produce the ranking; the ranking exists to produce the decision.

**The project's claim is not "my model is accurate."** Accuracy is the wrong
metric here and this document treats it as one — see §11.2. The claim is: *at a
fixed operational capacity, this ranking reaches measurably more of the patients
who actually returned than the simple rules currently in use, and here is the
magnitude of that difference with an interval around it.*

### 1.2 Scope

Triage ingests a public, de-identified hospital dataset (101,766 encounters
across 130 US hospitals), cleans it under explicit and tested exclusion rules,
models 30-day readmission risk, and exposes a capacity-constrained targeting
interface: the user sets a capacity `k`, and the application returns the top `k`
patients, the reason each was selected, and the measured performance of that
selection against pre-registered baselines.

**In scope:** data acquisition and cleaning, leakage controls, exploratory
analysis, hypothesis testing with effect sizes, interpretable regression,
gradient-boosted ranking, probability calibration, capacity-constrained
evaluation (lift@k), a cost-benefit layer driven by user-supplied assumptions, a
deployed API, a deployed web application, a decision memo.

**Out of scope:** real-time or streaming ingestion, integration with any live
hospital system, authentication and multi-tenancy, deep learning, causal claims
about the effect of the follow-up programme itself (see §3.1), any use of
identifiable patient data, and any form of clinical decision support.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| **Encounter** | One hospital stay. One row of the source data. |
| **Patient** | A person, identified by `patient_nbr`. May have many encounters. |
| **Readmission** | The patient returns as an inpatient. |
| **Target event** | Readmission **within 30 days** (`readmitted == '<30'`). |
| **Capacity `k`** | The number of patients the follow-up team can contact. Fixed by staffing, not by the model. |
| **Lift@k** | True events captured in the model's top `k`, divided by true events captured in a baseline's top `k`. The primary metric. |
| **Precision@k** | Of the `k` selected, the proportion that were true events. |
| **Baseline rule** | A simple, single-variable ranking a hospital could apply without any model. |
| **Calibration** | Whether a stated risk of 40% corresponds to a 40% observed rate. |
| **Grouped split** | Train/test partition by `patient_nbr`, never by encounter. |
| **Expired disposition** | Discharge codes indicating the patient died or entered hospice. Cannot be readmitted. |

### 1.4 Intended audience

Primarily hiring managers and technical interviewers assessing analytical
capability. Sections 2, 3 and 11.2, plus the decision memo, are written to be
followed by a reader with no statistical background. Sections 6 through 12 are
written so a technical reader can reproduce every number.

---

## 2. Business context and problem statement

### 2.1 Context

Roughly **one in nine** patients discharged after a diabetes-related stay is
readmitted within 30 days. The causes are largely post-discharge failures rather
than in-hospital ones: medication regimens misunderstood or unfilled, follow-up
appointments never booked, wounds that become infected at home.

These failures are addressable. A structured follow-up call — confirming the
prescription was filled, checking the dosing schedule, booking the check-up —
targets exactly this failure mode, and is cheap relative to an inpatient stay.

**What is not cheap is the staff time.** A follow-up team has a fixed monthly
capacity, typically one to two orders of magnitude smaller than discharge volume.
Capacity is the binding constraint, and it does not move.

### 2.2 Problem statement

> A hospital discharges thousands of patients a month and can follow up with a
> few hundred. It selects them using a simple heuristic — usually age. It does
> **not** know how many of the patients it calls were actually going to return,
> how many it missed, or whether a different selection rule would do better with
> the same staff.

### 2.3 Primary business question

**Given a fixed follow-up capacity, which patients should be contacted, and how
much better is that selection than the rule in use today?**

Decomposed:

| # | Question | Method |
|---|---|---|
| BQ-1 | What is the 30-day readmission rate, and how does it vary by patient characteristics? | Descriptive |
| BQ-2 | Which recorded factors are associated with readmission, and how strongly? | Inferential, effect sizes |
| BQ-3 | Can readmission risk be ranked better than by any single simple rule? | Classification, lift@k |
| BQ-4 | Are the stated risk probabilities trustworthy as numbers, not just as an order? | Calibration |
| BQ-5 | At a given capacity `k`, how many additional true events does the model capture? | Capacity-constrained evaluation |
| BQ-6 | At what capacity does the programme stop being worth running? | Cost-benefit, user assumptions |

### 2.4 Success criteria

| # | Criterion | Threshold |
|---|---|---|
| SC-1 | Model lift over the **strongest** simple baseline at k=200 | ≥ 1.5x, with a bootstrap 95% CI excluding 1.0 |
| SC-2 | Calibration | Brier score better than the base-rate-only model; calibration curve published regardless of result |
| SC-3 | Leakage controls | Grouped-by-patient split; zero `patient_nbr` overlap between train and test, asserted in CI |
| SC-4 | Reproducibility | A clean clone reproduces every published number from a pinned seed and a checksummed input |
| SC-5 | Legibility | A non-technical reader can state the headline finding after reading the decision memo alone |
| SC-6 | Deployment | Application publicly reachable; capacity control recomputes selection and measured performance |

**SC-1 is the project.** If it fails, §13.1 applies.

---

## 3. Feasibility study

| Factor | Assessment |
|---|---|
| **Data availability** | Verified 2026-08-19. UCI ID 296, 101,766 encounters, 47 features, CC-BY 4.0, no registration required. |
| **Data volume** | ~30 MB. Fits Neon free tier (0.5 GB) with two orders of magnitude to spare. |
| **Compute** | Gradient boosting on 100k tabular rows trains in seconds on a laptop. No GPU, no paid compute. |
| **Cost** | Zero. Vercel + Render + Neon free tiers, as proven in GridCast and Bellwether. |
| **Novelty of the dataset** | **Low, and acknowledged.** Widely used for teaching. The contribution is not the model. |
| **Novelty of the framing** | **High.** Published work on this dataset overwhelmingly reports AUC or accuracy. Capacity-constrained targeting against a named incumbent rule is rare. |
| **Skill fit** | Direct: cleaning, hypothesis testing, regression, tree ensembles — the Advanced Data Analytics track end to end. |

### 3.1 Principal risk to validity

**The straw-man baseline.**

It is trivial to beat "rank by age," and a project that beats only that has
proved nothing. Age is a weak predictor of readmission and no serious programme
relies on it alone.

The honest incumbent is **`number_inpatient`** — how many times the patient has
already been admitted in the preceding year. It is a single column, requires no
model, and is the strongest individual predictor in this dataset. Any competent
discharge planner would reach for it.

**Therefore `number_inpatient` is pre-registered as the primary baseline, not
age.** Age is reported as a secondary comparison because it reflects actual
practice, but SC-1 is measured against the strongest baseline available.

There is a real possibility the model beats `number_inpatient` only marginally.
That outcome is a finding, not a failure, and §13.1 specifies what is published
if it occurs. What is **not** acceptable is discovering it in month three, which
is why it is measured in M0.

**Second validity risk: the data is from 1999–2008.** Clinical practice, coding
and readmission policy have all changed since. Triage is a demonstration of a
targeting method on historical data, and every published surface must say so. No
claim is made about any hospital operating today.

**Third: the dataset supports risk ranking, not intervention effect.** It records
who was readmitted. It records nothing about follow-up calls. Triage therefore
**cannot** measure whether calling anyone helps. Any monetary figure requires the
user to supply an assumed programme effectiveness, and the interface must render
measured and assumed quantities differently (§7.5, NFR-11).

---

## 4. SDLC methodology

Incremental milestones M0–M7, each with a written spec before work starts and a
written summary after. Same structure as OrderLens, GridCast and Bellwether.

### 4.1 Walking skeleton first

M0 stands up the thinnest end-to-end path — data in, one number out, deployed —
**and answers the kill question before any application work begins.** No feature
engineering, no interface work, no model tuning in M0.

### 4.2 Definition of Done (applies to every milestone)

1. Every requirement in the milestone spec is met or explicitly deferred with a reason.
2. Tests pass in CI on a clean clone.
3. Every published number is reproducible from a pinned seed and a checksummed input.
4. A written summary records what was built, what was verified, what broke, and what was decided.
5. Nothing is asserted that was not measured.

---

## 5. Stakeholders and user characteristics

| Stakeholder | Interest | Technical level |
|---|---|---|
| **Discharge planner** (primary persona) | Who to call this month, and why each name is on the list | None. Must never see a p-value. |
| **Programme manager** | Whether the programme justifies its staffing; where the capacity cutoff sits | Comfortable with rates and costs, not with models |
| **Hiring manager / interviewer** | Whether the analysis is sound and the reasoning is visible | High |
| **Author** | A portfolio artefact that survives scrutiny | — |

The primary persona drives the interface. The hiring manager drives the
documentation. These are different audiences and the project serves both without
mixing them: the application speaks plainly, the repository shows the work.

---

## 6. Data source specification

### 6.1 Source

**Diabetes 130-US Hospitals for Years 1999–2008.** UCI Machine Learning
Repository, dataset ID 296. 101,766 encounters, 47 features, licensed CC-BY 4.0.
Also mirrored on Kaggle.

Retrieved once, checksummed, and committed as a pinned artefact. The pipeline
reads the checksummed copy, never the live URL, so published numbers cannot
silently change beneath the analysis.

### 6.2 Target definition

`readmitted` takes three values: `<30`, `>30`, `NO`.

**Target = 1 if `readmitted == '<30'`, else 0.**

`>30` is collapsed into the negative class deliberately. The follow-up programme
addresses the post-discharge handoff, whose failure window is days to weeks. A
readmission at four months is a different phenomenon, and treating it as the same
event would blur the thing being targeted. This choice is pre-registered.

### 6.3 Known data characteristics requiring handling

These are the traps. Each is a tested exclusion or transformation, not a
judgement call made mid-analysis.

| # | Characteristic | Handling |
|---|---|---|
| DC-1 | **Multiple encounters per patient.** `patient_nbr` repeats. The same person can land in both train and test. | Grouped split by `patient_nbr`. Zero-overlap assertion in CI. |
| DC-2 | **Deceased and hospice patients.** Certain `discharge_disposition_id` values mean the patient died or entered hospice. They **cannot** be readmitted, so they are guaranteed negatives that flatter every metric. | Excluded before any split. Count of excluded rows published. |
| DC-3 | **`weight` is ~97% missing.** | Dropped. Documented, not silently imputed. |
| DC-4 | **`payer_code` and `medical_specialty` heavily missing.** | Missingness treated as its own category and tested for association with the target; not imputed. |
| DC-5 | **`diag_1/2/3` are raw ICD-9 codes** — hundreds of levels. | Grouped into clinical categories by a committed, versioned mapping table. |
| DC-6 | **Class imbalance (~11% positive).** | Never addressed by accuracy. Evaluation is precision@k / lift@k. Any resampling is applied inside CV folds only. |
| DC-7 | **High-cardinality categoricals** across 20+ medication columns. | Encoding fitted on training folds only. |
| DC-8 | **`?` used as the missing marker.** | Normalised to null at load; never treated as a category by accident. |

### 6.4 Knowability

Every feature must be knowable **at the moment of discharge**. The source is a
discharge-time snapshot, so this is largely satisfied by construction — but it is
asserted explicitly rather than assumed, and any derived feature is checked
against it before entering the model.

---

## 7. Functional requirements

### 7.1 Data foundation

| # | Requirement |
|---|---|
| FR-1 | Load the checksummed source into PostgreSQL with typed columns and `?` normalised to null. |
| FR-2 | Apply and test the DC-2 exclusion, publishing the row count removed. |
| FR-3 | Produce a grouped train/test split by `patient_nbr` with a pinned seed, and assert zero patient overlap. |
| FR-4 | Publish a data-quality report: row counts, missingness per column, target base rate before and after exclusions. |

### 7.2 Descriptive analysis

| # | Requirement |
|---|---|
| FR-5 | Report the 30-day readmission rate overall and by age band, prior-admission count, length of stay, and discharge destination. |
| FR-6 | Publish the distribution of `number_inpatient` and its relationship to the target — the incumbent baseline, characterised before it is competed against. |

### 7.3 Inferential analysis

| # | Requirement |
|---|---|
| FR-7 | Test the association between HbA1c measurement and 30-day readmission, reporting an effect size and interval, not only a p-value. |
| FR-8 | Test at least three further pre-registered associations, each with effect size and interval. |
| FR-9 | Apply and state a correction for multiple comparisons across all tests in FR-7 and FR-8. |

### 7.4 Predictive analysis

| # | Requirement |
|---|---|
| FR-10 | Fit an interpretable logistic regression, reporting odds ratios with confidence intervals. This model supplies the per-patient explanation. |
| FR-11 | Fit a gradient-boosted classifier for ranking quality. |
| FR-12 | Calibrate predicted probabilities and publish a calibration curve and Brier score. An uncalibrated risk percentage must never reach the interface. |
| FR-13 | Evaluate both models and all baselines by precision@k and lift@k across k ∈ {50, 100, 200, 500, 1000}. |
| FR-14 | Report bootstrap confidence intervals on lift@k. A point estimate alone is not acceptable. |

### 7.5 Decision layer

| # | Requirement |
|---|---|
| FR-15 | Given a capacity `k`, return the top `k` patients ranked by calibrated risk. |
| FR-16 | For each selected patient, return the top contributing factors in plain language, derived from FR-10. |
| FR-17 | Report, for the current `k`, the measured true events captured by the model and by each baseline on held-out data. |
| FR-18 | Accept user-supplied cost-per-readmission and assumed programme effectiveness, and compute an expected return — **rendered as clearly assumption-derived** and never merged with measured quantities. |
| FR-19 | Publish the capacity curve: captured events as a function of `k`, model against baselines, showing where returns flatten. |

### 7.6 Application and API

| # | Requirement |
|---|---|
| FR-20 | REST API exposing ranked selection, per-patient explanation, evaluation metrics, and the capacity curve. |
| FR-21 | Web application with a capacity control that recomputes selection and measured performance. |
| FR-22 | Serve precomputed scores; no model training at request time. |
| FR-23 | Display the historical-data and non-clinical notices on every page showing a patient-level number. |

### 7.7 Communication

| # | Requirement |
|---|---|
| FR-24 | A two-page decision memo readable with no technical background. |
| FR-25 | `PREREGISTRATION.md`, committed before any model is fitted. |
| FR-26 | `METHODS.md` sufficient for an independent reader to reproduce every number. |

---

## 8. Non-functional requirements

| # | Requirement |
|---|---|
| NFR-1 | Zero monetary cost. Free tiers only. |
| NFR-2 | Deterministic: pinned seeds, pinned dependencies, checksummed input. |
| NFR-3 | Every published number reproducible from a clean clone via one documented command. |
| NFR-4 | CI runs tests, the leakage assertion, and the reproducibility check on every push. |
| NFR-5 | API p95 under 500 ms for ranked selection — precomputed scores make this trivial. |
| NFR-6 | Cold-start behaviour on the Render free tier disclosed in the interface rather than hidden. |
| NFR-7 | Public repository — required for unlimited GitHub Actions minutes. |
| NFR-8 | No identifiable data. The source is de-identified; no attempt at re-identification is made or supported. |
| NFR-9 | Accessible: the primary persona is non-technical. No statistical jargon in the application interface. |
| NFR-10 | Every page carries the historical-data notice and an explicit statement that this is not clinical decision support. |
| NFR-11 | **Measured and assumed quantities are visually distinct throughout the interface.** A number derived from a user's assumed effectiveness must never be presented in the same style as a number measured from held-out data. |

### 8.1 Why NFR-11 exists

The most common way a project like this misleads is by multiplying a real lift by
an invented effectiveness rate and an invented cost, then presenting the product
— "$1.4M saved" — with the same authority as the measured lift.

The lift is measured. The dollars are the user's assumption wearing the lift's
credibility. Separating them in the interface is a requirement, not a
presentation preference.

---

## 9. Architecture

### 9.1 Layered design

```
Source (UCI, checksummed)
        |
        v
Ingestion  ---------->  PostgreSQL (Neon)
        |                 encounters, exclusions, splits
        v
Analysis layer (Python)
  cleaning . EDA . tests . logistic . gradient boosting . calibration
        |
        v
Scoring  ------------>  PostgreSQL
                          patient_scores, explanations, eval_metrics
                                  |
                                  v
                        FastAPI (Render)  -->  Next.js (Vercel)
```

Scores and evaluation metrics are computed offline and written to the database.
The API is a read path. This keeps the free-tier backend fast and makes the
application's numbers identical to the repository's numbers by construction.

### 9.2 Technology decisions and rejected alternatives

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Ranking model | Gradient boosting | Deep learning | 100k tabular rows; no benefit, large interpretability cost |
| Explanation model | Logistic regression, odds ratios | SHAP on the ensemble only | The persona needs a stable, statable reason per patient; odds ratios are directly reportable and defensible under questioning |
| Serving | Precomputed scores | Train/predict per request | Free-tier CPU; also guarantees interface and repository agree |
| Split | Grouped by `patient_nbr` | Random encounter split | DC-1. A random split leaks the same person across train and test |
| Primary metric | Lift@k vs strongest baseline | AUC, accuracy, F1 | Capacity is the real constraint; §11.2 |
| Storage | Postgres on Neon | SQLite in the repository | Matches the deployed pattern already proven in GridCast and Bellwether |

### 9.3 Free-tier constraints treated as design inputs

Render's free instance sleeps; the interface discloses the first-request delay
rather than appearing broken. Neon's 0.5 GB is ample and requires no pruning —
unlike GridCast, this dataset is static and bounded.

---

## 10. Conceptual data model

| Table | Grain | Notes |
|---|---|---|
| `encounters_raw` | One source row | Immutable after load; checksummed |
| `encounters_clean` | One eligible encounter | Post DC-2 exclusion; exclusion reason retained |
| `patient_splits` | One patient | `patient_nbr` to train/test, pinned seed |
| `patient_scores` | One test-set encounter | Calibrated risk, rank, model version |
| `score_explanations` | One encounter x factor | Top contributing factors, plain-language label |
| `eval_metrics` | One (method, k) pair | Precision@k, captured events, lift, bootstrap CI |

---

## 11. Analysis plan and statistical methods

### 11.1 Sequence

1. Clean and exclude per §6.3. Publish the data-quality report.
2. Grouped split. Assert zero patient overlap.
3. Descriptive analysis and baseline characterisation.
4. Pre-registered hypothesis tests with effect sizes and multiple-comparison correction.
5. Logistic regression — odds ratios, the explanation layer.
6. Gradient boosting — ranking.
7. Calibration and calibration curve.
8. Precision@k and lift@k against all baselines, with bootstrap intervals.
9. Capacity curve and cost-benefit layer.

### 11.2 Why accuracy is not used

The base rate is ~11%. A model predicting "no readmission" for every patient
scores ~89% accurate and is worthless.

More importantly, accuracy answers a question nobody asked. The hospital cannot
act on 3,240 patients; it can act on `k`. Only the composition of the top `k`
matters. Every patient ranked below `k` is irrelevant to the decision, regardless
of whether the model got them right.

**Primary metric: lift@k against the strongest baseline.** Precision@k, AUC and
Brier score are reported as supporting evidence — AUC because the existing
literature on this dataset reports it and comparability is useful, not because it
drives any decision here.

### 11.3 Pre-registered baselines

| Rank | Baseline | Rationale |
|---|---|---|
| **B1** | `number_inpatient` descending | **Primary.** The strongest single-variable rule; the honest incumbent |
| B2 | Age band descending | Reflects common practice; secondary |
| B3 | `time_in_hospital` descending | Plausible clinician heuristic |
| B4 | Random selection | Floor |

SC-1 is measured against **B1**.

---

## 12. Milestone plan

| # | Milestone | Exit criterion |
|---|---|---|
| **M0** | Feasibility and walking skeleton | The lift question is answered on held-out data and pre-registered; skeleton deployed. **Kill point.** |
| M1 | Data foundation | Cleaning, exclusions, grouped split, quality report, all tested in CI |
| M2 | Descriptive analysis | BQ-1 answered; baselines characterised |
| M3 | Inferential analysis | FR-7 to FR-9 complete with effect sizes and correction |
| M4 | Interpretable model | Logistic regression, odds ratios, explanation layer |
| M5 | Ranking and calibration | Gradient boosting, calibration curve, lift@k with intervals |
| M6 | Decision layer | Capacity curve, cost-benefit with NFR-11 separation |
| M7 | Application and deployment | FR-20 to FR-23 live; decision memo published |

---

## 13. Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| R-1 | **Model beats B1 only marginally.** | Measured in M0, before any build. If lift < 1.5x but the CI excludes 1.0, the project continues with the honest headline. If the CI includes 1.0, §13.1 applies. |
| R-2 | Patient-level leakage inflates every result | DC-1 grouped split, asserted in CI, not by convention |
| R-3 | Deceased patients flatter apparent performance | DC-2 exclusion applied before splitting; excluded count published |
| R-4 | Cost figures read as measured findings | NFR-11 visual separation; assumptions labelled at point of display |
| R-5 | Dataset age undermines relevance | Stated on every published surface; framed as a method demonstration |
| R-6 | Project mistaken for clinical software | NFR-10 notices; no patient-level advice; no lookup of real people |
| R-7 | Reviewer dismisses it as "another Kaggle model" | The framing, not the model, is the contribution — the decision memo leads with capacity and the incumbent comparison, never with AUC |

### 13.1 Kill criterion

**If the bootstrap 95% CI for lift@200 against B1 includes 1.0, Triage is not
built as specified.**

What is published instead is the negative result: that on this dataset, at
realistic capacity, a gradient-boosted model does not reliably outperform
counting a patient's prior admissions — with the analysis, the interval, and an
account of why. That is a shorter project and an honest one, and it is a better
artefact than a dashboard resting on a difference that is not there.

This criterion is committed in `PREREGISTRATION.md` **before** the model is
fitted.

---

## 14. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | Every FR met or explicitly deferred with a written reason |
| AC-2 | SC-1 through SC-6 met, or SC-1 failed and §13.1 executed |
| AC-3 | CI green on a clean clone, including the leakage assertion |
| AC-4 | Every published number reproducible via one documented command |
| AC-5 | `PREREGISTRATION.md` timestamped in git history before the first model commit |
| AC-6 | Decision memo readable end to end by a non-technical reader |
| AC-7 | Application deployed and publicly reachable |
| AC-8 | Measured and assumed quantities visually distinct in every view (NFR-11) |

---

## 15. Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-19 | Initial specification. Approved for M0. |

**Open items carried into M0 as unverified facts:** VER-1 through VER-5, defined
in `Triage_M0_Spec.md` §3.
