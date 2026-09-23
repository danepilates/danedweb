# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

DANED Studio — a Pilates & Nutrition studio booking app (Spanish-language UI). Clients create an account, fill in a health profile, and book sessions against a weekly recurring schedule with per-session capacity. Admins manage the schedule, clients, plans, blocked dates, and payment-verification requests. See `README.md` and `public/llms.txt` for the product framing.

Next.js 16 App Router + React 19 + TypeScript, Supabase (Postgres + Auth + Storage) as the only backend, Tailwind CSS v4. No test suite exists in this repo.

## Commands

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config: eslint-config-next core-web-vitals + typescript)
```

There is no test runner configured — don't assume `npm test` exists.

Database schema changes are plain SQL files under `supabase/migrations/`, applied manually via the Supabase Dashboard SQL Editor (there's no CLI migration runner wired up). New migrations are numbered sequentially (`00NN_description.sql`) and each carries a comment block explaining the *why* — follow that convention.

## Architecture

**Next.js 16 breaking changes**: this project uses APIs that differ from pre-16 Next.js. Before writing framework code, check `node_modules/next/dist/docs/`. Notably: `src/proxy.ts` (not `middleware.ts`) is the proxy/middleware convention — see `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

**Supabase client boundary** (`src/lib/supabase/`) — three separate clients, don't mix them up:
- `server.ts` — `createClient()`, cookie-bound, respects RLS as the logged-in user. Use in Server Components/Server Actions.
- `client.ts` — browser client for Client Components.
- `admin.ts` — `createAdminClient()`, service-role key, **bypasses RLS**. `server-only`; only use after already verifying the caller is an admin (or for pre-auth lookups like username→email resolution during login).
- `middleware.ts` — `updateSession()`, called from `src/proxy.ts` on every matched request to refresh the auth token, since Server Components can't write cookies themselves.

**Authorization is enforced at the database layer, not just in app code.** RLS policies and Postgres triggers (see `supabase/migrations/`) are the actual security boundary — assume a crafted direct REST call could otherwise bypass any check that only exists in a server action. When adding a privileged field or an admin-only mutation, add/extend the corresponding RLS policy or trigger rather than relying on UI/action-level checks alone. Key mechanisms already in place:
- `is_admin()` — SECURITY DEFINER function, avoids RLS recursion on `profiles`.
- `protect_privileged_profile_fields` trigger — freezes `is_admin`/plan fields on UPDATE unless the actor is an admin (a transaction-local `app.bypass_profile_protection` flag lets the plan-booking trigger legitimately adjust `plan_classes_remaining` as a side effect).
- `protect_booking_immutable_fields` trigger — freezes which slot/date/service a booking points at for non-admins, and freezes `status` once a booking is `'pending'` (only an admin can move it out of that state).
- `check_booking_capacity` trigger — enforces per-slot capacity under row locking (`for update`) so concurrent bookings can't overbook; fires on both INSERT and UPDATE (re-activating a cancelled booking must recheck capacity too).
- `check_plan_booking_rules` / `refund_plan_class_on_cancel` triggers — enforce plan quotas/limits and decrement/refund `plan_classes_remaining` (see Plans below).

**Server actions** (`src/lib/actions/*.ts`, all `"use server"`) are the only write path from the UI — there's no separate API layer/route handlers for app data (route handlers exist only for `auth/confirm` and the iCal export at `calendar/[bookingId]`). Actions follow a consistent pattern: read the authenticated user via the server Supabase client, redirect to `/login` if absent, perform the mutation (relying on RLS/triggers for authorization), `revalidatePath(...)`, then `redirect(...)` back with query-string state (`?error=`, `?confirmed=`, etc.) rather than using client-side state/toasts. Admin actions additionally call a local `requireAdmin()` helper (checks `profiles.is_admin`, redirects non-admins to `/book`) — this is a UX nicety, not the security boundary; RLS is.

**Plans** (`src/lib/plan.ts` + migrations 0008/0011/0012/0014): plan state (`plan_type`, `plan_end_date`, `plan_classes_remaining`) is stored on `profiles`, but a paid plan is only "active" if `plan_end_date` hasn't passed — this is computed at **read time** (`getEffectivePlanType`) both in app code and mirrored in the DB trigger, so there's no cron job reverting expired plans. Plan types: `free` ("Diario", one active reservation at a time, goes through payment-verification), `silver`/`gold`/`vip` (fixed class quota + period, `gold`/`vip` also cap at 5 classes/calendar week), `custom` (admin-assigned arbitrary quota, no `plan_end_date`/no expiry — only ends when the balance hits 0). When touching plan logic, changes usually need to land in both `lib/plan.ts` and the matching SQL trigger — they're intentionally kept in sync.

**Diario (free-plan) booking flow** (migration 0012): a free-plan booking inserts as `status = 'pending'` (excluded from capacity counts) instead of `'booked'`. The client has 15 minutes to report payment (`markPaymentReported` sets `payment_reported_at`, informational only); an admin then approves (→ `'booked'`) or rejects (→ `'rejected'`) from the admin bookings view. Expired pending requests aren't swept by a cron — they're just excluded from the "one active reservation" check once 15 minutes pass, and lazily flipped server-side on next admin view load.

**Login is username-based**, not email-based (`src/lib/actions/auth.ts`): the login action resolves `username` → `auth.users.email` server-side via the admin client (case-insensitive `ilike` match) before calling `signInWithPassword`. Email is still used internally for Supabase Auth itself and password-reset mail.

**Rate limiting** (`src/lib/rate-limit.ts`) is a simple Postgres-backed fixed-window limiter (`rate_limit_hits` table, service-role only) used per-action (`login`, `signup`, `create-booking`, etc.), keyed by IP or user id. It fails open on any error so a limiter problem never blocks core flows.

**Timezone**: the studio operates in `STUDIO_TIMEZONE` (`America/Guayaquil`, set via env). Date/time comparisons for booking rules happen in this timezone both client-side (`src/lib/dates.ts`) and inside SQL triggers (`now() at time zone 'America/Guayaquil'`) — keep both in sync if the rules change.

**Route structure** (`src/app/`): public pages (`/`, `/login`, `/signup`, `/forgot-password`) plus client pages (`/book`, `/my-bookings`, `/profile`) and an admin section (`/admin`, `/admin/schedule`, `/admin/clients/[id]`, `/admin/blocked-dates`, `/admin/custom-fields`) — access to the latter is gated by RLS + `requireAdmin()`, not route-level middleware.
