import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function validateAuth(request: Request) {
  const login = request.headers.get('x-auth-login');
  const password = request.headers.get('x-auth-password') || request.headers.get('x-admin-password');

  const expectedAdmin = process.env.ADMIN_PASSWORD || 'AE_ADMIN_2026';
  if ((login === 'admin' || !login) && password === expectedAdmin) return { id: 0, role: 'ADMIN' };

  if (login && password) {
    const user = await prisma.user.findFirst({ where: { login, password, isActive: true } });
    if (user) return user;
  }
  
  // Backward compatibility with generic employee password
  const expectedMember = process.env.MEMBER_PASSWORD || 'AE_EMPLOYEE_2026';
  if (password === expectedMember) return { id: 999, role: 'ENGINEER' };

  return null;
}

export async function validateAdmin(request: Request) {
  const user = await validateAuth(request);
  if (user && user.role === 'ADMIN') return user;
  return null;
}

export async function validateManager(request: Request) {
  const user = await validateAuth(request);
  if (user && (user.role === 'ADMIN' || user.role === 'MANAGER')) return user;
  return null;
}

export async function validateApprover(request: Request) {
  const user = await validateAuth(request);
  if (user && (user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'ACCOUNTANT')) return user;
  return null;
}

export async function createAuditLog(userId: number | null, action: string, details: string) {
  if (userId === 0) userId = null; // Admin master password -> null
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details
      }
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
