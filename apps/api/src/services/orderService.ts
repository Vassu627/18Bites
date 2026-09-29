import { prisma, OrderStatus, type Prisma } from "@18bites/db";
import { canTransitionOrderStatus, type OrderStatus as SharedOrderStatus } from "@18bites/shared";
import { config } from "../config";
export async function computePrepStartTarget(
  expectedFinishAt: Date,
  maxPrepMinutes: number
): Promise<Date> {
  const totalBuffer = maxPrepMinutes + config.deliveryBufferMinutes;
  return new Date(expectedFinishAt.getTime() - totalBuffer * 60 * 1000);
}

export async function transitionOrderStatus(
  orderId: string,
  toStatus: SharedOrderStatus,
  note?: string
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const from = order.status as SharedOrderStatus;
  if (!canTransitionOrderStatus(from, toStatus)) {
    throw new Error(`Invalid transition ${from} -> ${toStatus}`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: toStatus as OrderStatus },
    });
    await tx.orderEvent.create({
      data: { orderId, status: toStatus as OrderStatus, note },
    });

    return updated;
  });
}

export function orderInclude(): Prisma.OrderInclude {
  return {
    ground: true,
    vendor: true,
    user: { select: { id: true, name: true, phone: true } },
    items: true,
    deliveryAssignment: { include: { rider: { select: { id: true, name: true, phone: true } } } },
    events: { orderBy: { createdAt: "asc" } },
  };
}
