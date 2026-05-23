import { z } from "zod";

// ─── Reserve Request Schema ─────────────────────────────────────────────────

export const ReserveRequestSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

export type ReserveRequest = z.infer<typeof ReserveRequestSchema>;

// ─── API Response Types ─────────────────────────────────────────────────────

export interface ProductWithStock {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  stockLevels: {
    warehouse: {
      id: string;
      name: string;
      location: string;
    };
    totalUnits: number;
    reservedUnits: number;
    availableUnits: number;
  }[];
}

export interface ReservationResponse {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

export interface ApiError {
  error: string;
  details?: string;
}
