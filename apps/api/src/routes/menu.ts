import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getRecommendationsLive } from "../services/recommendationService";
import { prisma } from "@18bites/db";
import type { AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/recommendations", authenticate, async (req: AuthRequest, res) => {
  const groundId = req.query.ground_id as string;
  if (!groundId) {
    res.status(400).json({ error: "ground_id required" });
    return;
  }
  const recs = await getRecommendationsLive(groundId, req.user?.sub);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: recs.map((r) => r.menuItemId) } },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  res.json(
    recs
      .filter((r) => byId.has(r.menuItemId))
      .map((r) => ({ ...r, item: byId.get(r.menuItemId) }))
  );
});

export default router;
