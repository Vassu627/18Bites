import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma, UserRole } from "@18bites/db";
import {
  groundCreateSchema,
  vendorCreateSchema,
  menuCategoryCreateSchema,
  menuItemCreateSchema,
} from "@18bites/shared";
import { authenticate, requireRoles } from "../middleware/auth";

const router = Router();

router.use(authenticate, requireRoles("ADMIN"));

router.get("/vendors", async (_req, res) => {
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
  res.json(vendors);
});

router.post("/vendors", async (req, res) => {
  const parsed = vendorCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const vendor = await prisma.vendor.create({ data: parsed.data });
  res.status(201).json(vendor);
});

router.post("/grounds", async (req, res) => {
  const parsed = groundCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const ground = await prisma.ground.create({ data: parsed.data });
  res.status(201).json(ground);
});

router.post("/menu/categories", async (req, res) => {
  const parsed = menuCategoryCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const cat = await prisma.menuCategory.create({ data: parsed.data });
  res.status(201).json(cat);
});

router.post("/menu/items", async (req, res) => {
  const parsed = menuItemCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const item = await prisma.menuItem.create({ data: parsed.data });
  res.status(201).json(item);
});

router.post("/kitchen-users", async (req, res) => {
  const { email, password, name, vendorId } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    vendorId?: string;
  };
  if (!email || !password || !vendorId) {
    res.status(400).json({ error: "email, password, vendorId required" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      roles: [UserRole.KITCHEN],
      kitchenVendorId: vendorId,
    },
  });
  res.status(201).json({ id: user.id, email: user.email, vendorId });
});

router.post("/riders", async (req, res) => {
  const { phone, name } = req.body as { phone?: string; name?: string };
  if (!phone) {
    res.status(400).json({ error: "phone required" });
    return;
  }
  const user = await prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      name,
      roles: [UserRole.RIDER],
      riderProfile: { create: {} },
    },
    update: {
      name,
      roles: { set: [UserRole.RIDER, UserRole.PLAYER] },
    },
  });
  res.status(201).json(user);
});

router.post("/recommendations/refresh", async (_req, res) => {
  const { refreshRecommendationCache } = await import("../services/recommendationService");
  const count = await refreshRecommendationCache();
  res.json({ refreshed: count });
});

export default router;
