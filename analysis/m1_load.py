"""Triage M1-T2 — load the M1 export into PostgreSQL.

Idempotent: drops and rebuilds every table from analysis/export/. Also creates
the read-only application role and writes its connection string into .env.

Never prints a credential. Run:  python analysis/m1_load.py
"""
import io, json, os, secrets, sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import psycopg
from psycopg import sql

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
EXPORT = ROOT / "analysis" / "export"
APP_ROLE = "triage_app"


def env(path=ROOT / ".env"):
    out = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        t = line.strip()
        if t and not t.startswith("#") and "=" in t:
            k, v = t.split("=", 1)
            if k.strip().isidentifier():
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main():
    cfg = env()
    if "DATABASE_URL" not in cfg:
        sys.exit("DATABASE_URL missing from .env")

    patients = [json.loads(l) for l in (EXPORT / "patients.jsonl").read_text(encoding="utf-8").splitlines()]
    comparison = json.loads((EXPORT / "comparison.json").read_text(encoding="utf-8"))
    evidence = json.loads((EXPORT / "evidence.json").read_text(encoding="utf-8"))
    print(f"export: {len(patients):,} patients, "
          f"{len(comparison['captured'])} methods x {comparison['kmax']} capacities")

    with psycopg.connect(cfg["DATABASE_URL"], autocommit=False) as conn:
        with conn.cursor() as cur:
            print("host:", urlparse(cfg["DATABASE_URL"]).hostname)
            cur.execute((ROOT / "sql" / "schema.sql").read_text(encoding="utf-8"))
            print("schema created")

            with cur.copy("COPY encounters (encounter_id, age_band, time_in_hospital,"
                          " number_inpatient, number_emergency, num_medications,"
                          " a1c_tested, risk, readmitted_30d) FROM STDIN") as cp:
                for p in patients:
                    cp.write_row((p["encounter_id"], p["age_band"], p["time_in_hospital"],
                                  p["number_inpatient"], p["number_emergency"],
                                  p["num_medications"], p["a1c_tested"], p["risk"],
                                  bool(p["readmitted_30d"])))
            print(f"  encounters: {len(patients):,}")

            with cur.copy("COPY rankings (method, rank, encounter_id) FROM STDIN") as cp:
                n = 0
                for p in patients:
                    for m, r in p["rank"].items():
                        cp.write_row((m, r, p["encounter_id"])); n += 1
            print(f"  rankings:   {n:,}")

            with cur.copy("COPY reasons (encounter_id, ord, factor, label, weight) FROM STDIN") as cp:
                n = 0
                for p in patients:
                    for i, rs in enumerate(p["reasons"]):
                        cp.write_row((p["encounter_id"], i, rs["factor"], rs["text"], rs["weight"])); n += 1
            print(f"  reasons:    {n:,}")

            with cur.copy("COPY capacity_curve (method, k, captured) FROM STDIN") as cp:
                n = 0
                for m, vals in comparison["captured"].items():
                    for k, v in enumerate(vals, start=1):
                        cp.write_row((m, k, v)); n += 1
            print(f"  curve:      {n:,}")

            cur.execute("INSERT INTO evidence (id, payload) VALUES (1, %s)", (json.dumps(evidence),))

            # ---- read-only application role (SRS: application role SELECT only) ----
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (APP_ROLE,))
            fresh = cur.fetchone() is None
            pw = secrets.token_urlsafe(24)
            # CREATE/ALTER ROLE are utility statements: they do not accept bind
            # parameters. The password is composed as a quoted SQL literal
            # instead, which psycopg escapes — never by string concatenation.
            role = sql.Identifier(APP_ROLE)
            dbname = sql.Identifier(urlparse(cfg["DATABASE_URL"]).path.lstrip("/"))
            verb = sql.SQL("CREATE" if fresh else "ALTER")
            cur.execute(sql.SQL("{} ROLE {} WITH LOGIN PASSWORD {}").format(
                verb, role, sql.Literal(pw)))
            cur.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(dbname, role))
            cur.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(role))
            cur.execute(sql.SQL("GRANT SELECT ON ALL TABLES IN SCHEMA public TO {}").format(role))
            cur.execute(sql.SQL(
                "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO {}").format(role))
            print(f"  role {APP_ROLE}: {'created' if fresh else 'password rotated'}, SELECT only")

        conn.commit()

        # ---- verify the grant actually restricts, rather than trusting it ----
        u = urlparse(cfg["DATABASE_URL"])
        app_url = urlunparse(u._replace(netloc=f"{APP_ROLE}:{pw}@{u.hostname}"))
        with psycopg.connect(app_url, autocommit=True) as app:
            with app.cursor() as c:
                c.execute("SELECT count(*) FROM encounters")
                seen = c.fetchone()[0]
                try:
                    c.execute("DELETE FROM encounters WHERE false")
                    sys.exit("FAIL: application role can DELETE. Grants are wrong.")
                except psycopg.errors.InsufficientPrivilege:
                    pass
        print(f"  verified: app role reads {seen:,} rows, DELETE refused")

    # ---- write the app credential to .env without ever printing it ----
    p = ROOT / ".env"
    lines = [l for l in p.read_text(encoding="utf-8-sig").splitlines()
             if not l.strip().startswith("APP_DATABASE_URL=")]
    lines.append(f"APP_DATABASE_URL={app_url}")
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\nAPP_DATABASE_URL written to .env (read-only role, value not shown)")


if __name__ == "__main__":
    main()
