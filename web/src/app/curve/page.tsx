"use client";
import { useEffect, useMemo, useState } from "react";
import Loading from "@/components/Loading";
import Reveal from "@/components/Reveal";
import { get, type Curve } from "@/lib/api";

const META: Record<string, { label: string; color: string; width: number; dash?: string }> = {
  prior_admissions: { label: "Prior admissions", color: "var(--accent)", width: 2.8 },
  model: { label: "Model (untuned)", color: "#93a0ad", width: 1.6 },
  length_of_stay: { label: "Length of stay", color: "#b08968", width: 1.6 },
  age: { label: "Age band", color: "#a8748f", width: 1.6 },
  random: { label: "Random selection", color: "#6f7b7a", width: 1.6, dash: "4 5" },
};
const ORDER = ["prior_admissions", "model", "length_of_stay", "age", "random"];

const W = 880, H = 400, PL = 62, PR = 20, PT = 20, PB = 48, KMAX = 2000;

export default function CurvePage() {
  const [data, setData] = useState<Curve | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [k, setK] = useState(200);

  useEffect(() => {
    get<Curve>("/curve?kmax=2000&step=10").then(setData).catch((e) => setErr(String(e)));
  }, []);

  const series = useMemo(
    () => ORDER.map((id) => data?.series.find((s) => s.method === id)).filter(Boolean) as NonNullable<Curve["series"][number]>[],
    [data]
  );
  const maxY = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.captured)));
  const X = (kk: number) => PL + (kk / KMAX) * (W - PL - PR);
  const Y = (v: number) => H - PB - (v / maxY) * (H - PT - PB);

  /** Nearest measured point at or below k, for the live marker readout. */
  const at = (id: string) => {
    const pts = series.find((s) => s.method === id)?.points ?? [];
    let best = 0;
    for (const p of pts) if (p.k <= k) best = p.captured; else break;
    return best;
  };
  const priorAt = at("prior_admissions");

  return (
    <section style={{ animation: "rise 520ms var(--ease) both" }}>
      <div className="eyebrow">01 — Capacity</div>
      <h1>How the advantage changes with capacity</h1>
      <p className="lede">
        Readmissions caught, against how many patients you can call. The gap between prior admissions
        and everything simpler is wide at every capacity. The gap between prior admissions and the
        model never opens.
      </p>

      {err && <div className="err">Could not reach the API. {err}</div>}
      {!data && !err && <Loading />}

      {data && (
        <>
          <div className="panel" style={{ padding: "28px 30px 22px" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
                 aria-label="Readmissions caught against capacity, by selection method"
                 style={{ display: "block", overflow: "visible" }}>
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <g key={f}>
                  <line x1={PL} x2={W - PR} y1={Y(maxY * f)} y2={Y(maxY * f)} stroke="var(--rule-faint)" strokeWidth={1} />
                  <text x={PL - 10} y={Y(maxY * f) + 4} textAnchor="end" fontSize={11} fill="var(--faint)" className="mono">
                    {Math.round(maxY * f)}
                  </text>
                </g>
              ))}
              {[0, 500, 1000, 1500, 2000].map((kk) => (
                <text key={kk} x={X(kk)} y={372} textAnchor="middle" fontSize={11} fill="var(--faint)" className="mono">
                  {kk.toLocaleString()}
                </text>
              ))}
              <text x={470} y={396} textAnchor="middle" fontSize={10.5} letterSpacing={1.6} fill="var(--muted)" className="mono">
                PATIENTS CALLED
              </text>

              <line x1={X(k)} x2={X(k)} y1={20} y2={352} stroke="var(--accent)" strokeWidth={1}
                    strokeDasharray="3 5" opacity={0.65} style={{ transition: "all 300ms var(--ease)" }} />

              {series.map((s) => {
                const m = META[s.method];
                return (
                  <polyline key={s.method} fill="none" stroke={m.color} strokeWidth={m.width}
                            strokeDasharray={m.dash}
                            points={s.points.map((p) => `${X(p.k).toFixed(1)},${Y(p.captured).toFixed(1)}`).join(" ")} />
                );
              })}

              <circle cx={X(k)} cy={Y(priorAt)} r={4.5} fill="var(--accent)"
                      style={{ transition: "all 300ms var(--ease)", animation: "tick 2.6s ease-in-out infinite" }} />
            </svg>

            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--rule-soft)" }}>
              {series.map((s) => (
                <span key={s.method} className="mono"
                      style={{ display: "flex", alignItems: "center", gap: 9, fontSize: ".66rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>
                  <span style={{ width: 18, height: 3, background: META[s.method].color, display: "inline-block" }} />
                  {META[s.method].label}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", marginTop: 24, padding: "20px 26px", background: "var(--deep)", border: "1px solid var(--rule-soft)" }}>
            <span className="caplabel" style={{ marginBottom: 0 }}>move the capacity</span>
            <input type="range" min={10} max={2000} step={10} value={k}
                   onChange={(e) => setK(Number(e.target.value))}
                   style={{ flex: 1, minWidth: 200, margin: 0 }} />
            <span className="mono" style={{ fontSize: "1.05rem", fontWeight: 600 }}>{k.toLocaleString()}</span>
            <span className="mono" style={{ fontSize: ".8rem", color: "var(--accent-text)" }}>
              {priorAt.toFixed(1)} caught
            </span>
          </div>

          <Reveal>
            <div className="sechead">
              <span className="n">02</span>
              <h2>Reading it</h2>
            </div>
            <div className="panel quote">
              <p style={{ maxWidth: "64ch" }}>
                Every line rises — call more people, catch more. What matters is the distance between
                them at the capacity you actually have.
              </p>
              <p style={{ margin: 0, maxWidth: "64ch" }}>
                Prior admissions and the model run together the whole way. Age and length of stay sit
                far below both, barely above random selection. The choice that matters is not{" "}
                <em>model or no model</em> — it is <em>are you sorting by the right column at all</em>.
              </p>
            </div>
            <p className="note">Tie-averaged over repeated draws, computed on 19,765 held-out discharges.</p>
          </Reveal>
        </>
      )}
    </section>
  );
}
