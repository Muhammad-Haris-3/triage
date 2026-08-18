"""Triage M1-T1 — scoring export for the comparison application.

Reuses the M0 split exactly (seed 42, same call order). Fits a logistic
regression for EXPLANATION ONLY, per Triage_M1_Spec.md 4.1 — it is never a
competing ranker. No model from M0 is retrained or retuned.

Outputs (analysis/export/):
  patients.jsonl   one row per test encounter: ranks under every method, risk, reasons
  comparison.json  captured counts by method across k
  evidence.json    M0 measurements, calibration curve, odds ratios
"""
import io, json, sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.preprocessing import StandardScaler

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
SEED = 42
EXCLUDE = [11, 13, 14, 19, 20, 21]
OUT = Path(__file__).parent / "export"
OUT.mkdir(exist_ok=True)
rng_global = np.random.default_rng(SEED)

# ---------------------------------------------------------------- data + split
df = pd.read_csv(Path(__file__).parent / "data.csv", low_memory=False).replace("?", np.nan)
df["y"] = (df["readmitted"] == "<30").astype(int)
clean = df[~df.discharge_disposition_id.isin(EXCLUDE)].copy()

pats = clean.patient_nbr.unique()
perm = rng_global.permutation(pats)
train_p = set(perm[: int(0.8 * len(perm))])
tr = clean[clean.patient_nbr.isin(train_p)].copy()
te = clean[~clean.patient_nbr.isin(train_p)].copy().reset_index(drop=True)
assert not (set(tr.patient_nbr) & set(te.patient_nbr))
assert (len(tr), len(te)) == (79578, 19765), (len(tr), len(te))
print(f"split reproduced: train {len(tr):,} / test {len(te):,}")

# ------------------------------------------------------- model (M0 run 1, as-is)
drop = ["encounter_id", "patient_nbr", "readmitted", "y", "weight",
        "diag_1", "diag_2", "diag_3", "payer_code", "medical_specialty"]
isnum = lambda c: pd.api.types.is_numeric_dtype(clean[c])
feat = [c for c in clean.columns if c not in drop]
cats = [c for c in feat if not isnum(c) and clean[c].nunique() <= 25]
nums = [c for c in feat if isnum(c)]

Xtr = pd.get_dummies(tr[nums + cats], columns=cats, dummy_na=True)
Xte = pd.get_dummies(te[nums + cats], columns=cats, dummy_na=True).reindex(
    columns=Xtr.columns, fill_value=0)
gbm = HistGradientBoostingClassifier(random_state=SEED).fit(Xtr, tr.y.values)
p_gbm = gbm.predict_proba(Xte)[:, 1]
print(f"GBM reproduced: AUC {roc_auc_score(te.y.values, p_gbm):.4f}  (M0: 0.6680)")

# ------------------------------------------- logistic regression — EXPLANATION ONLY
EXPLAIN = ["number_inpatient", "number_emergency", "number_outpatient",
           "time_in_hospital", "num_medications", "number_diagnoses",
           "num_lab_procedures", "num_procedures"]
# Two phrasings per factor. Which one is used depends on the SIGN of the
# fitted coefficient, not on the value: a factor with an odds ratio below 1 is
# protective, so it contributes to risk when it is LOW. Rendering "0 outpatient
# visits" as a risk factor is arithmetically right and reads as a bug, so the
# protective factors get their own wording.
LABEL_HIGH = {
    "number_inpatient":   "{v:.0f} hospital admission(s) in the past year",
    "number_emergency":   "{v:.0f} emergency visit(s) in the past year",
    "number_outpatient":  "{v:.0f} outpatient visit(s) in the past year",
    "time_in_hospital":   "{v:.0f} day(s) in hospital this stay",
    "num_medications":    "on {v:.0f} medications",
    "number_diagnoses":   "{v:.0f} diagnoses recorded",
    "num_lab_procedures": "{v:.0f} lab procedures",
    "num_procedures":     "{v:.0f} procedures this stay",
}
LABEL_LOW = {
    "number_inpatient":   "no prior admissions recorded",
    "number_emergency":   "no emergency visits recorded",
    "number_outpatient":  "little or no outpatient follow-up ({v:.0f} visits)",
    "time_in_hospital":   "short stay ({v:.0f} day(s))",
    "num_medications":    "few medications ({v:.0f})",
    "number_diagnoses":   "few diagnoses recorded ({v:.0f})",
    "num_lab_procedures": "few lab procedures ({v:.0f})",
    "num_procedures":     "few procedures this stay ({v:.0f})",
}
sc = StandardScaler().fit(tr[EXPLAIN].values)
lr = LogisticRegression(max_iter=2000, random_state=SEED).fit(sc.transform(tr[EXPLAIN].values),
                                                              tr.y.values)
p_lr = lr.predict_proba(sc.transform(te[EXPLAIN].values))[:, 1]
brier = brier_score_loss(te.y.values, p_lr)
brier_base = brier_score_loss(te.y.values, np.full(len(te), tr.y.mean()))
print(f"logistic: AUC {roc_auc_score(te.y.values, p_lr):.4f} | "
      f"Brier {brier:.5f} vs base-rate-only {brier_base:.5f} "
      f"({'better' if brier < brier_base else 'WORSE'})")

# per-patient contributions: standardised value x coefficient
Zte = sc.transform(te[EXPLAIN].values)
contrib = Zte * lr.coef_[0]
odds = {f: {"odds_ratio": float(np.exp(c)), "coef": float(c)}
        for f, c in zip(EXPLAIN, lr.coef_[0])}
print("\nodds ratios (per 1 SD):")
for f, d in sorted(odds.items(), key=lambda x: -x[1]["odds_ratio"]):
    print(f"   {f:20s} {d['odds_ratio']:5.3f}")

# ------------------------------------------------------------------ rankings
def ranks(score, seed):
    """Dense competition ranking, random tie-break. 1 = highest priority."""
    r = np.random.default_rng(seed)
    order = np.lexsort((r.random(len(score)), -np.asarray(score, dtype=float)))
    out = np.empty(len(score), dtype=int)
    out[order] = np.arange(1, len(score) + 1)
    return out

methods = {
    "prior_admissions": te.number_inpatient.values.astype(float),
    "age":              te.age.map(lambda a: int(str(a).split("-")[0].strip("["))).values.astype(float),
    "length_of_stay":   te.time_in_hospital.values.astype(float),
    "random":           rng_global.random(len(te)),   # ranks only; counts use captured_random
    "model":            p_gbm,
}
rank_cols = {m: ranks(s, SEED + i) for i, (m, s) in enumerate(methods.items())}

# ------------------------------------------------------------ comparison curve
# Captured@k for EVERY k in 1..KMAX, tie-averaged, in one pass per draw:
# a cumulative sum along each drawn ordering IS the captured-count curve.
KMAX = 2000

def curve(score, draws=200, seed=SEED):
    r = np.random.default_rng(seed)
    y, s = te.y.values, np.asarray(score, dtype=float)
    acc = np.zeros(KMAX)
    for _ in range(draws):
        acc += np.cumsum(y[np.lexsort((r.random(len(s)), -s))[:KMAX]])
    return acc / draws

def curve_random(draws=2000, seed=SEED):
    """Random redraws the SELECTION, not the tie-break — see METHODS 6.1."""
    r = np.random.default_rng(seed)
    y, n = te.y.values, len(te)
    acc = np.zeros(KMAX)
    for _ in range(draws):
        acc += np.cumsum(y[r.permutation(n)[:KMAX]])
    return acc / draws

curves = {m: curve(s) for m, s in methods.items()}
curves["random"] = curve_random()
comparison = {m: [round(float(v), 4) for v in c] for m, c in curves.items()}
print("\ncaptured@50  — " + "  ".join(f"{m}:{curves[m][49]:.1f}" for m in curves))
print("captured@200 — " + "  ".join(f"{m}:{curves[m][199]:.1f}" for m in curves))

# ---------------------------------------------------------------- patient rows
with open(OUT / "patients.jsonl", "w", encoding="utf-8") as fh:
    for i in range(len(te)):
        top = np.argsort(-contrib[i])[:4]
        reasons = [
            {"factor": EXPLAIN[j],
             "text": (LABEL_HIGH if lr.coef_[0][j] > 0 else LABEL_LOW)[EXPLAIN[j]]
                     .format(v=te[EXPLAIN[j]].iloc[i]),
             "weight": float(contrib[i][j])}
            for j in top if contrib[i][j] > 0
        ]
        fh.write(json.dumps({
            "encounter_id": int(te.encounter_id.iloc[i]),
            "age_band": str(te.age.iloc[i]),
            "time_in_hospital": int(te.time_in_hospital.iloc[i]),
            "number_inpatient": int(te.number_inpatient.iloc[i]),
            "number_emergency": int(te.number_emergency.iloc[i]),
            "num_medications": int(te.num_medications.iloc[i]),
            "a1c_tested": bool(te.A1Cresult.iloc[i] == te.A1Cresult.iloc[i]),
            "risk": round(float(p_lr[i]), 4),
            "readmitted_30d": int(te.y.iloc[i]),
            "rank": {m: int(rank_cols[m][i]) for m in methods},
            "reasons": reasons,
        }) + "\n")
print(f"\nwrote {len(te):,} patient rows")

# ------------------------------------------------------------------- evidence
frac_pos, mean_pred = calibration_curve(te.y.values, p_lr, n_bins=10, strategy="quantile")
m0 = json.loads((Path(__file__).parent / "m0_results.json").read_text())
json.dump({
    "test_encounters": int(len(te)), "test_patients": int(te.patient_nbr.nunique()),
    "test_events": int(te.y.sum()), "base_rate": float(te.y.mean()),
    "m0": {"lift200": m0["lift200"], "ci": m0["ci"], "auc_gbm": m0["auc"],
           "auc_gbm_with_diagnosis": 0.6731,
           "captured200_gbm": 94.0, "captured200_gbm_with_diagnosis": 84.0,
           "captured200_prior_admissions": 88.9},
    "amendment": {"lift200": 0.945, "ci": [0.83, 1.17]},
    "calibration": {"mean_predicted": [round(float(x), 4) for x in mean_pred],
                    "observed": [round(float(x), 4) for x in frac_pos],
                    "brier": round(float(brier), 5),
                    "brier_base_rate_only": round(float(brier_base), 5)},
    "odds_ratios": odds,
}, open(OUT / "evidence.json", "w"), indent=1)
json.dump({"kmax": KMAX, "captured": comparison}, open(OUT / "comparison.json", "w"))
print(f"wrote comparison.json (curves 1..{KMAX}), evidence.json")

# sanity: the curve must agree with the published M0 figures at k=200
assert abs(curves["prior_admissions"][199] - 88.9) < 0.15, curves["prior_admissions"][199]
assert abs(curves["model"][199] - 94.0) < 0.15, curves["model"][199]
print("curve agrees with M0 at k=200: prior_admissions 88.9, model 94.0  OK")
