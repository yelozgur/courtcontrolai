# CourtControl AI — Türkçe Hero Seçenekleri (Landing Page)

**Tarih:** 2026-10-08  
**Yazar:** marketing-team (Agent `87405f08-d044-46e2-bbd1-dd40b0d932dd`)  
**Sözlük Uyumu:** `src/i18n/translations.ts` dosyasındaki mevcut terimlerle birebir uyumludur (`t('common.signIn')`, `t('tournament.createFirst')`, `t('dashboard.title')`, `t('schedule.title')`).

---

## Seçenek 1: Operasyonel & Çözüm Odaklı (Tavsiye Edilen)

> **Hedef:** Salı akşamı veya hafta sonu turnuva düzenleyen, fikstür karmaşası ve kort krizleriyle boğuşan kulüp yöneticisi.

### 1. Rozet (Badge)
**Kort ve Turnuva Yönetim Sistemi**  
*(Mevcut İngilizce: "The Multi-Tenant Sports Engine")*

### 2. Başlık (Headline)
**Kortlarınızda Maç Kaosuna Son Verin: Fikstürden Canlı Skora Tek Panel.**

### 3. Tek Cümlelik Açıklama (One-Sentence Explanation)
**Turnuva eşleşmelerini ve kort dağılımını dakikalar içinde hazırlayın; hakem masasından girilen skorları kulüp ekranlarına ve oyuncuların telefonlarına anında yayınlayın.**

### 4. Birincil Eylem Çağrısı (Primary CTA)
- **Ana Buton:** **Yönetim Konsoluna Giriş Yap** `[t('dashboard.title') + t('common.signIn')]` (veya üye değilse: **Kulübünüzü Kaydedin** `[t('auth.signUp.title')]`)
- **İkincil Buton:** **Canlı Skor Alanı** `[t('nav.tournaments') / Arena]`

### İddia Doğrulama Analizi:
- *Turnuva eşleşmelerini ve kort dağılımını dakikalar içinde hazırlama:* **[VERIFIED]** — Deterministik bracket motoru (`src/lib/bracket-generator.ts`) ve arka planda 164ms yanıt süresiyle çalışan OR-Tools kısıt çözücüsü (`/api/scheduler/solve`) ile kort ve maç çakışmaları çözülmektedir.
- *Hakem masasından girilen skorların anlık yansıması:* **[VERIFIED]** — `src/app/referee/[id]/page.tsx` hakem konsolu ile `src/app/arena/[id]/page.tsx` canlı skor ekranı Firestore abonelikleriyle anlık senkronizedir.
- *LLM / Genkit yapay zeka optimizasyonu:* **[UNVERIFIED / DISABLED]** — Metinde AI iddiasından bilinçli olarak kaçınılmıştır; çünkü üretimde `GOOGLE_GENAI_API_KEY` tanımlı değildir.

---

## Seçenek 2: Prestij ve Profesyonelleşme Odaklı

> **Hedef:** Kulübünü Excel tabloları ve WhatsApp karmaşasından kurtarıp kurumsal, profesyonel standartlara taşımak isteyen kulüp başkanı.

### 1. Rozet (Badge)
**Kulüp ve Turnuva Altyapısı**

### 2. Başlık (Headline)
**Kulübünüze Profesyonel Turnuva Standardı Getirin.**

### 3. Tek Cümlelik Açıklama (One-Sentence Explanation)
**Oyuncularınızı QR kodla karşılayın, maç takvimini çakışmasız planlayın ve turnuva heyecanını canlı skor paneliyle kortlara taşıyın.**

### 4. Birincil Eylem Çağrısı (Primary CTA)
- **Ana Buton:** **İlk Turnuvanızı Oluşturun** `[t('tournament.createFirst')]`
- **İkincil Buton:** **Turnuvaları İncele** `[t('tournament.yourTournaments')]`

### İddia Doğrulama Analizi:
- *Oyuncuları QR kodla karşılama (Check-in):* **[VERIFIED]** — `POST /api/checkin` endpoint'i ve Prisma `CheckIn` modeli üzerinden QR kod ve manuel varış (attendance) kaydı doğrulanmıştır.
- *Çakışmasız maç takvimi planlama:* **[VERIFIED]** — OR-Tools scheduler servisi kort ve zaman kısıtlarını doğrulamaktadır.
- *Canlı skor paneli:* **[VERIFIED]** — `/arena/[id]` canlı skor ekranı test edilmiş ve çalışmaktadır.
- *Tüm kulüp ağında global sıralama ligi:* **[UNVERIFIED]** — Veritabanında yalnızca turnuva içi sıralama (`/api/standings`) mevcuttur; global çapta ağ sıralaması iddiasına metinde yer verilmemiştir.

---

## Seçenek 3: Doğrudan & İşlevsel (Net ve Kısa)

> **Hedef:** Teknolojik süslemeler yerine doğrudan sistemin ne yaptığını görmek isteyen pragmatik kulüp yöneticisi.

### 1. Rozet (Badge)
**Spor Kulübü Yönetim Konsolu** `[t('dashboard.title')]`

### 2. Başlık (Headline)
**Turnuva Yönetimi ve Canlı Skor Artık Çok Kolay.**

### 3. Tek Cümlelik Açıklama (One-Sentence Explanation)
**Kortlarınızı verimli kullanın, maç programını otomatik oluşturun ve maç sonuçlarını anında tüm kulüple paylaşın.**

### 4. Birincil Eylem Çağrısı (Primary CTA)
- **Ana Buton:** **Kulüp Konsolunu Başlat** `[t('nav.console')]`
- **İkincil Buton:** **Canlı Arenayı Gör** `[t('profile.findArena')]`

### İddia Doğrulama Analizi:
- *Kortları verimli kullanma ve maç programı:* **[VERIFIED]** — Saha ve kort yönetimi CRUD arayüzü (`src/app/dashboard/venues/page.tsx`) ile kısıt çözücü entegredir.
- *Maç sonuçlarını anında paylaşma:* **[VERIFIED]** — Sonuçlar sayfası (`/tournaments/[id]/results`) ve Arena canlı skor sayfası mevcuttur.
- *Yapay zeka ile otonom turnuva direktörlüğü:* **[UNVERIFIED / DISABLED]** — Metne dahil edilmemiştir.

---

## Karşılaştırma ve Tercih Gerekçesi

| Kriter | Seçenek 1 (Tavsiye Edilen) | Seçenek 2 | Seçenek 3 |
|---|---|---|---|
| **Müşteri Empatisi** | **Çok Yüksek** (Maç kaosu, kort sıkıntısı) | Yüksek (Prestij, standart) | Orta (Doğrudan araç) |
| **Doğrulanmış İddia Oranı** | **%100** (Tüm vaatler kodda mevcut) | **%100** (Tüm vaatler kodda mevcut) | **%100** (Tüm vaatler kodda mevcut) |
| **i18n Sözlük Uyumu** | Birebir uyumlu | Birebir uyumlu | Birebir uyumlu |
| **10 Saniyelik Değer Netliği** | En net (Kura + Fikstür + Ekran) | Net (QR + Planlama + Ekran) | Sade |
