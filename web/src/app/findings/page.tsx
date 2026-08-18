"use client";
import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import { get, type Evidence } from "@/lib/api";

export default function Findings() {
  const [e, setE] = useState<Evidence | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    get<Evidence>("/evidence").then(setE).catch((x) => setErr(String(x)));
  }, []);

  return (
    <>
      <h1>What this shows</h1>
      <p className="lede">
        Three findings, all measured on patients the model never saw, all
        reproducible from a checksummed input and a fixed seed.
      </p>

      {err && <div className="err">Could not reach the API. {err}</div>}
      {!e && !err && <Loading />}

      {e && (
        <>
          <h2>1. The model does not beat counting</h2>
          <div className="panel">
            <table>
              <tbody>
                <tr>
                  <td>Prior admissions, one column</td>
                  <td className="num"><strong>{e.m0.captured200_prior_admissions}</strong></td>
                </tr>
                <tr>
                  <td>Untuned gradient-boosted model</td>
                  <td className="num"><strong>{e.m0.captured200_gbm}</strong></td>
                </tr>
              </tbody>
            </table>
            <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
              Caught in the top 200. Lift ={" "}
              <strong className="num">{e.m0.lift200.toFixed(2)}×</strong>, 95% confidence
              interval <strong className="num">[{e.m0.ci[0].toFixed(2)}, {e.m0.ci[1].toFixed(2)}]</strong>. The
              interval includes 1.0, so five extra patients out of 200 cannot be told
              apart from noise.
            </p>
          </div>

          <h2>2. Better AUC, worse decision</h2>
          <p>
            One declared retry added grouped diagnosis codes and admitting specialty.
            The standard industry score improved. The number of at-risk patients
            actually reached fell.
          </p>
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th className="num">AUC</th>
                  <th className="num">Caught in top 200</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Without diagnosis</td>
                  <td className="num">{e.m0.auc_gbm.toFixed(4)}</td>
                  <td className="num"><strong>{e.m0.captured200_gbm}</strong></td>
                </tr>
                <tr>
                  <td>With diagnosis</td>
                  <td className="num">{e.m0.auc_gbm_with_diagnosis.toFixed(4)} ↑</td>
                  <td className="num"><strong>{e.m0.captured200_gbm_with_diagnosis}</strong> ↓</td>
                </tr>
              </tbody>
            </table>
            <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
              Ten fewer real patients, from the model that scores better. AUC measures
              ranking across all {e.test_encounters.toLocaleString()} discharges. A
              hospital cannot call all of them — it calls a few hundred. A model can
              improve overall while getting worse at the only part that is actionable.
            </p>
          </div>
          <p>
            <strong>This is the finding worth carrying elsewhere.</strong> The other two
            are about this dataset. This one is about how the choice of metric decides
            what gets shipped.
          </p>

          <h2>3. What actually predicts a return</h2>
          <p className="small">
            Odds ratios from the logistic model, per one standard deviation. Above 1.0
            means higher risk.
          </p>
          <div className="panel scroll">
            <table>
              <thead>
                <tr><th>Factor</th><th className="num">Odds ratio</th></tr>
              </thead>
              <tbody>
                {Object.entries(e.odds_ratios)
                  .sort((a, b) => b[1].odds_ratio - a[1].odds_ratio)
                  .map(([k, v]) => (
                    <tr key={k}>
                      <td>{k.replace(/_/g, " ")}</td>
                      <td className="num">{v.odds_ratio.toFixed(3)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="small">
            Prior admissions dominates everything else — which is why a model with
            access to all 41 fields struggles to improve on that one column.
          </p>

          <h2>Are the risk figures trustworthy?</h2>
          <div className="panel">
            <p className="small" style={{ marginBottom: 8 }}>
              Brier score <strong className="num">{e.calibration.brier}</strong> against{" "}
              <strong className="num">{e.calibration.brier_base_rate_only}</strong> for
              predicting the base rate for everyone — lower is better, so the stated
              risks carry real information.
            </p>
            <table>
              <thead>
                <tr><th className="num">Predicted</th><th className="num">Observed</th></tr>
              </thead>
              <tbody>
                {e.calibration.mean_predicted.map((p, i) => (
                  <tr key={i}>
                    <td className="num">{(p * 100).toFixed(1)}%</td>
                    <td className="num">{(e.calibration.observed[i] * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>What this does not show</h2>
          <div className="panel">
            <p><strong>That calling patients helps.</strong> This data records who was
              readmitted. It records no interventions. Nothing here supports a savings
              estimate, which is why there is no money figure anywhere in this site.</p>
            <p><strong>That the model is useless in general.</strong> It does not beat one
              strong column at this capacity, on this data, untuned. A tuned model was
              not tested — deliberately, because searching until something clears a
              pre-registered bar destroys the bar.</p>
            <p style={{ marginBottom: 0 }}>
              <strong>Anything about hospitals today.</strong> The data is 1999–2008.
            </p>
          </div>

          <p className="small">
            Held out: {e.test_encounters.toLocaleString()} discharges from{" "}
            {e.test_patients.toLocaleString()} patients, {e.test_events.toLocaleString()}{" "}
            readmissions, base rate {(e.base_rate * 100).toFixed(2)}%. Split by patient,
            never by encounter —{" "}
            <a href="https://github.com/Muhammad-Haris-3/triage/blob/main/METHODS.md">
              full method
            </a>
            .
          </p>
        </>
      )}
    </>
  );
}
