"use client";

const PRESETS = [50, 100, 200, 500, 1000];

export default function Capacity({ k, setK }: { k: number; setK: (n: number) => void }) {
  return (
    <div className="panel">
      <div className="cap">
        <label htmlFor="k">Patients we can call</label>
        <input
          id="k" type="range" min={10} max={2000} step={10}
          value={k} onChange={(e) => setK(Number(e.target.value))}
        />
        <input
          type="number" min={1} max={2000} value={k}
          onChange={(e) => setK(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))}
        />
      </div>
      <div className="presets" style={{ marginTop: 12 }}>
        {PRESETS.map((p) => (
          <button key={p} className={k === p ? "on" : ""} onClick={() => setK(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
