-- Triage M1-T2 — schema for the comparison application.
-- Read-only at runtime: nothing in the application writes. Loading is a
-- separate, idempotent step run from analysis/m1_load.py.

DROP TABLE IF EXISTS reasons, rankings, capacity_curve, evidence, encounters CASCADE;

-- One row per held-out encounter. This is the entire population the
-- application can select from: test-set patients only, never training rows.
CREATE TABLE encounters (
    encounter_id      integer PRIMARY KEY,
    age_band          text    NOT NULL,
    time_in_hospital  smallint NOT NULL,
    number_inpatient  smallint NOT NULL,
    number_emergency  smallint NOT NULL,
    num_medications   smallint NOT NULL,
    a1c_tested        boolean NOT NULL,
    risk              real    NOT NULL,   -- calibrated, from logistic regression
    readmitted_30d    boolean NOT NULL    -- the outcome, known only because this is historical
);

-- One row per (method, encounter). rank 1 = highest priority under that method.
-- A single realised ordering: ties are broken randomly once, at export time.
CREATE TABLE rankings (
    method       text     NOT NULL,
    rank         integer  NOT NULL,
    encounter_id integer  NOT NULL REFERENCES encounters(encounter_id),
    PRIMARY KEY (method, rank)
);
CREATE INDEX rankings_enc_idx ON rankings (encounter_id);

-- Plain-language contributing factors, from the logistic regression only.
CREATE TABLE reasons (
    encounter_id integer NOT NULL REFERENCES encounters(encounter_id),
    ord          smallint NOT NULL,
    factor       text    NOT NULL,
    label        text    NOT NULL,
    weight       real    NOT NULL,
    PRIMARY KEY (encounter_id, ord)
);

-- Captured events by method at every capacity k, TIE-AVERAGED over repeated
-- draws. These are the published figures. They differ slightly from counting
-- the single realised ordering in `rankings`, and that is intentional: the
-- curve is the expected value, the ranking is one draw from it.
CREATE TABLE capacity_curve (
    method   text     NOT NULL,
    k        integer  NOT NULL,
    captured real     NOT NULL,
    PRIMARY KEY (method, k)
);

-- M0 measurements, calibration curve, odds ratios. One row.
CREATE TABLE evidence (
    id      smallint PRIMARY KEY DEFAULT 1,
    payload jsonb NOT NULL,
    CONSTRAINT evidence_single_row CHECK (id = 1)
);
