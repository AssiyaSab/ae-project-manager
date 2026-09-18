import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { login, password } = body;

    if (!login || !password) {
      return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    // Проверяем мастер-пароль админа
    const expectedAdmin = process.env.ADMIN_PASSWORD || 'AE_ADMIN_2026';
    if (login === 'admin' && password === expectedAdmin) {
      return NextResponse.json({
        id: 0,
        name: 'ГИП (Мастер-аккаунт)',
        role: 'ADMIN',
        isActive: true,
        login: 'admin'
      });
    }

    // Ищем пользователя в БД
    const user = await prisma.user.findFirst({
      where: {
        login: login,
        password: password, // В реальном проекте здесь должен быть хэш, но для ТЗ оставляем как есть
        isActive: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Неверный логин или пароль, либо аккаунт деактивирован' }, { status: 401 });
    }

    // Логируем успешный вход
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        details: 'Успешная авторизация в веб-панели'
      }
    });

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error('POST /api/auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
