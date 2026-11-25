import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getMimeTypeFromPath(filePath: string, fallback?: string | null): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (fallback && fallback !== 'application/octet-stream') return fallback;
  return 'application/octet-stream';
}

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { searchParams } = new URL(request.url);
  const queryLogin = searchParams.get('login');
  const queryPass = searchParams.get('pass');

  let authUser = await validateAuth(request);
  if (!authUser && (queryPass || queryLogin)) {
    const headers = new Headers(request.headers);
    if (queryLogin) headers.set('x-auth-login', queryLogin);
    if (queryPass) {
      headers.set('x-auth-password', queryPass);
      headers.set('x-admin-password', queryPass);
    }
    authUser = await validateAuth(new Request(request.url, { headers }));
  }

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileId } = await context.params;
  if (!fileId) {
    return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  try {
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { cache: 'no-store' }
    );
    const getFileData = await getFileRes.json();
    if (!getFileData.ok || !getFileData.result?.file_path) {
      return NextResponse.json({ error: 'Файл не найден в Telegram' }, { status: 404 });
    }

    const filePath: string = getFileData.result.file_path;
    const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
      cache: 'no-store',
    });
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Не удалось скачать файл из Telegram' }, { status: 502 });
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const contentType = getMimeTypeFromPath(filePath, fileRes.headers.get('content-type'));
    const filename = filePath.split('/').pop() || `telegram_${fileId}`;
    const isDownload = searchParams.get('download') === '1';

    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('GET /api/files/telegram/[fileId] error:', error);
    return NextResponse.json({ error: 'Failed to proxy Telegram file' }, { status: 500 });
  }
}
