"""Triage API — M1-T3.

Read-only service over the M0 measurements and the held-out patient set.

Two rules from Triage_M1_Spec.md are enforced here rather than left to the
frontend, because an API that hands out a model ranking without its measured
lift invites exactly the presentation the project exists to argue against:

  NFR-12  the model is never the default, and never returned without its
          measured lift and interval attached
  NFR-13  every count is real; averaged and single-draw figures are returned
          as separate, differently named fields
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import db

DEFAULT_METHOD = "prior_admissions"
KMAX = 2000

METHODS = {
    "prior_admissions": {
        "label": "Prior admissions",
        "detail": "Ranked by admissions in the past year. One column, no model.",
        "recommended": True,
    },
    "model": {
        "label": "Machine learning model",
        "detail": "Untuned gradient boosting over 41 fields.",
        "recommended": False,
        "lift_vs_recommended": 1.06,
        "lift_ci": [0.92, 1.23],
        "distinguishable_from_recommended": False,
        "advisory": (
            "Measured lift over prior admissions is 1.06x, 95% CI [0.92, 1.23] — "
            "the interval includes 1.0, so this model is not distinguishable from "
            "the single-column rule. It is shown for comparison, not as a "
            "recommendation."
        ),
    },
    "length_of_stay": {"label": "Length of stay", "detail": "Ranked by days in hospital.", "recommended": False},
    "age": {"label": "Age", "detail": "Ranked oldest first. The rule most programmes use today.", "recommended": False},
    "random": {"label": "Random", "detail": "Selection at random. The floor.", "recommended": False},
}

NOTICE = {
    "historical": "Data is from 130 US hospitals, 1999-2008. Nothing here describes any hospital operating today.",
    "not_clinical": "This is a demonstration of a targeting method. It is not clinical decision support and must not inform anyone's care.",
    "cold_start": "The API sleeps when idle on its free tier. The first request after a quiet period can take 30-50 seconds.",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.pool.open()
    yield
    db.pool.close()


app = FastAPI(
    title="Triage API",
    description="Capacity-constrained readmission targeting: what each way of choosing gets you.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    # Starlette fullmatches this against the Origin header, so the alternation
    # is anchored implicitly. Covers Vercel deployments plus local development
    # on either loopback name and any port.
    allow_origin_regex=r"https://[A-Za-z0-9._-]+\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _check_method(method: str) -> str:
    if method not in METHODS:
        raise HTTPException(404, f"unknown method '{method}'. known: {sorted(METHODS)}")
    return method


@app.get("/health")
def health():
    counts = db.rows("""
        SELECT (SELECT count(*) FROM encounters)     AS encounters,
               (SELECT count(*) FROM rankings)       AS rankings,
               (SELECT count(*) FROM reasons)        AS reasons,
               (SELECT count(*) FROM capacity_curve) AS capacity_curve
    """)[0]
    return {
        "status": "ok",
        "rows": counts,
        "default_method": DEFAULT_METHOD,
        "kmax": KMAX,
        "methods": METHODS,
        "notices": NOTICE,
    }


@app.get("/evidence")
def evidence():
    """The M0 measurements: lifts, intervals, calibration, odds ratios."""
    payload = db.one("SELECT payload FROM evidence WHERE id = 1")
    if payload is None:
        raise HTTPException(503, "evidence not loaded")
    return payload


@app.get("/comparison")
def comparison(k: int = Query(200, ge=1, le=KMAX)):
    """What every method catches at capacity k.

    `captured` is tie-averaged over repeated draws — the published figure.
    `captured_this_draw` counts the single realised ordering in `rankings`, and
    will differ slightly. Both are returned rather than silently picking one.
    """
    base = db.one("SELECT avg(readmitted_30d::int) FROM encounters")
    total = db.one("SELECT count(*) FROM encounters")
    events = db.one("SELECT count(*) FROM encounters WHERE readmitted_30d")

    avg = {r["method"]: r["captured"] for r in
           db.rows("SELECT method, captured FROM capacity_curve WHERE k = %s", (k,))}
    drawn = {r["method"]: r["captured"] for r in db.rows("""
        SELECT r.method, sum(e.readmitted_30d::int)::float AS captured
        FROM rankings r JOIN encounters e USING (encounter_id)
        WHERE r.rank <= %s GROUP BY r.method
    """, (k,))}

    out = []
    for m, meta in METHODS.items():
        c = avg.get(m)
        out.append({
            "method": m, **meta,
            "captured": c,
            "captured_this_draw": drawn.get(m),
            "precision": (c / k) if c is not None else None,
            "vs_random": (c / avg["random"]) if c and avg.get("random") else None,
        })
    # Sorted by captured — the honest order. But a point estimate on its own
    # invites "the model won", so anything not distinguishable from the
    # recommended method carries the flag and interval that say otherwise.
    out.sort(key=lambda r: -(r["captured"] or 0))
    rec = next((r for r in out if r.get("recommended")), None)
    for r in out:
        if rec and r["method"] != rec["method"] and r["captured"] is not None:
            r["difference_vs_recommended"] = round(r["captured"] - rec["captured"], 2)
        if r.get("distinguishable_from_recommended") is False:
            r["display_rule"] = (
                "Do not show this figure without its interval. It is higher than the "
                "recommended method here, but the measured difference is not "
                "distinguishable from zero."
            )

    return {
        "k": k,
        "population": {"encounters": total, "events": events, "base_rate": float(base)},
        "expected_if_random": float(base) * k,
        "methods": out,
        "recommended_method": DEFAULT_METHOD,
        "note": ("`captured` is averaged over repeated tie-breaking draws. "
                 "`captured_this_draw` is the single ordering served by /selection."),
        "notices": NOTICE,
    }


@app.get("/curve")
def curve(kmax: int = Query(KMAX, ge=10, le=KMAX), step: int = Query(10, ge=1, le=100)):
    """Captured events against capacity, every method. Tie-averaged."""
    data = db.rows("""
        SELECT method, k, captured FROM capacity_curve
        WHERE k <= %s AND (k %% %s = 0 OR k = 1) ORDER BY method, k
    """, (kmax, step))
    series: dict[str, list] = {}
    for r in data:
        series.setdefault(r["method"], []).append({"k": r["k"], "captured": r["captured"]})
    return {"kmax": kmax, "step": step,
            "series": [{"method": m, **METHODS[m], "points": p} for m, p in series.items()]}


@app.get("/selection")
def selection(k: int = Query(200, ge=1, le=KMAX),
              method: str = Query(DEFAULT_METHOD)):
    """The top k patients under `method`, with the reason each was selected.

    Defaults to prior admissions — the method that measurably performed best.
    Selecting the model returns its advisory alongside (NFR-12).
    """
    _check_method(method)
    picked = db.rows("""
        SELECT r.rank, e.encounter_id, e.age_band, e.time_in_hospital,
               e.number_inpatient, e.number_emergency, e.num_medications,
               e.a1c_tested, e.risk, e.readmitted_30d
        FROM rankings r JOIN encounters e USING (encounter_id)
        WHERE r.method = %s AND r.rank <= %s ORDER BY r.rank
    """, (method, k))
    if not picked:
        raise HTTPException(503, "rankings not loaded")

    ids = tuple(p["encounter_id"] for p in picked)
    by_enc: dict[int, list] = {}
    for r in db.rows("""
        SELECT encounter_id, label, weight FROM reasons
        WHERE encounter_id = ANY(%s) ORDER BY encounter_id, ord
    """, (list(ids),)):
        by_enc.setdefault(r["encounter_id"], []).append(r["label"])

    for p in picked:
        p["reasons"] = by_enc.get(p["encounter_id"], [])
        p["risk"] = round(p["risk"] * 100, 1)

    caught = sum(1 for p in picked if p["readmitted_30d"])
    averaged = db.one("SELECT captured FROM capacity_curve WHERE method = %s AND k = %s",
                      (method, k))
    return {
        "k": k, "method": method, **METHODS[method],
        "caught_this_draw": caught,
        "caught_averaged": averaged,
        "precision_this_draw": caught / len(picked),
        "patients": picked,
        "note": ("Outcomes are shown because this is historical data and the answer is "
                 "already known. A live system would not have them. Ties in the ranking "
                 "were broken at random once, at export time."),
        "notices": NOTICE,
    }
