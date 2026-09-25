import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from './src/lib/db';
async function main() {
    const users = await prisma.user.findMany({ select: { name: true, login: true, password: true } });
    console.log(users.slice(0, 5));
}
main().finally(() => prisma.$disconnect());
