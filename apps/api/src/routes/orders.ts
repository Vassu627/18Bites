import { Router } from "express";
import { prisma, OrderStatus } from "@18bites/db";
import {
  createOrderSchema,
  updateFinishTimeSchema,
  type OrderStatus as SharedOrderStatus,
} from "@18bites/shared";
import { authenticate, requireRoles, type AuthRequest } from "../middleware/auth";
import {
  computePrepStartTarget,
  orderInclude,
  transitionOrderStatus,
} from "../services/orderService";
import { generateDeliveryOtp, hashOtp } from "../lib/crypto";

const router = Router();

const deliveryOtpPlain = new Map<string, string>();

router.post("/", authenticate, requireRoles("PLAYER", "ADMIN"), async (req: AuthRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { groundId, expectedFinishAt, items, playerNotes } = parsed.data;
  const ground = await prisma.ground.findUnique({ where: { id: groundId } });
  if (!ground) {
    res.status(404).json({ error: "Ground not found" });
    return;
  }

  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: items.map((i) => i.menuItemId) },
      vendorId: ground.vendorId,
      isAvailable: true,
    },
  });
  if (menuItems.length !== items.length) {
    res.status(400).json({ error: "Invalid menu items" });
    return;
  }

  const maxPrep = Math.max(...menuItems.map((m) => m.prepMinutes), ground.vendorId ? 15 : 15);
  const vendor = await prisma.vendor.findUnique({ where: { id: ground.vendorId } });
  const prepMinutes = Math.max(maxPrep, vendor?.prepTimeDefaultMinutes ?? 25);
  const finishDate = new Date(expectedFinishAt);
  const prepStartTarget = await computePrepStartTarget(finishDate, prepMinutes);

  let subtotal = 0;
  const lineData = items.map((line) => {
    const mi = menuItems.find((m) => m.id === line.menuItemId)!;
    subtotal += mi.pricePaise * line.quantity;
    return {
      menuItemId: mi.id,
      nameSnapshot: mi.name,
      pricePaise: mi.pricePaise,
      quantity: line.quantity,
      notes: line.notes,
    };
  });

  const deliveryCode = generateDeliveryOtp();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: req.user!.sub,
        groundId,
        vendorId: ground.vendorId,
        expectedFinishAt: finishDate,
        prepStartTarget,
        subtotalPaise: subtotal,
        deliveryFeePaise: 2000,
        playerNotes,
        status: OrderStatus.PLACED,
        items: { create: lineData },
        events: { create: { status: OrderStatus.PLACED, note: "Order placed" } },
        deliveryOtp: { create: { codeHash: hashOtp(deliveryCode) } },
      },
      include: orderInclude(),
    });
    return created;
  });

  deliveryOtpPlain.set(order.id, deliveryCode);

  res.status(201).json({
    order,
    deliveryOtp: deliveryCode,
    prepStartTarget,
  });
});

router.get("/mine", authenticate, async (req: AuthRequest, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.sub },
    include: orderInclude(),
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(orders);
});

router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: orderInclude(),
  });
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const isOwner = order.userId === req.user!.sub;
  const isKitchen =
    req.user!.roles.includes("KITCHEN") && req.user!.vendorId === order.vendorId;
  const isRider = req.user!.roles.includes("RIDER");
  const isAdmin = req.user!.roles.includes("ADMIN");
  if (!isOwner && !isKitchen && !isRider && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let deliveryOtp: string | undefined;
  if (isOwner && order.status !== "DELIVERED" && order.status !== "CANCELLED") {
    deliveryOtp = deliveryOtpPlain.get(order.id);
    if (!deliveryOtp) {
      res.json({ order, deliveryOtp: null, message: "Delivery OTP was shown at checkout only" });
      return;
    }
  }

  res.json({ order, deliveryOtp });
});

router.post("/:id/cancel", authenticate, requireRoles("PLAYER", "ADMIN"), async (req: AuthRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order || order.userId !== req.user!.sub) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!["PLACED", "ACCEPTED"].includes(order.status)) {
    res.status(400).json({ error: "Cannot cancel at this stage" });
    return;
  }
  try {
    const updated = await transitionOrderStatus(req.params.id, "CANCELLED", "Cancelled by player");
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.patch("/:id/finish-time", authenticate, requireRoles("PLAYER"), async (req: AuthRequest, res) => {
  const parsed = updateFinishTimeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { menuItem: true } } },
  });
  if (!order || order.userId !== req.user!.sub) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!["PLACED", "ACCEPTED"].includes(order.status)) {
    res.status(400).json({ error: "Kitchen already started preparation" });
    return;
  }
  const maxPrep = Math.max(...order.items.map((i) => i.menuItem.prepMinutes), 15);
  const finishDate = new Date(parsed.data.expectedFinishAt);
  const prepStartTarget = await computePrepStartTarget(finishDate, maxPrep);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { expectedFinishAt: finishDate, prepStartTarget },
    include: orderInclude(),
  });
  res.json(updated);
});

router.get("/:id/tracking", authenticate, async (req: AuthRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const lastPing = await prisma.locationPing.findFirst({
    where: { orderId: order.id },
    orderBy: { recordedAt: "desc" },
  });
  res.json({
    status: order.status,
    ground: await prisma.ground.findUnique({ where: { id: order.groundId } }),
    riderLocation: lastPing
      ? { lat: lastPing.lat, lng: lastPing.lng, recordedAt: lastPing.recordedAt }
      : null,
  });
});

export default router;
