import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Clean existing data ────────────────────────────────────────────
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  console.log("  ✓ Cleared existing data");

  // ─── Create Warehouses ──────────────────────────────────────────────
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: "Mumbai Central",
        location: "Mumbai, Maharashtra",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Delhi NCR Hub",
        location: "Gurugram, Haryana",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Bangalore South",
        location: "Bangalore, Karnataka",
      },
    }),
  ]);

  console.log(`  ✓ Created ${warehouses.length} warehouses`);

  // ─── Create Products ────────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Wireless Noise-Cancelling Headphones",
        sku: "WH-1000XM5",
        description:
          "Premium over-ear headphones with industry-leading noise cancellation, 30-hour battery life, and multipoint connection.",
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard RGB",
        sku: "KB-MK870-BLK",
        description:
          "Hot-swappable mechanical keyboard with per-key RGB lighting, PBT keycaps, and gasket-mounted design.",
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Ultra-Wide Curved Monitor 34\"",
        sku: "MON-UW34-QHD",
        description:
          "34-inch UWQHD curved monitor with 165Hz refresh rate, 1ms response time, and USB-C connectivity.",
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Ergonomic Office Chair",
        sku: "CH-ERGO-PRO",
        description:
          "Fully adjustable ergonomic chair with lumbar support, breathable mesh back, and 4D armrests.",
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Portable SSD 2TB",
        sku: "SSD-PORT-2TB",
        description:
          "Ultra-compact portable SSD with 2TB capacity, 2000MB/s read speed, and IP65 water resistance.",
        imageUrl: null,
      },
    }),
  ]);

  console.log(`  ✓ Created ${products.length} products`);

  // ─── Create Stock Levels ────────────────────────────────────────────
  // Each product gets different stock levels per warehouse to make it realistic
  const stockData = [
    // Headphones — popular, varied stock
    { product: products[0], warehouse: warehouses[0], total: 25 },
    { product: products[0], warehouse: warehouses[1], total: 15 },
    { product: products[0], warehouse: warehouses[2], total: 30 },

    // Keyboard — moderate stock
    { product: products[1], warehouse: warehouses[0], total: 40 },
    { product: products[1], warehouse: warehouses[1], total: 20 },
    { product: products[1], warehouse: warehouses[2], total: 35 },

    // Monitor — limited stock (good for testing 409 scenarios)
    { product: products[2], warehouse: warehouses[0], total: 5 },
    { product: products[2], warehouse: warehouses[1], total: 3 },
    { product: products[2], warehouse: warehouses[2], total: 8 },

    // Chair — good stock
    { product: products[3], warehouse: warehouses[0], total: 50 },
    { product: products[3], warehouse: warehouses[1], total: 30 },
    { product: products[3], warehouse: warehouses[2], total: 45 },

    // SSD — very limited stock (perfect for concurrency testing)
    { product: products[4], warehouse: warehouses[0], total: 2 },
    { product: products[4], warehouse: warehouses[1], total: 1 },
    { product: products[4], warehouse: warehouses[2], total: 3 },
  ];

  const stockLevels = await Promise.all(
    stockData.map((s) =>
      prisma.stockLevel.create({
        data: {
          productId: s.product.id,
          warehouseId: s.warehouse.id,
          totalUnits: s.total,
          reservedUnits: 0,
        },
      })
    )
  );

  console.log(`  ✓ Created ${stockLevels.length} stock levels`);

  // ─── Summary ────────────────────────────────────────────────────────
  console.log("\n📦 Seed complete! Summary:");
  console.log("─".repeat(50));

  for (const product of products) {
    const stocks = stockData.filter((s) => s.product.id === product.id);
    const totalStock = stocks.reduce((sum, s) => sum + s.total, 0);
    console.log(`  ${product.name} (${product.sku})`);
    console.log(`    Total units across all warehouses: ${totalStock}`);
    for (const s of stocks) {
      console.log(`    • ${s.warehouse.name}: ${s.total} units`);
    }
  }

  console.log("─".repeat(50));
  console.log("\n✅ Database is ready for use!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
