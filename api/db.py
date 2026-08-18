"""Connection handling for the Triage API.

The API is a read path. It connects as `triage_app`, which holds SELECT and
nothing else — verified at load time by attempting a DELETE and requiring it to
fail (analysis/m1_load.py). Every session is additionally opened read-only, so a
mistake in this process cannot write even if the grant were wrong.
"""
import os
from pathlib import Path

from psycopg_pool import ConnectionPool

ROOT = Path(__file__).resolve().parent.parent


def _from_dotenv(key: str):
    """Local development convenience. On Render the value comes from the
    environment and this file does not exist."""
    p = ROOT / ".env"
    if not p.exists():
        return None
    for line in p.read_text(encoding="utf-8-sig").splitlines():
        t = line.strip()
        if t and not t.startswith("#") and "=" in t:
            k, v = t.split("=", 1)
            if k.strip() == key:
                return v.strip().strip('"').strip("'")
    return None


def _url() -> str:
    url = os.environ.get("APP_DATABASE_URL") or _from_dotenv("APP_DATABASE_URL")
    if not url:
        raise RuntimeError(
            "APP_DATABASE_URL is not set. This must be the read-only role's "
            "connection string, never the owner's."
        )
    return url


pool = ConnectionPool(
    _url(),
    min_size=0,          # Render's free tier sleeps; do not hold idle connections
    max_size=4,          # Neon free tier is small — stay well inside it
    open=False,
)

# Read-only is set per TRANSACTION, not per session or as a startup option.
#
# Neon's pooled endpoint runs PgBouncer, which rejects `options=-c ...` at
# startup outright ("unsupported startup parameter"), and does not reliably
# carry session-level SET across transactions in transaction-pooling mode.
# `SET TRANSACTION READ ONLY` as the first statement of each transaction is
# the form that survives both. The SELECT-only grant remains the real
# enforcement; this is the second lock.
READ_ONLY = "SET TRANSACTION READ ONLY"


def rows(sql: str, params: tuple = ()) -> list[dict]:
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(READ_ONLY)
        cur.execute(sql, params)
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def one(sql: str, params: tuple = ()):
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(READ_ONLY)
        cur.execute(sql, params)
        r = cur.fetchone()
        return r[0] if r else None
