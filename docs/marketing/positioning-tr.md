# CourtControl AI — Türkiye ve KKTC Pazarı Konumlandırma İncelemesi

**Hedef Kitle:** Kıbrıs Pilot Projesi (UNDP) ve Türkiye Spor Kulübü Yöneticileri / Kulüp Başkanları  
**Tarih:** 2026-10-08  
**Yazar:** marketing-team (Agent `87405f08-d044-46e2-bbd1-dd40b0d932dd`)  
**İncelenen Canlı Üretim Ortamı:** `https://courtcontrolai-firebase.vercel.app` (ve alt sayfaları: `/arena`, `/tournaments`)

---

## 1. Canlı Site ve Mevcut Durum Tespiti

Canlı üretim ortamı (`https://courtcontrolai-firebase.vercel.app`), `/arena` ve `/tournaments` sayfaları doğrudan incelenmiş ve ölçümlenmiştir:

1. **Sıfır Türkçe Karakter:** Kod tabanında `src/i18n/I18nProvider.tsx` varsayılan yerel ayarı `DEFAULT_LOCALE = 'tr'` olarak tanımlamış olmasına rağmen; açılış sayfası (`src/app/page.tsx`), `/arena/page.tsx` ve `/tournaments/page.tsx` bileşenleri `useI18n` kancasını kullanmamakta ve tüm metinleri sabit kodlanmış (hardcoded) İngilizce dizgilerle sunmaktadır.
2. **Kopuk Konumlandırma:** Karşılama rozetinde *"The Multi-Tenant Sports Engine"* / *"SaaS Network Administrator"*, ana başlıkta *"Dominate Your Arena"*, alt başlıkta ise *"The elite sports management hub. Automate complex schedules, broadcast live scores, and grow your player community."* yer almaktadır.
3. **Müşteri Gerçeğiyle Çelişki:** Salı akşamı ligi veya hafta sonu turnuvası düzenleyen bir Türk kulüp başkanı için bu ifadeler soyut, jenerik ve yabancıdır.

---

## 2. Kulüp Sahibinin Kendi Kelimeleriyle Ürünün Adı Nedir?

Proje ve iç kod adı `"CourtControl AI"` veya pazarlama sloganı olan *"The Multi-Tenant Sports Engine"* müşterinin dili değildir.

Bir Türk tenis kulübü, padel tesisi veya spor kulübü başkanı (Kıbrıs UNDP pilotundaki kulüp yöneticisi dahil) meslektaşına bu üründen bahsederken şunu söyler:

> **"Kort ve Turnuva Yönetim Sistemi"**  
> *(veya günlük pratik dilde: **"Turnuva ve Maç Planlama Programı"** / **"Kulüp Fikstür ve Canlı Skor Sistemi"**)*

### Neden?
- Kulüp yöneticisi *"SaaS"* veya *"Engine"* satın almaz.
- Kulüp yöneticisi *"Kortları paylaştıran, fikstürü çeken ve skorları ekrana veren sistemi"* kullanır.
- Ürünün müşterinin zihnindeki yeri: Karmaşık Excel tabloları ve WhatsApp grupları üzerinden yürütülen turnuva kaosunu tek bir dijital ekranda toplayan yönetim aracıdır.

---

## 3. Kulüp Sahibi İlk 10 Saniyede Gerçekte Hangi Değeri Alır?

Mevcut açılış sayfasındaki *"Dominate Your Arena"* (Arenanı Domine Et) ve *"Automate complex schedules"* (Karmaşık takvimleri otomatikleştir) sloganları, salı akşamı ligi koşturan bir kulüp başkanının sorununu çözmez.

### Kulüp Başkanının Gerçek Derdi Nedir?
- Akşam saat 19:00'da 16 maç oynanacaktır ve sadece 4 kort vardır.
- Oyuncular sürekli *"Benim maçım saat kaçta?", "Hangi korttayım?", "Rakibim kim?"* diye mesaj atmaktadır.
- Hakem masasındaki kağıtlar karışmakta, maç gecikmeleri sonraki maçları zincirleme kilitlemektedir.
- Maç bitince skoru tahtaya elle yazmak ve puan durumunu tek tek hesaplamak gerekmektedir.

### İlk 10 Saniyede Verilmesi Gereken Değer Önerisi:
> **"Turnuva fikstürünüzü ve kort dağılımınızı dakikalar içinde kura çekip hazırlayın; canlı skorları kulüp ekranlarına ve oyuncuların cebine anında yayınlayın."**

Kulüp yöneticisi ilk 10 saniyede şunu görmelidir:
1. Turnuva oluşturma ve otomatik eşleşme (kağıt-kalem ve Excel bitti).
2. Kort bazlı canlı maç çizelgesi (kimin nerede oynadığı belli).
3. Hakemin girdiği skorun kulüp TV ekranına ve telefona anında düşmesi (organizasyonel profesyonellik).

---

## 4. Üç Temel Yeteneğin Doğrulanması (Gerçek vs. Aspirasyonel)

Mevcut açılış sayfasında öne sürülen 3 kabiliyet, hem canlı üretim ortamı API'leri hem de kaynak kod üzerinden test edilmiş ve doğrulanmıştır:

### Yetenek 1: Maç Planlama ve Çizelgeleme (AI Scheduling / Match Planner)
- **Mevcut İddia:** *"AI Scheduling — Eliminate manual planning. Our Tournament Director AI handles court allocations and recovery times with Genkit intelligence."*
- **Doğrulama Durumu:** **KISMİ / ŞARTLI**
  - **[UNVERIFIED / DISABLED] — Genkit LLM ile Doğal Dil Planlaması:**  
    *Kanıt:* Canlı üretim ortamında `GET /api/ai/status` çağrısı `503 Service Unavailable` dönmekte ve `{"error":"ai_not_configured","message":"AI features are disabled. GOOGLE_GENAI_API_KEY is not set."}` yanıtını vermektedir. `GET /api/health` çıktısında `checks.ai_quota.ok: false` ve `capabilities.ai: "disabled"` olarak raporlanmaktadır. Dolayısıyla pazarlamada *"Genkit AI / Tournament Director AI"* olarak sunulan LLM tabanlı özellik üretimde kapalıdır ve müşteriye çalışır durumda vaat edilemez.
  - **[VERIFIED] — Algoritmik Fikstür ve OR-Tools Kısıt Çözücü:**  
    *Kanıt:* Kod tabanında deterministik tekli eleme ağacı üretimi (`schedule.generateBracket`) saf TypeScript mantığıyla çalışmaktadır. Ayrıca harici OR-Tools kısıt çözücüsü devrededir (`GET /api/health` -> `checks.scheduler.ok: true, latency_ms: 164`). Kort ve zaman kısıtlarına göre çakışmasız matematiksel planlama mevcuttur.
- **Pazarlama Kararı:** "Yapay zeka her şeyi anlar ve çözer" yerine **"Kort ve saat çakışmalarını önleyen otomatik maç planlayıcı"** denmelidir.

---

### Yetenek 2: Canlı Skor ve Ekran Yayını (Arena Broadcast)
- **Mevcut İddia:** *"Arena Broadcast — Broadcast live scores to stadium screens and guest mobile devices in real-time. Professional results for any club level."*
- **Doğrulama Durumu:** **[VERIFIED]** (Tamamen gerçek ve çalışır durumda)
  - *Kanıt:* `src/app/arena/[id]/page.tsx` Firestore gerçek zamanlı veri akışı (`onSnapshot` / `useDoc` / `useCollection`) ile çalışmaktadır. Hakem konsolundan (`src/app/referee/[id]/page.tsx`) girilen set ve maç skorları anında Firestore'a yazılmakta ve `/arena/[id]` üzerindeki TV ekranı ve misafir mobil arayüzlerine gecikmesiz yansımaktadır. Kort filtreleme, canlı maçlar, tamamlanan maçlar ve yaklaşan maçlar paneli eksiksiz işlemektedir.
- **Pazarlama Kararı:** Bu kabiliyet ürünün en güçlü, en somut ve sahada hemen gösterilebilir (demo edilebilir) kozudur. Ön plana çıkarılmalıdır.

---

### Yetenek 3: Oyuncu Havuzu, Kayıt ve Check-in (Player Circuit)
- **Mevcut İddia:** *"Player Circuit — Build a community with global rankings, automated check-ins, and personalized player profiles across the entire network."*
- **Doğrulama Durumu:** **KISMİ (Check-in ve Kulüp Havuzu Gerçek; Global Ağ Sıralaması Aspirasyonel)**
  - **[VERIFIED] — QR Yoklama ve Kulüp Oyuncu Havuzu:**  
    *Kanıt:* `src/app/api/checkin/route.ts` içinde `POST /api/checkin` endpoint'i ve Prisma `CheckIn` modeli mevcuttur. Katılımcıların QR kod ile veya manuel yoklamayla gelişleri (attendance) sisteme işlenmektedir. Kulüp oyuncu kayıtları (`/dashboard/roster`, `src/app/dashboard/participants/page.tsx`) oyuncu beden ölçüleri, yetenek seviyeleri ve geçmiş kayıtlarıyla çalışmaktadır. Turnuva bazlı puan durumu (`/api/standings/route.ts`) mevcuttur.
  - **[UNVERIFIED] — Tüm Ağda Global Sıralama ("Global rankings across the entire network"):**  
    *Kanıt:* Kod tabanındaki sıralama (`standings`) yalnızca turnuva bazlıdır (`where: { tournamentId }`). Kulüpler arası, federasyon çapında merkezi bir global oyuncu ELO/sıralama ağı mevcut değildir.
- **Pazarlama Kararı:** "Tüm dünyadaki küresel oyuncu ağı" gibi afaki iddialar yerine **"Kulüp oyuncu havuzu, QR kodlu hızlı yoklama ve turnuva puan tablosu"** olarak konumlandırılmalıdır.
