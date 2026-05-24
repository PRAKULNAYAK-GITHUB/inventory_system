"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProductWithStock, ReservationResponse } from "@/lib/schemas";

// High-Fidelity horizontal stacked capacity bar chart
function WarehouseComparisonChart({ warehouses }: { warehouses: any[] }) {
  const maxTotal = Math.max(...warehouses.map((w) => w.total), 1);

  return (
    <div className="panel comparison-panel animate-fade-in" style={{ padding: "24px", flex: 1, minWidth: "320px" }}>
      <h3 style={{ fontSize: "1rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "4px" }}>
        Warehouse Stock Comparison
      </h3>
      <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
        Total capacity distribution relative to the largest fulfillment center.
      </p>

      <div style={{ display: "grid", gap: "18px" }}>
        {warehouses.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No warehouses tracked.</p>
        ) : (
          warehouses.map((w) => {
            const availablePercent = w.total > 0 ? (w.available / w.total) * 100 : 0;
            const reservedPercent = w.total > 0 ? (w.reserved / w.total) * 100 : 0;
            const relativeWidth = (w.total / maxTotal) * 100;

            return (
              <div key={w.id} style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: "14px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={w.name}>
                  {w.name}
                </span>
                <div style={{ width: `${relativeWidth}%`, minWidth: "40%" }}>
                  <div style={{
                    display: "flex",
                    height: "18px",
                    borderRadius: "6px",
                    overflow: "hidden",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}>
                    {w.available > 0 && (
                      <div
                        style={{
                          width: `${availablePercent}%`,
                          background: "var(--accent-success)",
                          height: "100%",
                          transition: "all 0.3s ease",
                        }}
                        title={`${w.available} Available Units`}
                      />
                    )}
                    {w.reserved > 0 && (
                      <div
                        style={{
                          width: `${reservedPercent}%`,
                          background: "var(--accent-warning)",
                          height: "100%",
                          transition: "all 0.3s ease",
                        }}
                        title={`${w.reserved} Reserved Units`}
                      />
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "4px", fontWeight: "700" }}>
                    <span style={{ color: "var(--accent-success)" }}>{w.available} available</span>
                    <span>{w.total} total</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// High-Fidelity SVG Area Line Chart representing Stock and Checkout hold Trends
function StockTrendChart({ data }: { data: any[] }) {
  const width = 500;
  const height = 200;
  const padding = 34;

  const maxVal = 100;

  const getX = (index: number) => padding + (index * (width - 2 * padding)) / (data.length - 1);
  const getY = (val: number) => height - padding - (val * (height - 2 * padding)) / maxVal;

  const availableCoords = data.map((d, i) => `${getX(i)},${getY(d.available)}`);
  const reservedCoords = data.map((d, i) => `${getX(i)},${getY(d.reserved)}`);

  const availablePath = `M ${availableCoords.join(" L ")}`;
  const reservedPath = `M ${reservedCoords.join(" L ")}`;

  const availableAreaPath = `${availablePath} L ${getX(data.length - 1)},${height - padding} L ${getX(0)},${height - padding} Z`;
  const reservedAreaPath = `${reservedPath} L ${getX(data.length - 1)},${height - padding} L ${getX(0)},${height - padding} Z`;

  return (
    <div className="panel chart-panel animate-fade-in" style={{ padding: "24px", flex: 1, minWidth: "320px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: "800", color: "var(--text-primary)" }}>Fulfillment Readiness</h3>
          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Dynamic stock buffer ratios vs checkholds over 7 days.</p>
        </div>
        <div style={{ display: "flex", gap: "14px", fontSize: "0.75rem" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)", fontWeight: "700" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-primary)", display: "inline-block" }} /> Available
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)", fontWeight: "700" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-warning)", display: "inline-block" }} /> Holds
          </span>
        </div>
      </div>
      <div style={{ position: "relative", width: "100%" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
          {/* Gradients */}
          <defs>
            <linearGradient id="availableGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="reservedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-warning)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--accent-warning)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((gridVal) => (
            <g key={gridVal}>
              <line
                x1={padding}
                y1={getY(gridVal)}
                x2={width - padding}
                y2={getY(gridVal)}
                stroke="var(--border-color)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding - 10}
                y={getY(gridVal) + 3}
                fill="var(--text-muted)"
                fontSize="9"
                fontWeight="800"
                textAnchor="end"
              >
                {gridVal}%
              </text>
            </g>
          ))}

          {/* Paths */}
          <path d={availableAreaPath} fill="url(#availableGrad)" />
          <path d={reservedAreaPath} fill="url(#reservedGrad)" />

          {/* Lines */}
          <path d={availablePath} fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={reservedPath} fill="none" stroke="var(--accent-warning)" strokeWidth="2.5" strokeLinecap="round" />

          {/* Circle markers */}
          {data.map((d, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getY(d.available)}
                r="4"
                fill="var(--bg-card)"
                stroke="var(--accent-primary)"
                strokeWidth="2"
              />
              <circle
                cx={getX(i)}
                cy={getY(d.reserved)}
                r="4"
                fill="var(--bg-card)"
                stroke="var(--accent-warning)"
                strokeWidth="2"
              />
            </g>
          ))}

          {/* X Axis Labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={getX(i)}
              y={height - 10}
              fill="var(--text-secondary)"
              fontSize="9"
              fontWeight="800"
              textAnchor="middle"
            >
              {d.date}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const [productResponse, reservationResponse] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/reservations"),
        ]);

        if (productResponse.ok) setProducts(await productResponse.json());
        if (reservationResponse.ok) setReservations(await reservationResponse.json());
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const stats = useMemo(() => {
    const totalStock = products.reduce(
      (sum, product) =>
        sum + product.stockLevels.reduce((inner, stock) => inner + stock.totalUnits, 0),
      0
    );
    const availableStock = products.reduce(
      (sum, product) =>
        sum + product.stockLevels.reduce((inner, stock) => inner + stock.availableUnits, 0),
      0
    );
    const pending = reservations.filter((reservation) => reservation.status === "PENDING").length;
    const confirmed = reservations.filter(
      (reservation) => reservation.status === "CONFIRMED"
    ).length;
    const stockHealth =
      totalStock === 0 ? 0 : Math.round((availableStock / totalStock) * 100);

    return [
      {
        label: "Stock health",
        value: `${stockHealth}%`,
        tone: "green",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: "var(--accent-success)" }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      },
      {
        label: "Pending holds",
        value: pending.toString(),
        tone: "amber",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: "var(--accent-warning)" }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
      {
        label: "Confirmed orders",
        value: confirmed.toString(),
        tone: "blue",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: "var(--accent-info)" }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
      },
      {
        label: "Tracked SKUs",
        value: products.length.toString(),
        tone: "violet",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: "var(--accent-primary)" }}>
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        ),
      },
    ];
  }, [products, reservations]);

  // Dynamically group warehouses
  const warehouses = useMemo(() => {
    const grouped = new Map<
      string,
      { id: string; name: string; location: string; total: number; reserved: number; available: number }
    >();

    products.forEach((product) => {
      product.stockLevels.forEach((stock) => {
        const current =
          grouped.get(stock.warehouse.id) ||
          {
            id: stock.warehouse.id,
            name: stock.warehouse.name,
            location: stock.warehouse.location,
            total: 0,
            reserved: 0,
            available: 0,
          };

        current.total += stock.totalUnits;
        current.reserved += stock.reservedUnits;
        current.available += stock.availableUnits;
        grouped.set(stock.warehouse.id, current);
      });
    });

    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }, [products]);

  // Compute 7-day historical simulation
  const trendData = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    });

    // Wavy curve to represent dynamic reservation holds and stock buffers
    const availabilityPoints = [82, 79, 88, 85, 91, 80, 86];
    const reservationPoints = [18, 21, 12, 15, 9, 20, 14];

    return dates.map((date, idx) => ({
      date,
      available: availabilityPoints[idx],
      reserved: reservationPoints[idx],
    }));
  }, []);

  return (
    <div className="route-page">
      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Signals</p>
          <h1>Analytics</h1>
          <p>High-level health metrics derived from live inventory levels and hold ratios.</p>
        </div>
      </section>

      <section className="analytics-grid" style={{ marginBottom: "24px" }}>
        {loading
          ? [1, 2, 3, 4].map((item) => <div key={item} className="skeleton metric-card" style={{ minHeight: "112px" }} />)
          : stats.map((stat) => (
              <article key={stat.label} className="metric-card premium-metric">
                <div className={`metric-icon metric-${stat.tone}`} style={{ display: "grid", placeItems: "center" }}>
                  {stat.icon}
                </div>
                <p style={{ marginTop: 2 }}>{stat.label}</p>
                <strong>{stat.value}</strong>
              </article>
            ))}
      </section>

      {!loading && (
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "24px" }}>
          <StockTrendChart data={trendData} />
          <WarehouseComparisonChart warehouses={warehouses} />
        </div>
      )}

      <section className="panel insight-panel animate-fade-in" style={{ padding: "20px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "6px" }}>
          Inventory Readiness Signals
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
          This command dashboard tracks atomic availability ratios and reservation pressures across all linked storage repositories. 
          Real-time checkholds allow you to simulate lock pressures and concurrency conflicts (e.g. 409 checkout overlaps) during peak transactions, ensuring optimal stock allocations throughout the multi-region logistics grid.
        </p>
      </section>
    </div>
  );
}
