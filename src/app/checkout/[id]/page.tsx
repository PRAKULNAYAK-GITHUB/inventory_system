"use client";

import { useState, useEffect, useCallback, use } from "react";
import type { ReservationResponse } from "@/lib/schemas";

interface Toast {
  id: number;
  type: "error" | "success" | "info";
  message: string;
}

function CountdownTimer({
  expiresAt,
  onExpired,
}: {
  expiresAt: string;
  onExpired: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calcTimeLeft = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };

    setTimeLeft(calcTimeLeft());

    const interval = setInterval(() => {
      const remaining = calcTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 60;
  const isWarning = timeLeft <= 180 && timeLeft > 60;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <div
        className="countdown"
        style={{
          fontSize: "3rem",
          fontWeight: "800",
          letterSpacing: "-0.02em",
          color: isUrgent
            ? "var(--accent-danger)"
            : isWarning
              ? "var(--accent-warning)"
              : "var(--accent-primary)",
          transition: "color 0.3s ease",
        }}
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: "600",
        }}
      >
        {isUrgent ? "⚠ Expiring soon!" : "Time remaining"}
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          maxWidth: "240px",
          height: "4px",
          borderRadius: "2px",
          background: "var(--bg-secondary)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(timeLeft / 600) * 100}%`,
            borderRadius: "2px",
            background: isUrgent
              ? "var(--gradient-danger)"
              : isWarning
                ? "var(--accent-warning)"
                : "var(--gradient-primary)",
            transition: "width 1s linear, background 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [reservation, setReservation] = useState<ReservationResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [expired, setExpired] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (type: "error" | "success" | "info", message: string) => {
      const toastId = Date.now();
      setToasts((prev) => [...prev, { id: toastId, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 5000);
    },
    []
  );

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) throw new Error("Failed to fetch reservation");
      const data = await res.json();
      setReservation(data);

      if (data.status === "RELEASED") {
        setExpired(true);
      }
    } catch {
      addToast("error", "Failed to load reservation details.");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
      });

      if (res.status === 410) {
        addToast(
          "error",
          "⏰ Reservation expired — the hold window has closed. Please create a new reservation."
        );
        setExpired(true);
        await fetchReservation();
        return;
      }

      if (res.status === 409) {
        const data = await res.json();
        addToast("error", `⚠️ ${data.error}`);
        return;
      }

      if (!res.ok) throw new Error("Confirm failed");

      const data = await res.json();
      setReservation(data);
      addToast("success", "✓ Payment confirmed! Your order is complete.");
    } catch {
      addToast("error", "Failed to confirm payment. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleRelease = async () => {
    setReleasing(true);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });

      if (res.status === 409) {
        const data = await res.json();
        addToast("error", `⚠️ ${data.error}`);
        await fetchReservation();
        return;
      }

      if (!res.ok) throw new Error("Release failed");

      const data = await res.json();
      setReservation(data);
      addToast("info", "Reservation cancelled. Units returned to inventory.");
    } catch {
      addToast("error", "Failed to cancel reservation. Please try again.");
    } finally {
      setReleasing(false);
    }
  };

  const handleExpired = useCallback(() => {
    setExpired(true);
    addToast(
      "error",
      "⏰ Reservation expired — the hold window has closed."
    );
  }, [addToast]);

  if (loading) {
    return (
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        <div
          className="skeleton"
          style={{
            height: "400px",
            borderRadius: "var(--radius-lg)",
          }}
        />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          textAlign: "center",
          padding: "80px 20px",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔍</div>
        <h2
          style={{
            fontSize: "1.3rem",
            fontWeight: "700",
            marginBottom: "8px",
          }}
        >
          Reservation not found
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
          This reservation may have been removed or the ID is invalid.
        </p>
        <a href="/" className="btn-primary" style={{ textDecoration: "none" }}>
          Back to Products
        </a>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING" && !expired;
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED" || expired;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      {/* ─── Toasts ──────────────────────────────────────────────────── */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div
        className="animate-fade-in-up"
        style={{ marginBottom: "24px" }}
      >
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--text-secondary)",
            fontSize: "0.85rem",
            textDecoration: "none",
            marginBottom: "16px",
          }}
        >
          ← Back to Products
        </a>
        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: "800",
            letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #f0f0f5 0%, #a0a0b8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Checkout
        </h1>
      </div>

      {/* ─── Status Card ─────────────────────────────────────────────── */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          padding: "32px",
          marginBottom: "20px",
          animationDelay: "0.1s",
          opacity: 0,
          textAlign: "center",
        }}
      >
        {/* Status badge */}
        <div style={{ marginBottom: "20px" }}>
          {isPending && (
            <span className="badge badge-warning">⏳ Pending Payment</span>
          )}
          {isConfirmed && (
            <span className="badge badge-success">✓ Confirmed</span>
          )}
          {isReleased && (
            <span className="badge badge-danger">✕ Released</span>
          )}
        </div>

        {/* Countdown for pending */}
        {isPending && (
          <div style={{ marginBottom: "24px" }}>
            <CountdownTimer
              expiresAt={reservation.expiresAt}
              onExpired={handleExpired}
            />
          </div>
        )}

        {/* Confirmed state */}
        {isConfirmed && (
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                fontSize: "3rem",
                marginBottom: "12px",
              }}
            >
              🎉
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: "700",
                color: "var(--accent-success)",
                marginBottom: "8px",
              }}
            >
              Payment Confirmed!
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
              }}
            >
              Your order has been processed. Stock has been permanently
              deducted.
            </p>
          </div>
        )}

        {/* Released / expired state */}
        {isReleased && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>⏰</div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: "700",
                color: "var(--accent-danger)",
                marginBottom: "8px",
              }}
            >
              Reservation Released
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
              }}
            >
              The units have been returned to inventory and are available
              for other customers.
            </p>
          </div>
        )}
      </div>

      {/* ─── Reservation Details ──────────────────────────────────────── */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          padding: "24px",
          marginBottom: "20px",
          animationDelay: "0.2s",
          opacity: 0,
        }}
      >
        <h3
          style={{
            fontSize: "0.75rem",
            fontWeight: "600",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "16px",
          }}
        >
          Reservation Details
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Product
            </div>
            <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>
              {reservation.product.name}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: "2px",
              }}
            >
              SKU: {reservation.product.sku}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Warehouse
            </div>
            <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>
              {reservation.warehouse.name}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: "2px",
              }}
            >
              {reservation.warehouse.location}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Quantity
            </div>
            <div style={{ fontWeight: "700", fontSize: "1.3rem" }}>
              {reservation.quantity}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Reservation ID
            </div>
            <div
              style={{
                fontWeight: "500",
                fontSize: "0.8rem",
                fontFamily: "monospace",
                color: "var(--text-secondary)",
                wordBreak: "break-all",
              }}
            >
              {reservation.id}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Actions ──────────────────────────────────────────────────── */}
      {isPending && (
        <div
          className="animate-fade-in-up"
          style={{
            display: "flex",
            gap: "12px",
            animationDelay: "0.3s",
            opacity: 0,
          }}
        >
          <button
            className="btn-danger"
            onClick={handleRelease}
            disabled={releasing || confirming}
            style={{ flex: 1, padding: "14px" }}
          >
            {releasing ? "Cancelling..." : "Cancel Reservation"}
          </button>
          <button
            className="btn-success"
            onClick={handleConfirm}
            disabled={confirming || releasing}
            style={{ flex: 2, padding: "14px", fontSize: "1rem" }}
          >
            {confirming ? (
              <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <span
                  className="animate-spin"
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                Processing Payment...
              </span>
            ) : (
              "✓ Confirm Purchase"
            )}
          </button>
        </div>
      )}

      {(isConfirmed || isReleased) && (
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: "0.3s", opacity: 0 }}
        >
          <a
            href="/"
            className="btn-primary"
            style={{
              display: "block",
              textAlign: "center",
              textDecoration: "none",
              padding: "14px",
              fontSize: "0.95rem",
            }}
          >
            ← Browse More Products
          </a>
        </div>
      )}
    </div>
  );
}
