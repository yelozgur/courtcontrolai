# Production Deploy Hazırlık — CourtControlAI

**Tarih:** 2026-10-03
**Hedef:** Firebase App Hosting — `courtcontrolai-2294b`
**Durum:** Kod tarafı ✅ hazır · Kimlik doğrulama ⏳ senin girişini bekliyor

---

## Neler yapıldı

### 1. OCR bulguları giderildi (3 critical + 4 high)

| Bulgu | Düzeltme |
|-------|----------|
| **C0** Kendi yazdığım redirect gerçek kullanıcıyı hard refresh'te atıyordu | `useUser()` artık `authUnavailable` döndürüyor; `loading` Firebase çözülene kadar `true` kalıyor; layout üç durumu ayırıyor (hazırlanıyor / çıkış yapmış / sunucu yok) |
| **C1** Login butonu sessiz no-op → kalıcı kilitlenme | `disabled={isSubmitting \|\| !auth \|\| !db}` + Türkçe hata banner'ı ("Sunucuya bağlanılamıyor") |
| **C2** Firebase init hatası terminal, retry yok | `initError` state + görünür banner + **"Tekrar dene"** butonu |
| **H0** Firestore proxy kimlik doğrulamasız, kuralları bypass ediyordu | Production'da **404** (route tamamen devre dışı) + koleksiyon allowlist'i (`tournaments`, `clubs`, `sponsors`, `publicconfig`) |
| **H1** "Firebase yok" = "çıkış yapıldı" sanılıyordu | Ayrı `authUnavailable` sinyali; sunucu hatası artık oturum bitişi gibi gösterilmiyor |
| **H2** "Double Elimination" sessizce tek eleme üretiyordu | Şema `z.literal('Single Elimination')`'a daraltıldı — yanlış bracket yerine reddediliyor |
| **H3** React ağacı her yüklemede remount | `FirebaseProvider` ilk paint'ten itibaren render ediliyor, `null` kabul ediyor → ağaç şekli sabit |
| **H4** Context değeri her render'da yeni nesne | `useMemo(() => ({app, firestore, auth}), [...])` |

Ek olarak: `firestore/route.ts` ölü `errorText` değişkeni düzeltildi (upstream
hata gövdesi artık sunucu loguna gidiyor, istemciye değil) ve saldırgan kontrollü
`path` segmenti hata gövdesinden çıkarıldı.

### 2. Doğrulama

| Kontrol | Sonuç |
|--------|-------|
| `npx tsc --noEmit` | ✅ temiz |
| `npx playwright test` | ✅ **69/69 geçti** (3.6 dk) |
| `NODE_ENV=production npm run build` | ✅ başarılı, `BUILD_ID: sgKcGlZZMkxJN_0kDSs6o` |
| Route sayısı | 33 |
| Shared JS | 101 KB |

---

## Kalan tek engel: Firebase kimlik doğrulaması

`.firebaserc` **yanlış projeyi** gösteriyordu (`studio-6483617873-db638`) —
`config.ts` ve `apphosting.yaml` ise `courtcontrolai-2294b` kullanıyor. Düzeltildi.

`firebase-tools` v15.32.1 kuruldu ama **hiçbir hesapla giriş yapılmamış**:
```
⚠ No authorized accounts, run "firebase login"
```

### Yapman gereken (2 dakika)

```bash
cd "/Users/ozguryel/Documents/Personal Projects/CourtControlAI/courtcontrolai-firebase"
firebase login
```

Sonra:

```bash
# 1. Secret'ları ayarla (değerler prompt'a girilir, terminale görünmez)
firebase apphosting:secrets:set GOOGLE_GENAI_API_KEY
firebase apphosting:secrets:set TELEGRAM_BOT_TOKEN

# 2. Backend oluştur (ilk kez)
firebase apphosting:backends:create --project courtcontrolai-2294b --region europe-west1

# 3. Deploy
firebase apphosting:backends:create ... (yukarıdaki) VEYA
firebase deploy --only apphosting
```

---

## Secret durumu

`apphosting.yaml` iki secret bekliyor:

| Secret | Zorunlu mu | Etkisi yoksa |
|--------|-----------|--------------|
| `GOOGLE_GENAI_API_KEY` | Üretimde evet | `genkit.ts` zaten `'echo'` mock modeline düşüyor — AI akışları sahte veri döner. Yanlış davranış. |
| `TELEGRAM_BOT_TOKEN` | İsteğe bağlı | `/api/telegram/send` 400 döner, bot çalışmaz. Kritik değil. |

**Not:** `GOOGLE_GENAI_API_KEY` olmadan deploy etmek mümkün, ama AI özellikleri
(scheduling optimizasyonu, marketing bot) production'da sahte veri üretecek. Bu
sessiz bir hata olur — kullanıcı gerçek çalışan bir şey sanır.

---

## Deploy sonrası yapılacaklar

1. **Authorized domain:** Firebase Console → Authentication → Settings →
   Authorized domains'e App Hosting domain'ini ekle (`*.web.app` ve
   `*.firebaseapp.com` otomatik gelir, custom domain ayrıca eklenmeli).
   *Bu adım atlanırsa `auth/authorized-domain` hatası alırsın — Sprint 10'da
   localhost'te bunu yaşamıştık.*
2. **Firestore rules deploy:** `firestore.rules` production'a gitmeli —
   `firebase deploy --only firestore:rules`
3. **Firestore indexes:** `.idx/firestore.indexes.json` kontrol edilmeli.
4. **Scheduler (`SCHEDULER_URL`):** `apphosting.yaml`'da tanımlı **değil**.
   M5 Air'deki OR-Tools servisine (:8500) erişim App Hosting'den mümkün değil —
   public IP + Tailscale gerekiyor. Deploy etmeden karar ver:
   - Scheduler'ı da App Hosting'e taşı (birim olarak deploy et)
   - M5/M2'de public erişim aç (güvenlik riski)
   - Scheduler'ı geçici devre dışı bırak
5. **`/api/firestore` proxy:** production'da 404 dönecek. `use-filtered-collection.ts`
   bunu kullanıyor — production'da bu hook boş liste döner. **Production'da
   client SDK'ya geçmeli**, yoksa liste hiç dolmaz.

---

## Bilinen riskler (deploy etmeden kabul et)

| Seviye | Risk | Durum |
|--------|------|-------|
| 🔴 | Scheduler App Hosting'de çalışmaz, `SCHEDULER_URL` tanımsız | Karar bekliyor |
| 🟠 | `GOOGLE_GENAI_API_KEY` yoksa AI sahte veri döner | Secret set edilmeli |
| 🟠 | `use-filtered-collection` prod'da boş liste döner | Client SDK'ya geçilmeli |
| 🟡 | Authorized domain eklenmezse login çalışmaz | Deploy sonrası adım |
| 🟡 | Firestore index'leri production'da yoksa sorgu hatası | Deploy edilmeli |

---

## Tavsiye

Önce **scheduler kararını** ver, sonra deploy et. Çünkü scheduler olmadan
deploy edersen `/api/scheduler/solve` production'da 503 verir ve kullanıcı
"hatayı kendi bulup düzeltmeye çalışan" müşteri olursun.
