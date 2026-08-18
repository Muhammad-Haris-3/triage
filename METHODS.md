# Triage — Methods

**How the numbers are produced, and what would invalidate them.**

Read §1 first. It is the list of things this project got wrong or cannot claim,
and it is at the top deliberately. A methods document whose limitations live in
an appendix is a sales document.

---

## 1. What went wrong, and what cannot be claimed

### 1.1 Failures found and fixed

| What happened | Consequence if missed | Found by |
|---|---|---|
| Feature selection used `dtype == object` to find categoricals. The installed pandas does not type string columns as `object`, so the filter matched **0 of 30** columns | The model would have trained on 11 of 41 intended features and returned a plausible number with no error | The fit crashing on the literal string `Caucasian`. **Nothing else would have caught it** |
| A probe loop reused one output filename across two URLs; the second returned 404, overwriting the real archive. The manifest recorded a checksum for a **9-byte error page** | The reproducibility guarantee would have verified against an error page | Printing the byte count beside the digest |
| The M0 spec asserted every excluded row must show ~0% readmission. Hospice codes show **4.8%** and **6.5%** | An unexamined assumption would have stayed in the spec, wrongly justifying a correct exclusion | The per-code breakdown in M0-T3, which existed only because the spec demanded the exclusion validate itself |
| The dataset's documented archive URL returns 404 | Reproduction instructions would not work for anyone else | Attempting the download |

Each is written up in [`Triage_M0_Summary.md`](Triage_M0_Summary.md) §4,
including the ones that make the work look careless.

The first entry is the one worth dwelling on. It was a **silently empty filter**:
no exception, no warning, a result that would have looked entirely normal. It was
caught by luck — a downstream estimator that refused strings — not by any test in
this project. A green test suite would not have found it.

### 1.2 What cannot be claimed

**Nothing about whether follow-up calls work.** The data records who was
readmitted. It records no interventions. Every statement here is about *ranking
risk*, never about changing it. This is why no monetary figure appears anywhere
in the repository.

**Nothing about tuned models.** Only library defaults were tested, deliberately
(`Triage_M0_Spec.md` §7). A tuned model may do better. That was not measured, and
the reason it was not measured — searching until something clears a
pre-registered bar destroys the bar — is itself a finding, not an oversight.

**Nothing about split variability.** This is the sharpest limitation and it is
stated plainly:

> The train/test split is **a single draw** at seed 42. The bootstrap quantifies
> sampling variability *within the test set*. It does **not** quantify variability
> across different splits. A different seed could move the point estimate.

Repeated grouped cross-validation would address this and was not performed. The
conclusion is robust in direction — both runs put the interval across 1.0, and
the amendment moved it *down* — but the point estimates 1.06 and 0.94 should be
read as one draw each, not as stable quantities.

**Nothing about capacities other than k=200.** Captured counts are reported for
k ∈ {50, 100, 200, 500, 1000}, but the confidence interval and the kill criterion
were computed at k=200 only.

**Nothing about hospitals operating today.** The data is 1999–2008.

**The repository's own provenance is limited.** It was initialised after M0
completed. Commit order reflects working order; the timestamps are not
independent evidence of it. See the README's Provenance section.

---

## 2. The central claim, and what protects it

The claim is narrow and stated in full:

> On the Diabetes 130-US Hospitals dataset, using a single patient-level 80/20
> split at seed 42 and evaluating on held-out patients at a capacity of 200, an
> untuned `HistGradientBoostingClassifier` does not achieve a lift over ranking
> by `number_inpatient` whose 95% bootstrap interval excludes 1.0.

Five mechanisms protect it, each fixed before the number it guards:

| Mechanism | Failure prevented | Where committed |
|---|---|---|
| Kill criterion as a number | Choosing the success threshold after seeing the result | SRS §13.1, commit `a5014f9` |
| Baseline is the strongest simple rule, not the incumbent | Beating a straw man | SRS §11.3 |
| Grouped split by patient | Contamination with no visible symptom | SRS DC-1 |
| Tie rule fixed before computing | Manufacturing lift from a tie convention | M0 spec T5 |
| Bootstrap at patient level | An interval that is too narrow | M0 spec T7 |

---

## 3. The metric

**Primary: lift@200 = (events captured by the model in its top 200) / (events
captured by B1 in its top 200).**

Accuracy is not used. The base rate is 11.61% in the test set, so a constant
"no readmission" prediction is 88.4% accurate and selects nobody.

AUC is reported for comparability with published work on this dataset **and for
no other purpose**. §7.2 records what happened when the two metrics disagreed.

---

## 4. Data preparation

### 4.1 Source

| | |
|---|---|
| URL | `https://archive.ics.uci.edu/static/public/296/data.csv` |
| SHA-256 | `f792c388d9b470aac4fbf21c39b176534d55a116e7626881c30bbe7ab0341422` |
| Shape | 101,766 × 50 |
| Licence | CC-BY 4.0 |
| Retrieved | 2026-08-19 |

`IDS_mapping.csv` comes from
`diabetes+130-us+hospitals+for+years+1999-2008.zip`, SHA-256
`f82ac129da2ddd2299391ff6fbae3a6a58b3edcf59ac9d7bd480c00fe453112a`.

`analysis/fetch_data.py` verifies both and calls `sys.exit` on mismatch rather
than continuing.

### 4.2 Target

`y = 1 if readmitted == '<30' else 0`. `>30` collapses into the negative class:
the intervention being modelled addresses the post-discharge handoff, whose
failure window is days to weeks. Fixed before analysis.

### 4.3 Missing values

`?` → null at load, across the whole frame, before any column is inspected.

### 4.4 Exclusions

Discharge disposition codes **11, 13, 14, 19, 20, 21**, read from
`IDS_mapping.csv`, not guessed. 2,423 rows removed.

Per-code 30-day readmission rate:

| Code | Meaning | Rows | Rate |
|---|---|---|---|
| 11 | Expired | 1,642 | **0.000%** |
| 13 | Hospice / home | 399 | 4.762% |
| 14 | Hospice / medical facility | 372 | 6.452% |
| 19 | Expired at home (hospice) | 8 | **0.000%** |
| 20 | Expired in medical facility (hospice) | 2 | **0.000%** |
| 21 | Expired, place unknown (hospice) | 0 | — |

**Every death code is exactly 0.000%.** That is the check: a non-zero rate on any
death code would have meant the mapping was misread. The hospice codes are not
zero because hospice patients can be readmitted; they remain excluded because
they are not candidates for a readmission-prevention programme, which is a
different justification from the one the spec originally gave.

Base rate: 11.16% before exclusion (11,357 / 101,766), **11.39% after**
(11,314 / 99,343).

---

## 5. Leakage controls

`patient_nbr` repeats. 99,343 encounters belong to 69,990 patients; **16,341
patients (23.3%) have more than one encounter, accounting for 45,694 encounters —
46.0% of the data.**

Split procedure:

```python
rng   = np.random.default_rng(42)
pats  = clean.patient_nbr.unique()
perm  = rng.permutation(pats)
train = set(perm[:int(0.8 * len(perm))])
```

Yielding train 79,578 encounters / 55,992 patients, test 19,765 / 13,998. The
assertion `set(train.patient_nbr) & set(test.patient_nbr) == set()` runs on every
execution.

**The counterfactual, measured rather than asserted:** an encounter-level random
split at the same ratio would have placed **8,264 test rows — 41.6% of the test
set — in training under a different row of the same patient.**

Nearly half the evaluation would have been contaminated, with no symptom visible
in any metric.

---

## 6. Baselines and tie-breaking

| ID | Rule |
|---|---|
| **B1** | `number_inpatient` descending — **primary** |
| B2 | Age band descending (lower bound of the bracket) |
| B3 | `time_in_hospital` descending |
| B4 | Uniform random |

`number_inpatient` is a small integer, so ties at the k=200 cutoff are heavy.
Ties are broken **uniformly at random and averaged over 200 draws**:

```python
order = np.lexsort((rng.random(len(score)), -score))[:k]
```

The rule was fixed in `Triage_M0_Spec.md` before any baseline was computed.
Giving B1 its worst-case ordering would have manufactured a lift out of a
convention.

**Note:** tie-breaking affects only the baselines. Model scores are continuous
floats with no ties, so all 200 draws return an identical count — which is why
the model's figures are whole numbers (94.0, 84.0) and B1's are not (88.9).

---

## 7. The model

### 7.1 Run 1 — M0 as specified

```python
HistGradientBoostingClassifier(random_state=42)   # every other parameter default
```

No tuning, no search, no class weighting, no resampling.

Dropped: `encounter_id`, `patient_nbr`, `readmitted`, `y`, `weight`,
`diag_1/2/3`, `payer_code`, `medical_specialty`.

Retained: 11 numeric + 30 categorical with ≤25 levels, one-hot encoded with
`dummy_na=True`. Test columns reindexed to the training columns, missing filled
with 0. **139 design columns.**

| | k=50 | k=100 | k=200 | k=500 | k=1000 |
|---|---|---|---|---|---|
| B1 | 25.8 | 51.3 | **88.9** | 183.9 | 300.0 |
| Model | 25.0 | 46.0 | **94.0** | 196.0 | 323.0 |

AUC 0.6680. Precision@200: 47.0% model, 44.4% B1.
**Lift@200 = 94.0 / 88.9 = 1.057.**

### 7.2 Run 2 — Amendment 1

Adds grouped ICD-9 `diag_1/2/3` (9 categories, mapping fixed in
[`PREREGISTRATION_M0_amendment.md`](PREREGISTRATION_M0_amendment.md)) and
`medical_specialty` reduced to its **top 25 levels by training-set frequency**,
remainder `other`. **196 design columns.** Everything else identical, including
the split object itself.

| | k=50 | k=100 | k=200 | k=500 | k=1000 |
|---|---|---|---|---|---|
| Model + diagnosis | 26.0 | 48.0 | **84.0** | 202.0 | 329.0 |

AUC **0.6731** (up from 0.6680). Captured@200 **84.0** (down from 94.0).
**Lift@200 = 84.0 / 88.9 = 0.945.**

The two metrics moved in opposite directions. AUC measures ranking across all
19,765 test encounters; captured@200 measures only the top 200. A model can
improve the former while degrading the latter, and here it did — by ten patients,
a 10.6% loss in the only region that is actionable.

---

## 8. The bootstrap

2,000 resamples. **Patients** are sampled with replacement; every encounter
belonging to a drawn patient enters the resample. Resampling encounters would
understate the interval for the same reason an encounter-level split leaks.

Within each resample, tie-breaking uses a **single draw** with a fresh seed
rather than a 200-draw average. This folds tie noise into the interval instead of
averaging it away — the wider, more conservative choice.

Resamples where B1 captures zero events are skipped, since the ratio is
undefined. This did not occur in either run.

Interval: 2.5th and 97.5th percentiles of the resampled lift distribution.

| Run | Lift@200 | 95% CI |
|---|---|---|
| M0 | 1.06 | [0.92, 1.23] |
| Amendment 1 | 0.94 | [0.83, 1.17] |

Both include 1.0. The kill criterion fired twice.

---

## 9. Why the second run is a second test and not p-hacking

The M0 feature restriction was chosen for speed, not on principle. It dropped the
dataset's largest unused signal, so *"does a model with diagnosis information beat
counting?"* was genuinely untested by Run 1.

The distinction that makes Run 2 legitimate is **entirely one of ordering**:

1. Run 1 completed; the kill criterion fired.
2. `PREREGISTRATION_M0_amendment.md` was written, fixing the ICD-9 mapping, the
   specialty cutoff, everything held constant, and a **one-shot** commitment.
3. It was committed (`e1aeaf8`).
4. Run 2 executed and was committed (`91a2074`).

The declaration commit sits between the two runs. Had Run 2 been run first and
the declaration written afterwards, the file would be identical and the result
worthless.

Not attempted after Run 2: class weighting, resampling, hyperparameter search,
alternative model classes, alternative capacities, alternative metrics,
alternative seeds. Any might have cleared 1.5x. None would have meant anything,
because the search would have been conditioned on knowing the first two answers.

---

## 10. Reproducibility

```bash
python analysis/fetch_data.py   # verifies both SHA-256 digests, exits on mismatch
python analysis/m0.py           # §4, §5, §6, §7.1, §8
python analysis/m0_amend.py     # §7.2, §8
```

Requires `pandas`, `scikit-learn`, `numpy`. Single seed (42) declared once and
imported everywhere; no module calls a random function without it.

`m0_amend.py` reconstructs the split by replaying the identical sequence of calls
on a fresh generator, rather than reading a saved partition — verified by
asserting the same encounter counts (79,578 / 19,765).

**Version sensitivity:** results are pinned to a seed, not to library versions.
`HistGradientBoostingClassifier` defaults may change between scikit-learn
releases, which would change the model's numbers. Run 1 and Run 2 were executed
on scikit-learn 1.9.0. Baselines, exclusions and the split are version-stable;
the model figures are not.

---

## 11. Known limits of the data

- **1999–2008.** Coding practice, readmission policy and clinical management have
  all changed.
- **Diabetes encounters only**, from 130 US hospitals. Not a general inpatient
  population.
- **No denominator for prior care.** `number_inpatient` counts admissions in the
  preceding year *as recorded in this dataset*, so a patient treated elsewhere
  appears lower-risk than they are. This limitation flatters neither the baseline
  nor the model — both see the same field.
- **`weight` is ~97% missing** and dropped. `payer_code` and `medical_specialty`
  are heavily missing; the latter enters Run 2 with missingness as its own level.
- **No cost, staffing or outcome fields.** Nothing supports a financial estimate,
  which is why none is made.
