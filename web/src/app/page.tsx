"use client";
import { useEffect, useState } from "react";
import Capacity from "@/components/Capacity";
import Loading from "@/components/Loading";
import Reveal from "@/components/Reveal";
import { get, type Comparison } from "@/lib/api";

const META: Record<string, { label: string; detail: string; color: string; glow: string }> = {
  prior_admissions: { label: "Prior admissions", detail: "one integer column already in the record", color: "var(--accent)", glow: "0 0 14px var(--accent-glow)" },
  model: { label: "Model (untuned)", detail: "gradient-boosted, 41 fields", color: "#93a0ad", glow: "none" },
  length_of_stay: { label: "Length of stay", detail: "days in hospital this stay", color: "#b08968", glow: "none" },
  age: { label: "Age band", detail: "the rule most follow-up programmes use", color: "#a8748f", glow: "none" },
  random: { label: "Random selection", detail: "2,000 draws, for scale", color: "#6f7b7a", glow: "none" },
};
const ORDER = ["prior_admissions", "model", "length_of_stay", "age", "random"];

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
    return () => { live = false; };
  }, [k]);

  const by = new Map(data?.methods.map((m) => [m.method, m]) ?? []);
  const rows = ORDER.map((id) => by.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof by.get>>[];
  const max = Math.max(1, ...rows.map((m) => m.captured ?? 0));
  const cap = (id: string) => by.get(id)?.captured ?? 0;

  return (
    <section style={{ animation: "fade 420ms var(--ease) both" }}>
      <div className="eyebrow">01 — The decision</div>
      <h1>
        A hospital can call <span className="k">{k.toLocaleString()}</span> patients this month.
      </h1>
      <p className="lede">
        Which {k.toLocaleString()}? Below is what each way of choosing actually caught, measured on
        19,765 discharges the model never saw — where we already know who came back.
      </p>

      <Capacity k={k} setK={setK} />

      {err && (
        <div className="err">
          Could not reach the API. {err}
          <br />
          <span className="small">The free-tier server may still be waking up — try again in a minute.</span>
        </div>
      )}
      {!data && !err && <Loading />}

      {data && (
        <>
          <Reveal>
            <div className="sechead tight">
              <span className="n">02</span>
              <h2>Readmissions caught in the top {k.toLocaleString()}</h2>
            </div>
            <div className="panel stack">
              {rows.map((m) => {
                const meta = META[m.method];
                const c = m.captured ?? 0;
                const notDistinct = m.distinguishable_from_recommended === false;
                return (
                  <div className="mrow" key={m.method}>
                    <div className="head">
                      <span className="label">{meta.label}</span>
                      {m.recommended && <span className="badge rec">served here</span>}
                      {notDistinct && <span className="badge warn">not distinguishable</span>}
                      <span className="cap">{c.toFixed(1)}</span>
                      <span className="caught">caught</span>
                    </div>
                    <div className="track">
                      <div style={{ width: `${(c / max) * 100}%`, background: meta.color, boxShadow: meta.glow }} />
                    </div>
                    <div className="detail">
                      {meta.detail} &nbsp;·&nbsp; {((m.precision ?? 0) * 100).toFixed(1)}% of those called
                      were readmitted
                      {m.method !== "random" && m.vs_random ? ` · ${m.vs_random.toFixed(1)}× random` : ""}
                    </div>
                    {notDistinct && (
                      <div className="advisory">
                        Its point estimate is higher. The 95% interval on that advantage spans 1.0, so
                        the list is not served from it — reading the point estimate alone is the mistake
                        this project is about.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="small" style={{ marginTop: 16 }}>
              Of {data.population.encounters.toLocaleString()} discharges,{" "}
              <strong className="n">{data.population.events.toLocaleString()}</strong> were readmitted
              within 30 days — a base rate of{" "}
              <strong className="n">{(data.population.base_rate * 100).toFixed(2)}%</strong>. Choosing{" "}
              {k.toLocaleString()} patients blindly would be expected to catch{" "}
              <strong className="n">{data.expected_if_random.toFixed(1)}</strong>.
            </p>
          </Reveal>

          <Reveal>
            <div className="sechead">
              <span className="n">03</span>
              <h2>What this says</h2>
            </div>
            <div className="panel quote">
              <p style={{ margin: 0, fontSize: "1.06rem", lineHeight: 1.6, maxWidth: "62ch" }}>
                Sorting by one column already in the record — <strong style={{ fontWeight: 600 }}>prior
                admissions</strong> — catches <strong className="na">{cap("prior_admissions").toFixed(1)}</strong>{" "}
                of the {k.toLocaleString()} you call. Age, the rule most programmes use, catches{" "}
                <strong className="n">{cap("age").toFixed(1)}</strong>. The machine learning model catches{" "}
                <strong className="n">{cap("model").toFixed(1)}</strong> — more, but not by enough to tell
                apart from noise.
              </p>
            </div>
            <p className="note">
              Tie-averaged over 200 draws on held-out data. Ranking served from prior admissions, not
              from the model.
            </p>
          </Reveal>
        </>
      )}
    </section>
  );
}
