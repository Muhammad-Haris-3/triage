"use client";
import { useEffect, useState } from "react";
import Capacity from "@/components/Capacity";
import Loading from "@/components/Loading";
import { get, type Selection } from "@/lib/api";

const METHODS = [
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
    return () => {
      live = false;
    };
  }, [k, method]);

  const shown = data?.patients.slice(0, 60) ?? [];

  return (
    <>
      <h1>The call list</h1>
      <p className="lede">
        The {k.toLocaleString()} patients this method would put in front of the
        follow-up team, in order, with the reason each was selected.
      </p>

      <Capacity k={k} setK={setK} />

      <div className="panel">
        <div className="cap">
          <label>Ranked by</label>
          <div className="presets">
            {METHODS.map((m) => (
              <button
                key={m.id}
                className={method === m.id ? "on" : ""}
                onClick={() => setMethod(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err && <div className="err">Could not reach the API. {err}</div>}
      {!data && !err && <Loading />}

      {data && (
        <>
          {data.advisory && <div className="advisory">{data.advisory}</div>}

          <div className="panel">
            <p style={{ marginBottom: 6 }}>
              Of these {data.k.toLocaleString()} patients,{" "}
              <strong className="num">{data.caught_this_draw}</strong> were actually
              readmitted within 30 days —{" "}
              <strong className="num">
                {(data.precision_this_draw * 100).toFixed(1)}%
              </strong>{" "}
              of the calls.
            </p>
            <p className="tiny" style={{ marginBottom: 0 }}>
              This is the single ordering served here. Averaged over repeated
              tie-breaking draws the figure is {data.caught_averaged?.toFixed(1)} — the two
              differ because ties in the ranking are broken at random.
            </p>
          </div>

          <div className="panel scroll">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Age</th>
                  <th className="num">Prior adm.</th>
                  <th className="num">Days</th>
                  <th className="num">Risk</th>
                  <th>Why this patient</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.encounter_id}>
                    <td className="num">{p.rank}</td>
                    <td>{p.age_band}</td>
                    <td className="num">{p.number_inpatient}</td>
                    <td className="num">{p.time_in_hospital}</td>
                    <td className="num">{p.risk}%</td>
                    <td className="small">{p.reasons.slice(0, 2).join(" · ") || "—"}</td>
                    <td>
                      <span className={p.readmitted_30d ? "tag" : "tag no"}>
                        {p.readmitted_30d ? "readmitted" : "did not return"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="small">
            Showing the first {shown.length} of {data.patients.length.toLocaleString()}.
          </p>
          <p className="tiny">{data.note}</p>
        </>
      )}
    </>
  );
}
