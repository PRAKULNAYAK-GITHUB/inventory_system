import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Checks for an existing idempotency record matching the given key.
 * If found and not expired, returns the cached response.
 * Returns null if no valid record exists.
 */
export async function checkIdempotency(
  key: string | null
): Promise<NextResponse | null> {
  if (!key) return null;

  const record = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });

  if (!record) return null;

  // Check if the record has expired
  if (record.expiresAt < new Date()) {
    // Clean up expired record
    await prisma.idempotencyRecord.delete({ where: { key } }).catch(() => {});
    return null;
  }

  // Return the cached response
  return NextResponse.json(JSON.parse(record.body), {
    status: record.statusCode,
    headers: { "X-Idempotency-Replay": "true" },
  });
}

/**
 * Stores a response in the idempotency table with a TTL.
 * Subsequent requests with the same key will return this cached response.
 */
export async function storeIdempotency(
  key: string | null,
  method: string,
  path: string,
  statusCode: number,
  body: unknown,
  ttlMinutes: number = 15
): Promise<void> {
  if (!key) return;

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.idempotencyRecord
    .upsert({
      where: { key },
      create: {
        key,
        method,
        path,
        statusCode,
        body: JSON.stringify(body),
        expiresAt,
      },
      update: {
        statusCode,
        body: JSON.stringify(body),
        expiresAt,
      },
    })
    .catch(() => {
      // Silently fail — idempotency is best-effort
    });
}
