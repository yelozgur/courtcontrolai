# Durum Doğrulama — Vercel Demo + Scheduler Kararı

**Tarih:** 2026-10-03
**Demo URL:** https://courtcontrolai-firebase-886lv2k72-yelozgur.vercel.app

---

## Aktarılan bilgilerin doğrulaması

| İddia | Sonuç |
|-------|-------|
| Vercel deploy canlı | ✅ HTTP 200, 0.30s, 25 KB, "CourtControl" ×6 |
| Public erişim açık | ✅ SSO koruması yok |
| Railway template hazır | ✅ `~/Personal Projects/railway-templates/` — `template/` + `scripts/` mevcut |
| `projects/courtcontrolai/` boş | ✅ Boş — planla tutarlı (trial'da sadece şablon) |
| OR-Tools M5'te çalışıyor | ✅ `http://127.0.0.1:8500/health` → HTTP 200 |

**Bir düzeltme:** Proje yolu `~/Personal Projects/` değil,
`/Users/ozguryel/Documents/Personal Projects/CourtControlAI/courtcontrolai-firebase`.
`~/Personal Projects/` içinde sadece `railway-templates`, `mcl-poc`,
`hermes-recovery` var. Memory'ye yazıldı.

---

## Demo'nun gerçek durumu — 3 sessiz hata

Demo **açılıyor ve gezilebiliyor**, ama içeride üç şey gerçek değil.
Bunları bilerek girmek gerekir, yoksa müşteri "çalışıyor" sanıp sonra
"neden sonuç üretmiyor" diye döner.

### 1. AI sahte veri döndürüyor (en kritik)

```
GET /api/health  →  checks.ai_quota.ok = false
                    "GOOGLE_GENAI_API_KEY missing or placeholder"
```

`src/ai/genkit.ts:21-29` — anahtar yoksa `model: 'echo'` mock'una düşüyor.
Yani **turnuva planlama optimizasyonu, AI destekli her akış sahte cevap üretiyor.**
Müşteri "AI ile optimize ediyor" sanır, çalışmıyor.

**Düzeltme:** Vercel'e `GOOGLE_GENAI_API_KEY` ekle. Google AI Pro aboneliğin
varsa anahtar hazır. Yoksa AI özelliklerini demo sırasında kapatmak daha dürüst.

### 2. Scheduler devrede değil

```
POST /api/scheduler/solve  →  503 {"error":"firebase_not_configured"}
```

`src/app/api/scheduler/solve/route.ts:23`:
```ts
const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://127.0.0.1:8500';
```
Vercel'de `SCHEDULER_URL` tanımsız → `127.0.0.1:8500`'a düşer → Vercel
container'ında o adres **kendi kendine** → 503.

`apphosting.yaml`'da da `SCHEDULER_URL` **yok**.

### 3. Health endpoint'i kendi kendisiyle çelişiyor

```json
"checks": {
  "process":   { "ok": true },
  "env":       { "ok": true },
  "scheduler": { "ok": true, "mode": "dev", "note": "SCHEDULER_URL not set (dev mode)" },
  "ai_quota":  { "ok": false }
}
```

`scheduler.ok: true` ama `mode: dev` — yani "çalışıyor" değil, "yapılandırılmamış".
`ai_quota.ok: false` ama `ok: false` zaten. Bu, Vercel'de **hiçbir şeyin
gerçekten yapılandırılmadığını** gösteriyor; `env.ok: true` sadece Firebase
key'lerinin `process.env`'de bulunduğunu doğruluyor.

**Bu üçü deploy öncesi karar gerektiriyor.**

---

## Scheduler kararı — 4 seçenek

`apphosting.yaml`'a `SCHEDULER_URL` eklenmesi şart. Değeri ne olacağı?

### A. Railway'e taşı (önerilen, planla uyumlu)
```
SCHEDULER_URL=https://<scheduler-service>.railway.app
```
- M5 Air'den bağımsız, gerçek production
- Planlanan mimari zaten bunu söylüyor
- **Ama:** Railway trial'da usage oluşturur → "Credit Usage olmasın" direktifi
  ile çelişir. Deploy'u Hobby upgrade sonrasına bırakmak gerekir.
- Bu arada Vercel'de scheduler **çalışmaz**

### B. Vercel'de Python serverless
- Vercel Python runtime destekliyor ama OR-Tools native bağımlılıkları sorunlu
- Cold start süresi turnuva planlamada kabul edilemez
- **Önermem** — riski yüksek, kazancı düşük

### C. M5 Air'de public erişim aç
- Cloudflare Tunnel veya Tailscale + public hostname
- **Risk:** ev ağındaki bir servise internete açmak. `api.telegram/send` zaten
  açık relay riski taşıyor, bir de scheduler eklenince saldırı yüzeyi artar
- Demo için geçici, production için kabul edilemez

### D. Demo sırasında scheduler'ı kapat
- `/api/scheduler/solve` düzgün bir mesaj dönsün:
  *"Takvim optimizasyonu demo sırasında kullanılamıyor"*
- **En dürüst seçenek.** Müşteriye yarım çalışan bir özellik göstermektense
  kapalı olduğunu söylemek daha iyi.
- Kod değişikliği: `SCHEDULER_URL` yoksa `mode: 'disabled'` dön, 503 yerine
  anlaşılır mesaj ver.

---

## Demo için tavsiye

| Öncelik | Aksiyon |
|---------|---------|
| 1 | `GOOGLE_GENAI_API_KEY` ekle → AI gerçekten çalışsın |
| 2 | Scheduler için **A** veya **D** seç |
| 3 | `TELEGRAM_BOT_TOKEN` isteğe bağlı (bot çalışmayacak) |
| 4 | Authorized domain'e Vercel domain'ini ekle → login çalışsın |

**Şu an login bile çalışmıyor olabilir** — Firebase Console → Authentication →
Authorized domains'e `courtcontrolai-firebase-886lv2k72-yelozgur.vercel.app`
eklenmeli. Eklenmemişse `auth/authorized-domain` hatası verir.
