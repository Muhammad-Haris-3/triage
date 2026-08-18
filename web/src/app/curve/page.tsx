"use client";
import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import { get, type Curve } from "@/lib/api";

const COLOR: Record<string, string> = {
  prior_admissions: "var(--accent)",
  model: "#8a8f9c",
  length_of_stay: "#b08968",
  age: "#a8748f",
  random: "#9a9a9a",
};
const ORDER = ["prior_admissions", "model", "length_of_stay", "age", "random"];

const W = 820, H = 380, PAD = { l: 56, r: 16, t: 16, b: 44 };

export default function CurvePage() {
  const [data, setData] = useState<Curve | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    get<Curve>("/curve?kmax=2000&step=20")
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  const series = data
    ? [...data.series].sort((a, b) => ORDER.indexOf(a.method) - ORDER.indexOf(b.method))
    : [];
  const maxK = data?.kmax ?? 2000;
  const maxY = series.length
    ? Math.max(...series.flatMap((s) => s.points.map((p) => p.captured)))
    : 1;

  const x = (k: number) => PAD.l + (k / maxK) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b);

  return (
    <>
      <h1>How the advantage changes with capacity</h1>
      <p className="lede">
        Readmissions caught, against how many patients you can call. The gap between
        prior admissions and everything simpler is wide at every capacity. The gap
        between prior admissions and the model never opens.
      </p>

      {err && <div className="err">Could not reach the API. {err}</div>}
      {!data && !err && <Loading />}

      {data && (
        <>
          <div className="panel scroll">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
                 aria-label="Readmissions caught against capacity, by selection method">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <g key={f}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={y(maxY * f)} y2={y(maxY * f)}
                        stroke="var(--line)" strokeWidth="1" />
                  <text x={PAD.l - 10} y={y(maxY * f) + 4} textAnchor="end"
                        fontSize="11" fill="var(--faint)">
                    {Math.round(maxY * f)}
                  </text>
                </g>
              ))}
              {[0, 500, 1000, 1500, 2000].map((k) => (
                <text key={k} x={x(k)} y={H - PAD.b + 20} textAnchor="middle"
                      fontSize="11" fill="var(--faint)">
                  {k}
                </text>
              ))}
              <text x={(W - PAD.l) / 2 + PAD.l} y={H - 6} textAnchor="middle"
                    fontSize="11" fill="var(--muted)">
                patients called
              </text>

              {series.map((s) => (
                <polyline
                  key={s.method}
                  fill="none"
                  stroke={COLOR[s.method]}
                  strokeWidth={s.recommended ? 2.6 : 1.6}
                  strokeDasharray={s.method === "random" ? "4 4" : undefined}
                  points={s.points.map((p) => `${x(p.k)},${y(p.captured)}`).join(" ")}
                />
              ))}
            </svg>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10 }}>
              {series.map((s) => (
                <span key={s.method} className="small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 16, height: 3, background: COLOR[s.method], display: "inline-block" }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Reading it</h3>
            <p>
              Every line rises — call more people, catch more. What matters is the
              distance between them at the capacity you actually have.
            </p>
            <p style={{ marginBottom: 0 }}>
              Prior admissions and the model run together the whole way. Age and length
              of stay sit far below both, barely above random selection. The choice that
              matters is not <em>model or no model</em> — it is{" "}
              <em>are you sorting by the right column at all</em>.
            </p>
          </div>

          <p className="tiny">
            Tie-averaged over repeated draws, computed on 19,765 held-out discharges.
          </p>
        </>
      )}
    </>
  );
}
