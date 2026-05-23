"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProductWithStock } from "@/lib/schemas";

interface Toast {
  id: number;
  type: "error" | "success" | "info";
  message: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Reserve dialog state
  const [reserveDialog, setReserveDialog] = useState<{
    open: boolean;
    productId: string;
    productName: string;
    warehouseId: string;
    warehouseName: string;
    maxQuantity: number;
  } | null>(null);
  const [reserveQuantity, setReserveQuantity] = useState(1);
  const [reserving, setReserving] = useState(false);

  const addToast = useCallback(
    (type: "error" | "success" | "info", message: string) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProducts(data);
    } catch {
      addToast("error", "Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openReserveDialog = (
    productId: string,
    productName: string,
    warehouseId: string,
    warehouseName: string,
    maxQuantity: number
  ) => {
    setReserveDialog({
      open: true,
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
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: reserveDialog.productId,
          warehouseId: reserveDialog.warehouseId,
          quantity: reserveQuantity,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        addToast(
          "error",
          `⚠️ Stock conflict: ${data.details || "Not enough units available."}`
        );
        setReserveDialog(null);
        await fetchProducts();
        return;
      }

      if (!res.ok) {
        throw new Error("Reservation failed");
      }

      const reservation = await res.json();
      addToast("success", "✓ Reservation created! Redirecting to checkout...");
      setReserveDialog(null);

      // Redirect to checkout
      setTimeout(() => {
        window.location.href = `/checkout/${reservation.id}`;
      }, 800);
    } catch {
      addToast("error", "Failed to create reservation. Please try again.");
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: "32px" }}>
          <div
            className="skeleton"
            style={{ width: "300px", height: "36px", marginBottom: "12px" }}
          />
          <div className="skeleton" style={{ width: "500px", height: "20px" }} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: "24px",
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: "320px", borderRadius: "var(--radius-lg)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ─── Toasts ──────────────────────────────────────────────────── */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* ─── Page Header ─────────────────────────────────────────────── */}
      <div
        style={{ marginBottom: "32px" }}
        className="animate-fade-in-up"
      >
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "800",
            letterSpacing: "-0.03em",
            marginBottom: "8px",
            background: "linear-gradient(135deg, #f0f0f5 0%, #a0a0b8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Product Inventory
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Browse products and reserve units from any warehouse. Reservations are
          held for 10 minutes.
        </p>
      </div>

      {/* ─── Product Grid ────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
          gap: "24px",
        }}
      >
        {products.map((product, index) => (
          <div
            key={product.id}
            className="glass-card animate-fade-in-up"
            style={{
              padding: "24px",
              animationDelay: `${index * 0.08}s`,
              opacity: 0,
            }}
          >
            {/* Product Header */}
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <h2
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: "700",
                    letterSpacing: "-0.02em",
                    lineHeight: "1.3",
                  }}
                >
                  {product.name}
                </h2>
                <span
                  className="badge badge-info"
                  style={{ flexShrink: 0 }}
                >
                  {product.sku}
                </span>
              </div>
              {product.description && (
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.85rem",
                    lineHeight: "1.5",
                  }}
                >
                  {product.description}
                </p>
              )}
            </div>

            {/* Stock by Warehouse */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Stock by Warehouse
              </div>
              {product.stockLevels.map((sl) => {
                const isLowStock = sl.availableUnits <= 5 && sl.availableUnits > 0;
                const isOutOfStock = sl.availableUnits <= 0;

                return (
                  <div
                    key={sl.warehouse.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      gap: "12px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          marginBottom: "2px",
                        }}
                      >
                        {sl.warehouse.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {sl.warehouse.location}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexShrink: 0,
                      }}
                    >
                      {/* Stock indicator */}
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "1rem",
                            fontWeight: "700",
                            color: isOutOfStock
                              ? "var(--accent-danger)"
                              : isLowStock
                                ? "var(--accent-warning)"
                                : "var(--accent-success)",
                          }}
                        >
                          {sl.availableUnits}
                        </div>
                        <div
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          of {sl.totalUnits} avail
                        </div>
                      </div>

                      {/* Reserve button */}
                      <button
                        className="btn-primary"
                        disabled={isOutOfStock}
                        onClick={() =>
                          openReserveDialog(
                            product.id,
                            product.name,
                            sl.warehouse.id,
                            sl.warehouse.name,
                            sl.availableUnits
                          )
                        }
                        style={{
                          padding: "8px 14px",
                          fontSize: "0.8rem",
                        }}
                      >
                        {isOutOfStock ? "Sold Out" : "Reserve"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && !loading && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📦</div>
          <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
            No products found
          </div>
          <div style={{ fontSize: "0.9rem", marginTop: "8px" }}>
            Please seed the database to add sample inventory.
          </div>
        </div>
      )}

      {/* ─── Reserve Dialog ──────────────────────────────────────────── */}
      {reserveDialog && (
        <div
          className="dialog-overlay"
          onClick={() => setReserveDialog(null)}
        >
          <div
            className="dialog-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: "700",
                marginBottom: "4px",
                letterSpacing: "-0.02em",
              }}
            >
              Reserve Inventory
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
                marginBottom: "24px",
              }}
            >
              Hold units for 10 minutes while you complete payment.
            </p>

            <div
              style={{
                padding: "16px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  marginBottom: "4px",
                }}
              >
                {reserveDialog.productName}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                }}
              >
                From: {reserveDialog.warehouseName} • Max:{" "}
                {reserveDialog.maxQuantity} units
              </div>
            </div>

            {/* Quantity selector */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Quantity
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <button
                  className="btn-ghost"
                  style={{ padding: "8px 14px" }}
                  onClick={() =>
                    setReserveQuantity((q) => Math.max(1, q - 1))
                  }
                  disabled={reserveQuantity <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={reserveDialog.maxQuantity}
                  value={reserveQuantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= reserveDialog.maxQuantity) {
                      setReserveQuantity(val);
                    }
                  }}
                  style={{
                    width: "72px",
                    textAlign: "center",
                    padding: "8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: "1rem",
                    fontWeight: "600",
                  }}
                />
                <button
                  className="btn-ghost"
                  style={{ padding: "8px 14px" }}
                  onClick={() =>
                    setReserveQuantity((q) =>
                      Math.min(reserveDialog.maxQuantity, q + 1)
                    )
                  }
                  disabled={reserveQuantity >= reserveDialog.maxQuantity}
                >
                  +
                </button>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn-ghost"
                onClick={() => setReserveDialog(null)}
                disabled={reserving}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleReserve}
                disabled={reserving}
                style={{ minWidth: "140px" }}
              >
                {reserving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                    <span
                      className="animate-spin"
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                        borderRadius: "50%",
                        display: "inline-block",
                      }}
                    />
                    Reserving...
                  </span>
                ) : (
                  `Reserve ${reserveQuantity} unit${reserveQuantity > 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
