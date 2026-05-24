import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

const warehouseSeed = [
  { name: "Mumbai Central", location: "Mumbai, Maharashtra" },
  { name: "Delhi NCR Hub", location: "Gurugram, Haryana" },
  { name: "Bangalore South", location: "Bangalore, Karnataka" },
  { name: "Pune West", location: "Pune, Maharashtra" },
  { name: "Hyderabad Fulfilment", location: "Hyderabad, Telangana" },
];

const productSeed = [
  {
    name: "Wireless Noise-Cancelling Headphones",
    sku: "WH-1000XM5",
    description:
      "Premium over-ear headphones with noise cancellation, long battery life, and multipoint connection.",
  },
  {
    name: "Mechanical Keyboard RGB",
    sku: "KB-MK870-BLK",
    description:
      "Hot-swappable mechanical keyboard with per-key RGB lighting and PBT keycaps.",
  },
  {
    name: 'Ultra-Wide Curved Monitor 34"',
    sku: "MON-UW34-QHD",
    description:
      "34-inch UWQHD curved monitor with fast refresh rate and USB-C connectivity.",
  },
  {
    name: "Ergonomic Office Chair",
    sku: "CH-ERGO-PRO",
    description:
      "Fully adjustable ergonomic chair with lumbar support and breathable mesh.",
  },
  {
    name: "Portable SSD 2TB",
    sku: "SSD-PORT-2TB",
    description:
      "Compact 2TB portable SSD with high-speed transfer and rugged enclosure.",
  },
  {
    name: "Creator 4K Camera",
    sku: "CAM-4K-PRO",
    description:
      "Mirrorless creator camera kit with 4K capture and stabilized lens bundle.",
  },
  {
    name: "Air Tablet 11",
    sku: "TABLET-AIR-11",
    description:
      "Lightweight 11-inch tablet with laminated display and all-day battery.",
  },
  {
    name: "Fit LTE Smartwatch",
    sku: "WATCH-FIT-LTE",
    description:
      "LTE smartwatch with health tracking, sport modes, and bright always-on display.",
  },
  {
    name: "Travel Backpack Pro",
    sku: "BAG-TRAVEL-PRO",
    description:
      "Weather-resistant travel backpack with laptop sleeve and modular compartments.",
  },
  {
    name: "USB-C Dock 12-in-1",
    sku: "DOCK-USBC-12",
    description:
      "Compact USB-C docking station with HDMI, Ethernet, SD, and power delivery.",
  },
  {
    name: "Smart Voice Assistant Hub",
    sku: "SPK-SMART-HUB",
    description:
      "Premium smart speaker with voice control assistant, high-fidelity sound, and local smart home hub capabilities.",
  },
  {
    name: "Wireless Gaming Mouse Pro",
    sku: "MOUSE-GAMING-PRO",
    description:
      "Ultra-lightweight wireless gaming mouse with sub-millisecond response time and 25k DPI optical sensor.",
  },
  {
    name: "4K Laser UST Projector",
    sku: "PROJ-4K-UST",
    description:
      "Ultra short throw smart laser projector with 4K UHD resolution, cinematic color, and built-in speakers.",
  },
  {
    name: "True Wireless ANC Earbuds",
    sku: "EAR-TWS-PRO",
    description:
      "Premium wireless earbuds with adaptive active noise cancellation, personalized sound profiles, and 30-hour battery life.",
  },
  {
    name: "Interactive Fitness Mirror",
    sku: "FIT-MIRROR-4K",
    description:
      "High-end smart home gym mirror with hidden 43-inch 4K touchscreen display, embedded cameras, and stereo sound.",
  },
];

const stockMatrix = [
  [25, 15, 30, 18, 22],
  [40, 20, 35, 14, 26],
  [5, 3, 8, 4, 6],
  [50, 30, 45, 22, 35],
  [2, 1, 3, 2, 4],
  [11, 7, 9, 3, 6],
  [18, 12, 16, 5, 8],
  [7, 4, 6, 2, 5],
  [24, 17, 18, 9, 13],
  [14, 9, 11, 4, 6],
  [15, 22, 18, 10, 14], // Smart Voice Assistant Hub
  [30, 25, 40, 15, 20], // Wireless Gaming Mouse Pro
  [3, 2, 4, 1, 2],       // 4K Laser UST Projector (Highly exclusive, perfect for concurrency/low stock test)
  [50, 45, 60, 30, 40], // True Wireless ANC Earbuds
  [2, 1, 3, 1, 2],       // Interactive Fitness Mirror (Highly exclusive, perfect for concurrency/low stock test)
];

async function main() {
  console.log("Seeding database...\n");

  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  console.log("  Cleared existing data");

  const warehouses = await Promise.all(
    warehouseSeed.map((warehouse) => prisma.warehouse.create({ data: warehouse }))
  );

  console.log(`  Created ${warehouses.length} warehouses`);

  const products = await Promise.all(
    productSeed.map((product) =>
      prisma.product.create({
        data: {
          ...product,
          imageUrl: null,
        },
      })
    )
  );

  console.log(`  Created ${products.length} products`);

  const stockData = products.flatMap((product, productIndex) =>
    warehouses.map((warehouse, warehouseIndex) => ({
      product,
      warehouse,
      total: stockMatrix[productIndex][warehouseIndex],
    }))
  );

  const stockLevels = await Promise.all(
    stockData.map((stock) =>
      prisma.stockLevel.create({
        data: {
          productId: stock.product.id,
          warehouseId: stock.warehouse.id,
          totalUnits: stock.total,
          reservedUnits: 0,
        },
      })
    )
  );

  console.log(`  Created ${stockLevels.length} stock levels`);

  const pendingReservations = [
    { productIndex: 4, warehouseIndex: 1, quantity: 1, minutes: 9 },
    { productIndex: 2, warehouseIndex: 0, quantity: 2, minutes: 7 },
    { productIndex: 7, warehouseIndex: 3, quantity: 1, minutes: 5 },
    { productIndex: 5, warehouseIndex: 3, quantity: 1, minutes: 4 },
  ];

  for (const reservation of pendingReservations) {
    await prisma.$transaction([
      prisma.reservation.create({
        data: {
          productId: products[reservation.productIndex].id,
          warehouseId: warehouses[reservation.warehouseIndex].id,
          quantity: reservation.quantity,
          status: "PENDING",
          expiresAt: new Date(Date.now() + reservation.minutes * 60 * 1000),
        },
      }),
      prisma.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: products[reservation.productIndex].id,
            warehouseId: warehouses[reservation.warehouseIndex].id,
          },
        },
        data: {
          reservedUnits: { increment: reservation.quantity },
        },
      }),
    ]);
  }

  await prisma.reservation.create({
    data: {
      productId: products[0].id,
      warehouseId: warehouses[0].id,
      quantity: 1,
      status: "CONFIRMED",
      expiresAt: new Date(Date.now() + 8 * 60 * 1000),
    },
  });

  await prisma.reservation.create({
    data: {
      productId: products[8].id,
      warehouseId: warehouses[4].id,
      quantity: 1,
      status: "RELEASED",
      expiresAt: new Date(Date.now() + 2 * 60 * 1000),
    },
  });

  console.log("  Created 6 sample reservations");
  console.log("\nSeed complete. Database is ready for use.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
