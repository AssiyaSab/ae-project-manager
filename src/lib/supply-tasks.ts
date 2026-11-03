import { prisma } from './db';

/**
 * Creates or updates a Project Task for SUPPLY role when a PurchaseRequest enters IN_PROCUREMENT
 */
export async function createOrUpdateSupplyTask(purchaseId: number) {
  try {
    const purchase = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseId },
      include: { project: true, requester: true, supplyUser: true }
    });
    if (!purchase) return null;

    // Find all users with SUPPLY role (fallback to ADMIN if none found)
    let supplyUsers = await prisma.user.findMany({
      where: { role: 'SUPPLY' }
    });
    if (supplyUsers.length === 0) {
      supplyUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' }
      });
    }

    // Determine assignees (if specific supply user assigned, prioritize them)
    const targetAssignees = purchase.supplyUserId 
      ? [{ id: purchase.supplyUserId }] 
      : supplyUsers.map(u => ({ id: u.id }));

    const taskName = `📦 Закупка ТМЦ: ${purchase.title}`;
    const taskDesc = `Заявка на закупку ТМЦ #${purchase.id} для проекта «${purchase.project.name}».\n` +
      `Инициатор: ${purchase.requester?.name || 'Сотрудник'}.\n` +
      `Ориентировочная сумма: ${purchase.amount > 0 ? purchase.amount.toLocaleString('ru-RU') + ' ₸' : 'Уточняется'}.\n` +
      `Статус ТМЦ: В снабжении. Требуется запросить счет у поставщика.`;

    if (purchase.taskId) {
      const existingTask = await prisma.task.findUnique({ where: { id: purchase.taskId } });
      if (existingTask) {
        return await prisma.task.update({
          where: { id: purchase.taskId },
          data: {
            name: taskName,
            description: taskDesc,
            status: 'IN_PROGRESS',
            assignees: {
              set: targetAssignees
            }
          }
        });
      }
    }

    // Create new Task in project
    const newTask = await prisma.task.create({
      data: {
        projectId: purchase.projectId,
        name: taskName,
        description: taskDesc,
        status: 'IN_PROGRESS',
        assignees: {
          connect: targetAssignees
        }
      }
    });

    // Link task to purchase request
    await prisma.purchaseRequest.update({
      where: { id: purchase.id },
      data: { taskId: newTask.id }
    });

    return newTask;
  } catch (error) {
    console.error('Error creating/updating supply task for purchase #' + purchaseId, error);
    return null;
  }
}

/**
 * Marks the supply task as DONE when ТМЦ is delivered to the warehouse
 */
export async function completeSupplyTask(purchaseId: number) {
  try {
    const purchase = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseId }
    });
    if (purchase?.taskId) {
      await prisma.task.update({
        where: { id: purchase.taskId },
        data: { status: 'DONE' }
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error completing supply task for purchase #' + purchaseId, error);
  }
}

/**
 * Deletes or cancels the supply task if the purchase request was rejected
 */
export async function cancelSupplyTask(purchaseId: number) {
  try {
    const purchase = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseId }
    });
    if (purchase?.taskId) {
      await prisma.task.delete({
        where: { id: purchase.taskId }
      }).catch(() => {});
    }
    if (purchase?.paymentTaskId) {
      await prisma.task.delete({
        where: { id: purchase.paymentTaskId }
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error canceling supply task for purchase #' + purchaseId, error);
  }
}

/**
 * Creates or updates a Project Task for CHIEF_ACCOUNTANT when an invoice is APPROVED_FOR_PAYMENT
 */
export async function createOrUpdatePaymentTask(purchaseId: number) {
  try {
    const purchase = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseId },
      include: { project: true, requester: true }
    });
    if (!purchase) return null;

    // Find Chief Accountants (role CHIEF_ACCOUNTANT or title contains "главн", fallback to ADMIN or any ACCOUNTANT)
    let chiefAccountants = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'CHIEF_ACCOUNTANT' },
          { role: 'ACCOUNTANT', title: { contains: 'главн', mode: 'insensitive' } }
        ]
      }
    });

    if (chiefAccountants.length === 0) {
      chiefAccountants = await prisma.user.findMany({
        where: { role: { in: ['CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'ADMIN'] } }
      });
    }

    const targetAssignees = chiefAccountants.map(u => ({ id: u.id }));
    const taskName = `💳 Оплата счета: ${purchase.title} (${purchase.amount.toLocaleString('ru-RU')} ₸)`;
    const taskDesc = `Счет на оплату ТМЦ по заявке #${purchase.id} утвержден Директором к оплате.\n` +
      `Проект: «${purchase.project.name}».\n` +
      `Поставщик: ${purchase.supplierName || 'Поставщик'}.\n` +
      `Счет: №${purchase.invoiceNumber || 'б/н'}.\n` +
      `Сумма к оплате: ${purchase.amount.toLocaleString('ru-RU')} ₸.\n` +
      (purchase.invoiceFileUrl ? `📎 Ссылка на счет: ${purchase.invoiceFileUrl}\n` : '') +
      `👉 Задача Главного бухгалтера: провести платеж в клиент-банке и подтвердить оплату.`;

    if (purchase.paymentTaskId) {
      const existingTask = await prisma.task.findUnique({ where: { id: purchase.paymentTaskId } });
      if (existingTask) {
        return await prisma.task.update({
          where: { id: purchase.paymentTaskId },
          data: {
            name: taskName,
            description: taskDesc,
            status: 'IN_PROGRESS',
            assignees: {
              set: targetAssignees
            }
          }
        });
      }
    }

    // Create new Task in project
    const newTask = await prisma.task.create({
      data: {
        projectId: purchase.projectId,
        name: taskName,
        description: taskDesc,
        status: 'IN_PROGRESS',
        assignees: {
          connect: targetAssignees
        }
      }
    });

    // Link payment task to purchase request
    await prisma.purchaseRequest.update({
      where: { id: purchase.id },
      data: { paymentTaskId: newTask.id }
    });

    return newTask;
  } catch (error) {
    console.error('Error creating/updating payment task for purchase #' + purchaseId, error);
    return null;
  }
}

/**
 * Marks the payment task as DONE when payment is recorded by Chief Accountant
 */
export async function completePaymentTask(purchaseId: number) {
  try {
    const purchase = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseId }
    });
    if (purchase?.paymentTaskId) {
      await prisma.task.update({
        where: { id: purchase.paymentTaskId },
        data: { status: 'DONE' }
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error completing payment task for purchase #' + purchaseId, error);
  }
}
