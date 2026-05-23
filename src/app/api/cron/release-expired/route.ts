import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/release-expired
 *
 * Cron endpoint that releases all expired pending reservations.
 * Protected by CRON_SECRET to prevent unauthorized access.
 *
 * This runs as a Vercel Cron Job every 5 minutes (configured in vercel.json).
 * It is a safety net — the primary expiry mechanism is lazy cleanup
 * that runs whenever products or reservations are fetched.
 *
 * Production setup:
 * - Vercel Cron calls this endpoint on schedule
 * - The Authorization header must match CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // ─── Verify authorization ─────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Find all expired pending reservations ────────────────────────
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({
        message: "No expired reservations found",
        released: 0,
      });
    }

    // ─── Release each expired reservation ─────────────────────────────
    let releasedCount = 0;

    for (const reservation of expiredReservations) {
      try {
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
        releasedCount++;
      } catch {
        // If a reservation was already released by lazy cleanup, skip it
        console.warn(
          `Skipped reservation ${reservation.id} — may have been released already`
        );
      }
    }

    // ─── Also clean up expired idempotency records ────────────────────
    const deletedIdempotency = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return NextResponse.json({
      message: `Released ${releasedCount} expired reservations`,
      released: releasedCount,
      idempotencyRecordsCleaned: deletedIdempotency.count,
    });
  } catch (error) {
    console.error("Error in cron release-expired:", error);
    return NextResponse.json(
      { error: "Failed to release expired reservations" },
      { status: 500 }
    );
  }
}
