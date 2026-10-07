# Week 2 Plan — Neon Postgres Kod Bağlantısı

**Tarih:** 2026-10-06
**Issue:** SEL-31
**Branch:** `production-code-2026-10-06`
**Durum:** Plan onayı bekliyor

---

## Doğrulanmış mevcut durum

| Kontrol | Sonuç |
|---------|-------|
| `prisma/schema.prisma` var mı? | ✅ Var (Tournament, Match, Bracket, AIQueue, User, Account, Session, VerificationToken) |
| `prisma` package.json'da mı? | ❌ YOK (ne dependencies ne devDependencies) |
| `@prisma/client` package.json'da mı? | ❌ YOK |
| `node_modules/prisma` var mı? | ❌ YOK |
| `node_modules/@prisma/client` var mı? | ❌ YOK |
| `.env.local` Neon env var'ları var mı? | ✅ Var (POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, vb.) |
| `src/lib/prisma.ts` (singleton) var mı? | ❌ YOK |
| NextAuth DB adapter kullanıyor mu? | ❌ YOK (JWT strategy, adapter yok) |
| `/api/health` DB check yapıyor mu? | ❌ YOK |

### Schema isim tutarsızlığı (CRITICAL)

- `prisma/schema.prisma` → `@@schema("courtcontrolai")` kullanıyor
- `scripts/setup-db.mjs` → `schema_courtcontrolai` schema'sı oluşturuyor
- **Bu iki isim uyuşmuyor.** Prisma migration çalıştırıldığında `courtcontrolai` schema'sı oluşturulacak, ama setup scripti `schema_courtcontrolai` oluşturmuş. Karar verilmesi gerekiyor.

---

## Week 2 Kapsamı — Adımlar

### Adım 1: Schema isim tutarsızlığını gider

**Dosyalar:**
- `prisma/schema.prisma` — `@@schema("courtcontrolai")` → `@@schema("schema_courtcontrolai")` olarak güncelle (tüm modeller ve enum'lar)
- VEYA `scripts/setup-db.mjs` — `schema_courtcontrolai` → `courtcontrolai` olarak güncelle

**Karar:** `prisma/schema.prisma`'daki `courtcontrolai` ismi daha temiz. `setup-db.mjs`'yi buna uyarlamak daha mantıklı. Ama önce Neon'da hangi schema'nın gerçekten oluşturulduğunu doğrulamak gerekiyor.

**Öneri:** Neon'da mevcut schema'yı kontrol et, hangisi varsa Prisma schema'sını ona göre ayarla. İkisi de yoksa, `courtcontrolai` (daha temiz) kullan ve setup-db.mjs'yi güncelle.

### Adım 2: Prisma bağımlılıklarını ekle

**Dosya:** `package.json`

```bash
npm install @prisma/client
npm install prisma --save-dev
```

**Sonuç:**
- `dependencies`: `@prisma/client` eklenecek
- `devDependencies`: `prisma` eklenecek

### Adım 3: Prisma client singleton oluştur

**Yeni dosya:** `src/lib/prisma.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Neden:** Next.js hot reload'da her seferinde yeni PrismaClient instance oluşmasını engeller (connection pool exhaustion).

### Adım 4: Prisma generate + migration

```bash
npx prisma generate          # Client kodunu üret
npx prisma migrate dev --name init   # İlk migration ( Neon'a push)
```

**Not:** Neon serverless Postgres'te `migrate deploy` production için daha uygun olabilir. Dev'de `migrate dev`, prod'da `migrate deploy` kullan.

**Alternatif (daha güvenli):** `npx prisma db push` — migration dosyası oluşturmadan schema'yı doğrudan push eder. İlk kurulum için uygun.

### Adım 5: NextAuth PrismaAdapter'a geç

**Dosya:** `src/lib/auth.ts`

```typescript
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // ... mevcut config
  session: {
    strategy: "database", // JWT'den DB'ye geç (adapter ile)
  },
})
```

**Ek bağımlılık:** `npm install @auth/prisma-adapter`

**Dikkat:** JWT'den database session'a geçmek mevcut login akışını değiştirir. Mevcut Firebase Auth paralel çalıştığı için risk düşük, ama test edilmeli.

**Müşteri demosunu etkiler mi?** Evet — login akışı değişecek. Ama Firebase Auth hala paralel çalışıyor, kullanıcı etkilenmez.

### Adım 6: Health check'e DB ekle

**Dosya:** `src/app/api/health/route.ts`

Yeni `checkDatabase()` fonksiyonu ekle:

```typescript
async function checkDatabase(): Promise<CheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, provider: 'neon-postgres' }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
```

`checks` objesine `database` ekle.

### Adım 7: `.env.example` güncelle

**Dosya:** `.env.example` ve `.env.production.example`

```
# === Neon Postgres ===
POSTGRES_PRISMA_URL="postgresql://..."
POSTGRES_URL_NON_POOLING="postgresql://..."
```

### Adım 8: Vercel production env vars

Vercel Dashboard'da `courtcontrolai-firebase` projesi için:
- `POSTGRES_PRISMA_URL` — Neon connection string (pooler)
- `POSTGRES_URL_NON_POOLING` — Neon connection string (direct)

Bu değerler `.env.local`'da zaten var, Vercel'e de set edilmeli.

---

## Dosya değişiklik özeti

| Dosya | Değişiklik | Bağımlılık |
|-------|-----------|------------|
| `package.json` | `@prisma/client` + `prisma` + `@auth/prisma-adapter` ekle | `npm install` |
| `prisma/schema.prisma` | Schema ismi düzelt (Adım 1'deki karara göre) | — |
| `src/lib/prisma.ts` | **YENİ** — Prisma client singleton | Adım 2 |
| `src/lib/auth.ts` | PrismaAdapter ekle, session strategy değiştir | Adım 2, 3 |
| `src/app/api/health/route.ts` | `checkDatabase()` ekle | Adım 3 |
| `.env.example` | Postgres env varları ekle | — |
| `.env.production.example` | Postgres env varları ekle | — |
| `scripts/setup-db.mjs` | Schema ismi düzelt (Adım 1'deki karara göre) | — |

---

## Migration stratejisi

1. **Local dev:** `npx prisma migrate dev --name init` — migration dosyası oluştur + apply et
2. **Production (Neon):** `npx prisma migrate deploy` — migration dosyalarını apply et (non-interactive)
3. **Alternatif (ilk kurulum):** `npx prisma db push` — migration dosyası olmadan schema'yı push et

**Öneri:** İlk kurulum olduğu için `db push` ile başla, sonra migration-based workflow'a geç.

---

## Env variable'lar (production)

| Variable | Zorunlu mu | Kaynak |
|----------|-----------|--------|
| `POSTGRES_PRISMA_URL` | ✅ Evet | Neon dashboard → connection string (pooler) |
| `POSTGRES_URL_NON_POOLING` | ✅ Evet | Neon dashboard → connection string (direct) |

---

## Müşteri demosunu etkileyen değişiklikler

| Değişiklik | Etki |
|-----------|------|
| NextAuth PrismaAdapter'a geç | Login akışı DB'ye taşınır. Firebase Auth paralel çalışıyor, kullanıcı etkilenmez. |
| Health check DB | Watchdog DB durumunu görecek, arıza durumunda Telegram alarmı gidecek. |

---

## Sınır dışı

- Marketing bu sprint'te scope dışı.
- `main` branch'e dokunulmaz.
- Sentinel denetim raporu gelmeden DB-bağımlı akışlarda implementasyon yapılmaz (sadece altyapı + bağlantı).

---

## Alt görevler (plan onayından sonra)

Bu plan büyük (8 adım, multi-PR). Child issue'lara bölünecek:

1. **Child 1:** Schema ismi düzelt + prisma bağımlılıkları ekle + generate (Adım 1-2-4)
2. **Child 2:** Prisma singleton + NextAuth adapter + health check (Adım 3-5-6)
3. **Child 3:** Env vars + .env.example + Vercel production set (Adım 7-8)
