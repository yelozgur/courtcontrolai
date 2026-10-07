# Screenshots

## What these files actually show (verified 2026-10-08)

The orchestrator opened every PNG in this directory and read the rendered content.

| File | What it shows | Usable as evidence |
|---|---|---|
| `home-2026-10-07.png` | Landing page | Yes |
| `tournaments-public-2026-10-07.png` | Public tournament list | Yes |
| `venues-list-2026-10-07.png` | **Login page** | **No** |
| `venues-detail-2026-10-07.png` | **Login page** | **No** |

The two `venues-*` captures were taken without an authenticated session, so the
middleware redirected to `/login` and the venue screens never rendered. An earlier
report described `venues-list` as showing the venue list page. That was wrong: it
is byte-for-byte the same login screen as `venues-detail`.

**Consequence:** the Venue UI in PR #2 has no visual verification. The openHours
editor, court reordering and the venue-delete cascade warning are unproven.

## How to capture an authenticated screen

1. Seed a club with an owner into Neon (`schema_courtcontrolai.Club`, `ownerId` set).
2. Obtain a session. The `test-session` credentials provider only exists when
   `AUTH_TEST_ENABLED=true`, which is deliberately **not** set in Vercel production.
   Either run the app locally with that flag, or capture against a local Postgres.
3. Use Playwright (it works in this environment and needs no TCC permission) to log
   in, navigate, then `page.screenshot()`.
4. Open the resulting PNG before claiming it. A file that exists is not a file that
   shows the feature.
