# CouplesCalendar

A shared calendar for the people you plan life with: your own calendars, group
calendars, and the ability to push a single event onto someone else's calendar
with a right-click.

**Phase 1 (this repo, now):** the calendar itself — month / week / day / agenda,
drag to create and move, groups, sharing UX — running entirely in the browser so
we can tune the look and feel before wiring a backend.

**Phase 2 (next):** Supabase auth + database, real multi-user sync, deploy to
Vercel. The schema is already written in [`supabase/schema.sql`](supabase/schema.sql).

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`.

## What works today

| Area | Details |
| --- | --- |
| Views | Day, Week, Month, Agenda — switch with the segmented control or `D` / `W` / `M` / `A` |
| Create | Click an empty slot, or drag down the time grid to draw a duration |
| Move | Drag an event to another day (month) or another time/day (week & day); drag the bottom edge to resize |
| Right-click an event | Open, duplicate, **add to their calendar** (per-person sharing), move to another calendar, recolour, delete |
| Right-click empty space | New event here, new all-day event, jump to that day |
| Calendars | Personal and group-shared, colour-coded, toggled from the sidebar |
| Groups | Create a group, pick members, invite by email, optionally spin up a shared calendar with it |
| Search | Filters the current view by title, location or notes |
| Theme | Light / dark, remembered per browser |
| URL | `?view=week&date=2026-08-16` — reloads and links land where you left off |

Keyboard: `T` today · `←` / `→` (or `J` / `K`) previous/next · `N` new event ·
`Esc` close.

## How sharing is modelled

Three distinct things, deliberately:

1. **Personal calendar** — yours alone.
2. **Group calendar** — owned by a group (`Us`, `Family`); every member reads and
   writes it. Create one from **My groups → +**.
3. **Per-event share** — a single event pushed onto specific people's calendars
   without sharing the whole calendar. That is the right-click →
   *Add to their calendar* flow, and the *Also on their calendar* row in the
   event editor.

## Project layout

```
src/
  app/
    layout.tsx        fonts, metadata, no-flash theme script
    page.tsx          mounts the store + the app
  components/
    CalendarApp.tsx   state owner: date, view, dialogs, context menus, shortcuts
    Sidebar.tsx       brand, mini month, calendar + group lists
    TopBar.tsx        navigation, search, view switch, theme
    MonthView.tsx     month grid with lane-packed event bars
    TimeGridView.tsx  week + day time grid (drag create / move / resize)
    AgendaView.tsx    upcoming list
    EventDialog.tsx   create + edit an event
    CalendarDialog.tsx / GroupDialog.tsx
    ContextMenu.tsx   right-click menus with submenus
    ui.tsx            buttons, modal, colour picker, avatars
  lib/
    types.ts          domain model (mirrors the SQL tables)
    date.ts           week/month maths, lane packing, overlap layout
    colors.ts         palette; colours are mixed in CSS so both themes work
    store.tsx         all reads/writes — the seam Supabase plugs into
    seed.ts           demo data, anchored to the current week
supabase/schema.sql   CC_ tables, RLS policies, triggers (phase 2)
```

## Data, and the road to Supabase

Everything lives in `localStorage` under `cc.state.v1`, behind the
`useStore()` API in `src/lib/store.tsx`. Every action there
(`createEvent`, `toggleEventShare`, `createGroup`, …) maps one-to-one onto a
table in `supabase/schema.sql`, so phase 2 replaces the bodies of those
functions with Supabase queries and the UI does not change.

To reset the demo content, clear the key from devtools or call
`useStore().resetDemoData()`.

Tables are prefixed `CC_` as agreed. Postgres folds unquoted identifiers to
lower case, so they are created as `cc_events`, `cc_groups`, … and `CC_events`
in a query still resolves to the same table.

When we start phase 2:

```bash
cp .env.local.example .env.local   # fill in the project URL + anon key
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · date-fns ·
lucide-react. Supabase for auth + data, Vercel for hosting.
