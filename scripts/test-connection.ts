import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function test() {
  console.log('Попытка подключения к базе данных...');
  try {
    const count = await prisma.user.count();
    console.log(`Подключение успешно! Количество пользователей в БД: ${count}`);
  } catch (err) {
    console.error('Ошибка подключения:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
