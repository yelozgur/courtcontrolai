// CourtControl AI — Telegram Send API Route
// Bot token'ini browser'a expose etmemek icin server-side endpoint.
// Onceki 'use client' telegram-service.ts'in guvenli versiyonu.
//
// ENV: TELEGRAM_BOT_TOKEN (opsiyonel, club bazli override edilebilir)
//
// Frontend'den cagri:
//   await fetch('/api/telegram/send', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       chatId: '@channel_or_user_id',
//       message: 'MATCH LIVE: Ali vs Veli, Court 1',
//       // Istege bagli: club-level bot token override
//       botToken: club.telegramBotToken
//     })
//   })

import { NextRequest, NextResponse } from 'next/server';

interface SendPayload {
  chatId: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  // Eger club'un kendi bot token'i varsa onu kullan, yoksa default ENV
  botToken?: string;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

export async function POST(req: NextRequest) {
  // Hoisted so the catch block can redact the token without re-parsing the body.
  let sentToken = '';

  try {
    const body = (await req.json()) as SendPayload;
    const { chatId, message, parseMode = 'HTML', botToken: clubToken } = body;

    if (!chatId || !message) {
      return NextResponse.json(
        { ok: false, error: 'chatId ve message zorunlu' },
        { status: 400 }
      );
    }

    // Token onceligi: 1) club-level (request'ten) 2) default ENV
    const token = clubToken || process.env.TELEGRAM_BOT_TOKEN;

    // A blank/whitespace-only value counts as absent, so a half-configured
    // deployment still fails closed here instead of calling Telegram with junk.
    const usableToken = typeof token === 'string' && token.trim().length > 0 ? token.trim() : '';

    sentToken = usableToken;

    if (!usableToken) {
      // 400, not 500: the request cannot succeed as submitted because the caller
      // (club owner/operator) has not provided a usable bot credential. It is a
      // fixable configuration fault on the caller's side, never a server crash.
      return NextResponse.json(
        { ok: false, error: 'Telegram bot token tanimli degil (TELEGRAM_BOT_TOKEN env veya club.telegramBotToken)' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.telegram.org/bot${usableToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: parseMode,
        }),
      }
    );

    const result = (await response.json()) as TelegramApiResponse;

    if (!response.ok || !result.ok) {
      // eslint-disable-next-line no-console
      console.error('[telegram] API error:', redact(result.description ?? 'unknown', usableToken));
      return NextResponse.json(
        {
          ok: false,
          error: redact(result.description || `Telegram API ${response.status}`, usableToken),
          error_code: result.error_code,
        },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: result.result?.message_id,
    });
  } catch (e) {
    // Network/parse failures are upstream problems: report 502 and make sure the
    // token (which lives in the request URL) can never reach the client.
    // eslint-disable-next-line no-console
    console.error('[telegram] send error:', e instanceof Error ? e.name : 'unknown');
    return NextResponse.json(
      {
        ok: false,
        error: redact(e instanceof Error ? e.message : 'Telegram API is unreachable', sentToken),
      },
      { status: 502 }
    );
  }
}

/** Remove any occurrence of the bot token from a string bound for the client. */
function redact(message: string, token: string): string {
  const trimmed = token.trim();
  return trimmed.length > 0 ? message.split(trimmed).join('[redacted]') : message;
}
