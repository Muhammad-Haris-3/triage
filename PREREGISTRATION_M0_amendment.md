# Triage — M0 Amendment 1: declared before execution

**Date:** 2026-08-19
**Status:** Declared. Not yet executed at time of writing.
**Amends:** `Triage_M0_Spec.md` §2 ("Deliberate simplification")

---

## Why this amendment exists

M0-T7 was executed with the feature restriction declared in the M0 spec: numeric
and low-cardinality categorical columns only, with **diagnosis codes and medical
specialty dropped**. The result was:

| | |
|---|---|
| B1 (`number_inpatient`) captured @200 | 88.9 |
| Untuned model captured @200 | 94.0 |
| **Lift@200 vs B1** | **1.06x, 95% CI [0.92, 1.23]** |
| Kill criterion (CI includes 1.0) | **Fired** |

The dropped columns are the largest unused source of signal in the dataset. The
M0 restriction was chosen for speed, not on principled grounds. The question
*"does a model with access to diagnosis information beat counting prior
admissions?"* has therefore **not been tested**, and the M0 result cannot answer
it.

This amendment tests it **once**.

---

## What changes

Exactly two additions to the feature set:

1. **`diag_1`, `diag_2`, `diag_3`** — raw ICD-9 codes, grouped into clinical
   categories by the mapping in §4 below. The mapping is fixed here, before
   execution, and is the standard grouping used in the published literature on
   this dataset. It is not tuned.
2. **`medical_specialty`** — the admitting specialty. High cardinality, so the
   top 25 values by frequency are retained and all others collapsed to `other`.
   Missing remains its own level. The cutoff of 25 matches the existing
   low-cardinality rule in the M0 spec and is not chosen by looking at results.

---

## What does not change

Everything else is held fixed, deliberately:

- Same random seed (42)
- Same patient-level split — **the identical train/test partition**, not a re-split
- Same exclusion list (discharge codes 11, 13, 14, 19, 20, 21)
- Same target definition (`<30` positive)
- Same baselines and the same random tie-breaking rule
- Same model class with **library defaults — no tuning, no search, no class
  weighting, no resampling**
- Same primary metric: lift@200 against B1
- Same bootstrap: 2,000 resamples, at patient level
- Same kill criterion

---

## ICD-9 grouping (fixed before execution)

| Group | Codes |
|---|---|
| Circulatory | 390–459, 785 |
| Respiratory | 460–519, 786 |
| Digestive | 520–579, 787 |
| Diabetes | 250.xx |
| Injury | 800–999 |
| Musculoskeletal | 710–739 |
| Genitourinary | 580–629, 788 |
| Neoplasms | 140–239 |
| Other | everything else, including V and E codes and missing |

---

## The commitment

**This is a one-shot test.** The result is accepted whichever way it goes.

- If the 95% CI for lift@200 vs B1 **excludes 1.0**: M1 proceeds, and the
  headline is the measured lift with its interval — not a rounded-up version of it.
- If the CI **includes 1.0**: SRS §13.1 executes. Triage is published as a
  negative result. **No further feature sets, model classes, hyperparameters,
  capacities, or metrics are tried.**

Searching until something clears the bar would make any result meaningless. That
is the failure this document exists to prevent, and it applies to this amendment
as much as to the original spec.

**No third attempt.**
