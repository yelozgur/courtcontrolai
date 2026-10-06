# Vercel Projeleri Ayrımı ve Production Referans Rehberi

**Tarih:** 2026-10-06  
**Durum:** Kesin ve Bağlayıcı Mimari Karar  
**Sorumlu Ekip:** Infra & Core Platform  

---

## 1. Hızlı Sağlık Kontrolü (Quick Health Check)

Aşağıdaki tek satırlık komut ile hangi URL'in canlı olduğunu doğrulamak 1 saniye sürer:

```bash
# Canlı Production HTTP 200 Kontrolü:
[ "$(curl -fsS -o /dev/null -w '%{http_code}' https://courtcontrolai-firebase.vercel.app)" = "200" ] && echo "ONLINE (courtcontrolai-firebase)" || echo "DEAD"
```

Detaylı `/api/health` JSON sorgusu:
```bash
curl -sS https://courtcontrolai-firebase.vercel.app/api/health | jq '{ok: .ok, version: .version, firebase_configured: .checks.env.firebase_configured, config_source: .checks.env.firebase_config_source}'
```
> **Not:** `/api/health` endpoint'i `GOOGLE_GENAI_API_KEY` henüz atanmadığı sürece HTTP 503 döndürür; ancak payload içinde `firebase_configured: true` ve `firebase_config_source: "env"` doğrulaması canlı prod ortamını kesin olarak kanıtlar.

---

## 2. İki Vercel Projesinin Karşılaştırması

| Özellik / Kriter | `courtcontrolai-firebase` | `courtcontrolai` |
| :--- | :--- | :--- |
| **Rol** | 🟢 **PRODUCTION / CANLI** | 🔴 **PRODUCTION DEĞİL (ARŞİV / DENEY)** |
| **Canlı URL** | `https://courtcontrolai-firebase.vercel.app` | `https://courtcontrolai.vercel.app` |
| **Vercel Proje ID** | `prj_lc6yIi3DGlT4P915Upa14cs8wsj9` | `prj_FPCvEHdcGtJcWjljpPslnuPc1jv9` |
| **Müşteri Demoları** | **Yalnızca bu proje üzerinden verilir.** | **Müşteri demosu için ASLA kullanılmaz.** |
| **Referans Branch** | `production-code-2026-10-06` | `main` (hata kaynağı) |
| **Canlıdaki Referans Commit** | `fadc195` (`chore: commit working tree — this is the code running in production`) | `e7b2327` (`fix(api): remove heapUsedLimit...`) |
| **Environment Değişkenleri** | **31 adet tanımlı env** (Firebase, Google Auth, Neon Postgres, NextAuth) | **0 uygulama env'i** (Yalnızca arşiv/uyarı notları mevcuttur) |
| **Deploy Sağlığı** | 4/4 Ready (Production) | 2 Error, 1 eksik env ile Ready (boş) |
| **Kaynak Makine** | `Ozgurs-Laptop` (`yelozgur@Ozgurs-Laptop.local`) | `Ozgurs-Laptop-2` (`ozguryel@Ozgurs-Laptop-2.local`) |

---

## 3. Temel Kurallar ve Güvenlik Protokolü

### Kural 1: Branch Referansı
Vercel Dashboard'da veya Vercel CLI çıktısında `deploy.meta.githubCommitSha` değerinin **`production-code-2026-10-06`** branch'inden geldiği teyit edilmelidir.  
> ⚠️ **`main` dalından gelen hiçbir deploy production kabul edilmez.**

### Kural 2: `courtcontrolai` Projesine Müdahale Yasağı
- `courtcontrolai` projesi geçmişte başka bir makineden (`Ozgurs-Laptop-2`) push edilmiş, uygulama çevre değişkenleri (Firebase, Neon, Auth) bulunmayan atıl bir projedir.
- Bu proje üzerine:
  - `NOTE_NOT_PRODUCTION="PRODUCTION DEĞİL — yalnızca arşiv / deney. Müşteri demosu courtcontrolai-firebase üzerinden verilir."`
  - `PRODUCTION_DEGIL__ARSIV_VE_DENEY__MUSTERI_DEMOSU_COURTCONTROLAI_FIREBASE_PROJESIDIR="true"`
  çevre değişkenleri işlenmiştir.
- **Deploy Silinmeme Kararı:** Geçmiş hataların (`fc714cf`, `5dea39e`) logları ve adli referans (forensic review) bütünlüğü için mevcut deploy'lar Vercel'de silinmemiş, ancak çevre değişkeni seviyesinde kilitlenerek dokümante edilmiştir.

### Kural 3: `courtcontrolai-firebase` Sınırları
- Sentinel güvenlik ve kota raporu tamamlanmadan `courtcontrolai-firebase` env'lerine dokunulmaz.
- Özellikle `GOOGLE_GENAI_API_KEY` ve `SCHEDULER_URL` değişkenleri sentinel raporu teyit edilene kadar eklenmez.

---

## 4. Doğrulama ve CLI Komutları

Vercel CLI yerel makinede `/opt/homebrew/bin/vercel` yolunda çalışır:

```bash
# Projeleri listele
/opt/homebrew/bin/vercel projects ls

# Production projesinin canlı deploy'larını listele
/opt/homebrew/bin/vercel ls courtcontrolai-firebase --limit 3

# courtcontrolai projesindeki "Production Değil" notunu doğrula
/opt/homebrew/bin/vercel env ls --project courtcontrolai

# Canlı deployment detaylarını JSON olarak incele
/opt/homebrew/bin/vercel ls courtcontrolai-firebase --json --limit 1
```
