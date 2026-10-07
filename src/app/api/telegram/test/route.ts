import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface TestPayload {
  chatId?: string;
  testMessage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: TestPayload = await request.json().catch(() => ({}));

    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({
        ok: false,
        error: 'Telegram bot token not configured',
      }, { status: 503 });
    }

    const meRes = await fetch(`${TELEGRAM_API}${token}/getMe`);
    const meData = await meRes.json();

    if (!meData.ok) {
      return NextResponse.json({
        ok: false,
        error: 'Invalid bot token',
        details: meData.description,
      }, { status: 401 });
    }

    let messageResult = null;
    if (body.chatId && body.testMessage) {
      const sendRes = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: body.chatId,
          text: body.testMessage,
          parse_mode: 'HTML',
        }),
      });
      const sendData = await sendRes.json();
      messageResult = {
        sent: sendData.ok,
        chatId: body.chatId,
        messageId: sendData.result?.message_id,
        error: sendData.ok ? null : sendData.description,
      };
    }

    return NextResponse.json({
      ok: true,
      bot: {
        id: meData.result.id,
        username: meData.result.username,
        firstName: meData.result.first_name,
        canJoinGroups: meData.result.can_join_groups,
        canReadAllGroupMessages: meData.result.can_read_all_group_messages,
        supportsInlineQueries: meData.result.supports_inline_queries,
      },
      message: messageResult,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[telegram/test] error:', e instanceof Error ? e.name : 'unknown');
    return NextResponse.json({
      ok: false,
      error: 'Internal error',
    }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
  return NextResponse.json({
    status: 'ok',
    telegramConfigured: hasToken,
  });
}
