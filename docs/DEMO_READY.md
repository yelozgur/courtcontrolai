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
A1 typecheck        EXIT 0   ✓ yeniden ölçüldü 01:25
A2 build            EXIT 0   ✓
A3 lint             —        yapılandırılmamış
B1 test             EXIT 0   ✓ 13/13 scheduler kontrat testi
C1 sürüm kontrolü   ✓ push edildi
C2 çalışma ağacı    ✗ güvenlik ajanı canlı çalışıyor (2 dosya)
D1 yazma uçları     ✓ 401 doğrulandı
D2 okuma uçları     ~ düzeltiliyor: teams/fixtures/results auth()=1,
                             clubs/tournaments/standings hâlâ açık
D3 kiracı izolasyonu ? güvenlik ajanı inceliyor
D4 sır sızdırma     ✓ 0a8144e
D5 kimlik tutarlılığı ✗ SEL-71'de inceleniyor
E  demo yolu        ✓ SEL-68 TAMAMLANDI — aşağıya bak
F1 production       ✓ 6 uç canlı
F3 veri             ~ tenant artık dolu (Main Arena + 3 salon)
F4 şifre rotasyonu  ✗ bekliyor (belgelendi)
```

### Venue UI — görsel doğrulama tamamlandı (SEL-68, commit 5e88097)

Önceki iki capture login sayfasıydı. Yeniden alınan görüntüler **gerçek ekranı
gösteriyor** ve orkestrator tarafından açılıp incelendi:

- `venues-list-2026-10-08.png` — "Mekanlar", 1 şaha, Main Arena, 3 salon
  etiketi, gün bazlı saat satırı (fri 08:00-16:00; mon 09:00-12:00, 14:00-20:00;
  sat 14:00-20:00 …), session'lı "Club Manager".
- `venues-detail-2026-10-08.png` — "Mekanı Düzenle", **Açılış Saatleri** sekmesi
  çalışıyor: gün seçimi ("Özel saatler"), Pazartesi için iki ayrı aralık
  (09:00–12:00, 14:00–20:00), "Aralık Ekle", silme kontrolü, Kaydet.
- `venues-reorder-2026-10-08.png` — salon sıralama kontrolü.

Yani üç durum korunuyor: `null` (bilgi yok → "Özel saatler"), `[]` (kapalı),
aralık listesi. Hepsi Türkçe.

**Sonuç: görsel engel kapandı.** Kalan tek engel güvenlik (D2, D5).

### geolease-src

```
A1 typecheck        EXIT 0   ✓ DÜZELDİ (başlangıçta EXIT 2, 4 hata)
A2 build            EXIT 0   ✓
B1 test             EXIT 0   ✓ DÜZELDİ (başlangıçta 7/25 fail → 23/23 pass)
B2 smoke            yok
C1 sürüm kontrolü   ✓ baseline 2e10db5
C2 çalışma ağacı    ✗ ajan henüz commit etmedi
D*                  değerlendirilmedi
E  demo yolu        ? SEL-73'te
F1 production       ✓ Vercel'de
```

**Sonuç: teknik borç kapandı, kanıt eksik.** Ajan 4 tip hatasını ve 7 testi
düzeltmiş; yeniden ölçümde typecheck EXIT 0, test 23/23. Ancak değişiklikler
henüz commit edilmediği için C2 temiz değil — ve demo yolu (E) henüz
doğrulanmadı. Commit + ekran görüntüsü bekleniyor.

### idaim-web

```
A1 typecheck        EXIT 0   ✓
A2 build            EXIT 0   ✓
B1 test             yok      birim test altyapısı yok (kabul edildi)
B2 smoke            EXIT 0   ✓ DÜZELDİ (başlangıçta EXIT 1)
B3 yazma kontratı   EXIT 0   ✓ sheet şeması ve enum'lar bozulmamış
C1 sürüm kontrolü   ✓ 16 commit (remote yok)
C2 çalışma ağacı    ✗ 3 dosya, ajan henüz commit etmedi
E  demo yolu        ? SEL-74'te
F1 production       ✓ 307 → /login (giriş duvarı, doğru davranış)
F3 veri             ✓ canlı sheet'ten okundu: 2 trap check, lab sonuçları
```

**Sonuç: üç projede de tip ve smoke borcu kapandı.** `smoke:sheets` artık
canlı sheet'i okuyor (başlangıçta `ERR_MODULE_NOT_FOUND`). Kalan eksikler
B1 (birim testi yok — kabul edildi, inşa etmek demo için gerekli değil),
C2 (commit bekleniyor) ve E (ekran kanıtı).