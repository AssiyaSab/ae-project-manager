import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { prisma } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { User } from '@prisma/client';

// =========================================================================
// 1. Function Declarations for Gemini API
// =========================================================================

export const createFieldAlertDeclaration: FunctionDeclaration = {
  name: 'createFieldAlert',
  description: 'Фиксация аварийного блокера, задержки, поломки или проблемы с объекта для ГИПа и Директора.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      projectId: {
        type: SchemaType.INTEGER,
        description: 'ID проекта, на котором возникла проблема или блокер.',
      },
      description: {
        type: SchemaType.STRING,
        description: 'Подробное описание проблемы, задержки, нехватки материалов или поломки на объекте.',
      },
      severity: {
        type: SchemaType.STRING,
        description: 'Уровень критичности: "CRITICAL" (полная остановка работ, авария) или "WARNING" (задержка, нехватка вспомогательных материалов, предупреждение).',
      },
    },
    required: ['projectId', 'description', 'severity'],
  },
};

export const createQuickPurchaseDeclaration: FunctionDeclaration = {
  name: 'createQuickPurchase',
  description: 'Оперативная подача заявки на материал, комплектующие или закупку ТМЦ в свободной форме.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      title: {
        type: SchemaType.STRING,
        description: 'Наименование требуемых ТМЦ, кабеля, автоматов, оборудования или расходных материалов.',
      },
      estimatedAmount: {
        type: SchemaType.NUMBER,
        description: 'Ориентировочная сумма в тенге (KZT), если известна или указана пользователем.',
      },
      projectId: {
        type: SchemaType.INTEGER,
        description: 'ID проекта, для которого требуются материалы.',
      },
    },
    required: ['title', 'projectId'],
  },
};

export const parseReceiptOrInvoiceDeclaration: FunctionDeclaration = {
  name: 'parseReceiptOrInvoice',
  description: 'Извлечение реквизитов, сумм и позиций из загруженного фото счета на оплату, фискального чека или накладной (Vision).',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      supplierName: {
        type: SchemaType.STRING,
        description: 'Наименование поставщика (ТОО, ИП или компания), выставившего документ.',
      },
      invoiceNumber: {
        type: SchemaType.STRING,
        description: 'Номер счета на оплату, накладной или фискального чека.',
      },
      amount: {
        type: SchemaType.NUMBER,
        description: 'Итоговая сумма документа к оплате в тенге (KZT).',
      },
      items: {
        type: SchemaType.STRING,
        description: 'Список или краткое перечисление основных позиций/товаров из документа.',
      },
      bin: {
        type: SchemaType.STRING,
        description: 'БИН или ИИН поставщика (12 цифр), если различим в документе.',
      },
    },
    required: ['amount'],
  },
};

export const aiToolsDeclarations = [
  createFieldAlertDeclaration,
  createQuickPurchaseDeclaration,
  parseReceiptOrInvoiceDeclaration,
];

// =========================================================================
// 2. Tool Execution Logic (Prisma mutations + RBAC + Telegram notifications)
// =========================================================================

export interface ToolExecutionContext {
  user: User;
  photoUrl?: string | null;
  activeProjectId?: number;
}

/**
 * 1. createFieldAlert execution
 */
export async function executeCreateFieldAlert(
  args: { projectId: number; description: string; severity?: string },
  context: ToolExecutionContext
) {
  const { user } = context;
  const severity = (args.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING') as 'CRITICAL' | 'WARNING';

  // Find project
  let project = await prisma.project.findUnique({
    where: { id: Number(args.projectId) },
    include: { manager: true },
  });

  if (!project) {
    project = await prisma.project.findFirst({
      include: { manager: true },
      orderBy: { id: 'asc' },
    });
  }

  if (!project) {
    return {
      success: false,
      error: 'Проект не найден в базе данных.',
    };
  }

  // Find or create appropriate task
  let task = await prisma.task.findFirst({
    where: {
      projectId: project.id,
      assignees: { some: { id: user.id } },
      status: { not: 'DONE' },
    },
  });

  if (!task) {
    task = await prisma.task.findFirst({
      where: { projectId: project.id, status: { not: 'DONE' } },
    });
  }

  if (!task) {
    task = await prisma.task.create({
      data: {
        name: `Оперативный блокер: ${args.description.substring(0, 50)}`,
        projectId: project.id,
        status: severity === 'CRITICAL' ? 'BLOCKED' : 'IN_PROGRESS',
        updatedAt: new Date(),
      },
    });
  } else if (severity === 'CRITICAL') {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'BLOCKED' },
    });
  }

  // Create Alert entry
  const alert = await prisma.alert.create({
    data: {
      taskId: task.id,
      text: `[${severity}] ${args.description}`,
      status: 'ACTIVE',
    },
  });

  // Notify Admins and Project Manager in Telegram
  const recipients = new Set<string>();
  if (project.manager?.telegramId) {
    recipients.add(project.manager.telegramId);
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null }, isActive: true },
  });

  admins.forEach((admin) => {
    if (admin.telegramId) recipients.add(admin.telegramId);
  });

  if (user.telegramId) {
    recipients.delete(user.telegramId);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ae-project-manager-nu.vercel.app';
  const alertMessage =
    `🚨 *ВНИМАНИЕ РУКОВОДСТВУ! АВАРИЙНЫЙ БЛОКЕР С ОБЪЕКТА*\n\n` +
    `• *Объект:* ${project.name}\n` +
    `• *Уровень:* ${severity === 'CRITICAL' ? '🔴 КРИТИЧЕСКИЙ (Остановка работ)' : '🟡 ПРЕДУПРЕЖДЕНИЕ'}\n` +
    `• *Сотрудник:* ${user.name} (${user.role}${user.title ? ', ' + user.title : ''})\n` +
    `• *Раздел / Задача:* ${task.name}\n` +
    `• *Суть проблемы:* _${args.description}_\n\n` +
    `🔗 [Открыть веб-панель управления](${appUrl})`;

  for (const chatId of recipients) {
    await sendTelegramMessage(chatId, alertMessage);
  }

  return {
    success: true,
    alertId: alert.id,
    projectId: project.id,
    projectName: project.name,
    taskName: task.name,
    severity,
    description: args.description,
  };
}

/**
 * 2. createQuickPurchase execution
 */
export async function executeCreateQuickPurchase(
  args: { title: string; estimatedAmount?: number; projectId: number },
  context: ToolExecutionContext
) {
  const { user, photoUrl } = context;

  // Find project
  let project = await prisma.project.findUnique({
    where: { id: Number(args.projectId) },
  });

  if (!project) {
    project = await prisma.project.findFirst({
      orderBy: { id: 'asc' },
    });
  }

  if (!project) {
    return {
      success: false,
      error: 'Проект не найден в системе.',
    };
  }

  const cleanTitle = args.title.trim();
  const amount = Number(args.estimatedAmount) || 0;

  const purchase = await prisma.purchaseRequest.create({
    data: {
      type: 'INVOICE',
      title: cleanTitle,
      amount: amount,
      projectId: project.id,
      requesterId: user.id,
      status: 'PENDING_APPROVAL',
      fileUrl: photoUrl || null,
    },
    include: {
      project: true,
      requester: true,
    },
  });

  // Notify Admins with Direct Approval Inline Buttons
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null }, isActive: true },
  });

  const notifyMsg =
    `🛒 *Новая экспресс-заявка на закупку #${purchase.id} (ИИ-Диспетчер)*\n\n` +
    `• *Проект:* ${project.name}\n` +
    `• *Инициатор:* ${user.name} (${user.role})\n` +
    `• *ТМЦ:* ${purchase.title}\n` +
    (purchase.amount > 0 ? `• *Ориент. сумма:* ${purchase.amount.toLocaleString('ru-RU')} ₸\n` : '') +
    (photoUrl ? `📎 [Прикрепленное фото/документ](${photoUrl})\n\n` : '\n') +
    `👉 Выберите действие для согласования потребности:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: 'Одобрить ✅', callback_data: `pur_approve_need_${purchase.id}` },
        { text: 'Отклонить ❌', callback_data: `pur_reject_${purchase.id}` },
      ],
    ],
  };

  for (const admin of admins) {
    if (admin.telegramId && admin.telegramId !== user.telegramId) {
      await sendTelegramMessage(admin.telegramId, notifyMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }

  return {
    success: true,
    purchaseId: purchase.id,
    title: purchase.title,
    projectName: project.name,
    estimatedAmount: purchase.amount,
    status: purchase.status,
  };
}

/**
 * 3. parseReceiptOrInvoice execution
 */
export async function executeParseReceiptOrInvoice(
  args: {
    supplierName?: string;
    invoiceNumber?: string;
    amount: number;
    items?: string;
    bin?: string;
  },
  context: ToolExecutionContext
) {
  const { user, photoUrl, activeProjectId } = context;
  const amount = Number(args.amount) || 0;

  // Check if there's a recent pending purchase request from this user or in procurement
  let targetPurchase = await prisma.purchaseRequest.findFirst({
    where: {
      OR: [
        { requesterId: user.id, status: { in: ['PENDING_APPROVAL', 'IN_PROCUREMENT'] } },
        { supplyUserId: user.id, status: { in: ['PENDING_APPROVAL', 'IN_PROCUREMENT'] } },
      ],
    },
    include: { project: true },
    orderBy: { createdAt: 'desc' },
  });

  if (targetPurchase) {
    // Update existing purchase request with extracted invoice details
    const updated = await prisma.purchaseRequest.update({
      where: { id: targetPurchase.id },
      data: {
        supplierName: args.supplierName || targetPurchase.supplierName,
        invoiceNumber: args.invoiceNumber || targetPurchase.invoiceNumber,
        amount: amount > 0 ? amount : targetPurchase.amount,
        invoiceFileUrl: photoUrl || targetPurchase.invoiceFileUrl,
        fileUrl: targetPurchase.fileUrl || photoUrl || null,
        status: 'PENDING_PAYMENT_APPROVAL',
        supplyUserId: user.role === 'SUPPLY' ? user.id : targetPurchase.supplyUserId,
      },
      include: { project: true, requester: true },
    });

    // Notify Directors with Direct Approval Buttons
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null }, isActive: true },
    });

    const dirMsg =
      `📑 *Счет поставщика распознан и ожидает согласования к оплате*\n\n` +
      `• *Заявка:* #${updated.id}\n` +
      `• *Проект:* ${updated.project.name}\n` +
      `• *ТМЦ:* ${updated.title}\n` +
      `• *Поставщик:* ${updated.supplierName || 'Поставщик'}${args.bin ? ` (БИН: ${args.bin})` : ''}\n` +
      (updated.invoiceNumber ? `• *Счет:* №${updated.invoiceNumber}\n` : '') +
      `• *Итоговая сумма:* ${updated.amount.toLocaleString('ru-RU')} ₸\n\n` +
      (photoUrl ? `📎 [Открыть распознанный счет](${photoUrl})\n\n` : '') +
      `👉 Выберите действие для согласования счета:`;

    const dirKeyboard = {
      inline_keyboard: [
        [
          { text: 'Одобрить к оплате ✅', callback_data: `pur_approve_inv_${updated.id}` },
          { text: 'Вернуть на пересогласование 🔄', callback_data: `pur_renegotiate_${updated.id}` },
        ],
      ],
    };

    for (const admin of admins) {
      if (admin.telegramId && admin.telegramId !== user.telegramId) {
        await sendTelegramMessage(admin.telegramId, dirMsg, {
          parse_mode: 'Markdown',
          reply_markup: dirKeyboard,
        });
      }
    }

    return {
      success: true,
      action: 'UPDATED_EXISTING_PURCHASE',
      purchaseId: updated.id,
      supplierName: updated.supplierName,
      invoiceNumber: updated.invoiceNumber,
      amount: updated.amount,
      bin: args.bin,
      status: updated.status,
    };
  }

  // If no existing request, create a new one from the recognized receipt/invoice
  const targetProjectId =
    activeProjectId ||
    (await prisma.project.findFirst({ select: { id: true } }))?.id ||
    1;

  const project = await prisma.project.findUnique({
    where: { id: targetProjectId },
  });

  const title = args.items
    ? args.items.substring(0, 120)
    : `Закупка по счету №${args.invoiceNumber || 'б/н'} от ${args.supplierName || 'Поставщика'}`;

  const created = await prisma.purchaseRequest.create({
    data: {
      type: 'INVOICE',
      title,
      amount,
      projectId: targetProjectId,
      requesterId: user.id,
      supplierName: args.supplierName || null,
      invoiceNumber: args.invoiceNumber || null,
      invoiceFileUrl: photoUrl || null,
      fileUrl: photoUrl || null,
      status: 'PENDING_PAYMENT_APPROVAL',
      supplyUserId: user.role === 'SUPPLY' ? user.id : null,
    },
    include: { project: true, requester: true },
  });

  // Notify Admins
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null }, isActive: true },
  });

  const alertMsg =
    `📑 *Распознан новый счет на оплату #${created.id} (ИИ-Диспетчер)*\n\n` +
    `• *Проект:* ${project?.name || 'Проект'}\n` +
    `• *Инициатор:* ${user.name} (${user.role})\n` +
    `• *Поставщик:* ${created.supplierName || 'Поставщик'}${args.bin ? ` (БИН: ${args.bin})` : ''}\n` +
    (created.invoiceNumber ? `• *Номер:* №${created.invoiceNumber}\n` : '') +
    `• *Сумма:* ${created.amount.toLocaleString('ru-RU')} ₸\n` +
    (photoUrl ? `📎 [Скан / Фото счета](${photoUrl})\n\n` : '\n') +
    `👉 Подтвердите согласование к оплате:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: 'Одобрить к оплате ✅', callback_data: `pur_approve_inv_${created.id}` },
        { text: 'Отклонить ❌', callback_data: `pur_reject_${created.id}` },
      ],
    ],
  };

  for (const admin of admins) {
    if (admin.telegramId && admin.telegramId !== user.telegramId) {
      await sendTelegramMessage(admin.telegramId, alertMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }

  return {
    success: true,
    action: 'CREATED_NEW_PURCHASE',
    purchaseId: created.id,
    supplierName: created.supplierName,
    invoiceNumber: created.invoiceNumber,
    amount: created.amount,
    bin: args.bin,
    status: created.status,
  };
}
