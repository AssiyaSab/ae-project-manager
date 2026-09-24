import { prisma } from './src/lib/db';

async function main() {
    const users = await prisma.user.findMany({
        select: { name: true, login: true, role: true }
    });
    console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
