
'use client';

/**
 * @fileOverview Telegram Bot Service
 * Handles sending real-time notifications to players.
 */

export interface TelegramNotification {
  botToken: string;
  chatId: string;
  message: string;
}

/**
 * Sends a message via the Telegram Bot API.
 * Note: In a production environment, this should be handled by a secure 
 * background function or a server-side route to protect the Bot Token.
 */
export async function sendTelegramNotification({ botToken, chatId, message }: TelegramNotification) {
  if (!botToken || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId.startsWith('@') ? chatId : chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      console.error('Telegram API error:', await response.text());
    }
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

/**
 * Formats a match notification message
 */
export function formatMatchLiveMessage(tournamentName: string, court: number, teamA: string, teamB: string, category: string) {
  return `
🚀 <b>MATCH LIVE!</b> 🎾

<b>Tournament:</b> ${tournamentName}
<b>Category:</b> ${category}
<b>Court:</b> ${court}

<b>Match:</b> ${teamA} vs ${teamB}

Please proceed to your assigned court immediately. Good luck!
  `;
}
