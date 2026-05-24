import type { Metadata } from "next";
import Link from "next/link";
import { SidebarNav } from "@/components/SidebarNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo Inventory - Warehouse Reservation System",
  description:
    "Reserve inventory across multiple warehouses with real-time stock tracking and concurrency-safe checkout.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <div className="workspace">
          <aside className="sidebar">
            <Link href="/" className="brand">
              <span className="brand-mark">a</span>
              <span>allo</span>
            </Link>

            <SidebarNav />

            <div className="support-card" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <strong>Contact Support</strong>
              <p>Need assistance? Contact our team for support and enquiries.</p>
              <a 
                href="mailto:support@allo.co" 
                style={{ 
                  color: "var(--accent-primary)", 
                  fontSize: "0.85rem", 
                  fontWeight: "700", 
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px" 
                }}
              >
                <span>support@allo.co</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
            </div>
          </aside>

          <div className="content-shell">
            <header className="topbar">
              <div>
                <strong>Inventory Reservation System</strong>
                <span>Concurrency-safe checkout holds</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <ThemeToggle />
                <div className="user-chip">
                  <span>PN</span>
                  <div>
                    <strong>Prakul Nayak</strong>
                    <small>Admin</small>
                  </div>
                </div>
              </div>
            </header>
            <main>{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
