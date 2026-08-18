"""Triage M0 Amendment 1 — adds grouped diagnosis codes + medical_specialty.
Everything else identical to m0.py: same seed, same split, same baselines, same defaults.
Declared in E:/Triage/PREREGISTRATION_M0_amendment.md before execution."""
import sys, io, json
import numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
SEED = 42
KS = [50, 100, 200, 500, 1000]
EXCLUDE = [11, 13, 14, 19, 20, 21]
rng_global = np.random.default_rng(SEED)

df = pd.read_csv("data.csv", low_memory=False).replace("?", np.nan)
df["y"] = (df["readmitted"] == "<30").astype(int)
clean = df[~df.discharge_disposition_id.isin(EXCLUDE)].copy()

# ---- identical split: same seed, same call order as m0.py ----
pats = clean.patient_nbr.unique()
perm = rng_global.permutation(pats)
n_tr = int(0.8 * len(perm))
train_p, test_p = set(perm[:n_tr]), set(perm[n_tr:])
tr = clean[clean.patient_nbr.isin(train_p)].copy()
te = clean[clean.patient_nbr.isin(test_p)].copy()
assert not (set(tr.patient_nbr) & set(te.patient_nbr))
print(f"identical split reproduced: train {len(tr):,} / test {len(te):,} encounters")
print(f"test events: {te.y.sum():,}  base rate {te.y.mean()*100:.2f}%")

# ---- ICD-9 grouping, fixed in the declaration ----
def icd_group(v):
    if pd.isna(v): return "other"
    s = str(v)
    if s.startswith(("V", "E")): return "other"
    try: c = float(s)
    except ValueError: return "other"
    if 250 <= c < 251: return "diabetes"
    if (390 <= c <= 459) or int(c) == 785: return "circulatory"
    if (460 <= c <= 519) or int(c) == 786: return "respiratory"
    if (520 <= c <= 579) or int(c) == 787: return "digestive"
    if 800 <= c <= 999: return "injury"
    if 710 <= c <= 739: return "musculoskeletal"
    if (580 <= c <= 629) or int(c) == 788: return "genitourinary"
    if 140 <= c <= 239: return "neoplasms"
    return "other"

for d in ["diag_1", "diag_2", "diag_3"]:
    tr[d + "_g"] = tr[d].map(icd_group)
    te[d + "_g"] = te[d].map(icd_group)
print("diag_1 groups:", tr.diag_1_g.value_counts().to_dict())

# ---- medical_specialty: top 25 by TRAIN frequency, rest -> other ----
top = tr.medical_specialty.value_counts().head(25).index
tr["spec"] = tr.medical_specialty.where(tr.medical_specialty.isin(top), "other")
te["spec"] = te.medical_specialty.where(te.medical_specialty.isin(top), "other")
print(f"medical_specialty levels kept: {tr.spec.nunique()}")

def captured_at_k(score, y, k, n_draws=200, seed=SEED):
    rng = np.random.default_rng(seed)
    y = np.asarray(y); score = np.asarray(score, dtype=float)
    return float(np.mean([y[np.lexsort((rng.random(len(score)), -score))[:k]].sum()
                          for _ in range(n_draws)]))

b1 = {k: captured_at_k(te.number_inpatient.values.astype(float), te.y.values, k) for k in KS}
print(f"\nB1 (unchanged): captured@200 = {b1[200]:.1f}")

# ---- model, same defaults, richer features ----
drop = ["encounter_id", "patient_nbr", "readmitted", "y", "weight",
        "diag_1", "diag_2", "diag_3", "payer_code", "medical_specialty"]
isnum = lambda c: pd.api.types.is_numeric_dtype(clean[c])
feat = [c for c in clean.columns if c not in drop]
cats = [c for c in feat if not isnum(c) and clean[c].nunique() <= 25]
nums = [c for c in feat if isnum(c)]
newcats = ["diag_1_g", "diag_2_g", "diag_3_g", "spec"]
use, allcats = nums + cats + newcats, cats + newcats
print(f"features: {len(nums)} numeric + {len(allcats)} categorical "
      f"(+4 new vs M0: 3 diagnosis groups + specialty)")

X_tr = pd.get_dummies(tr[use], columns=allcats, dummy_na=True)
X_te = pd.get_dummies(te[use], columns=allcats, dummy_na=True).reindex(
    columns=X_tr.columns, fill_value=0)
print(f"design matrix: {X_tr.shape[1]} columns (M0 had 139)")

clf = HistGradientBoostingClassifier(random_state=SEED)   # defaults, unchanged
clf.fit(X_tr, tr.y.values)
p = clf.predict_proba(X_te)[:, 1]

model = {k: captured_at_k(p, te.y.values, k) for k in KS}
print(f"\n{'method':26s}" + "".join(f"{('k='+str(k)):>10s}" for k in KS))
print(f"{'B1 number_inpatient':26s}" + "".join(f"{b1[k]:>10.1f}" for k in KS))
print(f"{'MODEL M0 (no diagnosis)':26s}" + "".join(
    f"{v:>10.1f}" for v in json.load(open("m0_results.json"))["model"]))
print(f"{'MODEL +diagnosis +spec':26s}" + "".join(f"{model[k]:>10.1f}" for k in KS))

lift = model[200] / b1[200]
print(f"\nAUC: {roc_auc_score(te.y.values, p):.4f}   (M0 was 0.6680)")
print(f"precision@200: model {100*model[200]/200:.1f}%  |  B1 {100*b1[200]/200:.1f}%")
print(f"LIFT@200 = {model[200]:.1f} / {b1[200]:.1f} = {lift:.3f}x")

print("\nbootstrapping 2000 patient-level resamples ...")
te = te.reset_index(drop=True); te["_p"] = p
by_pat = {pid: g.index.values for pid, g in te.groupby("patient_nbr")}
pat_ids = np.array(list(by_pat.keys()))
rng = np.random.default_rng(SEED)
lifts = []
for _ in range(2000):
    idx = np.concatenate([by_pat[q] for q in rng.choice(pat_ids, len(pat_ids), replace=True)])
    s = te.iloc[idx]
    mc = captured_at_k(s._p.values, s.y.values, 200, 1, int(rng.integers(1e9)))
    bc = captured_at_k(s.number_inpatient.values.astype(float), s.y.values, 200, 1,
                       int(rng.integers(1e9)))
    if bc > 0: lifts.append(mc / bc)
lo, hi = np.percentile(lifts, [2.5, 97.5])

print("\n" + "=" * 68)
print(f"  AMENDMENT 1 RESULT")
print(f"  LIFT@200 vs B1 : {lift:.2f}x     95% CI [{lo:.2f}, {hi:.2f}]")
print(f"  M0 result was  : 1.06x           95% CI [0.92, 1.23]")
print(f"  KILL CRITERION : CI includes 1.0 ? {'YES -> KILL' if lo <= 1.0 <= hi else 'NO  -> PROCEED'}")
print(f"  SC-1 (>=1.5x)  : {'MET' if lift >= 1.5 and lo > 1.0 else 'NOT MET'}")
print("=" * 68)
