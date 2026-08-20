# Triage — M2 Pre-registration: declared before execution

**Date:** 2026-08-20
**Status:** Declared. No M2 code exists at the time of writing.
**Governs:** `Triage_M2_Spec.md`
**Related:** `PREREGISTRATION_M0_amendment.md`, `METHODS.md` §1.2, SRS §13.1

---

## Why this document exists

Every published figure in this repository descends from **one** train/test split, a
single patient-level permutation at seed 42. `METHODS.md` §1.2 states this plainly
and calls it the sharpest limitation of the work:

> A different seed could move the point estimate.

M2 re-splits the data 50 times and re-runs the identical analysis on each, so that
the published 1.06x can be read against the distribution it was drawn from.

**This document is written and committed before the code that performs that sweep
exists.** The commit between this declaration and the first run is the only thing
distinguishing a variance estimate from re-measuring until the answer improves. It
is the same argument `PREREGISTRATION_M0_amendment.md` makes for itself, and it is
the reason that document was written the same way.

---

## Relationship to "no third attempt"

`PREREGISTRATION_M0_amendment.md` closes:

> **No further feature sets, model classes, hyperparameters, capacities, or metrics
> are tried. No third attempt.**

That clause is honoured. It enumerates what may not vary, and **M2 varies none of
those things.** No new feature set, no new model class, no hyperparameter, no new
capacity, no new metric. The only quantity that changes between runs is the random
partition of patients into train and test.

The test that separates this from a prohibited search: **a search can only make the
result look better, because it stops when it does.** M2 has a stopping rule fixed
in advance at 50 splits and a decision rule fixed in advance in §4 below, and it is
as likely to weaken the published claim as to strengthen it. That asymmetry is the
distinction, and it is why the decision rule below is stated in both directions.

---

## 1. What is measured

Two things, from one pass of fits.

**1. The sampling distribution of lift@200.** How much the headline number moves
when only the split changes, and in what fraction of splits the pre-registered kill
criterion would have fired.

**2. The AUC-versus-captured divergence rate.** The README's third finding — that
adding diagnosis features raised AUC while lowering the number of at-risk patients
reached — currently rests on a single observation. M2 measures how often that
divergence occurs across the 50 splits.

---

## 2. Parameters, fixed here

| Parameter | Value |
|---|---|
| Number of splits | **50**, seeds `0`–`49` |
| Split procedure | `m0.py` verbatim: `default_rng(s).permutation(clean.patient_nbr.unique())`, 80/20 by patient |
| Exclusions | discharge codes 11, 13, 14, 19, 20, 21 — unchanged |
| Target | `readmitted == "<30"` — unchanged |
| Feature sets | the M0 set and the amendment set, **both exactly as already declared** |
| Model | `HistGradientBoostingClassifier(random_state=42)`, library defaults — unchanged |
| Baselines | B1–B4, random tie-break averaged over 200 draws — unchanged |
| Primary metric | lift@200 against B1 — unchanged |
| Capacities reported | k ∈ {50, 100, 200, 500, 1000} — unchanged |
| Bootstrap | patient-level, 95% percentile interval, **500 resamples per split** |
| Bootstrap on seed 42 | **2,000 resamples**, so the published interval reproduces exactly |

**`N = 50` is not extendable after the results are seen.** Running further splits
because the answer landed near a threshold is the same defect as trying a third
feature set. §4.4 states how a borderline outcome is handled instead.

The reduction to 500 resamples is declared here rather than chosen at runtime. The
quantity the decision rule consumes is *whether an interval covers 1.0*, not its
endpoints to two decimals. Seed 42 is run at both 500 and 2,000 and both are
published, so the cost of the reduction is visible rather than asserted.

### 2.1 Seed 42 is inside the swept range

`permutation` is the first call on the generator in `m0.py`, so seed 42 within this
sweep reproduces the published partition exactly — verified: 79,578 train and
19,765 test encounters.

The published result is therefore a member of its own distribution, and its
percentile within that distribution is reported.

### 2.2 Leakage discipline

The amendment feature set derives `medical_specialty`'s top-25 levels from the
training set. Under re-splitting these are **recomputed inside each split's own
training partition**. Freezing them from seed 42 would leak test information into
the other 49 splits — the contamination DC-1 exists to prevent, in a form that
produces no visible symptom and no error.

The ICD-9 grouping is a fixed function of the code, carries no data dependence, and
is reused unchanged.

---

## 3. The self-check that gates the sweep

Before any of the 50 splits runs, the harness reproduces seed 42 and asserts the
published M0 figures:

| Quantity | Required value |
|---|---|
| Train / test encounters | 79,578 / 19,765 |
| B1 captured@200 | 88.895 |
| Model captured@200 | 94.0 |
| lift@200 | 1.0574 |
| AUC | 0.6680 |

**If the self-check fails, the sweep does not run and no M2 figure is published.**

A harness that cannot reproduce the published number cannot be trusted to
characterise it. Fifty splits of a subtly different procedure would return a
confident answer to a question nobody asked.

---

## 4. The decision rule

The primary statistic is:

> **`F_kill`** — the fraction of the 50 splits whose own 95% bootstrap CI for
> lift@200 **includes 1.0**; that is, the fraction in which SRS §13.1's kill
> criterion would have fired.

The published draw fired it. This measures whether that draw was typical.

### 4.1 `F_kill ≥ 0.90` — the null is confirmed as split-robust

The single-draw caveat in `METHODS.md` §1.2 is **replaced** by the measured
distribution. `METHODS.md` §2's central claim is strengthened from a single-split
statement to a distributional one. The README gains a line stating in how many of
50 re-splits the conclusion held.

### 4.2 `0.50 < F_kill < 0.90` — split-dependent; the null stands, weakened

The negative result stands. It remains the majority outcome and it remains what was
pre-registered. But `METHODS.md` §1.2 and §2 and the README are amended to state,
in their own body text and not in a footnote, that the conclusion depends on the
draw, that 1.06x is one sample from a distribution spanning both conclusions, and
in what fraction of draws the opposite decision would have been reached.

### 4.3 `F_kill ≤ 0.50` — the published draw was unrepresentative

The README's central claim is **rewritten, prominently**: that on the pre-registered
draw the model did not beat counting prior admissions, and that across 50 re-splits
the criterion would have passed in the majority. `METHODS.md` §2 is amended in the
same terms.

`Triage_M0_Summary.md` gains a forward link and is **not** retro-edited. It is the
record of a decision correctly made on the information then available, and altering
it would destroy the only thing it is evidence of.

### 4.4 Borderline outcomes

A result within **±0.04** of a band boundary is reported **as borderline, in that
word**, and the **more conservative** band applies — the one requiring the larger
amendment. `N` is not extended and no further splits are run. The resolution limit
of a 50-split sweep is stated in the summary.

### 4.5 What no outcome can do

**No result of M2 revives the build.** Triage is not re-specified around the model's
ranking under any value of `F_kill`. The M0 decision was taken on a pre-registered
draw under a pre-registered criterion; reversing it after re-measuring is precisely
the failure this project exists to demonstrate. The deployed application continues
to serve `number_inpatient`, and nothing under `api/` or `web/` is modified.

**M2 has authority over what this repository claims, and no authority over what it
builds.**

---

## 5. The divergence rate is published whatever it says

Three quantities, with `Δ` denoting amendment-set minus M0-set, per split:

| Symbol | Definition |
|---|---|
| `D_readme` | fraction of splits where `ΔAUC > 0` **and** `Δcaptured@200 < 0` |
| `D_sym` | fraction where `sign(ΔAUC) ≠ sign(Δcaptured@200)`, either direction |
| `r` | Pearson correlation between `ΔAUC` and `Δcaptured@200` across splits |

No band attaches to these; they are new measurements rather than re-tests of a
committed claim. The same discipline does attach:

**If `D_readme` is low, the README's third finding is overstated, and its wording is
softened in the same commit that publishes the number.**

That finding is currently carried as this project's most transferable contribution.
If it turns out to be a coincidence of one split, that is the most important thing
M2 can find, and it is declared here so that it cannot later be quietly omitted.

`D_sym` is reported alongside `D_readme` because the claim under test — *AUC and
decision value can disagree* — is directionless. The M0 observation ran one
direction; reporting only that direction would be selecting on the observed outcome.

---

## 6. What M2 cannot claim, declared in advance

- **The 50 estimates are not independent.** All draws come from the same 99,343
  encounters and the test sets overlap heavily. The spread measures *variability
  under re-splitting this dataset* and **understates** what fresh samples would
  show. The claim is bounded to the question `METHODS.md` §1.2 asks.
- **The divergence rate is between two specific feature sets on one dataset.** It
  converts the README's third finding from an anecdote into a measured rate. It does
  not establish a general property of AUC.
- **Nothing about tuned models.** Unchanged from `METHODS.md` §1.2.
- **Nothing about capacities beyond those already published.**
- **Nothing clinical, and nothing about hospitals today.** Unchanged.

---

## 7. Re-runs

The sweep is executed **once**.

A re-run is permitted **only** for a demonstrated implementation defect — an
exception, a failed self-check, a breached assertion. Every re-run and its cause is
logged in `Triage_M2_Summary.md` beside the account of what else broke.

**A re-run because the result was unwelcome is not permitted and voids the
milestone.**

---

## The commitment

The parameters in §2, the self-check in §3, and the decision rule in §4 are fixed as
of this commit, before any M2 code exists.

The result is accepted whichever way it goes. If the sweep shows that the published
interval was too narrow, or that the conclusion turns on the draw, or that the
README's third finding does not replicate — **those are published, in the README,
in the words above.**

A variance estimate that could only ever confirm the estimate it checks would not be
worth the hour of compute.
