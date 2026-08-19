"use client";

const PRESETS = [50, 100, 200, 500, 1000];

export default function Capacity({ k, setK }: { k: number; setK: (n: number) => void }) {
  return (
    <div className="panel capgrid">
      <div className="left">
        <label className="caplabel" htmlFor="cap">
          Patients we can call
        </label>
        <input
          id="cap" type="range" min={10} max={2000} step={10}
          value={k} onChange={(e) => setK(Number(e.target.value))}
        />
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p} className={k === p ? "on" : ""} onClick={() => setK(p)}>
              {p.toLocaleString()}
            </button>
          ))}
        </div>
      </div>
      <div className="right">
        <div className="bignum">{k.toLocaleString()}</div>
        <div className="unit">capacity</div>
      </div>
    </div>
  );
}
