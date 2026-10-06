# OCR Code Review — Sprint 8-11 Diff

**Date:** 2026-10-03
**Tool:** alibaba/open-code-review v1.12.11 (Alibaba'nın üretimde doğrulanmış kural seti)
**Scope:** `ocr delegate preview` → 33 reviewable / 13 kaynak dosya (test ve markdown otomatik elendi)
**Mode:** `ocr delegate` (LLM gerektirmiyor) + kuralların host agent'a uygulanması
**Bottom line:** Bu diff **merge'e hazır değil.** 3 critical, 6 high bulgu var.
En kritik olan **bu oturumda yazılan kodda** ve testle kanıtlandı.

---

## Nasıl çalıştı

`ocr review` ve `ocr scan` lokal Qwen2.5-7B ile denendi ve **güvenilir çıktı vermedi**:
- 990 satırlık diff → Metal OOM
- `ocr scan` tek dosyada çalıştı ama tek bulgu üretti: *"redact fonksiyonunu kullan"* —
  oysa `redact` kodu **zaten yazılmıştı**. Yanlış pozitif.

Sonuç olarak `ocr delegate` kullanıldı: araç dosya kapsamını ve Alibaba'nın gerçek
kural setini (React hooks, render side-effect yasağı, async error handling, XSS,
sır sızıntısı, null güvenliği) çıkarıyor, incelemeyi host agent'a bırakıyor.
Kurallar bu şekilde tam olarak uygulandı.

**Araç hakkında dürüst not:** `ocr` + 4-bit yerel model işe yaramıyor. Ama
**kural seti değerli** — bu inceleme onun sayesinde yapıldı. Araç her koşumda
`--max-tokens` yetersizse dosyaları sessizce atlıyor (`exceeds 80% of max_tokens`),
bu da kapsam kaybı demek; token tavanını dosya boyutundan büyük tut.

---

## Critical

### C0 — Gerçekten giriş yapmış kullanıcı, hard refresh'te `/login`'e atılıyor
`src/app/dashboard/layout.tsx:84-88` ← **bu oturumda yazılan kod, regresyon**

Zincir tamamen doğrulandı ve worker tarafından sadık bir ağaç modeliyle yeniden üretildi:

1. `client-provider.tsx:43-51` — Firebase hazır olmadan önce ağacı **provider'sız** render ediyor
   (yorumu bile yazmış: *"Initial paint: render without provider"*).
2. `use-user.tsx:13-18` — bu pencerede `auth` null olduğu için `setUser(null)` +
   **`setLoading(false)`** çalışıyor. Yani `{ user: null, loading: false }`.
3. `layout.tsx:85` — `if (!authLoading && !user)` → **true** → `router.replace('/login')`.
4. `onAuthStateChanged` birkaç yüz ms sonra gerçek oturumu döndürüyor ama redirect
   çoktan tetiklenmiş oluyor.

**Sonuç:** oturum açık kullanıcı sayfayı yenileyince çıkış yapılmış gibi
görünüyor. E2E testler bunu yakalayamaz — hepsi kimliksiz çalışıyor.

**Düzeltme:** Auth context'in gerçekten çözülmesini bekle.
```tsx
const authReady = auth !== null;
React.useEffect(() => {
  if (authReady && !authLoading && !user) router.replace('/login');
}, [authReady, authLoading, user, router]);
```
Bu, aynı diff'in `handleSignOut`'a (satır 77) eklediği `if (auth)` null-guard'ın
effekt tarafında unutulmuş hali — koruma bir yere konmuş, diğerine konmamış.

### C1 — Login butonu sessiz no-op, kullanıcı kilitleniyor
`src/app/login/page.tsx:36, 70` (bu diff'te değil, diff'in **yarattığı** etki)

```tsx
if (!auth || !db) return;   // handleLogin ve handleGoogleLogin
```
Ama buton: `disabled={isSubmitting}` — yalnızca gönderim sırasında kilitli.

**Neden kritik:** Firebase yapılandırılmadığında kullanıcı "Giriş Yap"a tıklar ve
**hiçbir şey olmaz**. Hata yok, spinner yok, toast yok. Daha kötüsü: bu, `layout.tsx`'teki
yeni redirect ile bir döngü yaratıyor — kullanıcı `/dashboard` → `/login` gidiyor,
`/login` de giriş yapamıyor. Kalıcı kilitlenme, çökme bile değil.

**Düzeltme:** `disabled={isSubmitting || !auth || !db}` ve mevcut
`errorType === 'config'` uyarısını göster.

### C2 — Firebase hatası terminal, retry yok
`src/firebase/client-provider.tsx:43`

`useEffect(..., [])` bir kez çalışır; `initializeFirebase()` throw ederse uygulama
sonsuza kadar provider'sız render eder, sadece `console.warn` kalır. Config
oturum ortasında geçerli olsa bile kurtarma yok.

**Düzeltme:** `initState: 'pending' | 'ready' | 'failed'` state'i, başarısızlıkta
görünür banner + Retry.

---

## High

### H0 — Firestore proxy kimlik doğrulamasız ve allowlist'siz
`src/app/api/firestore/[...path]/route.ts:23` — repoda `middleware.ts` **yok**.

`GET /api/firestore/users` (ve istediği koleksiyon) kimliği olmayan herhangi bir
çağırana veri döndürüyor. Bu diff handler'ın hata yollarını sertleştirdi ama
açık proxy sorununa dokunmadı. Diff öncesinden gelen bir risk, ama merge
öncesi gateway'de karşılandığı doğrulanmalı.

### H1 — "Firebase yok" ile "çıkış yapıldı" karıştırılıyor
`src/firebase/auth/use-user.tsx:14` → `setUser(null); setLoading(false);`

`layout.tsx:85` bunu `!authLoading && !user` olarak okuyup `router.replace('/login')`
çağırıyor. Yani **backend arızası, oturum bitmiş gibi sunuluyor.** Kullanıcı
nedenini anlamadan sonsuz redirect döngüsüne giriyor.

**Düzeltme:** Ayrı bir sinyal döndür (`authUnavailable`), layout onu redirect'ten
önce kontrol edip hata ekranı göstersin.

### H2 — "Double Elimination" sessizce tek eleme üretiyor
`src/ai/flows/bracket-flow.ts:111, 164`

`format` destructuring'de alınıyor, hiç kullanılmıyor. Kod yorumu bile itiraf
ediyor: `// Winner advances to R2 (or R1 if format is double elim, but single for now)`.
Şema `'Double Elimination'` kabul ediyor → kullanıcı bu formatı seçerse **yanlış
bracket üretilir, hata da vermez.**

**Düzeltme:** Ya ikinci bracket'ı uygula, ya şemayı
`z.literal('Single Elimination')`'a daralt.

### H3 — React ağacı her sayfa yüklemesinde remount oluyor
`src/firebase/client-provider.tsx:45`

Root element tipi `Fragment` → `FirebaseProvider` değişiyor. React eski fiber'ı
silip yeniden oluşturuyor: tüm sayfa state'i kayboluyor, her `useEffect` ve
`onSnapshot` iki kez çalışıyor, ilk paint her zaman `db === null` ile oluyor.

**Düzeltme:** `FirebaseProvider`'ın `null` değer kabul etmesini sağla ve ağacı
tek bir kararlı şekilde render et — bu değişiklikle remount, redirect yarışı ve
memoization boşluğu birden çözülür.

### H4 — Context değeri her render'da yeni nesne
`src/firebase/provider.tsx:28` — `value={{ app, firestore, auth }}`

Her parent re-render'ında 33 `useFirestore()` tüketicisini geçersiz kılıyor.

**Düzeltme:** `useMemo(() => ({ app, firestore, auth }), [app, firestore, auth])`.

### H5 — Kullanılmayan `format` + uygulanmayan şema
`bracket-flow.ts:110` — `async` ama `await` yok; `BracketInputSchema` tanımlı
ama uygulanmıyor. `participants.length` ilk ham deref, JS çağıranı alanı atlarsa
TypeError atıyor.

---

## Medium / Low

| Seviye | Konum | Bulgu |
|--------|-------|-------|
| medium | `use-user.tsx:12` | `auth`' null → gerçek Auth geçişinde `loading` tekrar `true` olmuyor; şu an sadece `client-provider`'daki kazara remount maske yapıyor |
| medium | `bracket-flow.ts:152` | `byePlayerIds.find(() => true)` her zaman ilk elemanı döndürüyor → bir oyuncuya iki bye, diğerine hiç (6 oyuncu/8 slotta `seedOrder(8)=[1,8,5,4,3,6,7,2]`, iki bye de `p1`'e gidiyor) |
| medium | `marketing/page.tsx:74,82` | `addDoc(...).then().finally()` ve `updateDoc(...).then()` için `.catch()` yok → unhandled rejection, rollback yok |
| low | `provider.tsx:41` | Throw kaldırıldığı için "hook provider dışında kullanıldı" geliştirme güvenlik ağı kayboldu; hata artık uzak bir boş listede çıkıyor |
| low | `client-provider.tsx:30` | Her yüklemede `projectId`/`authDomain` konsola yazılıyor (gizli değil, ama gürültü) |
| low | `marketing/page.tsx:219` | `db && deleteDoc(...)` ile aynı dosyada kullanılan `if (!db) return;` ve `db && addDoc(...)` üç farklı idiom |
| low | `marketing/page.tsx:94` | `<Link>` içinde `<Badge>` (bir `<div>`) — HTML5 geçerli ama semantik zayıf |

## Ek bulgular (API route worker)

| Seviye | Konum | Bulgu |
|--------|-------|-------|
| high | `firestore/route.ts:42` | `errorText` hesaplanıyor ama kullanılmıyor — diff `details: errorText`'i kaldırdı, `await res.text()` okumasını bırakmadı. Upstream hata gövdesi artık **hiçbir yere** gitmiyor; sertleştirmenin amacı olan teşhis edilebilirlik kayboldu. Sunucu tarafı `console.error`'a al |
| high | `telegram/send/route.ts:56` | Token şekil doğrulaması yok — `usableToken` yalnızca boş mu diye bakılıyor. `/^\d+:[A-Za-z0-9_-]{30,}$/` ile doğrulanmalı |
| medium | `firestore/route.ts:50` | 4xx'ler (`401`/`403`) olduğu gibi geçiriliyor — istemci "Firestore reddetti" ile "oturumun geçersiz" ayrımını yapamıyor, sahte sign-out döngüsü riski |
| medium | `firestore/route.ts:48,68` | `path` (saldırgan kontrollü URL segmenti) hata gövdesine yansıtılıyor — gereksiz koleksiyon adı ifşası |
| medium | `telegram/send/route.ts:110` | Bozuk JSON gövdesinde `sentToken` hâlâ `''` olduğu için `redact` no-op çalışıyor. Bugün sızmıyor (Node'un `JSON.parse` hatası gövdeyi yankılamıyor — test edildi) ama garanti tesadüfi, runtime değişirse kırılır |
| low | `layout.tsx:99-106` | `!user` erken dönüşü, kullanıcı çıkış yapmışken "Giriş yapılıyor..." gösteriyor; ayrıca `t()` yerine sabit metin |
| low | `layout.tsx:124-174` | `SidebarContent` bileşen içinde tanımlı — her render'da sidebar alt ağacı remount, `Sheet` state'i düşüyor |
| low | `layout.tsx:77` | `signOut(auth).then(...)` rejection handler'ı yok |
| low | `telegram/send/route.ts:31` | `result?: any` — gerekçesiz `any`, tip zarfının anlamını boşaltıyor |

## Çalıştırılarak çürütülen iddialar

Test edilip **bulgu olmadığı kanıtlanan** şeyler — raporun asıl değeri bunları bilmekten geliyor:

- **`AbortSignal.timeout` gerçekten `TimeoutError` fırlatıyor.** `DOMException`,
  `e.name === 'TimeoutError'`, `e instanceof Error === true`. Hem gerçek timeout hem
  connection-refused senaryosu koşturuldu; 504 dalı doğrulandı.
- **Telegram token sızmıyor.** Gerçek `fetch` hatası `message: "fetch failed"`
  veriyor, `String(e)` içinde token yok, URL yok. Token *giden* URL'de, gelen
  istekte değil — yani Next.js access log'u `/api/telegram/send` için token
  içeremez. `redact` doğru uygulanmış: regex değil literal `split`/`join`
  (metak karakterler güvenli), boş-token koruması var.
- **`router.replace` `push`'tan doğru tercih** — geri tuşu kullanıcıyı korumalı
  ağaca geri fırlatmıyor. Bağımlılık dizisi eksiksiz, effect erken dönüşlerin
  üstünde doğru konumda. Bulgu **null-guard eksikliği**, seçimin kendisi değil.
- **Tüm 33 `useFirestore()` tüketicisi null-safe.** `tsc --noEmit` 114 dosyada temiz,
  `useCollection`/`useDoc` null query'de erken çıkıyor, kontrol edilen her tüketici
  `collection()`/`doc()` öncesi guard içeriyor. **Beyaz ekran çocuğa taşınmıyor.**
- **`tailwind.config.ts` ESM fix'i doğru** — `export =` tipi `esModuleInterop: true`
  ile çözülüyor, runtime'da jiti+sucrase fallback'i `plugins_len=1` ile yüklüyor.
  (Loader önce `require()` deniyor, yani `require` da çalışırdı — taşınabilirlik
  iyileştirmesi, hata düzeltmesi değil.)
- **`client-provider` içindeki yeni guard doğru ve gerekli** — onsuz 1 katılımcıda
  `bracketSize === 1` → `seedPositions[1] === undefined` → NaN pozisyon.
---

## Merge sırası önerisi

1. **C0** — `authReady` guard'ını ekle. Bu bir regresyon ve giriş yapmış her kullanıcıyı etkiliyor. Tek başına 3 satır.
2. **C1** — login butonunu `!auth || !db` durumunda kilitle (kullanıcı kilitlenmesi)
3. **H0** — firestore proxy'nin auth/allowlist durumunu doğrula, gateway karşılamıyorsa route içine koy
4. **H1** — `authUnavailable` sinyali: backend arızası, oturum bitişi gibi sunulmasın
5. **C2 + H3** — `client-provider`'ı tek kararlı şekle getir
6. **H2** — şemayı daralt (yanlış bracket üretmektense reddet)
7. Kalan medium/low'lar — bakım işleri

**Not:** Hiçbir düzeltme uygulanmadı. Bu bir inceleme raporudur.
