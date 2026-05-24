"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { ProductWithStock } from "@/lib/schemas";

interface Toast {
  id: number;
  type: "error" | "success" | "info";
  message: string;
}

interface ReserveDialog {
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  maxQuantity: number;
}

const productImages: Record<string, string> = {
  "WH-1000XM5":
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=720&q=80",
  "KB-MK870-BLK":
    "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=720&q=80",
  "MON-UW34-QHD":
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=720&q=80",
  "CH-ERGO-PRO":
    "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=720&q=80",
  "SSD-PORT-2TB":
    "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=720&q=80",
  "CAM-4K-PRO":
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=720&q=80",
  "TABLET-AIR-11":
    "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=720&q=80",
  "WATCH-FIT-LTE":
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=720&q=80",
  "BAG-TRAVEL-PRO":
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=720&q=80",
  "DOCK-USBC-12":
    "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=720&q=80",
};

function productImage(product: ProductWithStock) {
  return product.imageUrl || productImages[product.sku] || productImages["SSD-PORT-2TB"];
}

export default function ProductsRoutePage() {
  return (
    <Suspense fallback={<div className="skeleton dashboard-main-skeleton" />}>
      <ProductsRoutePageContent />
    </Suspense>
  );
}

function ProductsRoutePageContent() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reserveDialog, setReserveDialog] = useState<ReserveDialog | null>(null);
  const [reserveQuantity, setReserveQuantity] = useState(1);
  const [reserving, setReserving] = useState(false);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in-stock" | "low-stock" | "sold-out">("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const searchParams = useSearchParams();
  const search = searchParams.get("search");

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

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      setProducts(await response.json());
    } catch {
      addToast("error", "Failed to load product catalog.");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProducts();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadProducts]);

  useEffect(() => {
    if (search !== null) {
      setSearchQuery(search);
    } else {
      setSearchQuery("");
    }
  }, [search]);

  // Derived Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // 1. Search Query Filter (Matches Name or SKU)
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Warehouse Location Filter
      const hasWarehouseStock =
        warehouseFilter === "all" ||
        product.stockLevels.some((stock) => stock.warehouse.id === warehouseFilter);
      if (!hasWarehouseStock) return false;

      // 3. Status Filter (In Stock, Low Stock, Sold Out)
      const totalAvailable = product.stockLevels.reduce(
        (sum, s) => sum + s.availableUnits,
        0
      );
      const isOut = totalAvailable <= 0;
      const isLow =
        totalAvailable > 0 &&
        product.stockLevels.some((s) => s.availableUnits > 0 && s.availableUnits <= 5);

      if (statusFilter === "in-stock") return totalAvailable > 0;
      if (statusFilter === "low-stock") return isLow;
      if (statusFilter === "sold-out") return isOut;

      return true;
    });
  }, [products, searchQuery, statusFilter, warehouseFilter]);

  // Derived Warehouse List for the dropdown filter
  const warehousesList = useMemo(() => {
    const list = new Map<string, string>();
    products.forEach((p) => {
      p.stockLevels.forEach((s) => {
        list.set(s.warehouse.id, s.warehouse.name);
      });
    });
    return Array.from(list.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const catalogStats = useMemo(() => {
    const total = products.reduce(
      (sum, product) =>
        sum + product.stockLevels.reduce((inner, stock) => inner + stock.totalUnits, 0),
      0
    );
    const available = products.reduce(
      (sum, product) =>
        sum + product.stockLevels.reduce((inner, stock) => inner + stock.availableUnits, 0),
      0
    );

    return { total, available };
  }, [products]);

  const openReserveDialog = (
    productId: string,
    productName: string,
    warehouseId: string,
    warehouseName: string,
    maxQuantity: number
  ) => {
    setReserveDialog({
      productId,
      productName,
      warehouseId,
      warehouseName,
      maxQuantity,
    });
    setReserveQuantity(1);
  };

  const handleReserve = async () => {
    if (!reserveDialog) return;
    setReserving(true);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: reserveDialog.productId,
          warehouseId: reserveDialog.warehouseId,
          quantity: reserveQuantity,
        }),
      });

      if (response.status === 409) {
        const data = await response.json();
        addToast("error", data.details || "Not enough stock available.");
        setReserveDialog(null);
        await loadProducts();
        return;
      }

      if (!response.ok) throw new Error("Reservation failed");

      const reservation = await response.json();
      addToast("success", "Reservation created. Opening checkout...");
      setReserveDialog(null);
      window.setTimeout(() => {
        window.location.href = `/checkout/${reservation.id}`;
      }, 400);
    } catch {
      addToast("error", "Failed to create reservation.");
    } finally {
      setReserving(false);
    }
  };

  return (
    <div className="route-page catalog-page">
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <section className="subpage-hero catalog-hero">
        <div>
          <p className="eyebrow">Reservation catalog</p>
          <h1>Products</h1>
          <p>
            Choose a warehouse, hold units for 10 minutes, and continue into the
            checkout confirmation flow.
          </p>
        </div>
        <div className="catalog-hero-kpis">
          <div>
            <span>SKUs</span>
            <strong>{loading ? "-" : products.length}</strong>
          </div>
          <div>
            <span>Available</span>
            <strong>{loading ? "-" : catalogStats.available}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{loading ? "-" : catalogStats.total}</strong>
          </div>
        </div>
      </section>

      {/* Visual, Interactive Search & Filter Bar */}
      {!loading && (
        <div className="filter-bar">
          <div className="search-wrapper">
            <svg className="search-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-pills">
            {(["all", "in-stock", "low-stock", "sold-out"] as const).map((status) => (
              <button
                key={status}
                className={`filter-pill ${statusFilter === status ? "active" : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" && "All items"}
                {status === "in-stock" && "In stock"}
                {status === "low-stock" && "Low stock"}
                {status === "sold-out" && "Sold out"}
              </button>
            ))}
          </div>

          <div className="select-wrapper">
            <select
              className="select-filter"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
            >
              <option value="all">All warehouses</option>
              {warehousesList.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <svg className="select-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton dashboard-main-skeleton" />
      ) : (
        <section className="catalog-grid">
          {filteredProducts.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 24px", color: "var(--text-secondary)", background: "var(--card-bg-opacity)", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-md)", animation: "fadeIn 0.3s ease" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 44, height: 44, margin: "0 auto 12px", color: "var(--text-muted)", opacity: 0.8 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <p style={{ fontSize: "1.05rem", fontWeight: "800", color: "var(--text-primary)" }}>No products found</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>No products match your active search or filter criteria.</p>
              <button
                className="btn-ghost"
                style={{ marginTop: 16, minHeight: 34, padding: "0 14px", fontWeight: "700" }}
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setWarehouseFilter("all");
                }}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const totalAvailable = product.stockLevels.reduce(
                (sum, stock) => sum + stock.availableUnits,
                0
              );

              return (
                <article key={product.id} className="catalog-card">
                  <img src={productImage(product)} alt="" />
                  <div className="catalog-card-body">
                    <div className="catalog-title-row">
                      <div>
                        <span>{product.sku}</span>
                        <h2>{product.name}</h2>
                      </div>
                      <strong>{totalAvailable}</strong>
                    </div>
                    {product.description && <p>{product.description}</p>}
                    <div className="warehouse-choice-list">
                      {product.stockLevels.map((stock) => {
                        const isOut = stock.availableUnits <= 0;
                        const isLow = stock.availableUnits > 0 && stock.availableUnits <= 5;

                        return (
                          <div key={stock.warehouse.id} className="warehouse-choice">
                            <div>
                              <strong>{stock.warehouse.name}</strong>
                              <span>
                                {stock.availableUnits} available of {stock.totalUnits}
                              </span>
                            </div>
                            <button
                              className={isLow ? "btn-warning" : "btn-primary"}
                              disabled={isOut}
                              onClick={() =>
                                openReserveDialog(
                                  product.id,
                                  product.name,
                                  stock.warehouse.id,
                                  stock.warehouse.name,
                                  stock.availableUnits
                                )
                              }
                            >
                              {isOut ? "Sold out" : "Reserve"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            }))}
        </section>
      )}

      {reserveDialog && (
        <div className="dialog-overlay" onClick={() => setReserveDialog(null)}>
          <div className="dialog-content reserve-modal" onClick={(event) => event.stopPropagation()}>
            <p className="eyebrow">Create hold</p>
            <h3>Reserve inventory</h3>
            <p className="modal-copy">
              This will hold stock for 10 minutes while checkout completes.
            </p>

            <div className="reserve-summary">
              <strong>{reserveDialog.productName}</strong>
              <span>
                {reserveDialog.warehouseName} · {reserveDialog.maxQuantity} available
              </span>
            </div>

            <label className="field-label" htmlFor="reserve-quantity">
              Quantity
            </label>
            <div className="quantity-stepper">
              <button
                className="btn-ghost"
                onClick={() => setReserveQuantity((quantity) => Math.max(1, quantity - 1))}
                disabled={reserveQuantity <= 1}
              >
                -
              </button>
              <input
                id="reserve-quantity"
                type="number"
                min={1}
                max={reserveDialog.maxQuantity}
                value={reserveQuantity}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  if (value >= 1 && value <= reserveDialog.maxQuantity) {
                    setReserveQuantity(value);
                  }
                }}
              />
              <button
                className="btn-ghost"
                onClick={() =>
                  setReserveQuantity((quantity) =>
                    Math.min(reserveDialog.maxQuantity, quantity + 1)
                  )
                }
                disabled={reserveQuantity >= reserveDialog.maxQuantity}
              >
                +
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setReserveDialog(null)} disabled={reserving}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleReserve} disabled={reserving}>
                {reserving
                  ? "Reserving..."
                  : `Reserve ${reserveQuantity} unit${reserveQuantity > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
