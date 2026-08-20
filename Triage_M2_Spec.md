# Triage — M2 Specification

**Milestone:** M2 — Split variability and the AUC-divergence rate
**Author:** Muhammad Haris Khokhar
**Date:** 2026-08-20
**Status:** Not started
**Depends on:** `Triage_M0_Summary.md`, `PREREGISTRATION_M0_amendment.md`, `METHODS.md` §1.2
**Supersedes:** nothing. SRS §12's M1–M7 was cancelled by the M0 kill; M1 was
re-scoped and completed. M2 is defined from what the project's own documents still
concede.

---

## 1. Why this milestone exists

`METHODS.md` §1.2 names the project's sharpest surviving weakness in its own words:

> The train/test split is **a single draw** at seed 42. The bootstrap quantifies
> sampling variability *within* the test set. It does **not** quantify variability
> across different splits. A different seed could move the point estimate.

Every headline figure in the repository — 1.06x, [0.92, 1.23], 88.9, 94.0, 0.6680 —
descends from one permutation. The bootstrap that guards them resamples patients
*inside* that one test set; it cannot see the variance introduced by having drawn
the test set differently.

Second, the finding the README calls the transferable one —

> **Adding better features raised AUC and made the decision worse.**

— rests on **n = 1**. One feature-set comparison, on that same single split. It is
presented as a general lesson about metric choice while being, as measured, an
anecdote. Either it survives being measured as a rate, or the README overstates it.

M2 measures both. It is one compute pass: the same fits that give the lift
distribution give the divergence rate.

---

## 2. The conflict with the amendment, and how it is resolved

`PREREGISTRATION_M0_amendment.md` closes:

> **No further feature sets, model classes, hyperparameters, capacities, or metrics
> are tried. No third attempt.**

M2 performs roughly 100 model fits. That has to be confronted before a line of code
is written, because a milestone that quietly violates the project's own commitment
device destroys more credibility than the measurement creates.

**The clause prohibits searching the configuration space until something clears the
bar.** Its list is exactly that: feature sets, model classes, hyperparameters,
capacities, metrics. M2 varies **none of them**. It holds every declared choice
fixed and varies only the train/test partition, to estimate the sampling
distribution of a number that has already been published.

The distinction is operational, not rhetorical:

| | Prohibited search | M2 |
|---|---|---|
| What varies | the configuration | the split |
| What is being asked | "which setup wins?" | "how stable was the number we printed?" |
| Can the answer make the published result look worse? | No — a search runs only until it looks better | **Yes, and it is as likely to** |
| Stopping rule | until the bar is cleared | fixed count, declared before execution |

An honest test of that distinction is whether the procedure can hurt. It can: M2
may well show the published interval was too narrow and the claim less certain than
stated. A search never carries that risk, which is what makes it a search.

### 2.1 Two invariants, binding for the whole milestone

**I-1 — M2 cannot revive the build.** No outcome re-specifies Triage around the
model's ranking. The M0 decision was taken on a pre-registered draw under a
pre-registered criterion; reversing it after re-measuring is precisely the failure
this project exists to demonstrate. The deployed application continues to serve
`number_inpatient`.

**I-2 — M2 can, and where the declared rule requires it must, amend the published
claim.** A measurement that no result could change is theatre. §5 fixes what
outcome forces which amendment, in both directions, before the run.

The line between them: **M2 has authority over what the repository claims, and no
authority over what it builds.**

---

## 3. Scope

### In scope

- Repeated patient-level re-splitting, `N = 50`, using M0's exact split procedure.
- Per split: all four baselines, the M0-feature model, the amendment-feature model,
  captured@k for every k in {50, 100, 200, 500, 1000}, AUC for both models, and a
  patient-level bootstrap CI for lift@200.
- The distribution of lift@200, and the fraction of splits that would have fired the
  kill criterion.
- The AUC-versus-captured divergence rate between the two declared feature sets.
- `analysis/m2_results.json`, a summary document, and the amendments §5 requires to
  `METHODS.md` and `README.md`.

### Explicitly out of scope

Tuning of any kind. New features. New model classes. New capacities beyond the k
grid already published. Any change to the deployed application, its database, its
API, or its export. Anything requiring a fit not already declared in M0 or its
amendment.

**No file under `api/` or `web/` is modified in M2.**

### 3.1 `m0_results.json` is frozen

`api/test_api.py` asserts the deployed API matches `analysis/m0_results.json`. M2
writes `analysis/m2_results.json` and **must not touch** `m0_results.json`. This is
an acceptance criterion, not a convention: it is the mechanism that stops a
re-measurement from silently altering what the live site reports.

---

## 4. Design

### 4.1 What varies, and what does not

Only the split varies. Held fixed, identical to M0:

- Exclusion list (discharge codes 11, 13, 14, 19, 20, 21)
- Target definition (`readmitted == "<30"`)
- Both feature sets, exactly as declared — the M0 set and the amendment set
- `HistGradientBoostingClassifier` at library defaults, `random_state=42`
- Baselines B1–B4 and the random tie-break rule, 200 draws
- Primary metric: lift@200 against B1
- Bootstrap at patient level, percentile interval, 95%

### 4.2 The splits

`N = 50` independent patient-level 80/20 draws at seeds `0 … 49`, produced by
replaying `m0.py`'s split procedure verbatim with the seed substituted:

```python
rng = np.random.default_rng(s)
perm = rng.permutation(clean.patient_nbr.unique())
n_tr = int(0.8 * len(perm))
```

Independent draws rather than cross-validation folds, deliberately: folds within a
repeat are negatively correlated by construction, whereas independent draws are
members of exactly the family M0 sampled from once. The question `METHODS.md` §1.2
asks is *"what if a different seed had been used"*, and this answers that question
literally.

**Seed 42 lies inside the swept range and reproduces the published split exactly** —
`permutation` is the first call on the generator in `m0.py`, so the partition is
identical. The published result is therefore a member of its own distribution, and
its percentile within that distribution is reportable. That is the single most
informative number M2 can produce.

`N = 50` is fixed here and **is not extendable after seeing the results.** Extending
the sweep because the answer landed near a threshold is the same defect as adding a
third feature set. §5.4 states how a borderline outcome is handled instead.

### 4.3 Bootstrap resamples

2,000 resamples per split × 50 splits × 2 feature sets is 105 minutes of bootstrap
alone, measured. M2 uses **500 resamples per split**, with the full 2,000 retained
on the seed-42 split so the published interval reproduces exactly.

The quantity the decision rule consumes is *whether the interval covers 1.0*, not
its endpoints to two decimals. 500 percentile resamples resolve that adequately.
The reduction is declared here rather than chosen at runtime, and the seed-42
comparison at both 500 and 2,000 is published so the cost of the reduction is
visible rather than asserted.

### 4.4 Leakage discipline under re-splitting

The amendment feature set derives `medical_specialty`'s top-25 levels **from the
training set**. Under re-splitting this must be **recomputed inside each split's own
training partition**, never frozen from seed 42. Freezing it would leak test
information into all 49 other splits — the same class of contamination DC-1 exists
to prevent, in a form that produces no visible symptom.

The ICD-9 grouping is a fixed function of the code and carries no data dependence;
it is reused unchanged.

### 4.5 Quantities produced

**Primary — split variability**

| Symbol | Definition |
|---|---|
| `lift_s` | lift@200 vs B1 on split `s`, M0 feature set |
| `F_kill` | fraction of the 50 splits whose 95% CI for `lift_s` **includes** 1.0 |
| `F_win` | fraction of splits where the model's captured@200 exceeds B1's at all, point estimate, no interval |
| `pctile_42` | the percentile of the published 1.06x within the 50 `lift_s` values |
| `spread` | the 2.5th–97.5th percentile range of `lift_s` across splits, and its width against the published bootstrap width of 0.31 |

`F_win` is the legible number: how often counting prior admissions beat the model
outright. If it sits near a half, that sentence needs no statistical training to
land.

`spread` versus the published interval is the direct answer to §1: if the
across-split range is wider than [0.92, 1.23], then the interval this project has
been publishing understates its own uncertainty, and `METHODS.md` says so.

**Secondary — the divergence rate**

Per split, with `Δ` denoting amendment-set minus M0-set:

| Symbol | Definition |
|---|---|
| `D_readme` | fraction of splits where `ΔAUC > 0` **and** `Δcaptured@200 < 0` — the README's finding 3, as a rate |
| `D_sym` | fraction of splits where `sign(ΔAUC) ≠ sign(Δcaptured@200)`, either direction |
| `r` | Pearson correlation between `ΔAUC` and `Δcaptured@200` across splits |

`D_sym` is the fairer statistic and is reported alongside `D_readme`. The general
claim being tested is *"AUC and decision value can disagree"*, which is
directionless; the observed M0 case was one direction, and reporting only that
direction selects on the observed outcome.

**Also reported:** the distribution of B1's own captured@200 — the bar itself moves
across splits, and its variability belongs in the record.

### 4.6 What this cannot claim

Declared now, not discovered afterwards:

- **The 50 estimates are not independent.** All 50 draws come from the same 99,343
  encounters; the test sets overlap heavily. The spread therefore measures
  *variability under re-splitting this dataset* and **understates** what would be
  seen across genuinely fresh samples. The claim is bounded to the question §1.2
  actually asks.
- **The divergence rate is between two specific feature sets on one dataset.** It
  makes the README's finding 3 a measured rate rather than an anecdote. It does not
  make it a general property of AUC.
- **Nothing about tuned models** — unchanged from `METHODS.md` §1.2.
- **Nothing about capacities other than those already published.**

### 4.7 Compute

Measured on the development machine, 2026-08-20:

| Component | Measured | × | Total |
|---|---|---|---|
| Model fit, 79,578 × 139 | 14.0 s | 100 | ~23 min |
| Bootstrap, 500 resamples | 16 s | 100 | ~27 min |
| captured@k, 200 tie-break draws | ~0.3 s | ~1,750 | ~9 min |
| Load, split, encode | ~3 s | 50 | ~3 min |
| | | | **~62 min** |

A single batch run. If it exceeds 2 hours the run is stopped and the cause
investigated, rather than the parameters reduced mid-flight.

---

## 5. The decision rule — declared before execution

The primary statistic is **`F_kill`**: the fraction of the 50 splits whose own 95%
bootstrap CI for lift@200 includes 1.0 — SRS §13.1's criterion, applied 50 times.

The published draw fired that criterion. The question is whether it was typical.

### 5.1 `F_kill ≥ 0.90` — the null is confirmed as split-robust

The single-draw caveat in `METHODS.md` §1.2 is **replaced** by the measured
distribution. The README gains one line stating the conclusion held in `F_kill` of
50 re-splits. The central claim in `METHODS.md` §2 is strengthened from a
single-split statement to a distributional one.

### 5.2 `0.50 < F_kill < 0.90` — split-dependent, null stands but weakened

The negative result stands — it remains the majority outcome and it remains what was
pre-registered — but `METHODS.md` §1.2 and §2 are amended to state plainly that the
conclusion depends on the draw, that the published 1.06x is one sample from a
distribution spanning both conclusions, and in what fraction of draws the opposite
decision would have been reached. The README's claim is qualified in its own text,
not in a footnote.

### 5.3 `F_kill ≤ 0.50` — the published draw was unrepresentative

The README's central claim is **rewritten**, prominently, to state that on the
pre-registered draw the model did not beat counting prior admissions, and that
across 50 re-splits the criterion would have passed in the majority. `METHODS.md` §2
is amended in the same terms. `Triage_M0_Summary.md` gains a linked note; its text
is not retro-edited, because it is the record of a decision that was correctly made
on the information available.

**I-1 still binds.** The application is not re-specified around the model. What
changes is what the repository claims, not what it serves — and the summary states
that distinction explicitly, because a reader is entitled to ask why.

### 5.4 Borderline outcomes

A result landing within ±0.04 of a band boundary is reported **as borderline**, in
those words, and the **more conservative** band applies — the one demanding the
larger amendment. `N` is not extended, no further splits are run, and the resolution
limit of a 50-split sweep is stated in the summary.

### 5.5 The divergence rate carries no decision, and is published regardless

`D_readme`, `D_sym` and `r` are new measurements, not re-tests of a committed claim,
so no band applies. But the same discipline does: **they are published whatever they
say.** If `D_readme` is low, the README's finding 3 is overstated and its wording is
softened in the same commit that publishes the number. That finding is currently
carried as the project's most transferable contribution; if it is a coincidence of
one split, that is the most important thing M2 can find.

### 5.6 Re-runs

The sweep is executed **once**. A re-run is permitted only for a *demonstrated
implementation defect* — an exception, a failed self-check, an assertion breach — and
every re-run, with its cause, is logged in the summary alongside the M0-style
account of what broke. A re-run because the result was unwelcome is not permitted
and would void the milestone.

---

## 6. Tasks

### M2-T1 — Pre-registration, committed before any code exists

`PREREGISTRATION_M2.md`: the §4.1–4.5 parameters and the §5 decision rule, extracted
and committed **as its own commit, before `m2_cv.py` is written**. The commit sitting
between the declaration and the run is the only thing distinguishing this from
re-measuring until the answer improves — the same argument
`PREREGISTRATION_M0_amendment.md` makes for itself.

### M2-T2 — `analysis/m2_cv.py`

The harness. Before the sweep begins it **reproduces the seed-42 split and asserts
the published M0 figures** — `(len(tr), len(te)) == (79578, 19765)`, AUC 0.6680 to
four decimals, B1 captured@200 = 88.9, model captured@200 = 94.0, lift 1.06.

**If that self-check fails, the sweep does not run.** A harness that cannot reproduce
the published number cannot be trusted to characterise it, and 50 splits of a subtly
different procedure would produce a confident answer to a different question.

Also asserts, per split: no patient appears in both partitions; `medical_specialty`
levels derive from that split's training rows only (§4.4).

### M2-T3 — Execute once

One batch run. Runtime logged. Output: `analysis/m2_results.json` — all 50 rows of
per-split figures, plus the aggregates of §4.5. Raw per-split values are retained,
not only summaries, so any statistic can be recomputed without a re-run.

### M2-T4 — `Triage_M2_Summary.md`

Every measurement, the band that fired, the amendments made, and a §4-style account
of what broke — in the house style, including the parts that look careless.

### M2-T5 — Amendments

`METHODS.md` §1.2 and §2, and `README.md`, edited per the band §5 selected, in the
same commit as the numbers that forced them. If §5.5 requires softening finding 3,
that lands here too.

---

## 7. Acceptance criteria

| # | Criterion |
|---|---|
| AC-M2-1 | `PREREGISTRATION_M2.md` committed in a commit that predates `analysis/m2_cv.py` |
| AC-M2-2 | The harness reproduces M0's published figures on seed 42, asserted, before the sweep runs |
| AC-M2-3 | 50 splits at seeds 0–49, M0's split procedure unmodified |
| AC-M2-4 | `analysis/m0_results.json` byte-identical after M2; nothing under `api/` or `web/` modified |
| AC-M2-5 | No tuning, no new feature set, no new model class, no new capacity |
| AC-M2-6 | Per-split `medical_specialty` levels derived from that split's training rows, asserted |
| AC-M2-7 | Per-split raw figures retained in `m2_results.json`, not only aggregates |
| AC-M2-8 | The band that fired is named explicitly in the summary, and its amendments are made |
| AC-M2-9 | `D_readme`, `D_sym` and `r` published whatever their values; finding 3 softened if low |
| AC-M2-10 | §4.6's limits restated in `METHODS.md`, including the non-independence of the 50 draws |
| AC-M2-11 | Every re-run, with cause, logged in the summary |

---

## 8. What M2 must not become

- **A search for a better split.** The stopping rule is fixed at 50 and the decision
  rule is fixed before the run. Reporting the best-performing split, or extending the
  sweep after seeing a borderline number, voids the milestone.
- **A rehabilitation of the model.** I-1 binds under every outcome. M2 has authority
  over what the repository claims and none over what it builds.
- **A retro-edit of the M0 record.** `Triage_M0_Summary.md` documents a decision
  correctly made on the information then available. It gains a forward link, never a
  rewrite.
- **A frontend change.** Analysis and documents only. Whether any M2 figure reaches
  the application is a separate, later decision, taken once the numbers exist.

---

## 9. Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-20 | M2 scoped: split variability and the AUC-divergence rate. |
