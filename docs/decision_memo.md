# Decision memo — we are calling the wrong patients, and a model will not fix it

**To:** Readmissions Programme / Discharge Planning
**From:** Muhammad Haris Khokhar
**Date:** 2026-08-19
**Decision requested:** change the follow-up targeting rule from age to prior
admissions, and do not commission a predictive model

---

## The finding

Our follow-up team can call about 200 patients a month. We choose them by age.

**Age tells us almost nothing.** Out of 200 patients chosen by age, about **28**
were actually readmitted within 30 days. Out of 200 chosen completely at random,
about **23** were. Age buys us five patients over picking names out of a hat, and
the two overlap so heavily that a lucky random draw beats age one time in eight.

There is one piece of information already in every patient record that does far
better: **how many times the patient has been admitted in the past year.**

| Out of every 200 patients we call | Actually readmitted within 30 days |
|---|---|
| Chosen at random | 23 |
| Chosen by age *(what we do now)* | 28 |
| Chosen by length of stay | 30 |
| **Chosen by prior admissions** | **89** |

Same two nurses. Same 200 calls. **Three times as many of the patients who
actually came back.**

Put another way: 44% of the patients that rule selects were readmitted, against a
hospital-wide rate of 12%.

---

## What we recommend

**Sort by prior admissions instead of age. Start next month.**

This is not a system, a purchase, or a project. It is a different sort order on a
column we already collect. There is nothing to install and no one to train beyond
telling the team which list to work from.

For a team making 200 calls a month, this reaches roughly **730 more at-risk
patients a year** than the current rule — at no additional cost, using no
additional staff.

---

## And do not build a predictive model

We tested one. On 100,000 patient records, a modern machine learning model was
given every field we hold and asked to do better than that single column.

| Out of every 200 patients | Actually readmitted |
|---|---|
| Prior admissions alone | 88.9 |
| Machine learning model | 94.0 |

**Five patients. And the difference is within the margin of error** — repeated
testing puts the true improvement anywhere between 8% *worse* and 23% better.

We then gave the model more to work with, adding diagnosis information. It got
**worse**: down to 84 patients. Ten fewer than before.

A model is a system that needs building, hosting, monitoring, explaining to
clinicians, and rebuilding when it drifts. We cannot show it would find a single
additional patient. **The recommendation is to spend nothing on it.**

---

## One thing to watch for

When the diagnosis information was added, the model's **standard industry score
went up** while the number of at-risk patients it actually found went **down**.

That score — you may hear it called AUC — measures how well a model ranks *all*
patients. But we cannot call all patients. We call 200. A model can improve its
overall ranking while getting worse at the only part that matters to us.

**If anyone offers us a readmission model, do not accept a score.** Ask one
question:

> *Of the 200 patients your model picks, how many were actually readmitted — and
> how does that compare to sorting by prior admissions?*

If they cannot answer in those terms, the number they are showing us does not
describe our decision.

---

## What this does not tell us

**We have not shown that calling patients helps.** This work identifies who is
likely to return. It says nothing about whether our intervention changes that.
That would need a trial comparing patients we call against patients we do not.

**That is why there is no money figure in this memo.** Any savings estimate would
be our assumption about how well the calls work, multiplied by a real number, and
presented as though the whole thing were measured. If we want a financial case,
the honest way to get one is to run the trial.

**The analysis uses historical US hospital data (1999–2008).** The finding that
prior admissions strongly predicts readmission is well established and unlikely
to have reversed, but the exact figures should be re-checked against our own
records before we rely on the size of the effect.

**Everything above assumes a capacity of about 200.** The comparison could look
different at 20 or at 2,000, and would need re-running.

---

## In one line

We are choosing follow-up patients by a rule that performs barely better than
chance, when a column already in the record does three times better — and the expensive
solution everyone would reach for adds nothing we can measure.

*Full method, code and measurements: [Triage repository](../README.md).*
