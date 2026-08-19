import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Triage — a model that could not beat counting",
  description:
    "A hospital can follow up with a few hundred discharged patients a month. Which few hundred? Measured on 19,765 held-out records.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <div className="shell">
          <Nav />
          <main className="wrap">{children}</main>
          <footer className="site">
            <div className="inner">
              <span style={{ maxWidth: "52ch" }}>
                Diabetes 130-US Hospitals, 1999&ndash;2008 · CC-BY 4.0 · seed pinned at 42 ·
                every figure reproducible from two scripts. Not clinical decision support.{" "}
                <a href="https://github.com/Muhammad-Haris-3/triage">Source and methods</a>.
              </span>
              <span className="mono" style={{ fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase" }}>
                Triage · negative result, published
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
