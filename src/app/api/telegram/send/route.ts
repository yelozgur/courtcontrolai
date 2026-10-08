// CourtControl AI — Telegram Send API Route
// Bot token'ini browser'a expose etmemek icin server-side endpoint.
// Token sunucu tarafinda kulup kaydindan veya env'den cozulur.
//
// Token onceligi:
//   1. clubId verilmissa → Firestore clubs/{clubId}.telegramBotToken
//      (sahiplik dogrulamasi: club.ownerId === session.user.firebaseUid)
//   2. TELEGRAM_BOT_TOKEN env degiskeni
//
// Frontend'den cagri:
//   await fetch('/api/telegram/send', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       chatId: '@channel_or_user_id',
//       message: 'MATCH LIVE: Ali vs Veli, Court 1',
//       clubId: 'firestore-club-doc-id',
//     })
//   })

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

interface SendPayload {
  chatId: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  clubId?: string;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

async function resolveTokenFromClub(
  clubId: string,
  firebaseUid: string | null | undefined
): Promise<{ token: string | null; error?: string; status?: number }> {
  if (!firebaseUid) {
    return { token: null };
  }

  let db: import('firebase-admin/firestore').Firestore;
  try {
    const { getAdminFirestore } = await import('@/lib/firebase-admin');
    db = getAdminFirestore();
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[telegram] Firebase Admin unavailable, falling back to env token');
    return { token: null };
  }

  try {
    const clubDoc = await db.collection('clubs').doc(clubId).get();
    if (!clubDoc.exists) {
      return { token: null, error: 'Club not found', status: 404 };
    }

    const club = clubDoc.data();
    if (club?.ownerId !== firebaseUid) {
      return { token: null, error: 'Forbidden', status: 403 };
    }

    const clubToken = club?.telegramBotToken;
    if (typeof clubToken === 'string' && clubToken.trim().length > 0) {
      return { token: clubToken.trim() };
    }

    return { token: null };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[telegram] Firestore club lookup failed:', e instanceof Error ? e.message : 'unknown');
    return { token: null };
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let sentToken = '';

  try {
    const body = (await req.json()) as SendPayload;
    const { chatId, message, parseMode = 'HTML', clubId } = body;

    if (!chatId || !message) {
      return NextResponse.json(
        { ok: false, error: 'chatId ve message zorunlu' },
        { status: 400 }
      );
    }

    let token: string | null | undefined;

    if (clubId) {
      const clubResult = await resolveTokenFromClub(clubId, session.user.firebaseUid);
      if (clubResult.error) {
        return NextResponse.json(
          { ok: false, error: clubResult.error },
          { status: clubResult.status || 400 }
        );
      }
      token = clubResult.token;
    }

    if (!token) {
      token = process.env.TELEGRAM_BOT_TOKEN;
    }

    const usableToken = typeof token === 'string' && token.trim().length > 0 ? token.trim() : '';

    sentToken = usableToken;

    if (!usableToken) {
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
