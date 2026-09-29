import { prisma } from "@18bites/db";
import type { MenuRecommendation } from "@18bites/shared";

const POPULARITY_DAYS = 30;
const MAX_RECS = 8;

export async function getRecommendationsLive(
  groundId: string,
  userId?: string
): Promise<MenuRecommendation[]> {
  const ground = await prisma.ground.findUnique({ where: { id: groundId } });
  if (!ground) return [];

  const cached = await prisma.recommendationScore.findMany({
    where: {
      groundId,
      OR: [{ userId: userId ?? undefined }, { userId: null }],
    },
    orderBy: { score: "desc" },
    take: MAX_RECS,
  });

  if (cached.length >= 3) {
    return cached.map((c) => ({
      menuItemId: c.menuItemId,
      score: c.score,
      reason: c.reason as MenuRecommendation["reason"],
    }));
  }

  return computeRecommendations(groundId, ground.vendorId, userId);
}

export async function computeRecommendations(
  groundId: string,
  vendorId: string,
  userId?: string
): Promise<MenuRecommendation[]> {
  const since = new Date();
  since.setDate(since.getDate() - POPULARITY_DAYS);

  const popular = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: {
      order: {
        groundId,
        createdAt: { gte: since },
        status: { notIn: ["CANCELLED", "FAILED"] },
      },
      menuItem: { vendorId, isAvailable: true },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: MAX_RECS,
  });

  const recs: MenuRecommendation[] = popular.map((p) => ({
    menuItemId: p.menuItemId,
    score: p._sum.quantity ?? 0,
    reason: "popular" as const,
  }));

  if (userId) {
    const pastItems = await prisma.orderItem.findMany({
      where: {
        order: { userId, status: { notIn: ["CANCELLED", "FAILED"] } },
      },
      select: { menuItemId: true },
      distinct: ["menuItemId"],
      take: 20,
    });
    for (const item of pastItems) {
      if (!recs.find((r) => r.menuItemId === item.menuItemId)) {
        recs.push({
          menuItemId: item.menuItemId,
          score: 100,
          reason: "ordered_before",
        });
      }
    }
  }

  return recs.slice(0, MAX_RECS);
}

export async function refreshRecommendationCache(): Promise<number> {
  const grounds = await prisma.ground.findMany();
  let count = 0;

  for (const ground of grounds) {
    await prisma.recommendationScore.deleteMany({ where: { groundId: ground.id } });

    const users = await prisma.order.findMany({
      where: { groundId: ground.id },
      select: { userId: true },
      distinct: ["userId"],
    });

    const base = await computeRecommendations(ground.id, ground.vendorId);
    for (const r of base) {
      await prisma.recommendationScore.create({
        data: {
          userId: null,
          groundId: ground.id,
          menuItemId: r.menuItemId,
          score: r.score,
          reason: r.reason,
        },
      });
      count++;
    }

    for (const { userId } of users) {
      const personal = await computeRecommendations(ground.id, ground.vendorId, userId);
      for (const r of personal) {
        await prisma.recommendationScore.create({
          data: {
            userId,
            groundId: ground.id,
            menuItemId: r.menuItemId,
            score: r.score,
            reason: r.reason,
          },
        });
        count++;
      }
    }
  }

  return count;
}
