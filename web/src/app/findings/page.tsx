"use client";
import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import Reveal from "@/components/Reveal";
import { get, type Evidence } from "@/lib/api";

/** The lift axis. 1.0 must sit inside it, since the whole point is that the
 *  interval crosses the null. */
const LO = 0.8, HI = 1.35;
const pos = (v: number) => ((v - LO) / (HI - LO)) * 100;

export default function Findings() {
  const [e, setE] = useState<Evidence | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    get<Evidence>("/evidence").then(setE).catch((x) => setErr(String(x)));
  }, []);

  return (
    <section style={{ animation: "rise 520ms var(--ease) both" }}>
      <div className="eyebrow">01 — What this shows</div>
      <h1>A model that could not beat counting</h1>
      <p className="lede">
        Three findings, all measured on patients the model never saw, all reproducible from a
        checksummed input and a fixed seed.
      </p>

      {err && <div className="err">Could not reach the API. {err}</div>}
      {!e && !err && <Loading />}

      {e && (
        <>
          <div className="sechead tight" style={{ marginBottom: 32 }}>
            <span className="n">02</span>
            <h2>The model does not beat counting</h2>
          </div>
          <div className="panel stats">
            <div>
              <div className="v a">{e.m0.captured200_prior_admissions.toFixed(1)}</div>
              <div className="l">prior admissions · one column</div>
            </div>
            <div>
              <div className="v">{e.m0.captured200_gbm.toFixed(1)}</div>
              <div className="l">untuned gradient-boosted model</div>
            </div>
            <div style={{ boxShadow: "none" }}>
              <div className="v">{e.m0.lift200.toFixed(2)}×</div>
              <div className="l">lift at k = 200</div>
            </div>
          </div>

          <Reveal>
            <div className="panel warnleft" style={{ marginTop: 8 }}>
              <div className="mono" style={{ fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--caveat-text)", marginBottom: 28 }}>
                95% confidence interval · spans 1.0
              </div>
              <div style={{ position: "relative", height: 64, margin: "0 8px" }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: 38, height: 1, background: "var(--rule-soft)" }} />
                <div style={{ position: "absolute", left: `${pos(1)}%`, top: 8, bottom: 0, width: 1, background: "var(--text)", opacity: 0.65 }} />
                <div className="mono" style={{ position: "absolute", left: `${pos(1)}%`, top: 0, transform: "translateX(-50%)", fontSize: ".62rem" }}>
                  1.00
                </div>
                <div style={{
                  position: "absolute", left: `${pos(e.m0.ci[0])}%`,
                  width: `${pos(e.m0.ci[1]) - pos(e.m0.ci[0])}%`, top: 34, height: 9,
                  background: "var(--caveat-wash)", borderLeft: "2px solid var(--caveat)", borderRight: "2px solid var(--caveat)",
                }} />
                <div style={{
                  position: "absolute", left: `${pos(e.m0.lift200)}%`, top: 31, width: 15, height: 15,
                  transform: "translateX(-50%)", background: "var(--accent)", boxShadow: "0 0 14px var(--accent-glow)",
                }} />
                <div className="mono" style={{ position: "absolute", left: `${pos(e.m0.ci[0])}%`, top: 52, transform: "translateX(-50%)", fontSize: ".62rem", color: "var(--faint)" }}>
                  {e.m0.ci[0].toFixed(2)}
                </div>
                <div className="mono" style={{ position: "absolute", left: `${pos(e.m0.ci[1])}%`, top: 52, transform: "translateX(-50%)", fontSize: ".62rem", color: "var(--faint)" }}>
                  {e.m0.ci[1].toFixed(2)}
                </div>
              </div>
              <p style={{ margin: "24px 0 0", fontSize: ".95rem", color: "var(--muted)", maxWidth: "64ch" }}>
                The interval includes 1.0, so five extra patients out of 200 cannot be told apart from
                noise. The kill criterion for exactly this outcome was written into the specification
                before any data was loaded.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div className="sechead">
              <span className="n">03</span>
              <h2>Better AUC, worse decision</h2>
            </div>
            <p style={{ maxWidth: "66ch", marginBottom: 24 }}>
              One declared retry added grouped diagnosis codes and admitting specialty. The standard
              industry score improved. The number of at-risk patients actually reached fell.
            </p>
            <div className="panel scroll">
              <table>
                <thead>
                  <tr>
                    <th>Feature set</th>
                    <th className="r">AUC</th>
                    <th className="r">Caught in top 200</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Without diagnosis</td>
                    <td className="m r">{e.m0.auc_gbm.toFixed(4)}</td>
                    <td className="m r" style={{ fontWeight: 600 }}>{e.m0.captured200_gbm.toFixed(1)}</td>
                  </tr>
                  <tr>
                    <td>With diagnosis</td>
                    <td className="m r" style={{ color: "var(--accent-text)" }}>{e.m0.auc_gbm_with_diagnosis.toFixed(4)} ↑</td>
                    <td className="m r" style={{ fontWeight: 600, color: "var(--caveat-text)" }}>
                      {e.m0.captured200_gbm_with_diagnosis.toFixed(1)} ↓
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="small" style={{ marginTop: 18 }}>
              Ten fewer real patients, from the model that scores better. AUC measures ranking across
              all {e.test_encounters.toLocaleString()} discharges. A hospital cannot call all of them —
              it calls a few hundred. A model can improve overall while getting worse at the only part
              that is actionable.
            </p>
            <p style={{ marginTop: 18, maxWidth: "66ch" }}>
              <strong style={{ fontWeight: 600 }}>This is the finding worth carrying elsewhere.</strong>{" "}
              The other two are about this dataset. This one is about how the choice of metric decides
              what gets shipped.
            </p>
          </Reveal>

          <Reveal>
            <div className="sechead">
              <span className="n">04</span>
              <h2>What actually predicts a return</h2>
            </div>
            <p className="small" style={{ marginBottom: 24 }}>
              Odds ratios from the logistic model, per one standard deviation. Above 1.0 means higher risk.
            </p>
            <div className="panel odds">
              {Object.entries(e.odds_ratios)
                .sort((a, b) => b[1].odds_ratio - a[1].odds_ratio)
                .map(([key, v]) => {
                  const or = v.odds_ratio;
                  const w = Math.min(50, (Math.abs(or - 1) / 0.45) * 50);
                  const color = or >= 1.05 ? "var(--accent)" : or >= 1 ? "var(--muted)" : "var(--caveat)";
                  return (
                    <div key={key}>
                      <span className="lab">{key.replace(/_/g, " ")}</span>
                      <span className="bar">
                        <span style={{ left: `${or >= 1 ? 50 : 50 - w}%`, width: `${Math.max(0.6, w)}%`, background: color }} />
                      </span>
                      <span className="val" style={{ color }}>{or.toFixed(3)}</span>
                    </div>
                  );
                })}
            </div>
            <p className="small" style={{ marginTop: 18 }}>
              Prior admissions dominates everything else — which is why a model with access to all 41
              fields struggles to improve on that one column. The bar is drawn from the 1.0 line: left
              of it means lower risk.
            </p>
          </Reveal>

          <Reveal>
            <div className="sechead">
              <span className="n">05</span>
              <h2>What this does not show</h2>
            </div>
            <div className="panel stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(18rem,1fr))" }}>
              <div>
                <h3 className="mono" style={{ margin: "0 0 12px", fontSize: ".64rem", fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent-text)" }}>
                  That calling patients helps
                </h3>
                <p style={{ margin: 0, fontSize: ".92rem", color: "var(--muted)" }}>
                  This data records who was readmitted. It records no interventions. Nothing here
                  supports a savings estimate, which is why there is no money figure anywhere on this site.
                </p>
              </div>
              <div>
                <h3 className="mono" style={{ margin: "0 0 12px", fontSize: ".64rem", fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent-text)" }}>
                  That the model is useless
                </h3>
                <p style={{ margin: 0, fontSize: ".92rem", color: "var(--muted)" }}>
                  It does not beat one strong column at this capacity, on this data, untuned. A tuned
                  model was not tested — deliberately, because searching until something clears a
                  pre-registered bar destroys the bar.
                </p>
              </div>
              <div style={{ boxShadow: "none" }}>
                <h3 className="mono" style={{ margin: "0 0 12px", fontSize: ".64rem", fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent-text)" }}>
                  Anything about hospitals today
                </h3>
                <p style={{ margin: 0, fontSize: ".92rem", color: "var(--muted)" }}>
                  The data is 1999–2008. Practice, coding and readmission policy have all changed since.
                  Nothing here should inform the care of any person.
                </p>
              </div>
            </div>
            <p className="note">
              Held out: {e.test_encounters.toLocaleString()} discharges from{" "}
              {e.test_patients.toLocaleString()} patients, {e.test_events.toLocaleString()} readmissions,
              base rate {(e.base_rate * 100).toFixed(2)}%. Split by patient, never by encounter. Brier
              score {e.calibration.brier} against {e.calibration.brier_base_rate_only} for predicting the
              base rate for everyone —{" "}
              <a href="https://github.com/Muhammad-Haris-3/triage/blob/main/METHODS.md">full method</a>.
            </p>
          </Reveal>
        </>
      )}
    </section>
  );
}
