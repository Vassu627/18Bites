import { Router } from "express";
import { prisma } from "@18bites/db";
import { assignRiderSchema, updateOrderStatusSchema } from "@18bites/shared";
import { authenticate, requireRoles, type AuthRequest } from "../middleware/auth";
import { orderInclude, transitionOrderStatus } from "../services/orderService";

const router = Router();

router.use(authenticate, requireRoles("KITCHEN", "ADMIN"));

router.get("/orders", async (req: AuthRequest, res) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId && !req.user!.roles.includes("ADMIN")) {
    res.status(400).json({ error: "Kitchen user missing vendor" });
    return;
  }

  const date = req.query.date as string | undefined;
  const groundId = req.query.ground as string | undefined;
  const start = date ? new Date(date) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const orders = await prisma.order.findMany({
    where: {
      vendorId: vendorId ?? undefined,
      groundId: groundId ?? undefined,
      expectedFinishAt: { gte: start, lt: end },
      status: { notIn: ["CANCELLED"] },
    },
    include: orderInclude(),
    orderBy: { expectedFinishAt: "asc" },
  });

  res.json(orders);
});

router.patch("/orders/:id/status", async (req: AuthRequest, res) => {
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (req.user!.vendorId && order.vendorId !== req.user!.vendorId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const updated = await transitionOrderStatus(req.params.id, parsed.data.status, "Kitchen update");
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.post("/orders/:id/assign-rider", async (req: AuthRequest, res) => {
  const parsed = assignRiderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (req.user!.vendorId && order.vendorId !== req.user!.vendorId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rider = await prisma.user.findUnique({
    where: { id: parsed.data.riderId },
    include: { riderProfile: true },
  });
  if (!rider?.roles.includes("RIDER") || !rider.riderProfile) {
    res.status(400).json({ error: "Invalid rider" });
    return;
  }

  const assignment = await prisma.deliveryAssignment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      riderId: rider.id,
    },
    update: { riderId: rider.id },
  });

  res.json(assignment);
});

router.get("/riders", async (_req, res) => {
  const riders = await prisma.user.findMany({
    where: { roles: { has: "RIDER" } },
    include: { riderProfile: true },
    orderBy: { name: "asc" },
  });
  res.json(riders);
});

export default router;
