"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Compare" },
  { href: "/list", label: "The list" },
  { href: "/curve", label: "Capacity" },
  { href: "/findings", label: "What this shows" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="site">
      <Link href="/" className="brand">
        <b>Triage</b>
        <i>readmission targeting</i>
      </Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={`tab${path === l.href ? " on" : ""}`}>
          {l.label}
          <span />
        </Link>
      ))}
      <div className="spacer" />
      <div className="held">held out · 19,765 discharges</div>
    </nav>
  );
}
