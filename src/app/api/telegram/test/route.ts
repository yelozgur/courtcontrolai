// CourtControl AI: Telegram integration test endpoint
//
// Bu endpoint Telegram bot token'inin gecerli olup olmadigini kontrol eder.
// Test message gonderir (chat_id gerekli), sadece bot info'yu alir.
//
// Frontend'den cagri:
//   await fetch('/api/telegram/test', { method: 'POST' })
//
// Production'da bu endpoint'i rate-limit altina almak veya admin-only yapmak
// onerilir (TODO: middleware/auth integration).

import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface TestPayload {
  botToken?: string;
  chatId?: string;
  testMessage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TestPayload = await request.json().catch(() => ({}));
    const token = body.botToken || process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({
        ok: false,
        error: 'No bot token',
        message: 'TELEGRAM_BOT_TOKEN env variable or botToken field required',
      }, { status: 400 });
    }

    // 1) Bot info'yu al — token gecerli mi?
    const meRes = await fetch(`${TELEGRAM_API}${token}/getMe`);
    const meData = await meRes.json();

    if (!meData.ok) {
      return NextResponse.json({
        ok: false,
        error: 'Invalid bot token',
        details: meData.description,
        hint: 'BotFather\'dan yeni token al: https://t.me/BotFather',
      }, { status: 401 });
    }

    // 2) Opsiyonel: test message gonder
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
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: 'Internal error',
      message: e.message,
    }, { status: 500 });
  }
}

export async function GET() {
  // Health check — token set mi diye
  const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
  return NextResponse.json({
    status: 'ok',
    telegramConfigured: hasToken,
    hint: hasToken
      ? 'POST to this endpoint to verify the token works.'
      : 'Set TELEGRAM_BOT_TOKEN env variable, or send botToken in POST body.',
  });
}
