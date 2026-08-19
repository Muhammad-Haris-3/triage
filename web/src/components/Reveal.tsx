"use client";
import { useEffect, useRef } from "react";

/** Fades a section in as it enters the viewport.
 *
 *  Visibility is never allowed to depend on the animation firing. Three
 *  independent paths reveal the content:
 *
 *    1. IntersectionObserver, the normal path.
 *    2. An immediate reveal if the element is already within the viewport on
 *       mount — covers short pages and restored scroll positions.
 *    3. A 1200ms backstop timer that reveals regardless.
 *
 *  (3) exists because an observer that is present but never fires is a real
 *  state: a zero-height viewport reports no intersections at all, and the
 *  earlier guard — which only checked whether the API existed — left the
 *  content at opacity 0 permanently. An effect that can hide content must
 *  fail open.
 */
export default function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.classList.add("in");

    const backstop = window.setTimeout(show, 1200);

    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    if (viewportH <= 0 || rect.top < viewportH) {
      show();
      window.clearTimeout(backstop);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      show();
      window.clearTimeout(backstop);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            show();
            window.clearTimeout(backstop);
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);

    return () => {
      window.clearTimeout(backstop);
      io.disconnect();
    };
  }, []);

  return (
    <div className="reveal" ref={ref}>
      {children}
    </div>
  );
}
