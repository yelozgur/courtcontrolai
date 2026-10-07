# Demo-ready tanımı

Bir projenin "müşteri demosuna hazır" sayılması için geçmesi gereken
kontroller. Ölçülebilir; "iyi görünüyor" bir kriter değildir.

Bu tanım, 2026-10-08'de üç projenin gerçek ölçümlerinden türetildi. Her
projenin hangi maddeleri geçtiği aşağıda kayıtlıdır.

## A. Derleme ve statik analiz

| # | Kontrol | Komut | Geçme ölçütü |
|---|---|---|---|
| A1 | Tip kontrolü | `npm run typecheck` | exit 0, çıktıyı yapıştır |
| A2 | Üretim derlemesi | `npm run build` | exit 0 |
| A3 | Lint | `npm run lint` | exit 0 veya lint scripti yoksa belgelenmiş |

**Neden ayrı:** Next.js derlemesi `tsc` çalıştırmaz. Ajanların bir kez doğruladığı
hatayla derleme hâlâ yeşil kalabiliyor — geolease bu durumda şu an.

## B. Test

| # | Kontrol | Komut | Geçme ölçütü |
|---|---|---|---|
| B1 | Birim/integrasyon testi | `npm test -- --run` | exit 0, geçen/başarısız sayısı yapıştırılır |
| B2 | Smoke testi | projeye özgü smoke script | exit 0 **veya** kaldırıldıysa gerekçesi yazılı |
| B3 | Yazma kontratı | projeye özgü check:* | exit 0, hiçbir veri yazılmadığını teyit eder |

**Neden ayrı:** Test silerek yeşile döndürmek kabul edilmez. Yeniden yazılan
her test için gerekçe yazılır. Çalışmayan smoke scripti, hiç script olmamasından
daha kötüdür — var olmayan bir güvence izlenimi yaratır.

## C. Kanıt zinciri

| # | Kontrol | Geçme ölçütü |
|---|---|---|
| C1 | Sürüm kontrolü var | `git log` çalışır, `.gitignore` sırları kapsar |
| C2 | Çalışma ağacı | `git status --short` boş veya bilinen değişiklik |
| C3 | Değişiklik izlenebilir | Ajan hangi dosyayı değiştirdiğini kanıtlayabilir |

**Neden ayrı:** Sürüm kontrolü olmayan bir projede "düzeltildi" iddiasının
doğrulanması mümkün değildir. Ajan listesiyle çalışırsa, kanıt zinciri
zayıflar ve her doğrulama manuel dosya karşılaştırmasına düşer.

## D. Güvenlik

| # | Kontrol | Geçme ölçütü |
|---|---|---|
| D1 | Yazma uçları yetkili | Oturumsuz istek 401/403, sıfır veri |
| D2 | Okuma uçları değerlendirilmiş | Her GET ya auth'lu ya da "kasıtlı kamu" kararı yazılı |
| D3 | Kiracı izolasyonu | A kulübü B kulübüne veri göremiyor, test edildi |
| D4 | Sır sızdırmama | Hata mesajları istemciye ham gitmiyor |
| D5 | Kimlik tutarlılığı | `ownerId` ve session kimliği aynı uzayda |

**Neden ayrı:** CourtControl'da D2 ve D5 iki kez sessizce kırıktı ve ikisi de
görsel denetimle değil, kodu okuyarak çıktı.

## E. Demo yolu

Müşterinin gerçekten göreceği adımlar, sırayla:

1. İlk açılış sayfası — ne olduğu belli mi?
2. Giriş — kayıt ve giriş çalışıyor mu?
3. Ana iş akışı — ürünün yaptığı şey
4. Raporlama/çıktı — müşteriye gösterilecek sonuç

Her adım için: URL, HTTP durumu, **açılıp incelenmiş** ekran görüntüsü, konsol
hatası. Dosyanın var olması ekranın render olduğu anlamına gelmez; bu tuzak
iki kez yaşandı.

## F. Operasyonel hazırlık

| # | Kontrol | Geçme ölçütü |
|---|---|---|
| F1 | Üretim yanıt veriyor | `curl` gerçek HTTP kodu, sadece 200 değil |
| F2 | Kimlik bilgileri | Müşterinin gireceği hesap mevcut ve çalışıyor |
| F3 | Veri durumu | Demo için gereken veri var mı, yoksa boş ekran mı gösterilecek |
| F4 | Sır rotasyonu | Varsa bekleyen iş belgelenmiş |

---

## Ölçülmüş durum (2026-10-08)

### CourtControlAI

```
A1 typecheck        EXIT 0   ✓
A2 build            EXIT 0   ✓
A3 lint             —        yapılandırılmamış
B1 test             EXIT 0   ✓ 13/13 scheduler kontrat testi
B2 smoke            EXIT 1   ✗ e2e/results.json'da D01 bayat
C1 sürüm kontrolü   ✓ 29 commit, origin/fix-sel57 push edildi
C2 çalışma ağacı    ✗ güvenlik ajanı canlı çalışıyor
D1 yazma uçları     ✓ production'da 401 doğrulandı
D2 okuma uçları     ✗ 6 GET auth'suz, /api/clubs anonim 200
D3 kiracı izolasyonu ? güvenlik ajanı inceliyor
D4 sır sızdırma     ✓ 0a8144e ile 15 catch bloğu düzeltildi
D5 kimlik tutarlılığı ✗ firebaseUid/cuid uyuşmazlığı — kulüp sahibi 403
E  demo yolu        ✗ Venue UI hiç render olmadı (SEL-68)
F1 production       ✓ 6 uç canlı
F3 veri             ✗ tenant boş, demo ekranları boş
F4 şifre rotasyonu  ✗ bekliyor (belgelendi)
```

**Sonuç: demo-ready değil.** İki engel var: güvenlik (D2, D5) ve
görsel doğrulanmamış arayüz (E). İkisi de SEL-71 ve SEL-68'de.

### geolease-src

```
A1 typecheck        EXIT 2   ✗ 4 hata
A2 build            EXIT 0   ✓
B1 test             EXIT 1   ✗ 7/25 başarısız
B2 smoke            yok
C1 sürüm kontrolü   ✓ bu seansta baseline kuruldu (2e10db5)
C2 çalışma ağacı    ✗ ajan çalışıyor
D*                  değerlendirilmedi
E  demo yolu        ✗ doğrulanmadı
F1 production       ✓ Vercel'de
```

**Sonuç: demo-ready değil.** 4 tip hatası ve 7 kırık test var; derleme
yeşil olduğu için bunlar müşteri karşısında çıkmaz.

### idaim-web

```
A1 typecheck        EXIT 0   ✓
A2 build            EXIT 0   ✓
B1 test             yok      birim test altyapısı yok
B2 smoke            EXIT 1   ✗ src/lib/sheets modülü yok
B3 yazma kontratı   EXIT 0   ✓ sheet şeması ve enum'lar bozulmamış
C1 sürüm kontrolü   ✓ 16 commit (remote yok)
C2 çalışma ağacı    ✓ temiz
E  demo yolu        ? SEL-74'te doğrulanıyor
F1 production       ✓ 307 → /login (giriş duvarı, doğru davranış)
F3 veri             ? canlı Google Sheet
```

**Sonuç: en sağlıklı proje**, ancak tek birim testi yok ve tek smoke
scripti bozuk — yani mevcut tek uçtan uca koruma çalışmıyor.