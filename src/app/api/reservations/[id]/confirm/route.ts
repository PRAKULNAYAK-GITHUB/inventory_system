import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";

/**
 * POST /api/reservations/:id/confirm
 *
 * Confirms a pending reservation (payment succeeded).
 * - Returns 404 if reservation doesn't exist
 * - Returns 410 if the reservation has expired
 * - Returns 409 if already confirmed or released
 *
 * On confirmation:
 * - Status changes to CONFIRMED
 * - totalUnits is decremented (stock permanently sold)
 * - reservedUnits is decremented (hold released)
 *
 * Supports idempotency via Idempotency-Key header.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ─── Check idempotency ────────────────────────────────────────────
    const idempotencyKey = request.headers.get("idempotency-key");
    const cachedResponse = await checkIdempotency(idempotencyKey);
    if (cachedResponse) return cachedResponse;

    // ─── Fetch reservation ────────────────────────────────────────────
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true, location: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // ─── Check if already processed ──────────────────────────────────
    if (reservation.status === "CONFIRMED") {
      return NextResponse.json(
        { error: "Reservation already confirmed" },
        { status: 409 }
      );
    }

    if (reservation.status === "RELEASED") {
      return NextResponse.json(
        { error: "Reservation was already released" },
        { status: 409 }
      );
    }

    // ─── Check expiry (410 Gone) ─────────────────────────────────────
    if (reservation.expiresAt < new Date()) {
      // Release the expired reservation
      await prisma.$transaction([
        prisma.reservation.update({
          where: { id: reservation.id, status: "PENDING" },
          data: { status: "RELEASED" },
        }),
        prisma.stockLevel.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
          data: {
            reservedUnits: { decrement: reservation.quantity },
          },
        }),
      ]);

      return NextResponse.json(
        {
          error: "Reservation expired",
          details:
            "The reservation window has closed. Please create a new reservation.",
        },
        { status: 410 }
      );
    }

    // ─── Confirm the reservation ─────────────────────────────────────
    // In a single transaction:
    // 1. Update reservation status to CONFIRMED
    // 2. Decrement totalUnits (stock is now permanently sold)
    // 3. Decrement reservedUnits (the hold is released)
    const [confirmed] = await prisma.$transaction([
      prisma.reservation.update({
        where: { id: reservation.id, status: "PENDING" },
        data: { status: "CONFIRMED" },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, location: true } },
        },
      }),
      prisma.stockLevel.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: {
          totalUnits: { decrement: reservation.quantity },
          reservedUnits: { decrement: reservation.quantity },
        },
      }),
    ]);

    const responseBody = {
      id: confirmed.id,
      productId: confirmed.productId,
      warehouseId: confirmed.warehouseId,
      quantity: confirmed.quantity,
      status: confirmed.status,
      expiresAt: confirmed.expiresAt.toISOString(),
      createdAt: confirmed.createdAt.toISOString(),
      product: confirmed.product,
      warehouse: confirmed.warehouse,
    };

    // Store idempotency record
    await storeIdempotency(
      idempotencyKey,
      "POST",
      `/api/reservations/${id}/confirm`,
      200,
      responseBody
    );

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("Error confirming reservation:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
