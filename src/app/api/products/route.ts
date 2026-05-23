import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { ProductWithStock } from "@/lib/schemas";

/**
 * GET /api/products
 *
 * Lists all products with available stock per warehouse.
 * Also performs lazy cleanup of expired reservations encountered during the query
 * to keep stock levels accurate without relying solely on the cron job.
 */
export async function GET() {
  try {
    // Lazy cleanup: release any expired pending reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
    });

    if (expiredReservations.length > 0) {
      // Release each expired reservation in a transaction
      await prisma.$transaction(
        expiredReservations.map((reservation) =>
          prisma.reservation.update({
            where: { id: reservation.id, status: "PENDING" },
            data: { status: "RELEASED" },
          })
        )
      );

      // Decrement reservedUnits for each released reservation
      for (const reservation of expiredReservations) {
        await prisma.stockLevel.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
          data: {
            reservedUnits: {
              decrement: reservation.quantity,
            },
          },
        });
      }
    }

    // Fetch all products with their stock levels and warehouse info
    const products = await prisma.product.findMany({
      include: {
        stockLevels: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Transform to API response shape with computed availableUnits
    const response: ProductWithStock[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      imageUrl: product.imageUrl,
      stockLevels: product.stockLevels.map((sl) => ({
        warehouse: {
          id: sl.warehouse.id,
          name: sl.warehouse.name,
          location: sl.warehouse.location,
        },
        totalUnits: sl.totalUnits,
        reservedUnits: sl.reservedUnits,
        availableUnits: sl.totalUnits - sl.reservedUnits,
      })),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
