# CourtControl AI — Functional Test Plan

> **Amaç:** Bu planı local LLM/agent'ınıza (Ollama qwen2.5:7b, llama3.1, vb.) vererek
> browser automation ile functional testleri uygulayın. Sonuçları `TEST_RESULTS.md`'ye
> yazın. Biz değerlendirelim.

## 🛠️ Test Ortamı

### Ön Koşullar
- Emulator'lar çalışıyor: `lsof -i :8080 -i :9099 -i :9002` (3 port LISTEN olmalı)
- Next.js dev server: `http://localhost:9002`
- Test seed: `node test-seed.cjs` (idempotent, eksik user'ları ekler)

### Test Kullanıcıları (şifre: `test1234`)
```
admin@cca.local      → Platform Admin
club@cca.local       → Test Club Owner
referee@cca.local    → Referee
player1@cca.local    → Player 1 (M / Intermediate)
player2@cca.local    → Player 2 (L / Advanced)
player3@cca.local    → Player 3 (XL / Beginner)
```

### Önemli ID'ler
```
Test Club ID:   kCxbbwrIu3rjQGLtUzII  (değişebilir, emulator restart sonrası)
Tournament ID:  hhDjr2XKS2Tk0pGarPWU  (Summer Padel Series 2026, draft, 3 gün)
```

### Test Sonuç Formatı
Her test için:
- **PASS** ✅ — beklenen sonuçla eşleşti
- **FAIL** ❌ — beklenen sonuçtan farklı, hata detayı
- **SKIP** ⏭️ — precondition karşılanmadı (örn. tournament generate edilmedi)
- **PARTIAL** ⚠️ — bazı adımlar geçti, bazıları hata

Sonuçları `TEST_RESULTS.md`'ye yazın.

---

## 🧪 Test Kategorileri

### A. AUTH (5 test)

**A1. Login - Club Owner**
- Pre: Tarayıcı aç, `localStorage.clear()`, `http://localhost:9002/login`
- Steps: Email "club@cca.local" + Password "test1234" + "Giriş Yap" tıkla
- Expected: Dashboard'a yönlendirilir, sidebar "Maç Planlayıcı" görünür
- Locale: TR (default)

**A2. Login - Invalid credentials**
- Pre: `/login`
- Steps: Email "wrong@test.com" + Password "wrong" + Sign In
- Expected: Hata toastu (auth/invalid-credential), login sayfasında kalır

**A3. Login - Referee**
- Pre: `/login`, logout
- Steps: Email "referee@cca.local" + Password "test1234" + Sign In
- Expected: Dashboard'a yönlendirilir (club role'den farklı görünüm olabilir)

**A4. Logout**
- Pre: Login olmuş
- Steps: Sağ üst Account dropdown → "Log Out" / "Çıkış" tıkla
- Expected: Login sayfasına yönlendirilir, user state sıfırlanır

**A5. Locale auto-detect + persist**
- Pre: Fresh browser, localStorage.clear()
- Steps: Login ol, Globe (TR) tıkla → "🇬🇧 English" seç, sayfayı yenile
- Expected: Tüm string'ler İngilizce, Globe (EN) gösterir

---

### B. DASHBOARD (3 test)

**B1. Club Owner Dashboard**
- Pre: club@cca.local login
- Steps: `/dashboard` sayfası
- Expected: "Tournament Command" başlığı, tournament cards, recent matches, stats

**B2. Sidebar i18n (TR)**
- Pre: club@cca.local login, TR locale
- Steps: Sol sidebar görüntüle
- Expected: "Ana Menü", "Konsol", "Turnuvalar", "Maç Planlayıcı", "Kulüp Roster",
  "Mekan Girişi", "Partnerler", "Ayarlar"

**B3. Sidebar i18n (EN)**
- Pre: club@cca.local login, EN locale (Globe'dan seç)
- Steps: Sol sidebar görüntüle
- Expected: "Main Menu", "Console", "Tournaments", "Match Planner", "Club Roster",
  "Venue Arrival", "Partners", "Settings"

---

### C. TOURNAMENTS (10 test)

**C1. Tournament List (TR)**
- Pre: club@cca.local login
- Steps: `/dashboard/tournaments`
- Expected: "Turnuvalarınız" başlığı, 1 tournament kartı (Summer Padel Series 2026)

**C2. Tournament List (Empty state)**
- Pre: Başka bir club olmadan (skip if no other club)
- Steps: Farklı bir club ile login, `/dashboard/tournaments`
- Expected: "Henüz Turnuva Yok" + "İlk turnuvanızı oluşturun"

**C3. Tournament Create (Wizard)**
- Pre: club@cca.local login
- Steps: `/tournaments/new` → Form doldur:
  - Name: "Test Tournament 2026"
  - Description: "E2E test"
  - Start Date: 2026-09-01
  - End Date: 2026-09-03
  - Sport: padel
  - Location: "Nicosia Central" (Enter veya Add)
  - Total Courts: 4
  - Step 2: Add Category (Dialog) → "Pro Men's", Single Elim, 3 sets, Open, team-based off
  - Step 3: Match Duration 60
  - Step 4: Launch
- Expected: Turnuva oluşturulur, dashboard'a yönlendirilir, toast: "Tournament Launched!"

**C4. Tournament Edit (Category Dialog)**
- Pre: C3'te oluşturulan turnuva (veya Summer Padel Series draft)
- Steps: `/dashboard/tournaments/{id}/edit` → Categories tab
  - "Add Category" butonuna tıkla (Dialog açılmalı, inline değil)
  - Name: "Mixed Doubles", Format: Single Elim, Sets: 3, Age: Open, Team: ON
  - "Add Category" tıkla
- Expected: Dialog kapanır, kategori listede görünür

**C5. Tournament Public Listing (Anonymous)**
- Pre: Logout, `/tournaments` (public)
- Steps: Tournament kartlarına bak
- Expected: Registration durumuna göre "Register Now" veya "View Arena" butonu;
  altında "Leaders" / "Bracket" / "Results" linkleri

**C6. Tournament Registration (Player)**
- Pre: Logout, `/tournaments/hhDjr2XKS2Tk0pGarPWU/register` (veya C3 turnuvası)
- Steps: Form doldur (player1@cca.local + test1234 ile giriş yap),
  - Name, Email (auto-fill), Skill: Intermediate, Category seç
  - Welcome pack: T-shirt M, Shorts L, Shoe EU 42
  - "Continue to Payment"
- Expected: Validation geçer, "Continue to Payment" toast/screen

**C7. Tournament Registration Validation**
- Pre: C6 aynı sayfa
- Steps: Welcome pack boyutlarından birini boş bırak, "Continue" tıkla
- Expected: Hata toastu: "Size Required - Please complete: ..."

**C8. Tournament Status Filter (Tournament List)**
- Pre: club@cca.local login, `/dashboard/tournaments`
- Steps: Search box'ta "Summer" yaz
- Expected: "Summer Padel Series 2026" görünür, diğerleri filtrelenir

**C9. Tournament Card Links (Public)**
- Pre: Logout, `/tournaments`
- Steps: Bir tournament'ın "Leaders" linkine tıkla
- Expected: `/tournaments/{id}/leaderboard` sayfası açılır, 3 player görünür

**C10. Tournament Delete (Admin)**
- Pre: admin@cca.local login
- Steps: `/dashboard/tournaments` → bir turnuvada delete (varsa)
- Expected: Turnuva silinir, listede kalmaz

---

### D. SCHEDULE (8 test)

**D1. Bracket Generation**
- Pre: club@cca.local login, `/dashboard/schedule`
- Steps: Tournament combobox'tan "Summer Padel Series 2026" seç
  - "Generate Bracket" (veya "Bracket Oluştur") tıkla
  - 3-5 saniye bekle
- Expected: Toast: "Bracket Oluşturuldu · 7 maç, 3 round, 3 gün."
  Schedule matrix'te R1 match'leri (pending) görünür

**D2. AI Auto-Schedule (Quota Check)**
- Pre: D1'den sonra, club@cca.local
- Steps: "AI Auto-Schedule" → strategic goals yaz → "Launch Optimizer"
- Expected: AI call başarılı, toast: "AI Direktörü Başarılı", aiUsageCount++

**D3. AI Quota (3rd call)**
- Pre: D2'den sonra
- Steps: AI Auto-Schedule'i 2 kez daha çağır (her bir → 2. ve 3. call)
- Expected: 3/3'e ulaşır, hata yok

**D4. AI Quota Reached (4th call)**
- Pre: D3'ten sonra
- Steps: 4. kez AI Auto-Schedule dene
- Expected: Toast: "AI Kotası Doldu · 3 ücretsiz AI optimizasyonu kullandınız. ..."

**D5. Cross-Day Carryover - Multi-day**
- Pre: D1'den sonra, multi-day turnuva
- Steps: "Consolidate" (veya "Birleştir") tıkla
- Expected: Toast: "Çapraz Gün Aktarımı Tamamlandı · N bekleyen maç sonraki günlere taşındı."
  Pending match'lerin scheduledDate'leri sonraki güne kayar

**D6. Cross-Day Carryover - Single Day**
- Pre: Tek günlük turnuva (varsa)
- Steps: Consolidate tıkla
- Expected: Toast: "Tek Günlük Turnuva · Çapraz gün aktarımı multi-day turnuvalar için."

**D7. Manual Match Creation**
- Pre: club@cca.local, schedule page
- Steps: "Manual Match" (veya "Manuel Maç") → form doldur → "Save"
- Expected: Match eklenir, matrix'te görünür

**D8. Schedule Locale (TR/EN)**
- Pre: club@cca.local login
- Steps: TR'de "Maç Planlayıcı", sonra EN'e switch
- Expected: Tüm toolbar butonları + AI Director dialog TR/EN

---

### E. ROSTER (5 test)

**E1. Roster List**
- Pre: club@cca.local login, `/dashboard/participants`
- Steps: Sayfayı görüntüle
- Expected: 3 player (player1, player2, player3), pack size, skill level

**E2. Add Player (Manual)**
- Pre: club@cca.local
- Steps: "Manual Entry" / "Manuel Giriş" → Name "Test Player", Email "test@cca.local"
  → "Add to Roster" / "Roster'a Ekle"
- Expected: Toast: "Player Added" / "Oyuncu Eklendi", 4 player olur

**E3. Edit Player**
- Pre: E1'den player1'i seç
- Steps: MoreVertical → "Edit Player" → Name "Alice Updated" → "Save Changes"
- Expected: Toast: "Player Updated", listede güncel isim

**E4. Remove Player (Cancel)**
- Pre: E1'den bir player
- Steps: MoreVertical → "Remove from Roster" → "Cancel"
- Expected: Dialog kapanır, player hâlâ listede

**E5. Remove Player (Confirm)**
- Pre: E1'den player3
- Steps: MoreVertical → "Remove" → "Remove" (confirm)
- Expected: Toast: "Player Removed", listede kalmaz

---

### F. REFEREE (6 test)

**F1. Referee Console Access**
- Pre: referee@cca.local login, `/dashboard` → "Match Planner" sidebar (veya doğrudan `/referee/hhDjr2XKS2Tk0pGarPWU`)
- Steps: Tournament'a git
- Expected: Hakem konsolu açılır, "Assign Venue" dropdown boş

**F2. Venue Assignment**
- Pre: F1
- Steps: "Assign Venue" → "Main Venue" (veya ilk location) seç
- Expected: Header'da "COURT 1" badge'i, "Syncing Venue" yazısı kaybolur

**F3. Score Update**
- Pre: F2, R1 match'i seç
- Steps: teamA için + butonu 3 kez tıkla, teamB için 1 kez
- Expected: Skor 3-1 olur, realtime güncellenir

**F4. Match Finalize (Winner Propagation)**
- Pre: F3
- Steps: "Finalize Match" / "Maçı Sonuçlandır" tıkla
- Expected: Toast: "Finalized · X advances to Round 2."
  R2 match'inde teamA veya teamB olarak kazanan görünür

**F5. Match Finalize (Tournament Complete - Last Match)**
- Pre: Tüm maçlar tamamlanmış
- Steps: Son maçı finalize et
- Expected: Toast: "🏆 Turnuva Tamamlandı! · X şampiyon!"
  Tournament status "completed" olur

**F6. Telegram Notify (No Token)**
- Pre: Referee, venue seçili, club'ta telegramBotToken yok
- Steps: "Notify Players" tıkla
- Expected: Hata toastu: "Config Missing - Telegram Bot Token not set in Club Settings."

---

### G. PUBLIC PAGES (5 test)

**G1. Public Leaderboard**
- Pre: Anonymous, `/tournaments/hhDjr2XKS2Tk0pGarPWU/leaderboard`
- Steps: Sayfayı görüntüle
- Expected: "Tournament Standings" başlığı, 3 player (player3=1300, player2=1250, player1=1200)
  Top 3 podium kartları

**G2. Public Bracket**
- Pre: Anonymous, `/tournaments/hhDjr2XKS2Tk0pGarPWU/bracket`
- Steps: Sayfayı görüntüle (D1 sonrası)
- Expected: "Tournament Bracket" başlığı, R1/R2/R3 kolonları, match kartları

**G3. Public Bracket (No Bracket)**
- Pre: Fresh tournament (D1 öncesi)
- Steps: `/tournaments/{freshId}/bracket`
- Expected: "No Bracket Generated" mesajı

**G4. Public Results (In Progress)**
- Pre: Anonymous, `/tournaments/hhDjr2XKS2Tk0pGarPWU/results`
- Steps: Sayfayı görüntüle
- Expected: "In Progress" badge, total/completed/rounds/progress stats

**G5. Public Results (Completed)**
- Pre: F5'ten sonra
- Steps: `/tournaments/{id}/results`
- Expected: "Completed" badge, Champion banner (altın gradient), stats

---

### H. API ENDPOINTS (4 test)

**H1. Firestore Proxy (Top-level collection)**
- Steps: `curl http://localhost:9002/api/firestore/ratings?limit=2`
- Expected: 200, 2 rating doc

**H2. Firestore Proxy (Subcollection)**
- Steps: `curl http://localhost:9002/api/firestore/tournaments/hhDjr2XKS2Tk0pGarPWU/registrations?limit=5`
- Expected: 200, 3 registration doc

**H3. Telegram Test (Health Check)**
- Steps: `curl http://localhost:9002/api/telegram/test`
- Expected: 200, `{"status":"ok","telegramConfigured":false}`

**H4. Telegram Test (Invalid Token)**
- Steps: `curl -X POST http://localhost:9002/api/telegram/test -H "Content-Type: application/json" -d '{"botToken":"123:fake"}'`
- Expected: 401, `{"ok":false,"error":"Invalid bot token"}`

---

### I. SECURITY (3 test)

**I1. Rules - Public Read**
- Steps: Logout, `curl /api/firestore/ratings` (REST)
- Expected: 200 (rules public read OK)

**I2. Rules - Unauthenticated Write Rejected**
- Steps: Logout, `curl -X POST /api/firestore/ratings -d '{...}'`
- Expected: 403 (signedIn gerekli)

**I3. Rules - Cross-tenant Isolation**
- Pre: club@cca.local login, başka bir kulüp turnuvası oluştur
- Steps: club@cca.local ile diğer kulübün turnuvasına erişmeyi dene
- Expected: rules reddeder, 403

---

### J. I18N (4 test)

**J1. Login Page TR**
- Pre: Fresh browser, localStorage.clear(), `/login`
- Expected: "Giriş Yap", "E-posta", "Şifre", "Hesabın yok mu?", "Kayıt Ol"

**J2. Login Page EN**
- Pre: localStorage.setItem("cca_locale", "en"), `/login`
- Expected: "Sign In", "Email", "Password", "Don't have an account?", "Sign Up"

**J3. LocaleSwitcher Visibility**
- Pre: club@cca.local login, dashboard
- Steps: Sağ üst header'ı kontrol et
- Expected: Globe (🌐) ikonu + "tr" veya "en" badge

**J4. Locale Switch Round-trip**
- Pre: club@cca.local login
- Steps: Globe tıkla → "🇬🇧 English" seç, ardından "🇹🇷 Türkçe" seç
- Expected: Sayfa anında TR'ye döner, localStorage'a persist edilir (yenilemede de TR)

---

### K. PERFORMANCE (3 test)

**K1. Initial Load**
- Steps: Tarayıcıda `/dashboard/schedule` (cold load)
- Expected: < 3 saniye tamamen yüklenir (Next.js dev mode)

**K2. Data Refresh**
- Steps: Bir match finalize et, schedule page'i yenile
- Expected: Data < 2 saniye içinde yansır

**K3. API Response Time**
- Steps: `curl -w "%{time_total}" /api/firestore/ratings`
- Expected: < 500ms

---

## 📊 Sonuç Toplama Şablonu

Her test için `TEST_RESULTS.md`'ye şu formatta yazın:

```markdown
### A1. Login - Club Owner
- **Sonuç:** PASS ✅
- **Süre:** 1.2s
- **Notlar:** localStorage temizlendi, TR locale, doğrudan dashboard'a yönlendirildi
- **Ekran:** /tmp/test-a1.png (varsa)

### A2. Login - Invalid credentials
- **Sonuç:** FAIL ❌
- **Hata:** "Email veya şifre hatalı" toastu bekleniyordu, generic error geldi
- **Stack:** page.on('console', ...) → "FirebaseError: auth/invalid-credential"
```

---

## 🎯 Toplam

**60 test case**, 11 kategori:
- A. Auth (5)
- B. Dashboard (3)
- C. Tournaments (10)
- D. Schedule (8)
- E. Roster (5)
- F. Referee (6)
- G. Public (5)
- H. API (4)
- I. Security (3)
- J. i18n (4)
- K. Performance (3)

**Önerilen agent:** Ollama qwen2.5:7b veya llama3.1, Playwright MCP tool ile browser automation yapabilir.

**Süre tahmini:** Tüm testler ~30-60 dakika (agent'ın hızına bağlı).

---

## 📁 Dosyalar

- `TEST_PLAN.md` — bu dosya
- `TEST_RESULTS.md` — sonuçları buraya yaz
- `tests/` — opsiyonel test scripts (agent tarafından oluşturulabilir)

---

**Test başladığında `TEST_RESULTS.md` template'i:**

```markdown
# CourtControl AI — Test Results

**Tarih:** [ISO timestamp]
**Agent:** [model adı, örn. qwen2.5:7b]
**Süre:** [toplam dakika]

## Özet
- Toplam: 60
- PASS: X
- FAIL: Y
- SKIP: Z
- PARTIAL: W
- Pass Rate: X%

## Detaylı Sonuçlar

### A. AUTH
- A1. ✅ PASS
- A2. ✅ PASS
- ...
```
