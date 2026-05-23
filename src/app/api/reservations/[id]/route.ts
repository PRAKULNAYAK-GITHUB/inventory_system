import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/reservations/:id
 *
 * Fetches a single reservation by ID with product and warehouse details.
 * Used by the checkout page to display reservation info and countdown.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Check if the reservation has expired but hasn't been released yet
    if (
      reservation.status === "PENDING" &&
      reservation.expiresAt < new Date()
    ) {
      // Lazy cleanup: release the expired reservation
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

      return NextResponse.json({
        id: reservation.id,
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
        quantity: reservation.quantity,
        status: "RELEASED",
        expiresAt: reservation.expiresAt.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
        product: reservation.product,
        warehouse: reservation.warehouse,
      });
    }

    return NextResponse.json({
      id: reservation.id,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      product: reservation.product,
      warehouse: reservation.warehouse,
    });
  } catch (error) {
    console.error("Error fetching reservation:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservation" },
      { status: 500 }
    );
  }
}
