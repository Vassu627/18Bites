import { Router } from "express";
import { prisma } from "@18bites/db";
import { deliveryCompleteSchema, riderLocationSchema } from "@18bites/shared";
import { authenticate, requireRoles, type AuthRequest } from "../middleware/auth";
import { orderInclude, transitionOrderStatus } from "../services/orderService";
import { hashOtp, timingSafeEqualString } from "../lib/crypto";

const router = Router();

router.use(authenticate, requireRoles("RIDER", "ADMIN"));

router.get("/jobs", async (req: AuthRequest, res) => {
  const riderId = req.user!.sub;
  const assignments = await prisma.deliveryAssignment.findMany({
    where: {
      riderId,
      order: { status: { in: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] } },
    },
    include: { order: { include: orderInclude() } },
    orderBy: { assignedAt: "desc" },
  });
  res.json(assignments);
});

router.post("/availability", async (req: AuthRequest, res) => {
  const { isAvailable } = req.body as { isAvailable?: boolean };
  const profile = await prisma.riderProfile.upsert({
    where: { userId: req.user!.sub },
    create: { userId: req.user!.sub, isAvailable: !!isAvailable },
    update: { isAvailable: !!isAvailable },
  });
  res.json(profile);
});

router.post("/location", async (req: AuthRequest, res) => {
  const parsed = riderLocationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { orderId, lat, lng } = parsed.data;

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { orderId, riderId: req.user!.sub },
  });
  if (!assignment) {
    res.status(403).json({ error: "Not assigned to this order" });
    return;
  }

  const ping = await prisma.locationPing.create({
    data: {
      riderId: req.user!.sub,
      orderId,
      lat,
      lng,
    },
  });

  const io = req.app.get("io") as import("socket.io").Server | undefined;
  io?.to(`order:${orderId}`).emit("rider:location", {
    lat,
    lng,
    recordedAt: ping.recordedAt,
  });

  res.json({ ok: true });
});

router.post("/deliveries/:orderId/pickup", async (req: AuthRequest, res) => {
  const orderId = req.params.orderId;
  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { orderId, riderId: req.user!.sub },
  });
  if (!assignment) {
    res.status(403).json({ error: "Not assigned" });
    return;
  }

  await prisma.deliveryAssignment.update({
    where: { id: assignment.id },
    data: { pickedUpAt: new Date() },
  });

  try {
    const updated = await transitionOrderStatus(orderId, "OUT_FOR_DELIVERY", "Rider picked up");
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.post("/deliveries/:orderId/complete", async (req: AuthRequest, res) => {
  const parsed = deliveryCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const orderId = req.params.orderId;
  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { orderId, riderId: req.user!.sub },
  });
  if (!assignment) {
    res.status(403).json({ error: "Not assigned" });
    return;
  }

  const deliveryOtp = await prisma.deliveryOtp.findUnique({ where: { orderId } });
  if (!deliveryOtp || deliveryOtp.usedAt) {
    res.status(400).json({ error: "Invalid delivery state" });
    return;
  }

  const hash = hashOtp(parsed.data.otp);
  if (!timingSafeEqualString(deliveryOtp.codeHash, hash)) {
    res.status(400).json({ error: "Invalid delivery OTP" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliveryOtp.update({
      where: { orderId },
      data: { usedAt: new Date() },
    });
    await tx.deliveryAssignment.update({
      where: { id: assignment.id },
      data: { deliveredAt: new Date() },
    });
  });

  try {
    const updated = await transitionOrderStatus(orderId, "DELIVERED", "OTP verified");
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

export default router;
