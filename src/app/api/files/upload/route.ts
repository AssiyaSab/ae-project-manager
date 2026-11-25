import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { validateAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = String(formData.get('folder') || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');

    if (!file) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const blob = await put(`${folder}/${Date.now()}_${safeName}`, buffer, {
        access: 'public',
        addRandomSuffix: true,
        contentType: file.type || 'application/octet-stream',
      });
      return NextResponse.json({ url: blob.url, storage: 'vercel-blob' });
    }

    // Fallback для локальной разработки без BLOB_READ_WRITE_TOKEN
    const mimeType = file.type || 'application/octet-stream';
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    return NextResponse.json({ url: dataUrl, storage: 'inline-fallback' });
  } catch (error: any) {
    console.error('POST /api/files/upload error:', error);
    return NextResponse.json({ error: error?.message || 'Ошибка загрузки файла' }, { status: 500 });
  }
}
