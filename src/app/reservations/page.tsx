"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReservationResponse } from "@/lib/schemas";

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/reservations");
        if (response.ok) setReservations(await response.json());
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="route-page">
      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Checkout holds</p>
          <h1>Reservations</h1>
          <p>Recent holds, confirmations, releases, and checkout status.</p>
        </div>
        <Link href="/" className="btn-primary">
          Create reservation
        </Link>
      </section>

      <section className="panel">
        <div className="data-table reservations-table">
          <div className="data-row data-head">
            <span>Reservation</span>
            <span>Product</span>
            <span>Warehouse</span>
            <span>Qty</span>
            <span>Status</span>
            <span>Checkout</span>
          </div>
          {loading ? (
            <div className="table-empty">Loading reservations...</div>
          ) : reservations.length === 0 ? (
            <div className="table-empty">No reservations yet.</div>
          ) : (
            reservations.map((reservation) => (
              <div key={reservation.id} className="data-row">
                <strong>{reservation.id.slice(-10)}</strong>
                <span>{reservation.product.name}</span>
                <span>{reservation.warehouse.name}</span>
                <span>{reservation.quantity}</span>
                <span className={`mini-status mini-${reservation.status.toLowerCase()}`}>
                  {reservation.status.toLowerCase()}
                </span>
                <Link href={`/checkout/${reservation.id}`} className="table-link">
                  Open
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
