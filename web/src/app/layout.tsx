import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Triage — what each way of choosing gets you",
  description:
    "A hospital can follow up with a few hundred discharged patients a month. Which few hundred? Measured on 19,765 held-out records.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="wrap">{children}</main>
        <footer className="site">
          <div className="wrap">
            <p>
              Data: 130 US hospitals, 1999–2008 (UCI dataset 296, CC-BY 4.0).
              Nothing here describes any hospital operating today.
            </p>
            <p>
              This is a demonstration of a targeting method. It is{" "}
              <strong>not clinical decision support</strong> and must not inform
              anyone&rsquo;s care.
            </p>
            <p style={{ marginTop: 12 }}>
              <a href="https://github.com/Muhammad-Haris-3/triage">Source, methods and measurements</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
