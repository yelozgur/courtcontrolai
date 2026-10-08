import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendTelegramNotification, formatMatchLiveMessage } from '../telegram-service';
import type { TelegramNotification } from '../telegram-service';

describe('sendTelegramNotification()', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns error when chatId is missing', async () => {
    const result = await sendTelegramNotification({ chatId: '', message: 'hi' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('chatId');
  });

  it('returns error when message is missing', async () => {
    const result = await sendTelegramNotification({ chatId: '123', message: '' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('message');
  });

  it('POSTs to /api/telegram/send and returns ok on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 42 }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendTelegramNotification({
      chatId: '123',
      message: 'hello',
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/telegram/send');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chatId).toBe('123');
    expect(body.message).toBe('hello');
    expect(body.botToken).toBeUndefined();
    expect(Object.keys(body)).not.toContain('botToken');
  });

  it('forwards clubId so the server can resolve the token from the club record', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 7 }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendTelegramNotification({
      chatId: '456',
      message: 'match live',
      clubId: 'club-doc-abc',
    });

    expect(result.ok).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.clubId).toBe('club-doc-abc');
    expect(body.chatId).toBe('456');
    expect(body.botToken).toBeUndefined();
  });

  it('never forwards a caller-supplied token, even if one is smuggled in', async () => {
    // The client no longer has a token to leak. Belt-and-braces: if some caller
    // passes one anyway (or the type is bypassed), it must not reach the wire.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 1 }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendTelegramNotification({
      chatId: '123',
      message: 'hi',
      botToken: 'SECRET_TOKEN_XYZ',
    } as unknown as TelegramNotification);

    const [, init] = fetchMock.mock.calls[0];
    const body = (init as RequestInit).body as string;
    expect(body).not.toContain('SECRET_TOKEN_XYZ');
    expect(body).not.toContain('botToken');

    for (const call of consoleSpy.mock.calls) {
      const serialized = call.map((a) => String(a)).join(' ');
      expect(serialized).not.toContain('SECRET_TOKEN_XYZ');
    }
  });

  it('handles network errors gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendTelegramNotification({ chatId: '123', message: 'hi' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
    consoleSpy.mockRestore();
  });
});

describe('formatMatchLiveMessage()', () => {
  it('contains tournament, category, court, and team names', () => {
    const msg = formatMatchLiveMessage('Summer Padel', 3, 'Alice/Bob', 'Carol/Dave', "Men's Doubles");
    expect(msg).toContain('Summer Padel');
    expect(msg).toContain("Men's Doubles");
    expect(msg).toContain('Court:');
    expect(msg).toContain('3');
    expect(msg).toContain('Alice/Bob');
    expect(msg).toContain('Carol/Dave');
    expect(msg.toUpperCase()).toContain('MATCH LIVE');
  });
});
