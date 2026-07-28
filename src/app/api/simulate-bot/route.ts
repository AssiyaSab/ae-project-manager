import { NextResponse } from 'next/server';
import { handleIncomingBotMessage } from '@/lib/bot-logic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, text } = body;
    
    if (!phone || !text) {
      return NextResponse.json({ error: 'phone and text are required' }, { status: 400 });
    }

    const botResponse = await handleIncomingBotMessage({ phone }, text);
    return NextResponse.json(botResponse);
  } catch (error) {
    console.error('POST /api/simulate-bot error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
