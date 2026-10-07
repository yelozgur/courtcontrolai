# Neon `neondb_owner` password rotation

**Status:** Manual, requires Neon console access. NEON_API_KEY is not
provisioned in this environment, so the rotation cannot be scripted from
the agent.

**Why:** The current `npg_WrmJEMbk2AC4` password has been in use since the
Neon project was created. It is the only credential that can DROP tables,
run `prisma migrate reset`, and read other tenants (`schema_geolease`,
`schema_idaim`, `neon_auth`). Rotation is hygiene, not incident response.

## Pre-conditions

- You can sign in to https://console.neon.tech and reach the
  `quiet-silence-78083144` project.
- The current password is in this machine's `.env.local` and in Vercel
  production envs (encrypted at rest, only this console / `vercel env pull`
  can show the values).

## Steps

1. **Generate a new password in Neon console**
   - Project settings → Database → "Reset password" (or "Rotate" if shown)
   - The new password replaces `npg_WrmJEMbk2AC4` for role `neondb_owner`.
   - Old password remains valid for ~60 seconds (Neon's default overlap);
     don't race it.

2. **Verify the new password before swapping the old one anywhere**
   ```
   psql "postgresql://neondb_owner:<NEW>@ep-ancient-frost-b2cfi3zs-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require" -c "select 1"
   ```
   Must return `?column? = 1`. If it fails, the password wasn't applied
   yet or you mistyped it.

3. **Update local `.env.local`**
   - Replace `npg_WrmJEMbk2AC4` in every `POSTGRES_*` and `DATABASE_URL*`
     line with the new password.
   - The local Postgres (`brew install postgresql@17`) is **separate** and
     unchanged; only the Neon-prefixed lines need editing.

4. **Update Vercel envs**
   For each of these names (all currently on Neon, all `eyJ2IjoidjIiLCJjIj…` Configs):
   - `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`
   - `DATABASE_URL`, `DATABASE_URL_UNPOOLED`
   - `PGHOST` (no password, but rotate connection-string refs anyway)
   - `POSTGRES_PASSWORD`, `PGPASSWORD`
   - `POSTGRES_URL_NO_SSL`
   Either re-paste the values in `vercel env rm` + `vercel env add` or use
   the Neon-Vercel integration's "Update connection string" button. After
   the change, Vercel will rebuild on the next push; you can also force it
   with `vercel --prod --yes` from a no-op commit.

5. **Trigger a Vercel rebuild and probe**
   - Wait for "Ready" in the Vercel dashboard.
   - `curl https://courtcontrolai-firebase.vercel.app/api/health` →
     `scheduler: ok:true, ai_quota: ...` (any non-`database_unavailable`
     response means Prisma could reach Neon).
   - `curl -X POST https://courtcontrolai-firebase.vercel.app/api/scheduler/solve -H 'content-type: application/json' -d '{"tournamentId":"rotate-probe"}'`
     → `401 unauthorised` (auth gate still good, no DB error).
   - **Negative probe:** confirm the old password is dead:
     ```
     psql "postgresql://neondb_owner:npg_WrmJEMbk2AC4@...neon.tech/neondb?sslmode=require" -c "select 1"
     ```
     Must return `FATAL: password authentication failed for user "neondb_owner"`.

6. **Revoke the old password** (only if Neon doesn't do this automatically
   on "Reset"). The console should mark the previous credential inactive.
   The overlap window in step 1 only matters if you need to roll back.

7. **Commit the local change**
   - `.env.local` is in `.gitignore`; nothing to commit for the password
     itself. Worth a one-line note in the project's `docs/` if you want
     the rotation date in git history.

## What this does NOT touch

- `schema_geolease` and `schema_idaim` are owned by the **same** `neondb_owner`
  role. Rotating that role's password affects every client of the Neon
  project. If those other apps share the password, you must rotate their
  envs in the same window. (This is exactly why the project was set up
  with one shared owner; the alternative is one role per tenant, which
  is its own operational cost.)
- Vercel `FIREBASE_ADMIN_*` envs: not present in this project, so no
  interaction.
- The local Postgres `ccai` database on this Mac: separate auth, no
  password rotation needed here.

## If something breaks

- Build fails with `P1001 Can't reach database` → Vercel envs didn't
  update; re-check `vercel env ls` vs the values you set.
- Build fails with `password authentication failed` → the new password
  wasn't applied to Neon before Vercel re-tried, or you copied a
  whitespace.
- Local Prisma stops working → `.env.local` not reloaded; re-source it
  (`set -a; source .env.local; set +a`) or restart your shell.

## Reference

- Neon project: `quiet-silence-78083144` (region eu-central-1)
- Host: `ep-ancient-frost-b2cfi3zs-pooler.c-6.eu-central-1.aws.neon.tech`
- Role: `neondb_owner` (the only owner; rotating it = rotating the
  superuser for this Neon project)
- Vercel project: `courtcontrolai-firebase` (`prj_lc6yIi3DGlT4P915Upa14cs8wsj9`)
