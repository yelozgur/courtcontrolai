# CourtControl AI — Test Results

> Bu dosyayı local LLM/agent'ınız (Ollama qwen2.5:7b, llama3.1, vb.) dolduracak.
> Browser automation yaptıktan sonra her test için PASS/FAIL/SKIP + notlar yazın.

**Tarih:** 2026-10-01 (Sprint 8 revival başlangıcı)
**Agent:** Mavis (MiniMax M3) + local Vitest
**Toplam Süre:** ~25 dakika (build + 30 unit test + typecheck + lint)
**Test Ortamı:** macOS 25.6.0, Node 26.0.0, Firebase Emulator 8080/9099/4000, Next.js 9002, M5 Air 32GB

---

## 🧪 Sprint 8 — Unit Tests (Vitest, 30/30 ✅)

> Otomatik, lokal CI-friendly. `npm test` ile her an koşturulur. Bu sonuçlar
> functional testlerden bağımsız; functional testler aşağıdaki A-K tablosunda.

### Sprint 8 Özet Tablosu

| Test Dosyası | Toplam | PASS | FAIL | Süre |
|---|---|---|---|---|
| `src/lib/__tests__/utils.test.ts` | 5 | 5 ✅ | 0 | 3ms |
| `src/lib/__tests__/sports.test.ts` | 4 | 4 ✅ | 0 | 4ms |
| `src/lib/__tests__/ratings.test.ts` | 7 | 7 ✅ | 0 | 2ms |
| `src/lib/__tests__/telegram-service.test.ts` | 6 | 6 ✅ | 0 | 3ms |
| `src/ai/flows/__tests__/bracket-flow.test.ts` | 8 | 8 ✅ | 0 | 2ms |
| **TOPLAM** | **30** | **30** | **0** | **~14ms** |

**Pass Rate:** 100%

### Sprint 8 Bulgu & Fix Listesi

| # | Bulgu | Severity | Fix |
|---|---|---|---|
| 1 | `next lint` 3 unescaped apostrophe (`'`) | low | `participants`, `tournaments`, `results/page.tsx` → `&apos;` |
| 2 | `vitest` jsdom dependency missing | blocker | `npm i -D jsdom @testing-library/jest-dom` + `src/test/setup.ts` |
| 3 | `bracket-flow.ts` 1-participant edge case (boş match üretiyordu) | medium (regression test caught it) | `if (totalRounds === 0)` early-return guard eklendi |

### Sprint 8 Self-Healing Altyapısı (Yeni)

| Bileşen | Dosya | Durum |
|---|---|---|
| Health endpoint | `src/app/api/health/route.ts` | ✅ build pass, typecheck pass |
| Watchdog script | `scripts/watchdog.mjs` | ✅ syntax check pass |
| Test seed | `test-seed.cjs` | ✅ oluşturuldu, idempotent |
| Telegram alert | `scripts/watchdog.mjs` (integrated) | ✅ config: TELEGRAM_BOT_TOKEN + ADMIN_CHAT_ID |
| npm scripts | `package.json` | ✅ `npm run watchdog`, `npm run test:seed` |

**Production deploy için yapılacak:** `.env`'e `TELEGRAM_BOT_TOKEN` + `ADMIN_CHAT_ID` ekle, cron'a `*/5 * * * * cd /path && npm run watchdog` ekle.

---

## 📋 Functional Tests (Manuel/Playwright, henüz koşulmadı)

**Durum:** Sprint 8 sonunda henüz koşulmadı. Functional testler için
önce Firebase emulator kur + test seed çalıştır, ardından tarayıcıdan
veya Playwright ile koştur.

### Çalıştırma Sırası

```bash
# 1. Emulator başlat (terminal 1)
firebase login  # bir kez
npm run emulator  # auth :9099 + firestore :8080 + UI :4000

# 2. Test seed (terminal 2)
npm run test:seed

# 3. Dev server (terminal 3)
npm run dev  # :9002

# 4. Health check
curl http://localhost:9002/api/health

# 5. Manual functional test (browser)
open http://localhost:9002/login
# Email: club@cca.local, Password: test1234
# Yukarıdaki A-K testlerini koştur
```

### Functional Özet (Henüz Boş — Doldurulacak)

| Kategori | Toplam | PASS | FAIL | SKIP | PARTIAL |
|----------|--------|------|------|------|---------|
| A. Auth | 5 | 0 | 0 | 5 | 0 |
| B. Dashboard | 3 | 0 | 0 | 3 | 0 |
| C. Tournaments | 10 | 0 | 0 | 10 | 0 |
| D. Schedule | 8 | 0 | 0 | 8 | 0 |
| E. Roster | 5 | 0 | 0 | 5 | 0 |
| F. Referee | 6 | 0 | 0 | 6 | 0 |
| G. Public | 5 | 0 | 0 | 5 | 0 |
| H. API | 4 | 0 | 0 | 4 | 0 |
| I. Security | 3 | 0 | 0 | 3 | 0 |
| J. i18n | 4 | 0 | 0 | 4 | 0 |
| K. Performance | 3 | 0 | 0 | 3 | 0 |
| **TOPLAM** | **60** | **0** | **0** | **60** | **0** |

**Pass Rate:** 0% (henüz koşulmadı)

> **Not:** Functional testler Sprint 11'de Playwright ile otomatize edilecek.
> Şimdilik tarayıcıdan manuel koşturarak bu tabloyu doldurabilirsin.

## Detaylı Sonuçlar

### A. AUTH

#### A1. Login - Club Owner

## Detaylı Sonuçlar

### A. AUTH

#### A1. Login - Club Owner
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___
- **Adımlar:**
  1. localStorage.clear()
  2. /login'e git
  3. Email "club@cca.local" + Password "test1234" + Sign In
- **Beklenen:** Dashboard'a yönlendirilir, sidebar görünür
- **Gözlemlenen:** ___
- **Notlar:** ___

#### A2. Login - Invalid credentials
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___
- **Adımlar:**
  1. /login
  2. Email "wrong@test.com" + Password "wrong" + Sign In
- **Beklenen:** Hata toastu, login sayfasında kalır
- **Gözlemlenen:** ___
- **Notlar:** ___

#### A3. Login - Referee
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### A4. Logout
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### A5. Locale auto-detect + persist
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

### B. DASHBOARD

#### B1. Club Owner Dashboard
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### B2. Sidebar i18n (TR)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### B3. Sidebar i18n (EN)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

### C. TOURNAMENTS

#### C1. Tournament List (TR)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### C2. Tournament List (Empty state)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP  *(Yeni club oluştur veya skip)*
- **Süre:** ___

#### C3. Tournament Create (Wizard)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### C4. Tournament Edit (Category Dialog)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### C5. Tournament Public Listing
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### C6. Tournament Registration (Player)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### C7. Tournament Registration Validation
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### C8. Tournament Status Filter
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### C9. Tournament Card Links
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### C10. Tournament Delete (Admin)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP  *(Admin yetkisi gerekli)*
- **Süre:** ___

### D. SCHEDULE

#### D1. Bracket Generation
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### D2. AI Auto-Schedule (Quota Check)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### D3. AI Quota (3rd call)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### D4. AI Quota Reached (4th call)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### D5. Cross-Day Carryover - Multi-day
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### D6. Cross-Day Carryover - Single Day
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP  *(Tek günlük turnuva gerekli)*
- **Süre:** ___

#### D7. Manual Match Creation
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### D8. Schedule Locale (TR/EN)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

### E. ROSTER

#### E1. Roster List
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### E2. Add Player (Manual)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### E3. Edit Player
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### E4. Remove Player (Cancel)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### E5. Remove Player (Confirm)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

### F. REFEREE

#### F1. Referee Console Access
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### F2. Venue Assignment
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### F3. Score Update
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### F4. Match Finalize (Winner Propagation)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### F5. Match Finalize (Tournament Complete)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP  *(Tüm maçlar tamamlanmış olmalı)*
- **Süre:** ___

#### F6. Telegram Notify (No Token)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

### G. PUBLIC PAGES

#### G1. Public Leaderboard
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### G2. Public Bracket
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### G3. Public Bracket (No Bracket)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### G4. Public Results (In Progress)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### G5. Public Results (Completed)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP  *(F5 sonrası)*
- **Süre:** ___

### H. API ENDPOINTS

#### H1. Firestore Proxy (Top-level)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Komut:** `curl /api/firestore/ratings?limit=2`
- **Beklenen:** 200, 2 doc
- **Gözlemlenen:** ___

#### H2. Firestore Proxy (Subcollection)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Komut:** `curl /api/firestore/tournaments/{id}/registrations?limit=5`
- **Beklenen:** 200, 3 doc
- **Gözlemlenen:** ___

#### H3. Telegram Test (Health Check)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Komut:** `curl /api/telegram/test`
- **Beklenen:** 200, telegramConfigured:false
- **Gözlemlenen:** ___

#### H4. Telegram Test (Invalid Token)
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Komut:** `curl -X POST /api/telegram/test -d '{"botToken":"123:fake"}'`
- **Beklenen:** 401
- **Gözlemlenen:** ___

### I. SECURITY

#### I1. Rules - Public Read
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### I2. Rules - Unauthenticated Write Rejected
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### I3. Rules - Cross-tenant Isolation
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP  *(İkinci club oluştur)*
- **Süre:** ___

### J. I18N

#### J1. Login Page TR
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### J2. Login Page EN
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### J3. LocaleSwitcher Visibility
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

#### J4. Locale Switch Round-trip
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___

### K. PERFORMANCE

#### K1. Initial Load
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___
- **Threshold:** < 3s

#### K2. Data Refresh
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___
- **Threshold:** < 2s

#### K3. API Response Time
- **Sonuç:** [ ] PASS  [ ] FAIL  [ ] SKIP
- **Süre:** ___
- **Threshold:** < 500ms

---

## 🐛 Bulunan Bug'lar (varsa)

| Test ID | Hata | Öncelik | Çözüm önerisi |
|---------|------|---------|---------------|
| ___ | ___ | High/Med/Low | ___ |
| ___ | ___ | ___ | ___ |

## 📊 Özet İstatistikler

- **Toplam Test:** 60
- **Pass Rate:** ___%
- **Ortalama Süre:** ___s / test
- **Toplam Süre:** ___ dakika
- **En Hızlı Test:** ___ (A5 — locale persist)
- **En Yavaş Test:** ___

## 💡 Agent Notları

[Local LLM/agent'ın eklediği notlar, gözlemler, öneriler]

---

**Test tamamlandığında bu dosyayı kullanıcıya teslim edin, birlikte değerlendirelim.**
