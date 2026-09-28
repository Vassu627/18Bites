import { z } from "zod";

export const UserRole = z.enum(["PLAYER", "KITCHEN", "RIDER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRole>;

export const OrderStatus = z.enum([
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentStatus = z.enum(["PENDING", "PAID", "REFUNDED"]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  CANCELLED: [],
  FAILED: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export const otpRequestSchema = z.object({
  phone: z.string().min(10).max(15),
  role: UserRole.optional().default("PLAYER"),
});

export const otpVerifySchema = z.object({
  phone: z.string().min(10).max(15),
  code: z.string().length(6),
});

export const kitchenLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createOrderSchema = z.object({
  groundId: z.string().uuid(),
  expectedFinishAt: z.string().datetime(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1),
  playerNotes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: OrderStatus,
});

export const assignRiderSchema = z.object({
  riderId: z.string().uuid(),
});

export const riderLocationSchema = z.object({
  orderId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const deliveryCompleteSchema = z.object({
  otp: z.string().length(6),
});

export const updateFinishTimeSchema = z.object({
  expectedFinishAt: z.string().datetime(),
});

export const groundCreateSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().min(5).max(300),
  lat: z.number(),
  lng: z.number(),
  vendorId: z.string().uuid(),
  serviceHours: z.string().max(100).optional(),
});

export const vendorCreateSchema = z.object({
  name: z.string().min(2).max(120),
  prepTimeDefaultMinutes: z.number().int().min(5).max(120).default(25),
});

export const menuItemCreateSchema = z.object({
  vendorId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  pricePaise: z.number().int().min(0),
  isVeg: z.boolean().default(true),
  prepMinutes: z.number().int().min(1).max(120).default(15),
  isAvailable: z.boolean().default(true),
});

export const menuCategoryCreateSchema = z.object({
  vendorId: z.string().uuid(),
  name: z.string().min(2).max(80),
  sortOrder: z.number().int().default(0),
});

export type RecommendationReason = "popular" | "ordered_before" | "similar_users";

export interface MenuRecommendation {
  menuItemId: string;
  score: number;
  reason: RecommendationReason;
}
