import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { ReserveRequestSchema } from "@/lib/schemas";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";
import { Prisma } from "@prisma/client";

const RESERVATION_TTL_MINUTES = 10;

export async function GET() {
  try {
    const reservations = await prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true, location: true } },
      },
    });

    return NextResponse.json(
      reservations.map((reservation) => ({
        id: reservation.id,
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
        quantity: reservation.quantity,
        status: reservation.status,
        expiresAt: reservation.expiresAt.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
        product: reservation.product,
        warehouse: reservation.warehouse,
      }))
    );
  } catch (error) {
    console.error("Error listing reservations:", error);
    return NextResponse.json(
      { error: "Failed to list reservations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reservations
 *
 * Reserves units of a product from a specific warehouse.
 * Uses pessimistic locking (SELECT ... FOR UPDATE) to guarantee
 * that concurrent requests for the last unit are handled correctly —
 * exactly one succeeds, the other gets a 409.
 *
 * Supports optional idempotency via the Idempotency-Key header.
 */
export async function POST(request: NextRequest) {
  try {
    // ─── Parse and validate request body ──────────────────────────────
    const body = await request.json();
    const parsed = ReserveRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // ─── Check idempotency ────────────────────────────────────────────
    const idempotencyKey = request.headers.get("idempotency-key");
    const cachedResponse = await checkIdempotency(idempotencyKey);
    if (cachedResponse) return cachedResponse;

    // Also check if a reservation already exists with this idempotency key
    if (idempotencyKey) {
      const existing = await prisma.reservation.findUnique({
        where: { idempotencyKey },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, location: true } },
        },
      });

      if (existing) {
        const responseBody = {
          id: existing.id,
          productId: existing.productId,
          warehouseId: existing.warehouseId,
          quantity: existing.quantity,
          status: existing.status,
          expiresAt: existing.expiresAt.toISOString(),
          createdAt: existing.createdAt.toISOString(),
          product: existing.product,
          warehouse: existing.warehouse,
        };

        return NextResponse.json(responseBody, {
          status: 201,
          headers: { "X-Idempotency-Replay": "true" },
        });
      }
    }

    // ─── Reserve with pessimistic locking ─────────────────────────────
    // This is the core concurrency-safe logic:
    // 1. Lock the stock row with SELECT ... FOR UPDATE
    // 2. Check available units (totalUnits - reservedUnits)
    // 3. If enough stock: increment reservedUnits, create reservation
    // 4. If not enough: return 409
    //
    // The FOR UPDATE lock ensures that if two transactions hit the same
    // stock row simultaneously, the second one blocks until the first
    // commits or rolls back. This guarantees exactly-once reservation.

    const expiresAt = new Date(
      Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
    );

    const reservation = await prisma.$transaction(async (tx) => {
      // Step 1: Lock the stock row
      const stockRows = await tx.$queryRaw<
        Array<{
          id: string;
          productId: string;
          warehouseId: string;
          totalUnits: number;
          reservedUnits: number;
        }>
      >(
        Prisma.sql`
          SELECT "id", "productId", "warehouseId", "totalUnits", "reservedUnits"
          FROM "stock_levels"
          WHERE "productId" = ${productId}
            AND "warehouseId" = ${warehouseId}
          FOR UPDATE
        `
      );

      if (stockRows.length === 0) {
        throw new Error("STOCK_NOT_FOUND");
      }

      const stock = stockRows[0];
      const availableUnits = stock.totalUnits - stock.reservedUnits;

      // Step 2: Check availability
      if (availableUnits < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // Step 3: Increment reservedUnits
      await tx.stockLevel.update({
        where: { id: stock.id },
        data: { reservedUnits: { increment: quantity } },
      });

      // Step 4: Create reservation record
      const newReservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
          idempotencyKey: idempotencyKey || undefined,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, location: true } },
        },
      });

      return newReservation;
    });

    const responseBody = {
      id: reservation.id,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      product: reservation.product,
      warehouse: reservation.warehouse,
    };

    // Store idempotency record for future replays
    await storeIdempotency(
      idempotencyKey,
      "POST",
      "/api/reservations",
      201,
      responseBody
    );

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INSUFFICIENT_STOCK") {
        return NextResponse.json(
          {
            error: "Insufficient stock",
            details:
              "Not enough units available to fulfill this reservation. Another customer may have reserved the last units.",
          },
          { status: 409 }
        );
      }

      if (error.message === "STOCK_NOT_FOUND") {
        return NextResponse.json(
          {
            error: "Stock not found",
            details:
              "No stock record found for this product/warehouse combination.",
          },
          { status: 404 }
        );
      }
    }

    console.error("Error creating reservation:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
