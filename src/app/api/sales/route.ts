import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAuth, createAuditLog } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orders = await prisma.saleOrder.findMany({
      include: {
        items: true,
        createdBy: true,
        warehouseUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('GET /api/sales error:', error);
    return NextResponse.json({ error: 'Failed to fetch sales orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      customerName,
      customerBin,
      customerPhone,
      customerEmail,
      customerAddress,
      brand = 'ONKA',
      notes,
      items = [],
    } = body;

    if (!customerName || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Заполните наименование покупателя и добавьте хотя бы один товар' },
        { status: 400 }
      );
    }

    // Автоматическая генерация номера счета: СЧ-ГГГГ-XXX
    const year = new Date().getFullYear();
    const count = await prisma.saleOrder.count();
    const orderNumber = `СЧ-${year}-${String(count + 1).padStart(3, '0')}`;

    // Расчет сумм позиций и итога
    let calculatedTotal = 0;
    const validatedItems = items.map((it: any) => {
      const qty = Number(it.quantity) || 1;
      const price = Number(it.price) || 0;
      const total = qty * price;
      calculatedTotal += total;
      return {
        brand: it.brand || brand || 'ONKA',
        article: String(it.article || '').trim(),
        name: String(it.name || '').trim(),
        unit: String(it.unit || 'шт').trim(),
        quantity: qty,
        price: price,
        total: total,
      };
    });

    const vatRate = 16; // 16% НДС
    const vatAmount = Math.round((calculatedTotal * vatRate) / (100 + vatRate) * 100) / 100;

    const order = await prisma.saleOrder.create({
      data: {
        orderNumber,
        customerName: customerName.trim(),
        customerBin: customerBin ? customerBin.trim() : null,
        customerPhone: customerPhone ? customerPhone.trim() : null,
        customerEmail: customerEmail ? customerEmail.trim() : null,
        customerAddress: customerAddress ? customerAddress.trim() : null,
        brand,
        status: 'DRAFT',
        totalAmount: calculatedTotal,
        vatRate,
        vatAmount,
        notes: notes ? notes.trim() : null,
        createdById: user.id !== 0 ? user.id : null,
        items: {
          create: validatedItems,
        },
      },
      include: {
        items: true,
        createdBy: true,
      },
    });

    await createAuditLog(user.id, 'CREATE_SALE_ORDER', `Создан заказ покупателя ${order.orderNumber} на сумму ${calculatedTotal} ₸`);

    return NextResponse.json(order);
  } catch (error) {
    console.error('POST /api/sales error:', error);
    return NextResponse.json({ error: 'Failed to create sale order' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing order ID' }, { status: 400 });
    }

    const existingOrder = await prisma.saleOrder.findUnique({
      where: { id: Number(id) },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updateData: any = {};

    // 1. Изменение статуса на PAID (Оплачено)
    if (status === 'PAID') {
      const canConfirmPayment = ['ADMIN', 'ACCOUNTANT', 'MANAGER'].includes(user.role);
      if (!canConfirmPayment) {
        return NextResponse.json({ error: 'Только Бухгалтер или Администратор могут подтвердить оплату' }, { status: 403 });
      }
      updateData.status = 'PAID';
      updateData.paidAt = new Date();
    }

    // 2. Изменение статуса на READY_FOR_PICKUP (Готов к отгрузке)
    else if (status === 'READY_FOR_PICKUP') {
      const canPrepare = ['ADMIN', 'WAREHOUSE', 'MANAGER', 'SUPPLY'].includes(user.role);
      if (!canPrepare) {
        return NextResponse.json({ error: 'Недостаточно прав для перевода в статус готовности к отгрузке' }, { status: 403 });
      }
      updateData.status = 'READY_FOR_PICKUP';
    }

    // 3. Изменение статуса на SHIPPED (Отгружен) - ТРЕБУЕТ ДОВЕРЕННОСТЬ!
    else if (status === 'SHIPPED') {
      const canShip = ['ADMIN', 'WAREHOUSE', 'MANAGER'].includes(user.role);
      if (!canShip) {
        return NextResponse.json({ error: 'Только Склад или Администратор могут подтвердить отгрузку' }, { status: 403 });
      }

      const poaNumber = rest.powerOfAttorneyNumber?.trim();
      const poaDate = rest.powerOfAttorneyDate;
      const issuedTo = rest.issuedToName?.trim();
      const poaUrl = rest.powerOfAttorneyFileUrl?.trim();

      if (!poaNumber || !poaDate || !issuedTo || !poaUrl) {
        return NextResponse.json(
          {
            error: 'Для отгрузки обязательны все 4 поля доверенности: Номер доверенности, Дата, ФИО получателя и фото/скан документа.',
          },
          { status: 400 }
        );
      }

      updateData.status = 'SHIPPED';
      updateData.shippedAt = new Date();
      updateData.powerOfAttorneyNumber = poaNumber;
      updateData.powerOfAttorneyDate = new Date(poaDate);
      updateData.issuedToName = issuedTo;
      updateData.powerOfAttorneyFileUrl = poaUrl;
      updateData.warehouseUserId = user.id !== 0 ? user.id : null;
    }

    // 4. Обычный перевод статуса (например DRAFT -> INVOICE_SENT)
    else if (status) {
      updateData.status = status;
    }

    // 5. Обновление прочих полей
    if (rest.notes !== undefined) updateData.notes = rest.notes;
    if (rest.customerName) updateData.customerName = rest.customerName;
    if (rest.customerBin !== undefined) updateData.customerBin = rest.customerBin;
    if (rest.customerPhone !== undefined) updateData.customerPhone = rest.customerPhone;
    if (rest.customerEmail !== undefined) updateData.customerEmail = rest.customerEmail;
    if (rest.customerAddress !== undefined) updateData.customerAddress = rest.customerAddress;

    const updated = await prisma.saleOrder.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        items: true,
        createdBy: true,
        warehouseUser: true,
      },
    });

    await createAuditLog(
      user.id,
      'UPDATE_SALE_ORDER',
      `Обновлен статус заказа ${updated.orderNumber} на ${updated.status}`
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/sales error:', error);
    return NextResponse.json({ error: 'Failed to update sale order' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }

  try {
    const canDelete = ['ADMIN', 'MANAGER'].includes(user.role);
    if (!canDelete) {
      return NextResponse.json({ error: 'Недостаточно прав для удаления сделки' }, { status: 403 });
    }

    const order = await prisma.saleOrder.findUnique({ where: { id: Number(id) } });
    if (!order) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
    }

    if (order.status === 'SHIPPED' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Отгруженный заказ может удалить только Главный Администратор' }, { status: 403 });
    }

    await prisma.saleOrder.delete({
      where: { id: Number(id) },
    });

    await createAuditLog(user.id, 'DELETE_SALE_ORDER', `Удален заказ покупателя ${order.orderNumber}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sales error:', error);
    return NextResponse.json({ error: 'Failed to delete sale order' }, { status: 500 });
  }
}
