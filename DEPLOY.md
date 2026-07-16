# CourtControl AI — Production Deployment

Bu dokuman Firebase App Hosting uzerinden production'a deploy icin adim adim rehber.

## On Kosullar

1. Firebase CLI yuklu: `npm install -g firebase-tools`
2. Firebase login: `firebase login`
3. Production project ID: `courtcontrolai-2294b`
4. Service account: Firebase Console > Project Settings > Service Accounts > Generate new private key

## Adim 1: Environment Secrets

Secret'lar Firebase App Hosting uzerinden set edilir (NOT .env dosyasinda):

```bash
# Google AI API key (Gemini Flash-Lite)
firebase apphosting:secrets:set --project courtcontrolai-2294b GOOGLE_GENAI_API_KEY

# Telegram bot token
firebase apphosting:secrets:set --project courtcontrolai-2294b TELEGRAM_BOT_TOKEN
```

Her secret icin interaktif olarak deger girmeniz istenir. Google AI key icin: https://aistudio.google.com/apikey

## Adim 2: Firestore Rules Production Deploy

Emulator'da test edilen rules production'a deploy edilir:

```bash
firebase deploy --only firestore:rules --project courtcontrolai-2294b
```

## Adim 3: App Hosting Deploy

```bash
# Production build test (lokal)
npm run build
npm start  # http://localhost:3000

# Deploy
firebase apphosting:deploy --project courtcontrolai-2294b
```

Ilk deploy 5-10 dakika surebilir (Cloud Build, container build, deploy).

## Adim 4: Custom Domain (Opsiyonel)

Firebase Console > App Hosting > Add custom domain (orn: courtcontrol.ai)

SSL sertifikasi otomatik (Let's Encrypt).

## Adim 5: Monitoring

- Logs: Firebase Console > App Hosting > Logs (Cloud Logging uzerinden)
- Errors: Firebase Console > Crashlytics (opsiyonel entegrasyon)
- Performance: Firebase Console > Performance Monitoring
- Emulator ile production data FARKLI — emulator: `demo-app`, production: `courtcontrolai-2294b`

## Environment Variables Reference

| Key | Public? | Source | Purpose |
|-----|---------|--------|---------|
| `NEXT_PUBLIC_FIREBASE_*` | Yes (bundled) | `apphosting.yaml` veya Firebase Console | Firebase client config |
| `NEXT_PUBLIC_USE_EMULATOR` | Yes | Set to `false` in production | Disable emulator connection |
| `GOOGLE_GENAI_API_KEY` | No (server) | Secret Manager | Gemini Flash-Lite AI |
| `TELEGRAM_BOT_TOKEN` | No (server) | Secret Manager | Telegram notifications |

## GitHub Actions CI/CD (Opsiyonel)

`.github/workflows/deploy.yml` olusturarak her `main` push'unda otomatik deploy:

```yaml
name: Deploy to Firebase App Hosting
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: \${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: \${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: courtcontrolai-2294b
```

## Rollback

```bash
firebase apphosting:rollback --project courtcontrolai-2294b
```

## Troubleshooting

- **Build fail:** `npm run build` lokal calistirin, hata mesajini okuyun
- **500 errors:** Firebase Console > Logs > Cloud Run logs
- **Auth issues:** `apphosting.yaml` veya Firebase Console'da `NEXT_PUBLIC_*` degerlerini kontrol edin
- **Emulator verileri production'a gitmez:** farkli project ID'ler (`demo-app` vs `courtcontrolai-2294b`)

## URL

Production URL (default): `https://courtcontrolai-2294b.web.app`

Custom domain ekledikten sonra: `https://your-domain.com`
