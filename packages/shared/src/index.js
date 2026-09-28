"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuCategoryCreateSchema = exports.menuItemCreateSchema = exports.vendorCreateSchema = exports.groundCreateSchema = exports.updateFinishTimeSchema = exports.deliveryCompleteSchema = exports.riderLocationSchema = exports.assignRiderSchema = exports.updateOrderStatusSchema = exports.createOrderSchema = exports.kitchenLoginSchema = exports.otpVerifySchema = exports.otpRequestSchema = exports.ORDER_STATUS_TRANSITIONS = exports.PaymentStatus = exports.OrderStatus = exports.UserRole = void 0;
exports.canTransitionOrderStatus = canTransitionOrderStatus;
const zod_1 = require("zod");
exports.UserRole = zod_1.z.enum(["PLAYER", "KITCHEN", "RIDER", "ADMIN"]);
exports.OrderStatus = zod_1.z.enum([
    "PLACED",
    "ACCEPTED",
    "PREPARING",
    "READY_FOR_PICKUP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "FAILED",
]);
exports.PaymentStatus = zod_1.z.enum(["PENDING", "PAID", "REFUNDED"]);
exports.ORDER_STATUS_TRANSITIONS = {
    PLACED: ["ACCEPTED", "CANCELLED"],
    ACCEPTED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
    READY_FOR_PICKUP: ["OUT_FOR_DELIVERY", "CANCELLED"],
    OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
    DELIVERED: [],
    CANCELLED: [],
    FAILED: [],
};
function canTransitionOrderStatus(from, to) {
    return exports.ORDER_STATUS_TRANSITIONS[from].includes(to);
}
exports.otpRequestSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10).max(15),
    role: exports.UserRole.optional().default("PLAYER"),
});
exports.otpVerifySchema = zod_1.z.object({
    phone: zod_1.z.string().min(10).max(15),
    code: zod_1.z.string().length(6),
});
exports.kitchenLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
exports.createOrderSchema = zod_1.z.object({
    groundId: zod_1.z.string().uuid(),
    expectedFinishAt: zod_1.z.string().datetime(),
    items: zod_1.z
        .array(zod_1.z.object({
        menuItemId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().min(1).max(20),
        notes: zod_1.z.string().max(200).optional(),
    }))
        .min(1),
    playerNotes: zod_1.z.string().max(500).optional(),
});
exports.updateOrderStatusSchema = zod_1.z.object({
    status: exports.OrderStatus,
});
exports.assignRiderSchema = zod_1.z.object({
    riderId: zod_1.z.string().uuid(),
});
exports.riderLocationSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    lat: zod_1.z.number().min(-90).max(90),
    lng: zod_1.z.number().min(-180).max(180),
});
exports.deliveryCompleteSchema = zod_1.z.object({
    otp: zod_1.z.string().length(6),
});
exports.updateFinishTimeSchema = zod_1.z.object({
    expectedFinishAt: zod_1.z.string().datetime(),
});
exports.groundCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    address: zod_1.z.string().min(5).max(300),
    lat: zod_1.z.number(),
    lng: zod_1.z.number(),
    vendorId: zod_1.z.string().uuid(),
    serviceHours: zod_1.z.string().max(100).optional(),
});
exports.vendorCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    prepTimeDefaultMinutes: zod_1.z.number().int().min(5).max(120).default(25),
});
exports.menuItemCreateSchema = zod_1.z.object({
    vendorId: zod_1.z.string().uuid(),
    categoryId: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().min(2).max(120),
    description: zod_1.z.string().max(500).optional(),
    pricePaise: zod_1.z.number().int().min(0),
    isVeg: zod_1.z.boolean().default(true),
    prepMinutes: zod_1.z.number().int().min(1).max(120).default(15),
    isAvailable: zod_1.z.boolean().default(true),
});
exports.menuCategoryCreateSchema = zod_1.z.object({
    vendorId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(2).max(80),
    sortOrder: zod_1.z.number().int().default(0),
});
