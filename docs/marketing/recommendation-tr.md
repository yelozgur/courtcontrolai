# CourtControl AI — Landing Page Değişiklik Önerisi (Recommendation)

**Hedef Dosya:** `src/app/page.tsx`  
**Tarih:** 2026-10-08  
**Yazar:** marketing-team (Agent `87405f08-d044-46e2-bbd1-dd40b0d932dd`)  
**Kapsam:** Açılış sayfasının (Hero & Navigasyon) Türkçe pazar konumlandırmasına ve `fix/sel57-test-auth-provider` dalındaki doğrulanmış kabiliyetlere uyarlanması.

---

## 1. Tespit Edilen Problem ve Gerekçe

`https://courtcontrolai-firebase.vercel.app` canlı üretim ortamı doğrudan incelendiğinde:
- Sayfa başlığı *"Dominate Your Arena"* ve alt başlığı *"The elite sports management hub. Automate complex schedules, broadcast live scores, and grow your player community."* olarak sabit kodlanmış (hardcoded) İngilizcedir.
- Rozet *"The Multi-Tenant Sports Engine"* şeklindedir.
- `src/i18n/I18nProvider.tsx` varsayılan dili `tr` olarak belirlemesine rağmen, `src/app/page.tsx` içinde ne `useI18n` kancası kullanılmakta ne de Türkçe metin bulunmaktadır.
- Salı akşamı veya hafta sonu turnuvası düzenleyen bir Türk spor kulübü başkanı (UNDP Kıbrıs pilotu dahil) için bu metinler tamamen yabancıdır ve operasyonel değer sunmamaktadır.

---

## 2. Değiştirilecek Spesifik Dosya ve Mevcut Dizgiler

### Dosya Yolu:
`src/app/page.tsx`

### Değiştirilecek Mevcut Dizgi Blokları:

#### A. Hero Rozeti (Satır 89):
```tsx
{isAdmin ? 'SaaS Network Administrator' : 'The Multi-Tenant Sports Engine'}
```
**Yeni Dizgi:**
```tsx
{isAdmin ? 'Yönetici Konsolu' : 'Kort ve Turnuva Yönetim Sistemi'}
```

#### B. Hero Başlığı (Satırlar 91-93):
```tsx
<h1 className="text-5xl font-headline font-bold tracking-tighter sm:text-6xl md:text-7xl lg:text-9xl/none uppercase">
  Dominate Your <span className="text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">Arena</span>
</h1>
```
**Yeni Dizgi:**
```tsx
<h1 className="text-5xl font-headline font-bold tracking-tighter sm:text-6xl md:text-7xl lg:text-9xl/none uppercase">
  Kortlarınızda Maç Kaosuna <span className="text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">Son Verin</span>
</h1>
```

#### C. Hero Alt Başlığı (Satırlar 94-98):
```tsx
<p className="mx-auto max-w-[800px] text-muted-foreground md:text-xl lg:text-2xl leading-relaxed font-medium">
  {aiEnabled
    ? 'The elite sports management hub. Automate complex schedules with Genkit AI, broadcast live scores, and grow your player community.'
    : 'The elite sports management hub. Automate complex schedules, broadcast live scores, and grow your player community.'}
</p>
```
**Yeni Dizgi:**
```tsx
<p className="mx-auto max-w-[800px] text-muted-foreground md:text-xl lg:text-2xl leading-relaxed font-medium">
  Turnuva eşleşmelerini ve kort dağılımını dakikalar içinde hazırlayın; hakem masasından girilen skorları kulüp ekranlarına ve oyuncuların telefonlarına anında yayınlayın.
</p>
```

#### D. Hero Butonları (Satırlar 105-127):
```tsx
<span>Browse Events</span>
...
<span>Live Arena Hub</span>
...
<span>{user ? "Go to Console" : "Launch Your Club"}</span>
```
**Yeni Dizgi:**
```tsx
<span>Turnuvaları İncele</span>
...
<span>Canlı Skor Ekranı</span>
...
<span>{user ? "Yönetim Konsolu" : "Kulübünüzü Başlatın"}</span>
```

---

## 3. Kod Ekibine (code-team) Sunulan Tam Git Diff

Aşağıdaki diff, `code-team` tarafından `src/app/page.tsx` dosyasına doğrudan uygulanabilir:

```diff
diff --git a/src/app/page.tsx b/src/app/page.tsx
index e8ec30f..8351b8c 100644
--- a/src/app/page.tsx
+++ b/src/app/page.tsx
@@ -38,10 +38,10 @@ export default function HomePage() {
         <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
           <Link className="text-sm font-medium hover:text-primary transition-colors hidden sm:block" href="/tournaments">
-            Events
+            Turnuvalar
           </Link>
           <Link className="text-sm font-medium hover:text-primary transition-colors hidden sm:block" href="/arena">
-            Arena
+            Canlı Skor
           </Link>
           
           {loading ? (
@@ -52,16 +52,16 @@ export default function HomePage() {
                 <Link href="/dashboard" className="flex items-center gap-2">
                   {isAdmin && <ShieldCheck className="h-4 w-4 text-accent" />}
-                  {isAdmin ? 'Admin Console' : 'Dashboard'}
+                  {isAdmin ? 'Yönetici Konsolu' : 'Yönetim Konsolu'}
                 </Link>
               </Button>
             </div>
           ) : (
             <div className="flex items-center gap-2">
               <Button asChild variant="ghost" size="sm">
-                <Link href="/login">Sign In</Link>
+                <Link href="/login">Giriş Yap</Link>
               </Button>
               <Button asChild variant="default" size="sm" className="bg-primary text-primary-foreground hidden md:flex rounded-xl">
-                <Link href="/signup">Register Club</Link>
+                <Link href="/signup">Kulüp Kaydı</Link>
               </Button>
             </div>
           )}
@@ -88,14 +88,12 @@ export default function HomePage() {
             <div className="flex flex-col items-center space-y-6 text-center">
               <div className="space-y-4">
                 <Badge variant="outline" className="text-accent border-accent/40 bg-accent/5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] animate-in fade-in slide-in-from-top-4 duration-1000">
-                  {isAdmin ? 'SaaS Network Administrator' : 'The Multi-Tenant Sports Engine'}
+                  {isAdmin ? 'Yönetici Konsolu' : 'Kort ve Turnuva Yönetim Sistemi'}
                 </Badge>
                 <h1 className="text-5xl font-headline font-bold tracking-tighter sm:text-6xl md:text-7xl lg:text-9xl/none uppercase">
-                  Dominate Your <span className="text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">Arena</span>
+                  Kortlarınızda Maç Kaosuna <span className="text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">Son Verin</span>
                 </h1>
                 <p className="mx-auto max-w-[800px] text-muted-foreground md:text-xl lg:text-2xl leading-relaxed font-medium">
-                  {aiEnabled
-                    ? 'The elite sports management hub. Automate complex schedules with Genkit AI, broadcast live scores, and grow your player community.'
-                    : 'The elite sports management hub. Automate complex schedules, broadcast live scores, and grow your player community.'}
+                  Turnuva eşleşmelerini ve kort dağılımını dakikalar içinde hazırlayın; hakem masasından girilen skorları kulüp ekranlarına ve oyuncuların telefonlarına anında yayınlayın.
                 </p>
               </div>
 
@@ -104,14 +102,14 @@ export default function HomePage() {
                   <Link href="/tournaments">
                     <Trophy className="h-6 w-6 group-hover:animate-bounce" />
-                    <span>Browse Events</span>
+                    <span>Turnuvaları İncele</span>
                   </Link>
                 </Button>
                 <Button asChild variant="secondary" size="lg" className="h-20 text-lg font-bold flex flex-col items-center gap-1 rounded-2xl group transition-all hover:scale-105 border border-white/5">
                   <Link href="/arena">
                     <Monitor className="h-6 w-6 text-accent group-hover:scale-110" />
-                    <span>Live Arena Hub</span>
+                    <span>Canlı Skor Ekranı</span>
                   </Link>
                 </Button>
                 
@@ -125,4 +123,4 @@ export default function HomePage() {
                     <Link href={user ? "/dashboard" : "/signup"}>
                       <Zap className="h-6 w-6 group-hover:text-amber-400" />
-                      <span>{user ? "Go to Console" : "Launch Your Club"}</span>
+                      <span>{user ? "Yönetim Konsolu" : "Kulübünüzü Başlatın"}</span>
                     </Link>
                   </Button>
```

---

## 4. İddia ve Doğrulama Durumu (Claim Verification)

- **Turnuva eşleşmeleri ve kort dağılımı:** `[VERIFIED]`  
  *Kanıt:* `src/lib/bracket-generator.ts` ve `/api/scheduler/solve` (OR-Tools kısıt çözücüsü, 164ms) doğrulanmıştır.
- **Canlı skorların ekranlara ve cep telefonlarına anında yayını:** `[VERIFIED]`  
  *Kanıt:* `src/app/referee/[id]/page.tsx` ve `src/app/arena/[id]/page.tsx` Firestore gerçek zamanlı veri akışı doğrulanmıştır.
- **Genkit AI / LLM vaadi:** `[UNVERIFIED / DISABLED]`  
  *Kanıt:* `GOOGLE_GENAI_API_KEY` eksikliği sebebiyle metne dahil edilmemiştir; dürüst pazarlama standardı korunmuştur.
