# Screenshots

## What these files actually show (verified 2026-10-08)

The orchestrator opened every PNG in this directory and read the rendered content.

| File | What it shows | Usable as evidence |
|---|---|---|
| `home-2026-10-07.png` | Landing page | Yes |
| `tournaments-public-2026-10-07.png` | Public tournament list | Yes |
| `venues-list-2026-10-07.png` | **Login page** (stale, pre-fix) | **No** |
| `venues-detail-2026-10-07.png` | **Login page** (stale, pre-fix) | **No** |
| `venues-list-2026-10-08.png` | Venue list — "Main Arena" with 3 courts, Turkish hours starting Pazartesi, "Konsol / Mekanlar" breadcrumb, "Hesabım" dropdown | Yes |
| `venues-detail-2026-10-08.png` | Venue detail — "Açılış Saatleri" tab, Pazartesi 09:00–12:00 & 14:00–20:00, Turkish day labels | Yes |
| `venues-reorder-2026-10-08.png` | Court reorder — Court B moved to #1, Court A to #2, "Sahaları Yönet" tab | Yes |

The two `venues-*-2026-10-07.png` captures were taken without an authenticated session,
so the middleware redirected to `/login` and the venue screens never rendered. An earlier
report described `venues-list` as showing the venue list page. That was wrong: it is
byte-for-byte the same login screen as `venues-detail`. They are kept as the record of
what went wrong.

The `venues-*-2026-10-08.png` captures were taken with an authenticated test session
(`AUTH_TEST_ENABLED=true` locally) and show the Venue UI rendering correctly.

## How to capture an authenticated screen

1. Seed a club with an owner into Neon (`schema_courtcontrolai.Club`, `ownerId` set).
2. Obtain a session. The `test-session` credentials provider only exists when
   `AUTH_TEST_ENABLED=true`, which is deliberately **not** set in Vercel production.
   Either run the app locally with that flag, or capture against a local Postgres.
3. Use Playwright (it works in this environment and needs no TCC permission) to log
   in, navigate, then `page.screenshot()`.
4. Open the resulting PNG before claiming it. A file that exists is not a file that
   shows the feature.
