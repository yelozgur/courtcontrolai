# Screenshots

## What these files actually show (verified 2026-10-08)

The orchestrator opened every PNG in this directory and read the rendered content.

| File | What it shows | Usable as evidence |
|---|---|---|
| `home-2026-10-07.png` | Landing page — "DOMINATE YOUR ARENA" hero, "Court Control AI" branding, Events/Arena nav | Yes |
| `tournaments-public-2026-10-07.png` | Public tournament list — "LIVE COMPETITIONS" header, two tournament cards (Padel $20, Badminton free), "Club Console" button | Yes |
| `venues-list-2026-10-08.png` | Admin venues list — "Mekanlar" page, "Main Arena" with 3 courts (Court A/B/C), Turkish hours, "Konsol / Mekanlar" breadcrumb | Yes |
| `venues-detail-2026-10-08.png` | Venue edit — "Mekanı Düzenle" / "Açılış Saatleri" tab, Pazartesi 09:00 AM–12:00 PM & 02:00 PM–08:00 PM, Turkish day labels | Yes |
| `venues-reorder-2026-10-08.png` | Court reorder — "Sahalar (3)" with Court B at #1, Court A at #2, drag handles visible, "Mekan Ayarları" section | Yes |

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
