import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo Inventory — Warehouse Reservation System",
  description:
    "Reserve inventory across multiple warehouses with real-time stock tracking and concurrency-safe checkout.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            borderBottom: "1px solid var(--border-color)",
            background: "rgba(10, 10, 15, 0.85)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <a
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textDecoration: "none",
                color: "var(--text-primary)",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "var(--gradient-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: "800",
                  letterSpacing: "-0.02em",
                }}
              >
                A
              </div>
              <span
                style={{
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  letterSpacing: "-0.02em",
                }}
              >
                Allo Inventory
              </span>
            </a>
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <a
                href="/"
                className="btn-ghost"
                style={{
                  padding: "8px 16px",
                  fontSize: "0.813rem",
                  textDecoration: "none",
                }}
              >
                Products
              </a>
            </nav>
          </div>
        </header>
        <main
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "32px 24px",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
