"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import type { ReservationResponse } from "@/lib/schemas";

interface Toast {
  id: number;
  type: "error" | "success" | "info";
  message: string;
}

const productImages: Record<string, string> = {
  "WH-1000XM5":
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
  "KB-MK870-BLK":
    "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=900&q=80",
  "MON-UW34-QHD":
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80",
  "CH-ERGO-PRO":
    "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=900&q=80",
  "SSD-PORT-2TB":
    "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=80",
};

function getProductImage(sku: string) {
  return productImages[sku] || productImages["SSD-PORT-2TB"];
}

function getSecondsLeft(expiresAt: string) {
  return Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );
}

function HoldTimer({
  expiresAt,
  onExpired,
}: {
  expiresAt: string;
  onExpired: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsLeft(expiresAt));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextSeconds = getSecondsLeft(expiresAt);
      setSecondsLeft(nextSeconds);

      if (nextSeconds === 0) {
        window.clearInterval(intervalId);
        onExpired();
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = Math.max(0, Math.min(100, (secondsLeft / 600) * 100));
  const tone =
    secondsLeft <= 60 ? "danger" : secondsLeft <= 180 ? "warning" : "active";

  return (
    <section className={`checkout-timer timer-${tone}`}>
      <div
        className="timer-ring"
        style={{
          background: `conic-gradient(var(--timer-color) ${progress}%, #e8edf6 0)`,
        }}
      >
        <div>
          <strong className="countdown">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </strong>
          <span>{secondsLeft === 0 ? "Expired" : "Hold remaining"}</span>
        </div>
      </div>
      <p>
        This reservation temporarily increments reserved stock. Confirm purchase
        to permanently decrement stock, or cancel to release the hold.
      </p>
    </section>
  );
}

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [expired, setExpired] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (type: "error" | "success" | "info", message: string) => {
      const toastId = Date.now();
      setToasts((prev) => [...prev, { id: toastId, type, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
      }, 5000);
    },
    []
  );

  const fetchReservation = useCallback(async () => {
    try {
      const response = await fetch(`/api/reservations/${id}`);
      if (!response.ok) throw new Error("Failed to fetch reservation");

      const data = await response.json();
      setReservation(data);
      setExpired(data.status === "RELEASED");
    } catch {
      addToast("error", "Failed to load reservation details.");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchReservation();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchReservation]);

  const handleConfirm = async () => {
    setConfirming(true);

    try {
      const response = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
      });

      if (response.status === 410) {
        addToast(
          "error",
          "Reservation expired. Create a fresh reservation before confirming."
        );
        setExpired(true);
        await fetchReservation();
        return;
      }

      if (response.status === 409) {
        const data = await response.json();
        addToast("error", data.error || "Reservation cannot be confirmed.");
        await fetchReservation();
        return;
      }

      if (!response.ok) throw new Error("Confirm failed");

      setReservation(await response.json());
      addToast("success", "Purchase confirmed. Stock was permanently decremented.");
    } catch {
      addToast("error", "Failed to confirm purchase. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleRelease = async () => {
    setReleasing(true);

    try {
      const response = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });

      if (response.status === 409) {
        const data = await response.json();
        addToast("error", data.error || "Reservation cannot be released.");
        await fetchReservation();
        return;
      }

      if (!response.ok) throw new Error("Release failed");

      setReservation(await response.json());
      setExpired(true);
      addToast("info", "Reservation cancelled. Units returned to available stock.");
    } catch {
      addToast("error", "Failed to cancel reservation. Please try again.");
    } finally {
      setReleasing(false);
    }
  };

  const handleExpired = useCallback(() => {
    setExpired(true);
    addToast("error", "Reservation expired. The held units can now be released.");
  }, [addToast]);

  const status = useMemo(() => {
    if (!reservation) return "loading";
    if (reservation.status === "CONFIRMED") return "confirmed";
    if (reservation.status === "RELEASED" || expired) return "released";
    return "pending";
  }, [reservation, expired]);

  if (loading) {
    return (
      <div className="checkout-shell">
        <div className="skeleton checkout-loading" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <section className="empty-state">
        <span>404</span>
        <h1>Reservation not found</h1>
        <p>This hold may have been removed or the reservation ID is invalid.</p>
        <Link href="/" className="btn-primary">
          Back to dashboard
        </Link>
      </section>
    );
  }

  const isPending = status === "pending";
  const isConfirmed = status === "confirmed";
  const isReleased = status === "released";

  return (
    <div className="checkout-shell">
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <section className="checkout-hero">
        <div>
          <Link href="/" className="back-link">
            Back to inventory
          </Link>
          <p className="eyebrow">Checkout hold</p>
          <h1>{reservation.product.name}</h1>
          <p>
            Reservation {reservation.id.slice(-8).toUpperCase()} is holding
            inventory from {reservation.warehouse.name}.
          </p>
        </div>
        <span className={`status-pill status-${status}`}>
          {isPending && "Pending payment"}
          {isConfirmed && "Confirmed"}
          {isReleased && "Released"}
        </span>
      </section>

      <div className="checkout-grid">
        <section className="checkout-card order-card">
          <img
            src={getProductImage(reservation.product.sku)}
            alt=""
            className="checkout-product-image"
          />
          <div className="order-copy">
            <span>{reservation.product.sku}</span>
            <h2>{reservation.product.name}</h2>
            <p>
              {reservation.quantity} unit{reservation.quantity > 1 ? "s" : ""} reserved
              from {reservation.warehouse.location}.
            </p>
          </div>

          <div className="order-detail-grid">
            <div>
              <span>Warehouse</span>
              <strong>{reservation.warehouse.name}</strong>
            </div>
            <div>
              <span>Quantity</span>
              <strong>{reservation.quantity}</strong>
            </div>
            <div>
              <span>Reservation ID</span>
              <strong>{reservation.id.slice(-12)}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>
                {new Date(reservation.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </div>
          </div>
        </section>

        <aside className="checkout-card action-card">
          {isPending && (
            <HoldTimer expiresAt={reservation.expiresAt} onExpired={handleExpired} />
          )}

          {isConfirmed && (
            <div className="final-state success-state">
              <span>Confirmed</span>
              <h2>Payment captured</h2>
              <p>
                The reservation is confirmed and stock has been permanently
                decremented from the selected warehouse.
              </p>
            </div>
          )}

          {isReleased && (
            <div className="final-state release-state">
              <span>Released</span>
              <h2>Hold no longer active</h2>
              <p>
                The reserved units were returned to available stock. Create a new
                reservation if the customer retries checkout.
              </p>
            </div>
          )}

          <div className="status-timeline">
            <div className="timeline-step complete">
              <span />
              <div>
                <strong>Inventory reserved</strong>
                <p>Reserved units increased atomically.</p>
              </div>
            </div>
            <div className={`timeline-step ${isPending ? "active" : "complete"}`}>
              <span />
              <div>
                <strong>Await payment</strong>
                <p>Customer has a 10 minute checkout window.</p>
              </div>
            </div>
            <div
              className={`timeline-step ${
                isConfirmed ? "complete" : isReleased ? "released" : ""
              }`}
            >
              <span />
              <div>
                <strong>{isReleased ? "Released" : "Confirm or release"}</strong>
                <p>
                  {isConfirmed
                    ? "Stock sold successfully."
                    : isReleased
                      ? "Hold returned to inventory."
                      : "Choose the payment outcome."}
                </p>
              </div>
            </div>
          </div>

          {isPending && (
            <div className="checkout-actions">
              <button
                className="btn-danger"
                onClick={handleRelease}
                disabled={releasing || confirming}
              >
                {releasing ? "Cancelling..." : "Cancel hold"}
              </button>
              <button
                className="btn-success"
                onClick={handleConfirm}
                disabled={confirming || releasing}
              >
                {confirming ? "Confirming..." : "Confirm purchase"}
              </button>
            </div>
          )}

          {!isPending && (
            <Link href="/" className="btn-primary checkout-return">
              Return to dashboard
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
