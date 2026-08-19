"use client";
import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import { get, type Selection } from "@/lib/api";

const CHIPS = [
  { id: "prior_admissions", label: "Prior admissions" },
  { id: "model", label: "Model" },
  { id: "age", label: "Age" },
];

export default function ListPage() {
  const [k, setK] = useState(200);
  const [method, setMethod] = useState("prior_admissions");
  const [data, setData] = useState<Selection | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setErr(null);
    get<Selection>(`/selection?k=${k}&method=${method}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [k, method]);

  const rows = data?.patients.slice(0, Math.min(40, k)) ?? [];

  return (
    <section style={{ animation: "rise 520ms var(--ease) both" }}>
      <div className="eyebrow">01 — The call list</div>
      <h1>Who the follow-up team calls</h1>
      <p className="lede">
        The {k.toLocaleString()} patients this method would put in front of the follow-up team, in
        order, with the reason each was selected.
      </p>

      <div
        style={{
          display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
          paddingBottom: 22, marginBottom: 36, borderBottom: "1px solid var(--rule-soft)",
        }}
      >
        <span className="caplabel" style={{ marginBottom: 0 }}>Ranked by</span>
        <div className="chips">
          {CHIPS.map((c) => (
            <button key={c.id} className={method === c.id ? "on" : ""} onClick={() => setMethod(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <span className="caplabel" style={{ marginBottom: 0 }}>capacity</span>
          <input
            type="range" min={10} max={2000} step={10} value={k}
            onChange={(e) => setK(Number(e.target.value))}
            style={{ width: 190, margin: 0 }}
          />
          <span className="mono" style={{ fontSize: "1rem", fontWeight: 600, minWidth: "3.6rem", textAlign: "right" }}>
            {k.toLocaleString()}
          </span>
        </div>
      </div>

      {err && <div className="err">Could not reach the API. {err}</div>}
      {!data && !err && <Loading />}

      {data && (
        <>
          {data.advisory && <div className="advisory" style={{ marginBottom: 24 }}>{data.advisory}</div>}

          <div className="panel" style={{ display: "flex", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "12rem", padding: "26px 30px", boxShadow: "inset -1px 0 0 var(--rule-soft)" }}>
              <div className="mono" style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-.03em", color: "var(--accent-text)" }}>
                {data.caught_this_draw}
              </div>
              <div className="unit">readmitted within 30 days</div>
            </div>
            <div style={{ flex: 1, minWidth: "12rem", padding: "26px 30px", boxShadow: "inset -1px 0 0 var(--rule-soft)" }}>
              <div className="mono" style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-.03em" }}>
                {(data.precision_this_draw * 100).toFixed(1)}%
              </div>
              <div className="unit">of the calls landed</div>
            </div>
            <div style={{ flex: 1.4, minWidth: "16rem", padding: "26px 30px" }}>
              <p style={{ margin: 0, fontSize: ".84rem", color: "var(--muted)" }}>
                Ties are broken at random, so this single served ordering differs from the tie-averaged
                figure of {data.caught_averaged?.toFixed(1)}. Both are reported rather than the
                flattering one.
              </p>
            </div>
          </div>

          <div className="panel scroll" style={{ marginTop: 36 }}>
            <table>
              <thead>
                <tr>
                  <th className="r">#</th>
                  <th>Age</th>
                  <th className="r">Prior adm.</th>
                  <th className="r">Days</th>
                  <th className="r">Risk</th>
                  <th>Why this patient</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.encounter_id}>
                    <td className="m r" style={{ color: "var(--faint)" }}>{p.rank}</td>
                    <td className="m">{p.age_band}</td>
                    <td className="m r" style={{ fontWeight: 600 }}>{p.number_inpatient}</td>
                    <td className="m r">{p.time_in_hospital}</td>
                    <td className="m r">{p.risk.toFixed(1)}%</td>
                    <td style={{ color: "var(--muted)", fontSize: ".82rem" }}>
                      {p.reasons.slice(0, 2).join("  ·  ") || "—"}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className={`tag ${p.readmitted_30d ? "yes" : "no"}`}>
                        {p.readmitted_30d ? "readmitted" : "did not return"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Showing the first {rows.length} of {k.toLocaleString()}. Encounter identifiers are withheld;
            every column shown is already in the discharge record.
          </p>
        </>
      )}
    </section>
  );
}
