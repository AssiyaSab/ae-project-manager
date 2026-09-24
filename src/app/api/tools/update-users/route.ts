import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { csvData } = await request.json();
    const lines = csvData.trim().split('\n');
    let updatedCount = 0;
    let createdCount = 0;
    let errors = [];

    const dbUsers = await prisma.user.findMany();

    for (const line of lines) {
      if (!line.trim() || line.startsWith('№')) continue;
      
      const parts = line.split(';');
      if (parts.length >= 6) {
        const name = parts[1].trim();
        const login = parts[4].trim();
        const password = parts[5].trim();
        
        const roleRaw = parts[2].trim().toUpperCase();
        let role = 'ENGINEER';
        if (roleRaw.includes('ГИП') || roleRaw.includes('РУКОВОД') || roleRaw.includes('АДМИН')) role = 'ADMIN';
        else if (roleRaw.includes('БУХ')) role = 'ACCOUNTANT';
        else if (roleRaw.includes('СБОР')) role = 'ASSEMBLER';
        else if (roleRaw.includes('МЕНЕДЖЕР')) role = 'MANAGER';

        const isActive = parts[3].trim().toLowerCase() === 'активен';

        // Find by login first, then by name
        let user = dbUsers.find((u: any) => u.login === login) || 
                   dbUsers.find((u: any) => u.name.trim().toLowerCase() === name.toLowerCase()) ||
                   dbUsers.find((u: any) => u.name.replace(/\s+/g, '').toLowerCase() === name.replace(/\s+/g, '').toLowerCase());

        try {
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: { 
                name,
                login, 
                password,
                role,
                isActive
              }
            });
            updatedCount++;
          } else {
            await prisma.user.create({
                data: {
                    name,
                    role,
                    isActive,
                    login,
                    password,
                    phone: null,
                    title: parts[2].trim()
                }
            });
            createdCount++;
          }
        } catch (e: any) {
          errors.push(`Failed for ${name} (${login}): ${e.message}`);
        }
      }
    }

    return NextResponse.json({ success: true, updatedCount, createdCount, errors });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
