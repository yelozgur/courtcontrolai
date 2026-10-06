import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const startTime = Date.now();

function getProcessHealth() {
  const mem = process.memoryUsage();
  return {
    ok: true,
    uptime_s: Math.floor(process.uptime()),
    rss_mb: Math.round(mem.rss / 1024 / 1024),
    heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
  };
}

function getEnvHealth() {
  const firebaseConfigured = !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
  
  const aiKey = process.env.GOOGLE_GENAI_API_KEY;
  const aiKeyConfigured = !!aiKey && 
    aiKey !== 'your_google_ai_key_here' && 
    aiKey !== 'your-google-ai-key-here' &&
    !aiKey.startsWith('placeholder');

  return {
    ok: firebaseConfigured,
    firebase_configured: firebaseConfigured,
    firebase_config_source: firebaseConfigured ? 'env' : 'missing',
    ai_key_configured: aiKeyConfigured,
  };
}

function getSchedulerHealth() {
  const schedulerUrl = process.env.SCHEDULER_URL;
  if (!schedulerUrl) {
    return {
      ok: true,
      mode: 'dev',
      note: 'SCHEDULER_URL not set (dev mode)',
    };
  }
  return {
    ok: true,
    mode: 'production',
    url: schedulerUrl,
  };
}

function getAiQuotaHealth() {
  const aiKey = process.env.GOOGLE_GENAI_API_KEY;
  const hasValidKey = !!aiKey && 
    aiKey !== 'your_google_ai_key_here' && 
    aiKey !== 'your-google-ai-key-here' &&
    !aiKey.startsWith('placeholder');

  if (!hasValidKey) {
    return {
      ok: false,
      error: 'GOOGLE_GENAI_API_KEY missing or placeholder',
    };
  }

  return {
    ok: true,
    model: process.env.GOOGLE_AI_MODEL || 'googleai/gemini-2.5-flash-lite',
  };
}

export async function GET() {
  const processHealth = getProcessHealth();
  const envHealth = getEnvHealth();
  const schedulerHealth = getSchedulerHealth();
  const aiQuotaHealth = getAiQuotaHealth();

  const allOk = processHealth.ok && envHealth.ok && schedulerHealth.ok && aiQuotaHealth.ok;

  const response = {
    ok: allOk,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      process: processHealth,
      env: envHealth,
      scheduler: schedulerHealth,
      ai_quota: aiQuotaHealth,
    },
    uptime_s: Math.floor((Date.now() - startTime) / 1000),
  };

  return NextResponse.json(response, {
    status: allOk ? 200 : 503,
  });
}
