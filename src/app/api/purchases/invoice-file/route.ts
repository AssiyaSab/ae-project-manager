import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid purchase id' }, { status: 400 });
    }

    const purchase = await prisma.purchaseRequest.findUnique({
      where: { id },
      select: { id: true, invoiceFileUrl: true, invoiceNumber: true },
    });

    if (!purchase || !purchase.invoiceFileUrl) {
      return NextResponse.json({ error: 'Счет на оплату не найден' }, { status: 404 });
    }

    const fileUrl = purchase.invoiceFileUrl.trim();

    if (fileUrl.startsWith('data:')) {
      const match = fileUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
      if (!match) {
        return NextResponse.json({ error: 'Некорректный формат файла' }, { status: 400 });
      }
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      let ext = 'bin';
      if (mimeType.includes('pdf')) ext = 'pdf';
      else if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
      else if (mimeType.includes('webp')) ext = 'webp';

      const safeFilename = `invoice_${purchase.id}.${ext}`;

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${safeFilename}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return NextResponse.redirect(fileUrl);
    }

    return NextResponse.json({ error: 'Неподдерживаемый формат ссылки на счет' }, { status: 400 });
  } catch (error) {
    console.error('GET /api/purchases/invoice-file error:', error);
    return NextResponse.json({ error: 'Failed to load invoice file' }, { status: 500 });
  }
}
