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
      <span className="dots">Loading</span>
      {slow && (
        <p className="small" style={{ marginTop: 12, maxWidth: 460 }}>
          The API sleeps when idle on its free tier, so the first request after a
          quiet period takes 30–50 seconds to wake it. Nothing is broken.
        </p>
      )}
    </div>
  );
}
