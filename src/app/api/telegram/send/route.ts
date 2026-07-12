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

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Telegram bot token tanimli degil (TELEGRAM_BOT_TOKEN env veya club.telegramBotToken)' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
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
      console.error('[telegram] API error:', result);
      return NextResponse.json(
        {
          ok: false,
          error: result.description || `Telegram API ${response.status}`,
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
    // eslint-disable-next-line no-console
    console.error('[telegram] send error:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}
