<div align="center">

<img src="public/pwa-192.png" width="88" alt="">

# רשימת קניות · Grocery

**A shared household shopping list.**
Everyone on the list sees the same items as they change — one person shops,
the rest watch things get ticked off from home.

Mobile-first PWA · Hebrew & English (RTL/LTR) · Google sign-in · no backend

</div>

---

## What it does

- **One list, shared.** Add an item on your phone, it appears on everyone else's.
  Changes arrive over a Postgres replication stream, not a poll.
- **Adding an item is one line.** A docked composer, not a button that opens a
  form: type, press enter, type the next one. The field keeps focus between
  adds, because items arrive in bursts — *milk, bread, tomatoes*.
- **The aisle is guessed as you type.** A tuned Hebrew-first vocabulary picks
  the supermarket section from the item's name, shown as the leading icon and
  correctable in one tap. The list then sorts itself in the order you actually
  walk a shop.
- **A shop has a beginning and an end.** Finishing one closes it into history
  with the store and the total, opens the next, and carries unbought items
  over — the usual reason something is still unticked is that the shop was out
  of it.
- **Photos, links and notes** for the item that needs them: a picture matters
  for the one specific yoghurt, not for bread.
- **Invite by link or by email.** Someone can be on more than one list.

## Architecture

There is **no application server**. The browser talks to Supabase directly, and
every rule about who may read or write what lives in Row Level Security next to
the data.

```
  Browser  ──────────────►  Supabase Postgres
  React + Vite              ├─ schema `grocery`  (6 tables, 22 RLS policies)
  Supabase JS               ├─ Supabase Auth     (Google only)
                            ├─ Realtime          (items → every open phone)
                            └─ Storage           (item photos, receipts)
```

| Layer | Choice | Why |
|---|---|---|
| Client | React 18 + Vite | |
| Styling | Tailwind, mobile-first | |
| Server state | TanStack Query + Supabase Realtime | |
| Client state | Zustand (auth, language, theme, active list) | |
| Auth | Supabase Auth — Google only | No passwords to store, reset, or leak |
| **Authorization** | **Row Level Security** | With no server in the path, the database is the only gate — so the policies are the whole security model, not defence in depth |
| Hosting | Vercel | Static; nothing to keep awake |

### Why RLS is the interesting part

This list used to live inside a larger app, behind Express middleware that
resolved membership, checked ownership, and made sure naming someone else's
list got you your own rather than theirs. All of that had to survive the move
into policies — and since nothing sits between the browser and Postgres any
more, a mistake there is not a bug, it is a leak.

So the policies are tested directly rather than inferred from the UI.
[`supabase/tests/rls.sql`](supabase/tests/rls.sql) creates two households,
acts as one through PostgREST's own role and claims, and asserts that:

| Attempt | Result |
|---|---|
| Read the other household's list | 0 rows |
| Add an item to their list | blocked, `42501` |
| Add yourself to their list | blocked, `42501` |
| Rename their list | 0 rows changed |
| Delete their items | 0 rows deleted |
| Anything at all, signed out | refused at the grant, before RLS is consulted |

Re-run it after touching a policy. It wraps everything in a rollback.

### Things worth knowing before changing something

- **`grocery` must stay in Supabase's Exposed Schemas** (Settings → API).
  Without it every query fails with `PGRST106 Invalid schema`.
- **`is_member` / `is_owner` are `SECURITY DEFINER` on purpose.** A policy on
  `list_members` that queried `list_members` would recurse forever. Don't
  "simplify" them into inline subqueries.
- **Items hang off a trip, not a list.** The active trip's items *are* the
  current list; a partial unique index enforces one active trip per list, so
  two people tapping *finish* at the same moment cannot leave two open.
- **Editing carries the version it read.** Ticking an item off is optimistic
  and never interrupts — two people ticking the same thing a second apart is
  not a conflict anyone cares about — but an edit that lost a race says so
  rather than silently overwriting the other person.
- **Language defaults to Hebrew unconditionally,** not from
  `navigator.language`: phones here are routinely set to English while the
  people holding them want Hebrew.

## Running it

```bash
npm install
cp .env.example .env      # the two Supabase values; both are public by design
npm run dev               # http://localhost:5174
```

`npm test` · `npm run lint` · `npm run build`

Both `.env` values are safe in a browser bundle: the publishable key grants
nothing on its own, because every table is behind RLS and every policy keys off
`auth.uid()`.

## Layout

```
src/
  lib/          Supabase client, the api shim, categories, the aisle guesser
  stores/       auth · language · theme · active list   (zustand)
  i18n/         he / en — the grocery bundle plus this app's own strings
  hooks/        list state and actions, sharing, history, toasts, insets
  components/   the list row, the sheets, the composer, the toolbar
  pages/        sign in · list · profile · invite
supabase/
  migrations/   the whole schema, consolidated
  tests/        the RLS proof above
```

## History

Extracted from [SpendWise](https://github.com/HananelSabag/SpendWise), where it
grew as a side feature. The bridge between them — turning a finished shop into
a SpendWise expense — was built, shipped, and used exactly zero times across
every trip ever completed. That number is what settled the question: the two
apps were never really one.

The screens came across as they were. What changed is everything underneath
them.
