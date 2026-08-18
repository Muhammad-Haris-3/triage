# Triage — M0 Summary: Lift proof

**Milestone:** M0 — Lift proof and walking skeleton
**Author:** Muhammad Haris Khokhar
**Date:** 2026-08-19
**Status:** Complete. **Kill criterion fired.**
**Depends on:** `Triage_SRS_v1.0.md`, `Triage_M0_Spec.md`,
`PREREGISTRATION_M0_amendment.md`

---

## 1. Exit criterion

M0 asked one question:

> **At a realistic follow-up capacity, does a model rank patients meaningfully
> better than simply counting how many times they have already been admitted?**

**Answer: no.**

Measured on held-out patients, at k=200, against `number_inpatient`:

| Run | Lift@200 | 95% CI | Verdict |
|---|---|---|---|
| M0 as specified | **1.06x** | [0.92, 1.23] | CI includes 1.0 — kill |
| Amendment 1 (declared, one shot) | **0.94x** | [0.83, 1.17] | CI includes 1.0 — kill |

Per `Triage_M0_Spec.md` §6 and SRS §13.1, **M1 does not start.** The project
becomes the published negative result described in §7.

The walking skeleton (M0-T8) was **not built**. That is the specified behaviour:
T5 and T7 were ordered before T8 precisely so that a bad answer would stop the
build, and it did.

---

## 2. What was built

| Task | Status |
|---|---|
| M0-T1 Repository and CI | Not built — superseded by the kill |
| M0-T2 Acquire and pin | Done. Source checksummed. |
| M0-T3 Exclusions | Done. Code list verified against `IDS_mapping.csv`. |
| M0-T4 Grouped split | Done. Overlap assertion passing. |
| M0-T5 Baselines | Done. VER-4 measured. |
| M0-T6 Pre-registration | Partial — the amendment was declared in writing before execution; the full `PREREGISTRATION.md` was superseded by the kill. See §5.1. |
| M0-T7 Untuned model | Done. VER-5 measured, twice. |
| M0-T8 Walking skeleton | **Not built, by design.** |
| M0-T9 Decision | This document. |

Analysis code: `m0.py` (T3–T7), `m0_amend.py` (Amendment 1).

---

## 3. Verification performed

### 3.1 Source

| | |
|---|---|
| Source | UCI ML Repository, dataset 296, via `data_url` from the UCI API |
| SHA-256 (`data.csv`) | `f792c388d9b470aac4fbf21c39b176534d55a116e7626881c30bbe7ab0341422` |
| Shape as read | 101,766 rows x 50 columns |
| Retrieved | 2026-08-19 |

`IDS_mapping.csv` was obtained separately from the archive zip and read directly.
**The exclusion codes were not guessed.**

### 3.2 VER-1 — base rate

| | Rate | Events / rows |
|---|---|---|
| Before exclusion | 11.16% | 11,357 / 101,766 |
| **After exclusion** | **11.39%** | **11,314 / 99,343** |
| Test set only | 11.61% | 2,295 / 19,765 |

### 3.3 VER-3 — the exclusion, and what it actually proved

2,423 rows excluded. Their combined 30-day readmission rate was **1.775%** —
low, but **not the zero the M0 spec expected.** Breaking it down by code
explains why, and the breakdown is more informative than the total:

| Code | Meaning | Rows | 30-day readmission rate |
|---|---|---|---|
| 11 | Expired | 1,642 | **0.000%** |
| 13 | Hospice / home | 399 | 4.762% |
| 14 | Hospice / medical facility | 372 | 6.452% |
| 19 | Expired at home (hospice) | 8 | 0.000% |
| 20 | Expired in medical facility (hospice) | 2 | 0.000% |
| 21 | Expired, place unknown (hospice) | 0 | — |

**Every death code is exactly 0.000%.** That is the code list validating itself:
deceased patients are not readmitted, and if any death code had shown a non-zero
rate the mapping would have been wrong.

**The hospice codes are not zero**, because a patient discharged to hospice care
can be readmitted. See §4.3 for the decision taken.

### 3.4 VER-2 — the leakage risk, quantified

| | |
|---|---|
| Encounters after exclusion | 99,343 |
| Distinct patients | 69,990 |
| Patients with more than one encounter | 16,341 (23.3%) |
| **Encounters belonging to those patients** | **45,694 (46.0%)** |

Split by patient, 80/20, seed 42: train 79,578 encounters / 55,992 patients;
test 19,765 encounters / 13,998 patients. Overlap assertion passes.

**The counterfactual, as required by M0-T4:** a naive encounter-level split would
have placed **8,264 test rows — 41.6% of the test set — in training under a
different row of the same patient.**

This number is the justification for DC-1. Nearly half the evaluation would have
been contaminated, and every figure in §3.5 and §3.6 would have been inflated by
an unknown amount with no visible symptom.

### 3.5 VER-4 — the baselines

Test set, k varied. Ordered baselines use random tie-breaking averaged over 200
draws (rule fixed before computing, per M0-T5). The random baseline redraws the
*selection* 2,000 times — see METHODS §6.1 for why the first version of this was
wrong.

| Method | k=50 | k=100 | **k=200** | k=500 | k=1000 |
|---|---|---|---|---|---|
| **B1 `number_inpatient`** | 25.8 | 51.3 | **88.9** | 183.9 | 300.0 |
| B2 age band | 7.1 | 14.4 | 28.2 | 70.8 | 133.4 |
| B3 `time_in_hospital` | 7.8 | 15.0 | 30.1 | 67.1 | 122.3 |
| B4 random *(2,000 draws)* | 5.8 | 11.6 | 23.2 | 58.0 | 115.8 |

**B1 captures 88.9 of 200 — precision 44.4% against an 11.61% base rate.**

Two things are visible here and both matter:

- **B1 is a strong rule.** Sorting one integer column beats random selection by
  **3.8x** (88.9 against 23.2). SRS §3.1 predicted this; the measurement
  confirms it.
- **B2 (age) is barely better than random.** 28.2 versus 23.2, with heavily
  overlapping ranges — 12.5% of random draws beat age's mean. Age, the rule
  hospitals actually use, carries very little information about 30-day
  readmission in this dataset, and less than a third of what prior admissions
  carries.

### 3.6 VER-5 — the model

**Run 1 — M0 as specified.** Numeric and low-cardinality categoricals; diagnosis
codes, `medical_specialty`, `payer_code` and `weight` dropped. 11 numeric + 30
categorical, 139 design columns. `HistGradientBoostingClassifier` at library
defaults, no tuning.

| Method | k=50 | k=100 | **k=200** | k=500 | k=1000 |
|---|---|---|---|---|---|
| B1 | 25.8 | 51.3 | **88.9** | 183.9 | 300.0 |
| Model | 25.0 | 46.0 | **94.0** | 196.0 | 323.0 |

Precision@200: model 47.0%, B1 44.4%. AUC 0.6680.

**Lift@200 = 94.0 / 88.9 = 1.06x. Bootstrap 95% CI [0.92, 1.23]**, 2,000
resamples at patient level.

The interval includes 1.0. **Kill criterion fired.**

**Run 2 — Amendment 1**, declared in writing in
`PREREGISTRATION_M0_amendment.md` before execution: grouped ICD-9 diagnosis codes
(fixed mapping) plus `medical_specialty` (top 25 by training frequency). 196
design columns. Identical split, seed, baselines, tie rule, model defaults and
bootstrap.

| Method | k=50 | k=100 | **k=200** | k=500 | k=1000 |
|---|---|---|---|---|---|
| B1 | 25.8 | 51.3 | **88.9** | 183.9 | 300.0 |
| Model (M0) | 25.0 | 46.0 | **94.0** | 196.0 | 323.0 |
| Model (+diagnosis, +specialty) | 26.0 | 48.0 | **84.0** | 202.0 | 329.0 |

**Lift@200 = 84.0 / 88.9 = 0.94x. Bootstrap 95% CI [0.83, 1.17].**

**Kill criterion fired a second time.** Per the declaration, no third attempt.

---

## 4. Problems found

### 4.1 The finding that outranks the result: AUC improved while the decision got worse

Between Run 1 and Run 2:

| | Run 1 | Run 2 | Direction |
|---|---|---|---|
| AUC | 0.6680 | 0.6731 | **better** |
| Captured @200 | 94.0 | 84.0 | **worse** |

Adding diagnosis information improved the model's overall ranking and **degraded
the top of it by ten real patients — a 10.6% loss in the only region that can be
acted on.**

Almost every published analysis of this dataset reports AUC. An analyst following
that convention would have concluded the richer model was better, shipped it, and
reached 10% fewer of the patients who actually returned — with a metric moving in
the right direction the entire time.

This is SRS §11.2 demonstrating itself on real data rather than being asserted.
It is the most transferable thing M0 produced.

### 4.2 `dtype == object` silently dropped 30 of 41 features

Feature selection used `clean[c].dtype == object` to identify categoricals. Under
the installed pandas version, string columns are **not** reported as `object`, so
the condition matched nothing: the first run selected **41 numeric + 0
categorical** features.

It surfaced only because `get_dummies` then had nothing to encode and the fit
crashed on the literal string `Caucasian`. **Had the estimator accepted strings,
the model would have trained on a quarter of the intended feature set and
reported a plausible number with no error at all.**

Corrected to `pd.api.types.is_numeric_dtype`. Recorded here because the failure
mode — a silently empty filter producing a believable result — is the class of
bug that a green test suite does not catch.

### 4.3 Hospice patients are not guaranteed negatives

M0-T3 asserted that excluded rows must show a near-zero readmission rate. Death
codes did (0.000%). Hospice codes did not (4.8% and 6.5%).

**Decision: hospice codes remain excluded.** A patient discharged to hospice is
not a candidate for a readmission-prevention programme — the intervention does
not apply to them — so their exclusion is justified by the decision being
modelled, not by their being impossible events. The spec's stated *reason* for
the exclusion was partly wrong; the exclusion itself stands, on corrected
grounds.

The 771 affected rows are 0.78% of the data. Retaining them would not change any
conclusion in §3.6.

### 4.4 The obvious download URL 404s

`archive.ics.uci.edu/static/public/296/<slugified-name>.zip` returns 404 for the
name shown on the dataset page. The working paths are the `data_url` field
returned by `https://archive.ics.uci.edu/api/dataset?id=296`, and — for the zip
containing `IDS_mapping.csv` — the exact hyphenated filename
`diabetes+130-us+hospitals+for+years+1999-2008.zip`.

Recorded so the write-up's reproduction instructions are correct.

---

## 5. Decisions taken during M0

### 5.1 Amendment 1 was declared in writing before it was run

After the first kill, the M0 feature restriction was identified as a choice made
for speed rather than on principle — diagnosis codes are the dataset's largest
unused signal, and the question "does a model *with* diagnosis information beat
counting?" had genuinely not been tested.

Rather than simply running it, the amendment was written to
`PREREGISTRATION_M0_amendment.md` first, fixing the ICD-9 grouping, the specialty
cutoff, everything held constant, and an explicit **one-shot** commitment with
no third attempt.

This is the difference between a second test and p-hacking, and the only thing
that distinguishes them is the order of the timestamps.

### 5.2 The kill was accepted rather than worked around

Available moves that were **not** taken: class weighting, resampling,
hyperparameter search, other model classes, other capacities, other metrics,
re-splitting on a different seed.

Any of them might have produced a lift above 1.5x. None would have meant
anything, because the search would have been conditioned on already knowing the
first two answers. M0-T7 §7 of the spec names this explicitly.

### 5.3 B1 was given a fair tie rule

`number_inpatient` is a small integer with heavy ties at the k=200 cutoff. Ties
were broken randomly and averaged over 200 draws, with the rule fixed before
computing. Awarding the baseline its worst-case ordering would have manufactured
a lift out of a tie-breaking convention.

---

## 6. The decision

**Triage is not built as specified.**

Two pre-registered tests, both with intervals spanning 1.0. SRS §13.1 executes.

What is published instead:

> On 100,000 US hospital records, at a realistic follow-up capacity, a
> gradient-boosted model does not reliably outperform ranking patients by their
> count of prior admissions. The model's apparent 3.3x advantage over the rule
> hospitals actually use — age — is explained almost entirely by that single
> column, which requires no model. Adding diagnosis information raised AUC and
> lowered the number of at-risk patients reached.

Three findings, all measured, all falsifiable, all reproducible from a
checksummed input and a pinned seed.

---

## 7. What replaces M1

Not an application. A short write-up — one to two weeks against the original
eight — carrying:

1. **The capacity argument.** Why accuracy and AUC are the wrong metrics when the
   operational constraint is `k`, demonstrated rather than argued (§4.1).
2. **The baseline argument.** Why the incumbent rule must be the strongest simple
   rule, not the one currently in use. Age is indistinguishable from random here;
   a project benchmarked against it would have claimed 3.3x and been meaningless.
3. **The leakage argument.** 41.6% of the test set contaminated by a split that
   looks entirely normal.
4. **The process.** Kill criterion committed in advance, fired, accepted.

Deliverables: `README.md` carrying the three findings, `METHODS.md`, the two
analysis scripts, `PREREGISTRATION_M0_amendment.md`, and a two-page decision
memo (FR-24) readable with no technical background.

`Triage_SRS_v1.0.md` and `Triage_M0_Spec.md` are retained unchanged. They are the
evidence that the bar was set before the result was known, and without them the
null result would be indistinguishable from a project that simply did not work.

---

## 8. Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-19 | M0 complete. Kill criterion fired on both runs. M1 cancelled. |
