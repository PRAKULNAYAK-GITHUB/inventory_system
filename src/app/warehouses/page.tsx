"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { ProductWithStock } from "@/lib/schemas";

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

const productImages: Record<string, string> = {
  "WH-1000XM5":
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=120&q=80",
  "KB-MK870-BLK":
    "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=120&q=80",
  "MON-UW34-QHD":
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=120&q=80",
  "CH-ERGO-PRO":
    "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=120&q=80",
  "SSD-PORT-2TB":
    "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=120&q=80",
  "CAM-4K-PRO":
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=120&q=80",
  "TABLET-AIR-11":
    "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=120&q=80",
  "WATCH-FIT-LTE":
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=120&q=80",
  "BAG-TRAVEL-PRO":
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=120&q=80",
  "DOCK-USBC-12":
    "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=120&q=80",
};

export default function WarehousesPage() {
  return (
    <Suspense fallback={<div className="skeleton dashboard-side-skeleton" />}>
      <WarehousesPageContent />
    </Suspense>
  );
}

function WarehousesPageContent() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const selectId = searchParams.get("id");

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const [warehouseResponse, productResponse] = await Promise.all([
          fetch("/api/warehouses"),
          fetch("/api/products"),
        ]);

        if (warehouseResponse.ok) setWarehouses(await warehouseResponse.json());
        if (productResponse.ok) setProducts(await productResponse.json());
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (selectId) {
      setActiveWarehouseId(selectId);
      window.setTimeout(() => {
        const element = document.getElementById(selectId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [selectId]);

  const warehouseStats = useMemo(
    () =>
      warehouses.map((warehouse) => {
        const stocks = products.flatMap((product) =>
          product.stockLevels.filter((stock) => stock.warehouse.id === warehouse.id)
        );
        const total = stocks.reduce((sum, stock) => sum + stock.totalUnits, 0);
        const reserved = stocks.reduce((sum, stock) => sum + stock.reservedUnits, 0);
        const available = stocks.reduce((sum, stock) => sum + stock.availableUnits, 0);
        const utilization = total === 0 ? 0 : Math.round((reserved / total) * 100);

        return { warehouse, total, reserved, available, utilization };
      }),
    [warehouses, products]
  );

  const displayedStats = useMemo(() => {
    if (activeWarehouseId) {
      return warehouseStats.filter((stat) => stat.warehouse.id === activeWarehouseId);
    }
    return warehouseStats;
  }, [warehouseStats, activeWarehouseId]);

  return (
    <div className="route-page">
      <section className="subpage-hero" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", padding: "26px" }}>
        <div>
          <p className="eyebrow">Network</p>
          <h1>Warehouses</h1>
          <p>Operational view of stock capacity, reserved units, and availability.</p>
        </div>
        {activeWarehouseId && (
          <button 
            onClick={() => {
              setActiveWarehouseId(null);
              window.history.pushState({}, "", "/warehouses");
            }}
            className="btn-ghost"
            style={{ fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>All Warehouses</span>
          </button>
        )}
      </section>

      <section className="warehouse-card-grid" style={{ gridTemplateColumns: activeWarehouseId ? "1fr" : undefined }}>
        {loading ? (
          <div className="skeleton dashboard-side-skeleton" />
        ) : (
          displayedStats.map(({ warehouse, total, reserved, available, utilization }) => (
            <article 
              id={warehouse.id}
              key={warehouse.id} 
              className={`warehouse-detail-card ${activeWarehouseId === warehouse.id ? "active" : ""}`}
              onClick={() => {
                const nextId = activeWarehouseId === warehouse.id ? null : warehouse.id;
                setActiveWarehouseId(nextId);
                if (!nextId) {
                  window.history.pushState({}, "", "/warehouses");
                }
              }}
              style={{ 
                cursor: "pointer", 
                transition: "all 0.25s ease",
                width: "100%"
              }}
            >
              <div>
                <span className="eyebrow">{warehouse.location}</span>
                <h2>{warehouse.name}</h2>
              </div>
              <div className="warehouse-meter">
                <span style={{ width: `${Math.max(utilization, 3)}%` }} />
              </div>
              <div className="warehouse-kpis">
                <div>
                  <span>Total</span>
                  <strong>{total}</strong>
                </div>
                <div>
                  <span>Reserved</span>
                  <strong className="warn-text">{reserved}</strong>
                </div>
                <div>
                  <span>Available</span>
                  <strong className="success-text">{available}</strong>
                </div>
              </div>

              {activeWarehouseId === warehouse.id && (
                <div 
                  className="warehouse-products" 
                  style={{ 
                    borderTop: "1px solid var(--border-color)", 
                    paddingTop: "16px", 
                    marginTop: "4px", 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "12px", 
                    animation: "fadeIn 0.25s ease",
                    width: "100%"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ fontSize: "0.78rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.5px", width: "100%" }}>Stocked Products</h3>
                  <div 
                    style={{ 
                      display: "flex", 
                      flexDirection: "row", 
                      flexWrap: "wrap", 
                      gap: "10px", 
                      width: "100%" 
                    }}
                  >
                    {products.map(p => {
                      const stock = p.stockLevels.find(s => s.warehouse.id === warehouse.id);
                      if (!stock || stock.totalUnits <= 0) return null;
                      return { product: p, stock };
                    }).filter((item): item is { product: ProductWithStock; stock: any } => item !== null).map(({ product, stock }) => (
                      <div 
                        key={product.id} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "space-between", 
                          gap: "12px", 
                          padding: "10px", 
                          background: "var(--bg-elevated)", 
                          borderRadius: "var(--radius-sm)", 
                          border: "1px solid var(--border-color)",
                          cursor: "default",
                          flex: "1 1 200px",
                          minWidth: "200px"
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <img 
                            src={product.imageUrl || productImages[product.sku] || "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=120&q=80"} 
                            alt="" 
                            style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover" }} 
                          />
                          <div style={{ display: "grid", gap: "2px", minWidth: 0 }}>
                            <strong style={{ fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>{product.name}</strong>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{product.sku}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)", textAlign: "right" }}>
                            <strong style={{ color: "var(--text-primary)", marginRight: "4px" }}>{stock.availableUnits}</strong>available
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {products.filter(p => p.stockLevels.some(s => s.warehouse.id === warehouse.id && s.totalUnits > 0)).length === 0 && (
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontStyle: "italic" }}>No products in stock.</p>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
