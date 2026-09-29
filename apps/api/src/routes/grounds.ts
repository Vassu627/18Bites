import { Router } from "express";
import { prisma } from "@18bites/db";
import { authenticate, type AuthRequest } from "../middleware/auth";
import { getRecommendationsLive } from "../services/recommendationService";

const router = Router();

router.get("/", async (_req, res) => {
  const grounds = await prisma.ground.findMany({
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  res.json(grounds);
});

router.get("/:id/menu", async (req, res) => {
  const ground = await prisma.ground.findUnique({ where: { id: req.params.id } });
  if (!ground) {
    res.status(404).json({ error: "Ground not found" });
    return;
  }

  const categories = await prisma.menuCategory.findMany({
    where: { vendorId: ground.vendorId },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { name: "asc" },
      },
    },
  });

  const uncategorized = await prisma.menuItem.findMany({
    where: { vendorId: ground.vendorId, categoryId: null, isAvailable: true },
    orderBy: { name: "asc" },
  });

  res.json({ groundId: ground.id, vendorId: ground.vendorId, categories, uncategorized });
});

router.get("/:id/recommendations", authenticate, async (req: AuthRequest, res) => {
  const recs = await getRecommendationsLive(req.params.id, req.user?.sub);
  const itemIds = recs.map((r) => r.menuItemId);
  const items = await prisma.menuItem.findMany({ where: { id: { in: itemIds } } });
  const byId = new Map(items.map((i) => [i.id, i]));
  res.json(
    recs
      .filter((r) => byId.has(r.menuItemId))
      .map((r) => ({ ...r, item: byId.get(r.menuItemId) }))
  );
});

export default router;
