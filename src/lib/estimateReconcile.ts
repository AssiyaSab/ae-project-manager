import { prisma } from './db';

function norm(s?: string | null): string {
  return (s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s.-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function reconcileEstimateItem(estimateItemId: number) {
  const est = await prisma.projectEstimateItem.findUnique({
    where: { id: estimateItemId },
    include: {
      purchaseItems: {
        include: {
          purchase: { select: { status: true } },
          invoice: { select: { status: true } },
        },
      },
    },
  });
  if (!est) return null;

  const items = est.purchaseItems || [];
  let actualQty = 0;
  let actualTotal = 0;
  let hasReplacement = false;

  for (const it of items) {
    const isClosed =
      it.sourceType === 'FROM_STOCK' ||
      it.isPaid ||
      it.invoice?.status === 'PAID' ||
      ['DELIVERED', 'IN_TRANSIT', 'POA_ISSUED', 'PAID_AND_ORDERED', 'PAID'].includes(it.purchase?.status || '') ||
      it.isReplacement;

    if (isClosed || items.length > 0) {
      actualQty += Number(it.quantity) || 0;
      const lineTotal = Number(it.total) > 0 ? Number(it.total) : (Number(it.quantity) || 0) * (Number(it.price) || 0);
      actualTotal += lineTotal;
    }
    if (it.isReplacement) hasReplacement = true;
  }

  let nextStatus = 'OPEN';
  if (items.length === 0 || actualQty <= 0) {
    nextStatus = 'OPEN';
  } else if (hasReplacement) {
    nextStatus = 'REPLACED';
  } else if (actualQty < est.plannedQty) {
    nextStatus = 'PARTIAL';
  } else if (items.every((it) => it.sourceType === 'FROM_STOCK')) {
    nextStatus = 'CLOSED_STOCK';
  } else {
    nextStatus = 'CLOSED_PURCHASE';
  }

  return prisma.projectEstimateItem.update({
    where: { id: est.id },
    data: {
      actualQty,
      actualTotal,
      status: nextStatus,
    },
  });
}

export async function reconcileProjectEstimate(projectId: number) {
  try {
    const estimateItems = await prisma.projectEstimateItem.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    });
    if (estimateItems.length === 0) return;

    const unlinkedPurchaseItems = await prisma.purchaseItem.findMany({
      where: {
        estimateItemId: null,
        purchase: { projectId },
        OR: [
          { sourceType: { in: ['FROM_STOCK', 'INVOICE'] } },
          { isPaid: true },
          { purchase: { status: { in: ['DELIVERED', 'IN_TRANSIT', 'POA_ISSUED', 'PAID_AND_ORDERED', 'PAID'] } } },
        ],
      },
      include: { purchase: { select: { status: true } } },
    });

    const touchedEstimateIds = new Set<number>();

    for (const pItem of unlinkedPurchaseItems) {
      const pName = norm(pItem.name);
      if (!pName) continue;

      let matched = estimateItems.find((est) => {
        const art = norm(est.article);
        return art.length >= 3 && pName.includes(art);
      });

      if (!matched) {
        matched = estimateItems.find((est) => {
          const eName = norm(est.name);
          if (!eName) return false;
          if (eName === pName) return true;
          if (eName.length >= 6 && (pName.includes(eName) || eName.includes(pName))) return true;
          const eWords = eName.split(' ').filter((w) => w.length >= 3);
          const pWords = new Set(pName.split(' ').filter((w) => w.length >= 3));
          if (eWords.length === 0) return false;
          const overlap = eWords.filter((w) => pWords.has(w)).length;
          return overlap / eWords.length >= 0.7;
        });
      }

      if (matched) {
        await prisma.purchaseItem.update({
          where: { id: pItem.id },
          data: { estimateItemId: matched.id },
        });
        touchedEstimateIds.add(matched.id);
      }
    }

    for (const estId of touchedEstimateIds) {
      await reconcileEstimateItem(estId);
    }
  } catch (err) {
    console.error('reconcileProjectEstimate error:', err);
  }
}
