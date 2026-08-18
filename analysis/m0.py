"""Triage M0-T3 .. M0-T7 — exclusions, grouped split, baselines, untuned model, lift."""
import sys, io, json, hashlib
import numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
SEED = 42
KS = [50, 100, 200, 500, 1000]
EXCLUDE = [11, 13, 14, 19, 20, 21]          # from IDS_mapping.csv, verified
rng_global = np.random.default_rng(SEED)

print("sha256(data.csv):", hashlib.sha256(open("data.csv", "rb").read()).hexdigest()[:32], "...")
df = pd.read_csv("data.csv", low_memory=False)
df = df.replace("?", np.nan)
print(f"loaded: {df.shape[0]:,} rows x {df.shape[1]} cols")
df["y"] = (df["readmitted"] == "<30").astype(int)

# ---------------- M0-T3  exclusions (VER-1, VER-3) ----------------
print("\n" + "=" * 68)
print("M0-T3  EXCLUSIONS")
print("=" * 68)
print(f"base rate BEFORE exclusion : {df.y.mean()*100:6.2f}%   ({df.y.sum():,} of {len(df):,})")

exc = df[df.discharge_disposition_id.isin(EXCLUDE)]
clean = df[~df.discharge_disposition_id.isin(EXCLUDE)].copy()
print(f"rows excluded (dead/hospice): {len(exc):,}")
print(f"  their <30 readmission rate: {exc.y.mean()*100:6.3f}%   <- must be ~0 or code list is wrong")
for cid in EXCLUDE:
    sub = df[df.discharge_disposition_id == cid]
    if len(sub):
        print(f"    code {cid:>2}: {len(sub):>5,} rows, <30 rate {sub.y.mean()*100:6.3f}%")
print(f"base rate AFTER exclusion  : {clean.y.mean()*100:6.2f}%   ({clean.y.sum():,} of {len(clean):,})  [VER-1]")

# ---------------- M0-T4  grouped split (VER-2) ----------------
print("\n" + "=" * 68)
print("M0-T4  GROUPED SPLIT")
print("=" * 68)
pats = clean.patient_nbr.unique()
per = clean.groupby("patient_nbr").size()
multi = (per > 1).sum()
print(f"encounters {len(clean):,} | distinct patients {len(pats):,}")
print(f"patients with >1 encounter : {multi:,} ({100*multi/len(pats):.1f}%)")
print(f"encounters belonging to them: {per[per>1].sum():,} ({100*per[per>1].sum()/len(clean):.1f}%)  [VER-2]")

perm = rng_global.permutation(pats)
n_tr = int(0.8 * len(perm))
train_p, test_p = set(perm[:n_tr]), set(perm[n_tr:])
tr = clean[clean.patient_nbr.isin(train_p)].copy()
te = clean[clean.patient_nbr.isin(test_p)].copy()
assert not (set(tr.patient_nbr) & set(te.patient_nbr)), "PATIENT OVERLAP"
print(f"train {len(tr):,} enc / {len(train_p):,} pts | test {len(te):,} enc / {len(test_p):,} pts")
print("patient-overlap assertion: PASS")

# counterfactual: what a naive encounter-level split would have leaked
enc_perm = rng_global.permutation(len(clean))
naive_te = clean.iloc[enc_perm[int(0.8*len(clean)):]]
naive_tr = clean.iloc[enc_perm[:int(0.8*len(clean))]]
leak = naive_te.patient_nbr.isin(set(naive_tr.patient_nbr)).sum()
print(f"naive encounter split would have leaked: {leak:,} test rows "
      f"({100*leak/len(naive_te):.1f}% of test) sharing a patient with train")

print(f"\ntest-set base rate: {te.y.mean()*100:.2f}%  ({te.y.sum():,} events in {len(te):,} encounters)")

# ---------------- helpers ----------------
def captured_at_k(score, y, k, n_draws=200, seed=SEED):
    """Captured events in top-k, random tie-break averaged over n_draws."""
    rng = np.random.default_rng(seed)
    y = np.asarray(y); score = np.asarray(score, dtype=float)
    out = []
    for _ in range(n_draws):
        jitter = rng.random(len(score))
        order = np.lexsort((jitter, -score))      # score desc, random within ties
        out.append(y[order[:k]].sum())
    return float(np.mean(out))

# ---------------- M0-T5  baselines (VER-4) ----------------
print("\n" + "=" * 68)
print("M0-T5  BASELINES  (test set, random tie-break averaged over 200 draws)")
print("=" * 68)
baselines = {
    "B1 number_inpatient": te.number_inpatient.values.astype(float),
    "B2 age band":         te.age.map(lambda a: int(str(a).split("-")[0].strip("[")) ).values.astype(float),
    "B3 time_in_hospital": te.time_in_hospital.values.astype(float),
    "B4 random":           None,
}
res = {}
print(f"{'method':22s}" + "".join(f"{('k='+str(k)):>10s}" for k in KS))
for name, sc in baselines.items():
    if sc is None:
        sc = rng_global.random(len(te))
    row = [captured_at_k(sc, te.y.values, k) for k in KS]
    res[name] = row
    print(f"{name:22s}" + "".join(f"{v:>10.1f}" for v in row))

b1_200 = res["B1 number_inpatient"][KS.index(200)]
print(f"\nBar to beat: B1 captures {b1_200:.1f} true readmissions in its top 200  [VER-4]")
print(f"  (precision@200 = {100*b1_200/200:.1f}%  vs base rate {te.y.mean()*100:.2f}%)")

# ---------------- M0-T7  untuned model (VER-5) ----------------
print("\n" + "=" * 68)
print("M0-T7  UNTUNED MODEL")
print("=" * 68)
drop = ["encounter_id", "patient_nbr", "readmitted", "y", "weight",
        "diag_1", "diag_2", "diag_3", "payer_code", "medical_specialty"]
feat = [c for c in clean.columns if c not in drop]
isnum = lambda c: pd.api.types.is_numeric_dtype(clean[c])
cats = [c for c in feat if not isnum(c) and clean[c].nunique() <= 25]
nums = [c for c in feat if isnum(c)]
use = nums + cats
print(f"features: {len(nums)} numeric + {len(cats)} categorical (diagnosis codes dropped per spec)")

X_tr = pd.get_dummies(tr[use], columns=cats, dummy_na=True)
X_te = pd.get_dummies(te[use], columns=cats, dummy_na=True)
X_te = X_te.reindex(columns=X_tr.columns, fill_value=0)
print(f"design matrix: {X_tr.shape[1]} columns after one-hot")

clf = HistGradientBoostingClassifier(random_state=SEED)   # library defaults, no tuning
clf.fit(X_tr, tr.y.values)
p = clf.predict_proba(X_te)[:, 1]

model_row = [captured_at_k(p, te.y.values, k) for k in KS]
print(f"\n{'method':22s}" + "".join(f"{('k='+str(k)):>10s}" for k in KS))
for name in baselines:
    print(f"{name:22s}" + "".join(f"{v:>10.1f}" for v in res[name]))
print(f"{'MODEL (untuned)':22s}" + "".join(f"{v:>10.1f}" for v in model_row))

m200 = model_row[KS.index(200)]
lift = m200 / b1_200
print(f"\nAUC (secondary, for literature comparison): {roc_auc_score(te.y.values, p):.4f}")
print(f"precision@200: model {100*m200/200:.1f}%  |  B1 {100*b1_200/200:.1f}%  |  base {te.y.mean()*100:.2f}%")
print(f"LIFT@200 vs B1 = {m200:.1f} / {b1_200:.1f} = {lift:.3f}x")

# ---------------- bootstrap at PATIENT level ----------------
print("\nbootstrapping 2000 patient-level resamples ...")
te = te.reset_index(drop=True)
te["_p"] = p
by_pat = {pid: g.index.values for pid, g in te.groupby("patient_nbr")}
pat_ids = np.array(list(by_pat.keys()))
rng = np.random.default_rng(SEED)
lifts, m_caps, b_caps = [], [], []
for _ in range(2000):
    pick = rng.choice(pat_ids, size=len(pat_ids), replace=True)
    idx = np.concatenate([by_pat[q] for q in pick])
    s = te.iloc[idx]
    mc = captured_at_k(s._p.values, s.y.values, 200, n_draws=1, seed=int(rng.integers(1e9)))
    bc = captured_at_k(s.number_inpatient.values.astype(float), s.y.values, 200,
                       n_draws=1, seed=int(rng.integers(1e9)))
    m_caps.append(mc); b_caps.append(bc)
    if bc > 0: lifts.append(mc / bc)
lo, hi = np.percentile(lifts, [2.5, 97.5])
print(f"\n{'='*68}")
print(f"  LIFT@200 vs B1 : {lift:.2f}x     95% CI [{lo:.2f}, {hi:.2f}]   [VER-5]")
print(f"  model captured : {np.mean(m_caps):.1f}  (bootstrap mean)")
print(f"  B1    captured : {np.mean(b_caps):.1f}  (bootstrap mean)")
print(f"  KILL CRITERION : CI includes 1.0 ? {'YES -> KILL' if lo <= 1.0 <= hi else 'NO  -> PROCEED'}")
print(f"  SC-1 (>=1.5x)  : {'MET' if lift >= 1.5 and lo > 1.0 else 'NOT MET'}")
print("=" * 68)

json.dump({"base_rate_before": float(df.y.mean()), "base_rate_after": float(clean.y.mean()),
           "excluded_rows": int(len(exc)), "excluded_rate": float(exc.y.mean()),
           "naive_leak_rows": int(leak), "test_encounters": int(len(te)),
           "baselines": {k: v for k, v in res.items()}, "model": model_row,
           "lift200": float(lift), "ci": [float(lo), float(hi)],
           "auc": float(roc_auc_score(te.y.values, p))},
          open("m0_results.json", "w"), indent=1)
