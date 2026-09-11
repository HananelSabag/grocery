# Grocery — רשימת קניות משותפת

A shared household shopping list. Everyone on the list sees the same items in
real time; one person shops, the rest watch items get ticked off from home.

Mobile-first PWA, Hebrew and English (RTL/LTR), Google sign-in only.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Client | React 18 + Vite | |
| Styling | Tailwind (mobile-first) | |
| Data | Supabase Postgres, queried directly from the browser | No API server to keep awake |
| Auth | Supabase Auth — Google only | No passwords to store, reset, or leak |
| Authorization | Row Level Security | The database is the only gate, so a bug in the client cannot leak another household's list |
| Hosting | Vercel | |

There is **no backend service**. The browser talks to Supabase, and every rule
about who may read or write what lives in RLS policies next to the data.

## Getting started

```bash
npm install
cp .env.example .env      # fill in the two Supabase values
npm run dev
```

## Project layout

```
src/
  lib/          Supabase client, query client
  stores/       auth + language (zustand)
  i18n/         he / en strings
  hooks/        data access — one hook per concern
  components/   UI
  pages/        routed screens
```

## Status

Work in progress — see commit history.
