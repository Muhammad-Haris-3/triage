# Triage — M1 Specification (revised)

**Milestone:** M1 — The comparison application
**Author:** Muhammad Haris Khokhar
**Date:** 2026-08-19
**Status:** Not started
**Depends on:** `Triage_SRS_v1.0.md`, `Triage_M0_Summary.md`
**Supersedes:** the M1–M7 plan in SRS §12, cancelled by the M0 kill

---

## 1. What changed

SRS §12 planned an application whose subject was **the model's ranking**. M0
measured that the model does not reliably beat ranking by `number_inpatient`
(1.06x, CI [0.92, 1.23]; 0.94x after the declared amendment).

That application cannot be built honestly. This one can, and its subject is
different:

> **Not "here is who the model picks." Instead: "here is what each way of
> picking gets you, at the capacity you actually have."**

The finding stops being a paragraph in a README and becomes the thing the visitor
operates. Moving a capacity control and watching age sit on top of random — and
watching the model's advantage over prior admissions fail to appear — is a more
direct demonstration than any table.

**Nothing measured in M0 is revisited.** No new model runs, no new features, no
tuning. M1 is engineering on top of a closed result.

---

## 2. The one question

> **Can a visitor who knows nothing about this project discover the finding by
> using the interface, without reading the README?**

If they leave believing the model is the recommended method, M1 has failed
regardless of how well it is built.

---

## 3. Scope

### In scope

- A per-encounter scoring export: every test-set encounter ranked under all five
  methods, plus a plain-language reason per patient.
- Logistic regression (SRS FR-10) fitted for **explanation only** — odds ratios,
  never as a competing ranker.
- PostgreSQL schema and loader.
- FastAPI read API.
- Next.js application: capacity control, method comparison, patient list,
  per-patient reasons, capacity curve, and the AUC-versus-captured view.
- Deployment to Vercel and Render.

### Explicitly out of scope

Retraining anything. New features. Tuning. Calibration beyond what is needed to
display a risk figure honestly. Authentication. Multi-tenancy. Any live patient
lookup. Any cost or savings estimate (SRS §3.1, third validity risk).

---

## 4. What the application serves, and what it must never imply

### 4.1 The default ranking is B1, not the model

The patient list is served from `number_inpatient` — the method that measurably
performed best. The model appears **only** in the comparison, never as the
recommendation.

This is the inversion of the original plan and it is the point. An application
that served the model's list while a page elsewhere admitted the model does not
work would be dishonest by construction.

### 4.2 Honesty requirements

Carried from the SRS, plus two new ones specific to this build:

| # | Requirement |
|---|---|
| NFR-10 | Historical-data and non-clinical notices on every page showing a patient-level number |
| NFR-11 | Measured and assumed quantities visually distinct. **In M1 there are no assumed quantities at all** — no cost inputs, no effectiveness sliders, nothing derived from a user assumption |
| **NFR-12** | The model is never presented as the recommended method. Where it appears, its measured lift and interval appear with it |
| **NFR-13** | Every count shown is a real count from held-out data, not a projection. Where a figure is scaled (for example "per year"), the scaling is stated inline |

### 4.3 The risk figure

The patient list shows a risk percentage. That figure comes from the calibrated
logistic regression, and the calibration curve is published in the application
(SRS FR-12). An uncalibrated probability is not displayed.

If calibration is poor, the risk column is replaced by a rank and a plain
descriptor rather than a number that misrepresents itself.

---

## 5. Tasks

### M1-T1 — Scoring export

Fit logistic regression on the M0 training split (unchanged split, seed 42).
Produce, for every test-set encounter:

- rank under each of B1, B2, B3, B4, model
- calibrated risk from the logistic model
- the top contributing factors, as plain-language strings
- the true outcome

Plus, precomputed: captured counts by method across k from 10 to 2000, and the
calibration curve.

Output: newline JSON, ready for the loader. No database yet.

### M1-T2 — Schema and loader

Neon PostgreSQL. Tables per SRS §10, application role `SELECT` only. Loader is
idempotent and re-runnable from the M1-T1 export.

### M1-T3 — API

FastAPI on Render:

| Endpoint | Returns |
|---|---|
| `GET /selection?k=` | Top `k` patients under the default method, with reasons |
| `GET /comparison?k=` | Captured counts and precision for every method at `k` |
| `GET /curve` | Captured counts by method across all `k` |
| `GET /evidence` | The M0 measurements: lifts, intervals, AUC, base rate |
| `GET /health` | Row counts and the loaded model version |

### M1-T4 — Application

Next.js on Vercel. Four views:

1. **Compare** — the capacity control and the method comparison. The landing view.
2. **The list** — top `k` patients with reasons.
3. **The curve** — captured counts across capacity, all methods.
4. **What this shows** — the AUC-versus-captured finding, the intervals, the limits.

### M1-T5 — Deployment

Both services live. Cold-start behaviour disclosed (NFR-6). Application numbers
identical to `analysis/m0_results.json`, asserted by a test.

### M1-T6 — Summary

`Triage_M1_Summary.md`: what was built, what broke, what was verified.

---

## 6. Acceptance criteria

| # | Criterion |
|---|---|
| AC-M1-1 | Every number in the application traceable to `m0_results.json` or the M1-T1 export |
| AC-M1-2 | Patient list served from B1; model never presented as recommended (NFR-12) |
| AC-M1-3 | Comparison view shows all five methods at any `k` |
| AC-M1-4 | Model's lift and interval displayed wherever the model appears |
| AC-M1-5 | Calibration curve published, or the risk figure withdrawn (§4.3) |
| AC-M1-6 | NFR-10 notices present on every patient-level view |
| AC-M1-7 | No cost, savings or effectiveness input anywhere |
| AC-M1-8 | Both services deployed and publicly reachable |
| AC-M1-9 | A test asserts application figures match the analysis output |

---

## 7. What M1 must not become

- **A rehabilitation of the model.** The result is closed. If the interface makes
  the model look better than 1.06x [0.92, 1.23], the interface is wrong.
- **A patient lookup.** No search by identifier, no individual risk enquiry. The
  unit of use is a capacity, not a person.
- **A savings calculator.** M0 established that this data cannot support one.

---

## 8. Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-19 | Revised M1 after the M0 kill. Supersedes SRS §12 M1–M7. |
