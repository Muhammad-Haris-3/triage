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
    <header className="site">
      <div className="inner">
        <Link href="/" className="brand">
          Triage<span>readmission targeting</span>
        </Link>
        <nav>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
