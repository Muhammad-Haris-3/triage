"use client";
import { useEffect, useState } from "react";

/** NFR-6: the free tier sleeps. Say so rather than looking broken. */
export default function Loading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="load">
      <span className="mono" style={{ letterSpacing: ".18em", textTransform: "uppercase", fontSize: ".7rem" }}>
        loading measurements…
      </span>
      {slow && (
        <p className="small" style={{ marginTop: 16, maxWidth: "46ch" }}>
          The API sleeps when idle on its free tier, so the first request after a quiet
          period takes 30&ndash;50 seconds to wake it. Nothing is broken.
        </p>
      )}
    </div>
  );
}
