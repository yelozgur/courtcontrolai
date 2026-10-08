
'use client';

/**
 * @fileOverview Telegram Notification Helper
 *
 * Frontend bu helper'i kullanir ama ASLA bot token'i gormez.
 * Token yalnizca server-side /api/telegram/send route'unda, TELEGRAM_BOT_TOKEN
 * env'inden okunur. Onceki surum istemciden `botToken` aliyordu; bu, route'u
 * anonim bir acik proxy'ye ceviriyordu — herhangi biri kendi token'ini
 * gonderip sunucuyu Telegram'a istek ettirebiliyordu.
 */

export interface TelegramNotification {
  chatId: string;
  message: string;
  clubId?: string;
}

export interface TelegramResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Server-side Telegram API'ye forward eder. Bot token hicbir zaman
 * browser'a girmez, cikmaz.
 */
export async function sendTelegramNotification({
  chatId,
  message,
  clubId,
}: TelegramNotification): Promise<TelegramResult> {
  if (!chatId || !message) {
    return { ok: false, error: 'chatId ve message zorunlu' };
  }

  try {
    const res = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message, clubId, parseMode: 'HTML' }),
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
