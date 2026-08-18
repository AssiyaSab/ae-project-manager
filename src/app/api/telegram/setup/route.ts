import { NextRequest, NextResponse } from 'next/server';
import { setTelegramWebhook, getTelegramWebhookInfo } from '@/lib/telegram';

export async function GET(req: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: 'TELEGRAM_BOT_TOKEN is not defined in environment variables.',
        },
        { status: 400 }
      );
    }

    // Determine the base URL
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (host ? `${proto}://${host}` : 'https://ae-project-manager-nu.vercel.app');

    const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;

    // 1. Set the webhook
    const setResult = await setTelegramWebhook(webhookUrl);

    // 2. Query the updated webhook info
    const infoResult = await getTelegramWebhookInfo();

    return NextResponse.json({
      success: setResult.ok,
      configuredUrl: webhookUrl,
      setWebhookResponse: setResult,
      currentWebhookInfo: infoResult,
      message: setResult.ok
        ? '✅ Telegram Webhook successfully connected to Vercel!'
        : '❌ Failed to set Telegram Webhook.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
