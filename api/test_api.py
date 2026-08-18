"""Triage API tests — AC-M1-9: application figures must match the analysis output."""
import json, pathlib
from fastapi.testclient import TestClient
import psycopg, pytest
from api.main import app

ROOT = pathlib.Path(__file__).resolve().parent.parent
M0 = json.loads((ROOT / "analysis" / "m0_results.json").read_text())


@pytest.fixture(scope="session")
def client():
    """TestClient must be used as a context manager, or the lifespan never runs
    and the connection pool is never opened."""
    with TestClient(app) as c:
        yield c


def test_health_row_counts(client):
    r = client.get("/health").json()
    assert r["status"] == "ok"
    assert r["rows"]["encounters"] == 19765
    assert r["rows"]["rankings"] == 19765 * 5


def test_comparison_matches_published_m0_figures(client):
    """The published numbers and the served numbers must be the same numbers."""
    m = {x["method"]: x for x in client.get("/comparison?k=200").json()["methods"]}
    assert m["prior_admissions"]["captured"] == pytest.approx(M0["baselines"]["B1 number_inpatient"][2], abs=0.15)
    assert m["model"]["captured"] == pytest.approx(M0["model"][2], abs=0.15)
    assert m["age"]["captured"] == pytest.approx(M0["baselines"]["B2 age band"][2], abs=0.15)
    assert m["random"]["captured"] == pytest.approx(M0["baselines"]["B4 random"][2], abs=0.20)


def test_base_rate_matches(client):
    p = client.get("/comparison?k=200").json()["population"]
    assert p["encounters"] == 19765 and p["events"] == 2295
    assert p["base_rate"] == pytest.approx(0.1161, abs=0.0005)


def test_model_is_never_recommended(client):
    """NFR-12."""
    d = client.get("/comparison?k=200").json()
    assert d["recommended_method"] == "prior_admissions"
    model = next(x for x in d["methods"] if x["method"] == "model")
    assert model["recommended"] is False
    assert model["distinguishable_from_recommended"] is False
    assert "advisory" in model and "display_rule" in model
    assert client.get("/selection?k=10").json()["method"] == "prior_admissions"


def test_model_lift_never_served_without_its_interval(client):
    model = next(x for x in client.get("/comparison?k=200").json()["methods"]
                 if x["method"] == "model")
    assert model["lift_ci"][0] < 1.0 < model["lift_ci"][1]


def test_notices_present_on_patient_level_views(client):
    """NFR-10."""
    for ep in ("/selection?k=5", "/comparison?k=200", "/health"):
        n = client.get(ep).json()["notices"]
        assert "1999-2008" in n["historical"]
        assert "not clinical decision support" in n["not_clinical"]


def test_averaged_and_single_draw_are_separate_fields(client):
    """NFR-13 — the two must never be collapsed into one number."""
    s = client.get("/selection?k=200").json()
    assert "caught_this_draw" in s and "caught_averaged" in s
    c = client.get("/comparison?k=200").json()["methods"][0]
    assert "captured" in c and "captured_this_draw" in c


def test_api_role_cannot_write(client):
    from api import db
    with db.pool.connection() as conn, conn.cursor() as cur:
        cur.execute(db.READ_ONLY)
        with pytest.raises((psycopg.errors.InsufficientPrivilege,
                            psycopg.errors.ReadOnlySqlTransaction)):
            cur.execute("DELETE FROM encounters WHERE false")


def test_unknown_method_404s(client):
    assert client.get("/selection?k=10&method=nonsense").status_code == 404
