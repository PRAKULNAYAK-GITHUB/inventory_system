import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/reservations/:id/release
 *
 * Releases a pending reservation early (payment failed or user cancelled).
 * - Returns 404 if reservation doesn't exist
 * - Returns 409 if already confirmed or released
 *
 * On release:
 * - Status changes to RELEASED
 * - reservedUnits is decremented (units become available again)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ─── Fetch reservation ────────────────────────────────────────────
    const reservation = await prisma.reservation.findUnique({
      where: { id },
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
        { error: "Cannot release a confirmed reservation" },
        { status: 409 }
      );
    }

    if (reservation.status === "RELEASED") {
      return NextResponse.json(
        { error: "Reservation already released" },
        { status: 409 }
      );
    }

    // ─── Release the reservation ─────────────────────────────────────
    const [released] = await prisma.$transaction([
      prisma.reservation.update({
        where: { id: reservation.id, status: "PENDING" },
        data: { status: "RELEASED" },
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
          reservedUnits: { decrement: reservation.quantity },
        },
      }),
    ]);

    return NextResponse.json({
      id: released.id,
      productId: released.productId,
      warehouseId: released.warehouseId,
      quantity: released.quantity,
      status: released.status,
      expiresAt: released.expiresAt.toISOString(),
      createdAt: released.createdAt.toISOString(),
      product: released.product,
      warehouse: released.warehouse,
    });
  } catch (error) {
    console.error("Error releasing reservation:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
