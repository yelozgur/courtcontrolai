
'use client';

/**
 * @fileOverview Telegram Notification Helper
 *
 * Frontend bu helper'i kullanir ama ASLA bot token'i gormez.
 * Token server-side /api/telegram/send route'unda kalir.
 * Onceki 'use client' versiyon browser console'dan token
 * yakalanabiliyordu — artik tum istekler server uzerinden gidiyor.
 */

export interface TelegramNotification {
  chatId: string;
  message: string;
  // Opsiyonel: eger club'un kendi bot'u varsa server'a token override gonder
  // (server yine de default env TELEGRAM_BOT_TOKEN'i fallback olarak kullanir)
  botToken?: string;
}

export interface TelegramResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Server-side Telegram API'ye forward eder. Bot token hicbir zaman
 * browser'a gitmez.
 */
export async function sendTelegramNotification({
  chatId,
  message,
  botToken,
}: TelegramNotification): Promise<TelegramResult> {
  if (!chatId || !message) {
    return { ok: false, error: 'chatId ve message zorunlu' };
  }

  try {
    const res = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message, botToken, parseMode: 'HTML' }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      console.error('[telegram] send failed:', data);
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, messageId: data.messageId };
  } catch (e) {
    console.error('[telegram] network error:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * Formats a match notification message
 */
export function formatMatchLiveMessage(
  tournamentName: string,
  court: number,
  teamA: string,
  teamB: string,
  category: string
) {
  return `
🚀 <b>MATCH LIVE!</b> 🎾

<b>Tournament:</b> ${tournamentName}
<b>Category:</b> ${category}
<b>Court:</b> ${court}

<b>Match:</b> ${teamA} vs ${teamB}

Please proceed to your assigned court immediately. Good luck!
  `;
}
