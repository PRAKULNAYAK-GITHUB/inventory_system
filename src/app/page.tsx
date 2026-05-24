"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductWithStock, ReservationResponse } from "@/lib/schemas";

interface Toast {
  id: number;
  type: "error" | "success" | "info";
  message: string;
}

const productImages: Record<string, string> = {
  "WH-1000XM5":
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=640&q=80",
  "KB-MK870-BLK":
    "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=640&q=80",
  "MON-UW34-QHD":
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=640&q=80",
  "CH-ERGO-PRO":
    "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=640&q=80",
  "SSD-PORT-2TB":
    "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=640&q=80",
  "CAM-4K-PRO":
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=640&q=80",
  "TABLET-AIR-11":
    "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=640&q=80",
  "WATCH-FIT-LTE":
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=640&q=80",
  "BAG-TRAVEL-PRO":
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=640&q=80",
  "DOCK-USBC-12":
    "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=640&q=80",
};

const warehouseImages: Record<string, string> = {
  "Mumbai Central":
    "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=240&q=80",
  "Delhi NCR Hub":
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=240&q=80",
  "Bangalore South":
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=240&q=80",
  "Pune West":
    "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=240&q=80",
  "Hyderabad Fulfilment":
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=240&q=80",
};

function productImage(product: { sku: string }) {
  return productImages[product.sku] || productImages["SSD-PORT-2TB"];
}

function WarehouseDonutChart({ warehouses }: { warehouses: any[] }) {
  const totalStock = warehouses.reduce((sum, w) => sum + w.total, 0);
  let accumulatedPercent = 0;

  const segments = warehouses.map((w, index) => {
    const percent = totalStock > 0 ? (w.total / totalStock) * 100 : 0;
    const strokeDasharray = `${percent} ${100 - percent}`;
    const strokeDashoffset = 100 - accumulatedPercent + 25;
    accumulatedPercent += percent;

    const colors = [
      "var(--accent-primary)",
      "var(--accent-info)",
      "var(--accent-warning)",
      "var(--accent-success)",
      "var(--accent-danger)",
    ];
    const strokeColor = colors[index % colors.length];

    return {
      name: w.name,
      total: w.total,
      percent: Math.round(percent),
      strokeDasharray,
      strokeDashoffset,
      strokeColor,
    };
  });

  return (
    <div className="donut-chart-container animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 10px 10px 20px" }}>
      <div style={{ position: "relative", width: "140px", height: "140px" }}>
        <svg viewBox="0 0 36 36" className="circular-chart" style={{ width: "100%", height: "100%" }}>
          {segments.map((seg, idx) => (
            <circle
              key={idx}
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke={seg.strokeColor}
              strokeWidth="3.2"
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              style={{
                transition: "stroke-width 0.2s ease",
                cursor: "pointer",
              }}
            >
              <title>{`${seg.name}: ${seg.total} units (${seg.percent}%)`}</title>
            </circle>
          ))}
        </svg>
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          pointerEvents: "none",
        }}>
          <strong style={{ fontSize: "1.25rem", display: "block", color: "var(--text-primary)", fontWeight: "800", lineHeight: "1.1" }}>
            {totalStock.toLocaleString()}
          </strong>
          <span style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.5px" }}>
            Total Units
          </span>
        </div>
      </div>
      <div className="chart-legend" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", marginTop: "18px", width: "100%", fontSize: "0.75rem" }}>
        {segments.slice(0, 5).map((seg, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: seg.strokeColor, display: "inline-block", flexShrink: 0 }} />
              <span style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--text-secondary)",
                fontWeight: "600",
              }} title={seg.name}>
                {seg.name}
              </span>
            </div>
            <strong style={{ color: "var(--text-primary)" }}>{seg.percent}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (type: "error" | "success" | "info", message: string) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 4500);
    },
    []
  );

  const loadDashboard = useCallback(
    async (showFeedback = false) => {
      if (showFeedback) setRefreshing(true);

      try {
        const [productResponse, reservationResponse] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/reservations"),
        ]);

        if (!productResponse.ok || !reservationResponse.ok) {
          throw new Error("Failed to load dashboard");
        }

        setProducts(await productResponse.json());
        setReservations(await reservationResponse.json());
        if (showFeedback) addToast("success", "Dashboard refreshed from live data.");
      } catch {
        addToast("error", "Failed to refresh dashboard data.");
      } finally {
        setLoading(false);
        if (showFeedback) setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  const totals = useMemo(
    () =>
      products.reduce(
        (acc, product) => {
          product.stockLevels.forEach((stock) => {
            acc.total += stock.totalUnits;
            acc.reserved += stock.reservedUnits;
            acc.available += stock.availableUnits;
          });
          return acc;
        },
        { total: 0, reserved: 0, available: 0 }
      ),
    [products]
  );

  const metrics = [
    {
      label: "Total Products",
      value: products.length.toLocaleString(),
      delta: "+ seeded catalog",
      tone: "violet",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: "var(--accent-primary)" }}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )
    },
    {
      label: "Total Stock",
      value: totals.total.toLocaleString(),
      delta: "Live from Supabase",
      tone: "blue",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: "var(--accent-info)" }}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
      )
    },
    {
      label: "Reserved Stock",
      value: totals.reserved.toLocaleString(),
      delta: "Active checkout holds",
      tone: "amber",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: "var(--accent-warning)" }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    },
    {
      label: "Available Stock",
      value: totals.available.toLocaleString(),
      delta: "Ready to sell",
      tone: "green",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: "var(--accent-success)" }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    },
  ];

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

  const topProducts = useMemo(
    () =>
      products
        .map((product) => {
          const total = product.stockLevels.reduce((sum, stock) => sum + stock.totalUnits, 0);
          const reserved = product.stockLevels.reduce(
            (sum, stock) => sum + stock.reservedUnits,
            0
          );
          const available = product.stockLevels.reduce(
            (sum, stock) => sum + stock.availableUnits,
            0
          );

          return { product, total, reserved, available };
        })
        .sort((a, b) => b.reserved - a.reserved || a.available - b.available)
        .slice(0, 5),
    [products]
  );

  const lowStockItems = useMemo(
    () =>
      products
        .flatMap((product) =>
          product.stockLevels.map((stock) => ({
            product,
            stock,
          }))
        )
        .filter(({ stock }) => stock.availableUnits > 0 && stock.availableUnits <= 5)
        .sort((a, b) => a.stock.availableUnits - b.stock.availableUnits)
        .slice(0, 6),
    [products]
  );

  const liveReservations = reservations.slice(0, 6);

  return (
    <div className="dashboard-pro">
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Allo operations</p>
          <h1>Inventory command center</h1>
          <p>
            Live warehouse stock, checkout holds, and availability signals for a
            multi-warehouse fulfilment flow.
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="btn-ghost refresh-button"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh stock"}
          </button>
          <Link href="/products" className="btn-primary">
            New reservation
          </Link>
        </div>
      </section>

      <section className="metric-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-card premium-metric">
            <div className={`metric-icon metric-${metric.tone}`} style={{ display: "grid", placeItems: "center" }}>
              {metric.icon}
            </div>
            <p style={{ marginTop: 2 }}>{metric.label}</p>
            <strong>{loading ? "-" : metric.value}</strong>
            <small>{metric.delta}</small>
          </article>
        ))}
      </section>

      <div className="dashboard-widgets-vertical" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* 1. Stock by Warehouse */}
        <section className="panel warehouse-panel">
          <div className="panel-header">
            <div>
              <h2>
                <span className="pulse-dot-green" style={{ marginRight: 8 }} />
                Stock by Warehouse
              </h2>
              <p>Availability after subtracting pending reservation holds.</p>
            </div>
            <Link href="/warehouses" className="table-link">
              View all
            </Link>
          </div>
          <div className="warehouse-split-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: "10px" }}>
            <div className="warehouse-table" style={{ flex: 1 }}>
              {warehouses.map((warehouse) => {
                const utilization =
                  warehouse.total === 0
                    ? 0
                    : Math.round((warehouse.reserved / warehouse.total) * 100);

                return (
                  <Link
                    key={warehouse.id}
                    href={`/warehouses?id=${warehouse.id}`}
                    className="warehouse-row"
                    style={{
                      gridTemplateColumns: "36px minmax(130px, 1fr) repeat(3, 76px) 110px",
                      cursor: "pointer",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <img
                      src={warehouseImages[warehouse.name]}
                      alt=""
                      className="warehouse-thumb"
                    />
                    <div className="warehouse-name">
                      <strong>{warehouse.name}</strong>
                      <span>{warehouse.location}</span>
                    </div>
                    <div className="stock-stat">
                      <span>Total</span>
                      <strong>{warehouse.total}</strong>
                    </div>
                    <div className="stock-stat reserved">
                      <span>Reserved</span>
                      <strong>{warehouse.reserved}</strong>
                    </div>
                    <div className="stock-stat available">
                      <span>Available</span>
                      <strong>{warehouse.available}</strong>
                    </div>
                    <div className="utilization">
                      <div>
                        <span style={{ width: `${Math.max(utilization, 4)}%` }} />
                      </div>
                      <strong>{utilization}%</strong>
                    </div>
                  </Link>
                );
              })}
            </div>
            <WarehouseDonutChart warehouses={warehouses} />
          </div>
        </section>

        {/* 2. Live Reservations */}
        <aside className="panel live-panel">
          <div className="panel-header compact">
            <div>
              <h2>
                <span className="pulse-dot-green" style={{ marginRight: 8 }} />
                Live Reservations
              </h2>
              <p>Most recent checkout holds and outcomes.</p>
            </div>
            <Link href="/reservations" className="table-link">
              View all
            </Link>
          </div>
          <div className="live-list">
            {liveReservations.length === 0 ? (
              <p className="empty-copy">No reservations yet.</p>
            ) : (
              liveReservations.map((reservation) => (
                <Link
                  key={reservation.id}
                  href={`/checkout/${reservation.id}`}
                  className="live-item"
                >
                  <img src={productImage(reservation.product)} alt="" />
                  <span>
                    <strong>{reservation.product.name}</strong>
                    <small>
                      {reservation.warehouse.name} · {reservation.quantity} unit
                      {reservation.quantity > 1 ? "s" : ""}
                    </small>
                  </span>
                  <em className={`mini-status mini-${reservation.status.toLowerCase()}`}>
                    {reservation.status.toLowerCase()}
                  </em>
                </Link>
              ))
            )}
          </div>
        </aside>

        {/* 3. Top Products by Reservation */}
        <section className="panel top-products-panel">
          <div className="panel-header">
            <div>
              <h2>Top Products by Reservation</h2>
              <p>Low availability and active holds surface first.</p>
            </div>
            <Link href="/products" className="table-link">
              Product catalog
            </Link>
          </div>
          <div className="top-product-strip">
            {topProducts.map(({ product, reserved, available }) => (
              <Link
                key={product.id}
                href={`/products?search=${encodeURIComponent(product.sku)}`}
                className="top-product-card"
                style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
              >
                <img src={productImage(product)} alt="" />
                <strong>{product.name}</strong>
                <span>{product.sku}</span>
                <div>
                  <small>Reserved: {reserved}</small>
                  <small>Available: {available}</small>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 4. Last Remaining Items */}
        <section className="panel last-items-panel">
          <div className="panel-header compact">
            <div>
              <h2>Last Remaining Items</h2>
              <p>Lowest stock pockets across warehouses.</p>
            </div>
          </div>
          <div className="watch-list">
            {lowStockItems.map(({ product, stock }) => (
              <Link
                key={`${product.id}-${stock.warehouse.id}`}
                href={`/products?search=${encodeURIComponent(product.sku)}`}
                className="watch-item"
              >
                <img src={productImage(product)} alt="" />
                <span>
                  <strong>{product.name}</strong>
                  <small>{stock.warehouse.name}</small>
                </span>
                <em>{stock.availableUnits} left</em>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
