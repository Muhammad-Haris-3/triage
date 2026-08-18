# Triage

**A model that could not beat counting — and the metric that would have hidden it.**

A hospital can follow up with a few hundred discharged patients a month. Triage
asked which few hundred, and whether a machine learning model picks them better
than a rule you could write in one line of SQL.

It does not. The interesting part is what that took to establish, and what almost
concealed it.

**[Try it](https://triage-brown.vercel.app)** — set a capacity, see what each method catches ·
[Decision memo](docs/decision_memo.md) (2 pages, no technical background needed) ·
[Decision to kill, in full](Triage_M0_Summary.md) ·
[The bar, set beforehand](Triage_SRS_v1.0.md) ·
[The one declared retry](PREREGISTRATION_M0_amendment.md)

---

## What it found

**1. The model does not beat counting prior admissions.**

At a capacity of 200 patients, ranking by `number_inpatient` — one integer
column, no model — captured **88.9** of the patients who actually returned within
30 days. An untuned gradient-boosted model captured **94.0**.

**Lift: 1.06x, 95% CI [0.92, 1.23].** The interval spans 1.0. Five extra patients
out of 200, indistinguishable from noise.

**2. The obvious baseline is nearly worthless, and would have made the model
look excellent.**

Hospitals typically target follow-up by age. In this data, age captures **28.2**
patients out of 200. Random selection captures **23.2**.

Age is barely better than chance, and the two overlap heavily — 12.5% of random
draws beat age outright. Benchmarked against it, the model shows a **3.33x**
improvement: a headline that would have been entirely true and entirely
meaningless, because sorting by prior admissions gets 3.15x of it without any
model at all.

**3. Adding better features raised AUC and made the decision worse.**

One declared retry added grouped diagnosis codes and admitting specialty:

| | AUC | Patients caught in top 200 |
|---|---|---|
| Without diagnosis | 0.6680 | **94.0** |
| With diagnosis | 0.6731 | **84.0** |

The standard metric improved. The number of at-risk patients actually reached
fell by **ten** — a 10.6% loss in the only region anyone can act on.

Nearly every published analysis of this dataset reports AUC. Following that
convention here would have meant shipping the richer model and reaching fewer of
the right people, with the metric moving in the right direction the whole time.

**That third finding is the one worth taking away.** The first two are about this
dataset. The third is about how the choice of metric decides what gets shipped.

---

## Why the question is shaped this way

Roughly one in nine patients discharged after a diabetes-related stay returns
within 30 days. The causes are mostly post-discharge: medication misunderstood or
never filled, no follow-up appointment booked, a wound infected at home. A nurse
phone call addresses exactly those, and it is cheap.

**Staff time is not cheap.** A follow-up team handles a few hundred patients a
month against a discharge volume in the thousands. Capacity is the binding
constraint and it does not move.

That changes what "good model" means. The hospital cannot act on 19,765 patients;
it acts on `k`. Everyone ranked below `k` is irrelevant to the decision no matter
how correctly they were classified. So the question is never *"how accurate is
the model"* — with an 11% base rate, predicting "nobody returns" is 89% accurate
and useless. The question is *"of the k we can reach, how many were the right
ones."*

---

## The measurement

Source: [Diabetes 130-US Hospitals, 1999–2008](https://archive.ics.uci.edu/dataset/296)
— 101,766 encounters, 130 hospitals, CC-BY 4.0.

After excluding deceased and hospice discharges: 99,343 encounters, 69,990
patients. Held-out test set: 19,765 encounters, 13,998 patients, 2,295 true
events (11.61%).

Patients captured in the top `k`, held-out data, ties broken randomly and
averaged over 200 draws:

| Method | k=50 | k=100 | **k=200** | k=500 | k=1000 |
|---|---|---|---|---|---|
| Random *(2,000 draws)* | 5.8 | 11.6 | 23.2 | 58.0 | 115.8 |
| Age band | 7.1 | 14.4 | 28.2 | 70.8 | 133.4 |
| Length of stay | 7.8 | 15.0 | 30.1 | 67.1 | 122.3 |
| **Prior admissions** | 25.8 | 51.3 | **88.9** | 183.9 | 300.0 |
| Model (untuned) | 25.0 | 46.0 | **94.0** | 196.0 | 323.0 |
| Model + diagnosis | 26.0 | 48.0 | **84.0** | 202.0 | 329.0 |

---

## What makes the negative result hard to dismiss

A null is only worth reading if it could not have been produced by carelessness.
Four mechanisms, each committed before the number it protects:

| Mechanism | What it prevents |
|---|---|
| **Kill criterion stated as a number** in the SRS before any data was loaded — *"if the 95% CI for lift@200 includes 1.0, publish the negative result"* | Deciding what counts as success after seeing the result |
| **The baseline is the strongest simple rule, not the one in use.** Prior admissions, chosen in the spec, not age | Beating a straw man and calling it a finding |
| **Split by patient, never by encounter.** 46% of encounters belong to repeat patients; a naive split would have leaked **41.6% of the test set** into training | Silent contamination that inflates everything with no visible symptom |
| **Ties broken randomly and averaged**, rule fixed before computing. `number_inpatient` is a small integer with heavy ties at the cutoff | Manufacturing a lift out of a tie-breaking convention |
| **Bootstrap resamples patients, not encounters** | An interval that is too narrow for the same reason a random split leaks |

And one more: the exclusion list was read from the dataset's own `IDS_mapping.csv`
rather than guessed. **Every death discharge code shows exactly 0.000% 30-day
readmission** — the list validating itself. Hospice codes showed 4.8% and 6.5%,
which corrected an assumption in the spec: hospice patients *can* be readmitted.
They stay excluded, but because they are not candidates for the intervention, not
because the event is impossible.

---

## What this does not show

- **That the model is useless in general.** It shows the model does not beat one
  strong column *at this capacity, on this data, untuned*. A tuned model, a
  different capacity, or a richer dataset might differ. Those were not tested,
  deliberately — see below.
- **That follow-up calls work.** This data records who was readmitted. It records
  nothing about interventions. No claim about programme effectiveness is made or
  supported.
- **Anything about hospitals today.** The data is from 1999–2008. Practice,
  coding and readmission policy have all changed. This is a demonstration of a
  targeting method on historical data.
- **Clinical guidance of any kind.** Nothing here should inform the care of any
  person.

## Why it stopped at two runs

Class weighting, resampling, hyperparameter search, other model classes, other
capacities, other metrics — any of them might have produced a lift above 1.5x.

None would have meant anything, because the search would have been conditioned on
already knowing the first two answers. The
[amendment declaration](PREREGISTRATION_M0_amendment.md) committed to one retry
and no third, in writing, before the retry ran. The commit sitting between the
first kill and the second run is the only thing distinguishing a second test from
p-hacking.

---

## Reproduce

```bash
python analysis/fetch_data.py   # downloads and verifies SHA-256, exits on mismatch
python analysis/m0.py           # exclusions, split, baselines, untuned model
python analysis/m0_amend.py     # the one declared retry
```

Requires `pandas`, `scikit-learn`, `numpy`. Seed pinned at 42; the source is
pinned by checksum in [`data/MANIFEST.json`](data/MANIFEST.json). Every number
above comes out of those two scripts.

Full parameters, and the limits of what these numbers support, are in
[`METHODS.md`](METHODS.md) — read §1 first.

---

## The application

[**triage-brown.vercel.app**](https://triage-brown.vercel.app) — Next.js on Vercel,
FastAPI on Render, PostgreSQL on Neon. All free tier.

Set a capacity and the comparison recomputes. The patient list is served from
**prior admissions**, the method that measurably performed best — not from the
model. Where the model appears it carries its measured lift and interval, because
its point estimate is higher and reading that number alone is the mistake this
project is about.

The API sleeps when idle on its free tier, so the first request after a quiet
period takes 30–50 seconds. The interface says so rather than looking broken.

---

## Provenance

The repository was initialised **after** M0 completed. Commit order reflects
working order — the specification was written before any data was loaded, and the
amendment was declared before it ran — but the timestamps are not independent
evidence of that, because nothing was committed as it happened.

That is stated plainly because the project's one substantive claim is *"the bar
was set before the result was known,"* and a project built on that claim cannot
afford to overstate its own provenance. Commits from here on land as the work
happens.

---

## Documents

| | |
|---|---|
| [`Triage_SRS_v1.0.md`](Triage_SRS_v1.0.md) | Requirements, baselines, metric, kill criterion — written before any data |
| [`Triage_M0_Spec.md`](Triage_M0_Spec.md) | The milestone that answers one question and stops |
| [`PREREGISTRATION_M0_amendment.md`](PREREGISTRATION_M0_amendment.md) | The single declared retry |
| [`Triage_M0_Summary.md`](Triage_M0_Summary.md) | Every measurement, both runs, what broke, the decision |
| [`docs/decision_memo.md`](docs/decision_memo.md) | Two pages for a non-technical reader: what to change, and what not to buy |
| [`METHODS.md`](METHODS.md) | Every parameter, every failure, and what cannot be claimed |
| [`Triage_M1_Spec.md`](Triage_M1_Spec.md) | The application, re-scoped around the comparison after the kill |
| [`Triage_M1_Summary.md`](Triage_M1_Summary.md) | What was built and deployed, and the seven things that broke |
