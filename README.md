# Allo Inventory Reservation System

A Next.js application that manages inventory reservations across multiple warehouses with **concurrency-safe checkout**, automatic expiry, and idempotent API endpoints.

Built for the Allo Engineering Take-Home Exercise.

---

## Live Demo

> **🔗 [Live URL]** — _Add your deployed Vercel URL here after deployment_

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Concurrency Strategy](#concurrency-strategy)
- [Reservation Expiry](#reservation-expiry)
- [Idempotency (Bonus)](#idempotency-bonus)
- [API Reference](#api-reference)
- [Trade-offs & Future Improvements](#trade-offs--future-improvements)

---

## Quick Start

### Prerequisites

- Node.js 20.9+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/PRAKULNAYAK-GITHUB/inventory_system.git
cd inventory_system
npm install
```

### 2. Configure Environment Variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase connection strings (found in Supabase Dashboard → Settings → Database → Connection String → **Prisma** tab):

```env
DATABASE_URL="postgresql://postgres.YOUR_PROJECT_ID:[PASSWORD]@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.YOUR_PROJECT_ID:[PASSWORD]@aws-0-REGION.pooler.supabase.com:5432/postgres"
CRON_SECRET="any-random-secret-string"
```

### 3. Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed with sample data
npm run db:seed
```

### 4. Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) | Full-stack React framework |
| Language | TypeScript | End-to-end type safety |
| ORM | Prisma 7 | Type-safe database access |
| Database | Supabase (PostgreSQL) | Hosted relational database |
| Validation | Zod | Shared API/frontend schemas |
| Styling | Tailwind CSS + Custom CSS | Dark theme design system |
| Deployment | Vercel | Serverless hosting + Cron |

### Data Model

```
Product ──────┐
              ├── StockLevel (totalUnits, reservedUnits)
Warehouse ────┘
              │
              └── Reservation (status: PENDING → CONFIRMED/RELEASED)
```

- **StockLevel**: One row per product-warehouse pair. `availableUnits = totalUnits - reservedUnits`
- **Reservation**: Tracks each hold with status enum and TTL (`expiresAt`)
- **IdempotencyRecord**: Caches API responses keyed by `Idempotency-Key` header

### User Flow

```
Product Listing → Reserve → Checkout (countdown) → Confirm / Cancel
```

1. Browse products with per-warehouse stock levels
2. Click "Reserve" → opens quantity dialog
3. POST /api/reservations → creates 10-minute hold
4. Redirect to checkout with live countdown timer
5. "Confirm Purchase" → permanently deducts stock
6. "Cancel" → releases hold back to inventory

---

## Concurrency Strategy

**This is the core of the exercise.**

### Problem
When two customers try to reserve the last unit simultaneously, both could see `available = 1` and both could succeed — overselling the item.

### Solution: Pessimistic Locking (`SELECT ... FOR UPDATE`)

```sql
BEGIN;
  -- 1. Lock the stock row (blocks other transactions)
  SELECT * FROM "stock_levels"
  WHERE "productId" = $1 AND "warehouseId" = $2
  FOR UPDATE;

  -- 2. Check: available = totalUnits - reservedUnits
  -- If available < requested → ROLLBACK, return 409

  -- 3. Increment reservedUnits
  UPDATE "stock_levels"
  SET "reservedUnits" = "reservedUnits" + quantity
  WHERE ...;

  -- 4. Create reservation record
  INSERT INTO "reservations" ...;
COMMIT;
```

### Why This Works

- `FOR UPDATE` acquires a **row-level exclusive lock** on the StockLevel row
- If two transactions hit the same row, the second **blocks** until the first commits
- After the first commits (incrementing `reservedUnits`), the second sees the updated value
- If stock is now insufficient, the second transaction gets a **409 Conflict**
- **No distributed locks needed** — PostgreSQL handles it natively

### Why Not Optimistic Locking?

Optimistic locking (version/timestamp checks) requires client-side retry logic and can fail under high contention. For checkout flows where contention on popular items is expected, pessimistic locking is simpler, more predictable, and guaranteed to resolve in a single attempt.

---

## Reservation Expiry

Reservations are held for **10 minutes**. After that, the units must return to available stock.

### Dual Strategy

**1. Vercel Cron Job (Primary)**
- Endpoint: `GET /api/cron/release-expired`
- Schedule: Every 5 minutes (`*/5 * * * *` in `vercel.json`)
- Protected by `CRON_SECRET` bearer token
- Batch-releases all expired PENDING reservations
- Also cleans up expired idempotency records

**2. Lazy Cleanup on Read (Immediate Consistency)**
- Every time `GET /api/products` or `GET /api/reservations/:id` is called, we check for and release expired reservations encountered during the query
- This ensures the user always sees accurate stock — even if the cron hasn't run yet
- Trade-off: Adds a small overhead to read queries, but guarantees data freshness

### Why Both?

The cron job handles the bulk cleanup efficiently, while lazy cleanup ensures no stale data appears in the UI. This is a belt-and-suspenders approach commonly used in production reservation systems.

---

## Idempotency (Bonus)

### Problem
Network failures can cause clients to retry a reservation or confirmation request. Without idempotency, a retry could create a duplicate reservation or confirm twice.

### Solution: PostgreSQL-Backed Idempotency

Instead of Redis, idempotency keys are stored in a dedicated PostgreSQL table (`IdempotencyRecord`).

**How it works:**

1. Client sends `Idempotency-Key: <unique-id>` header
2. Server checks `idempotency_records` table for an existing response
3. If found and not expired → return cached response with `X-Idempotency-Replay: true` header
4. If not found → process normally, cache the response with 15-minute TTL
5. Expired records are cleaned up by the cron job

**Applied to:**
- `POST /api/reservations` — prevents duplicate reservations
- `POST /api/reservations/:id/confirm` — prevents double-confirming

**Trade-off:** Using PostgreSQL instead of Redis adds a small latency overhead but keeps the infrastructure simple (one database for everything) and is fully transactional.

---

## API Reference

| Method | Path | Behavior | Error Codes |
|--------|------|----------|-------------|
| `GET` | `/api/products` | List products with available stock per warehouse | 500 |
| `GET` | `/api/warehouses` | List warehouses | 500 |
| `POST` | `/api/reservations` | Reserve units (10-min hold) | **409** (insufficient stock), 400, 404 |
| `GET` | `/api/reservations/:id` | Get reservation details | 404, 500 |
| `POST` | `/api/reservations/:id/confirm` | Confirm (payment succeeded) | **410** (expired), 409, 404 |
| `POST` | `/api/reservations/:id/release` | Release (cancel/failed payment) | 409, 404 |
| `GET` | `/api/cron/release-expired` | Batch-release expired reservations | 401, 500 |

### Reserve Request Body
```json
{
  "productId": "string",
  "warehouseId": "string",
  "quantity": 1
}
```

### Error Responses
- **409 Conflict**: Not enough stock available
- **410 Gone**: Reservation expired before confirmation

---

## Trade-offs & Future Improvements

### Trade-offs Made

1. **No Redis** — Chose PostgreSQL for idempotency to keep infrastructure simple. In a high-traffic system, Redis would be faster for key lookups, but for this scale PostgreSQL is sufficient and eliminates a dependency.

2. **Lazy cleanup adds read overhead** — Every product/reservation read checks for expired reservations. This is a small cost for guaranteed data freshness. In production, you'd tune the cron frequency and potentially batch the cleanup more aggressively.

3. **Single-warehouse reservation** — Each reservation targets one product-warehouse pair. A production system might want cross-warehouse allocation (split orders across warehouses for optimal fulfillment).

4. **No authentication** — No user sessions or auth. A production system would need user identity to scope reservations and prevent abuse.

5. **Tailwind + Vanilla CSS** — Used a hybrid approach: Tailwind for utility reset + custom CSS variables for the design system. This keeps the styling maintainable without heavy component library dependencies.

### What I'd Do With More Time

- **Distributed locking with Redis** for horizontal scaling beyond a single Postgres instance
- **WebSocket/SSE** for real-time stock updates across browser tabs
- **Rate limiting** on the reservation endpoint to prevent abuse
- **User authentication** with session-scoped reservations
- **Cross-warehouse fulfillment** — reserve from the nearest warehouse with stock
- **Reservation queue** — waitlist for out-of-stock items
- **Comprehensive test suite** — unit tests for concurrency, integration tests for the full flow
- **Monitoring & alerting** — track reservation success rates, expiry rates, and 409/410 frequencies
- **Optimistic UI updates** — update the product list immediately while the API call is in flight

---

## Seed Data

The database is seeded with:

| Product | SKU | Mumbai | Delhi | Bangalore |
|---------|-----|--------|-------|-----------|
| Wireless Headphones | WH-1000XM5 | 25 | 15 | 30 |
| Mechanical Keyboard | KB-MK870-BLK | 40 | 20 | 35 |
| Ultra-Wide Monitor | MON-UW34-QHD | 5 | 3 | 8 |
| Ergonomic Chair | CH-ERGO-PRO | 50 | 30 | 45 |
| Portable SSD 2TB | SSD-PORT-2TB | 2 | 1 | 3 |

> **Monitor** and **SSD** have intentionally low stock — ideal for testing the 409 conflict scenario.
