"use client";
import { useEffect, useState } from "react";
import Capacity from "@/components/Capacity";
import Loading from "@/components/Loading";
import { get, type Comparison } from "@/lib/api";

export default function Compare() {
  const [k, setK] = useState(200);
  const [data, setData] = useState<Comparison | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setErr(null);
    get<Comparison>(`/comparison?k=${k}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setErr(String(e)));
    return () => {
      live = false;
    };
  }, [k]);

  const max = data ? Math.max(...data.methods.map((m) => m.captured ?? 0)) : 1;
  const rec = data?.methods.find((m) => m.recommended);

  return (
    <>
      <h1>A hospital can call {k.toLocaleString()} patients this month.</h1>
      <p className="lede">
        Which {k.toLocaleString()}? Below is what each way of choosing actually
        caught, measured on {data ? data.population.encounters.toLocaleString() : "19,765"}{" "}
        discharges the model never saw — where we already know who came back.
      </p>

      <Capacity k={k} setK={setK} />

      {err && (
        <div className="err">
          Could not reach the API. {err}
          <br />
          <span className="small">
            The free-tier server may still be waking up — try again in a minute.
          </span>
        </div>
      )}

      {!data && !err && <Loading />}

      {data && (
        <>
          <div className="panel">
            {data.methods.map((m) => {
              const cap = m.captured ?? 0;
              const notDistinct = m.distinguishable_from_recommended === false;
              return (
                <div className="row" key={m.method}>
                  <div className="top">
                    <span className="name">{m.label}</span>
                    {m.recommended && <span className="badge rec">recommended</span>}
                    {notDistinct && <span className="badge warn">not distinguishable</span>}
                    <span className="val">
                      {cap.toFixed(1)}
                      <span className="pct"> caught</span>
                    </span>
                  </div>
                  <div className="track">
                    <div
                      className={`fill ${m.recommended ? "rec" : m.method === "model" ? "model" : ""}`}
                      style={{ width: `${max ? (cap / max) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="detail">
                    {m.detail} &nbsp;·&nbsp; {((m.precision ?? 0) * 100).toFixed(1)}% of
                    those called were readmitted
                    {m.vs_random ? ` · ${m.vs_random.toFixed(1)}× random` : ""}
                  </div>
                  {notDistinct && m.advisory && <div className="advisory">{m.advisory}</div>}
                </div>
              );
            })}
          </div>

          <p className="small">
            Of {data.population.encounters.toLocaleString()} discharges,{" "}
            <strong className="num">{data.population.events.toLocaleString()}</strong> were
            readmitted within 30 days — a base rate of{" "}
            <strong className="num">{(data.population.base_rate * 100).toFixed(2)}%</strong>.
            Choosing {k.toLocaleString()} patients blindly would be expected to catch{" "}
            <strong className="num">{data.expected_if_random.toFixed(1)}</strong>.
          </p>

          {rec && (
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>What this says</h3>
              <p style={{ marginBottom: 0 }}>
                Sorting by one column already in the record —{" "}
                <strong>prior admissions</strong> — catches{" "}
                <strong className="num">{(rec.captured ?? 0).toFixed(1)}</strong> of the{" "}
                {k.toLocaleString()} you call. Age, the rule most programmes use, catches{" "}
                <strong className="num">
                  {(data.methods.find((m) => m.method === "age")?.captured ?? 0).toFixed(1)}
                </strong>
                . The machine learning model catches{" "}
                <strong className="num">
                  {(data.methods.find((m) => m.method === "model")?.captured ?? 0).toFixed(1)}
                </strong>{" "}
                — more, but not by enough to tell apart from noise.
              </p>
            </div>
          )}

          <p className="tiny">{data.note}</p>
        </>
      )}
    </>
  );
}
