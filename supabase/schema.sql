-- CouplesCalendar — database schema (Supabase / Postgres)
--
-- Every object uses the CC_ prefix. Postgres folds unquoted identifiers to
-- lower case, so these are created as cc_* and you can still write CC_events
-- in a query — it resolves to the same table.
--
-- Not wired to the app yet: phase 1 runs on a local store (src/lib/store.tsx).
-- This file is the target shape, so the switch is a store swap, not a rewrite.
-- Run it in the Supabase SQL editor when we start phase 2.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists cc_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null,
  avatar_color text not null default 'orange',
  created_at   timestamptz not null default now()
);

create table if not exists cc_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references cc_profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists cc_group_members (
  group_id  uuid not null references cc_groups (id) on delete cascade,
  user_id   uuid not null references cc_profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists cc_calendars (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null default 'personal' check (kind in ('personal', 'shared')),
  color      text not null default 'orange',
  owner_id   uuid not null references cc_profiles (id) on delete cascade,
  group_id   uuid references cc_groups (id) on delete set null,
  -- What people who share a group with the owner may see:
  --   details = the whole event, busy = an anonymous block, hidden = nothing.
  privacy    text not null default 'busy'
             check (privacy in ('details', 'busy', 'hidden')),
  created_at timestamptz not null default now(),
  constraint cc_calendars_shared_needs_group
    check ((kind = 'shared') = (group_id is not null))
);

-- Which calendars a given user currently shows (the sidebar checkboxes).
create table if not exists cc_calendar_visibility (
  user_id     uuid not null references cc_profiles (id) on delete cascade,
  calendar_id uuid not null references cc_calendars (id) on delete cascade,
  visible     boolean not null default true,
  primary key (user_id, calendar_id)
);

create table if not exists cc_events (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references cc_calendars (id) on delete cascade,
  title       text not null,
  notes       text,
  location    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  all_day     boolean not null default false,
  color       text,
  -- Overrides the calendar's privacy for this one event; null = inherit.
  privacy     text check (privacy in ('details', 'busy', 'hidden')),
  created_by  uuid not null references cc_profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cc_events_time_order check (ends_at >= starts_at)
);

-- The right-click → "add to their calendar" action: one row per person the
-- event was pushed to. Distinct from sharing a whole calendar with a group.
create table if not exists cc_event_shares (
  event_id   uuid not null references cc_events (id) on delete cascade,
  user_id    uuid not null references cc_profiles (id) on delete cascade,
  shared_by  uuid not null references cc_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists cc_events_calendar_time_idx
  on cc_events (calendar_id, starts_at);
create index if not exists cc_event_shares_user_idx
  on cc_event_shares (user_id);
create index if not exists cc_group_members_user_idx
  on cc_group_members (user_id);
create index if not exists cc_calendars_group_idx
  on cc_calendars (group_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer: they must not be filtered by the policies that
-- call them, otherwise membership checks recurse)
-- ---------------------------------------------------------------------------

create or replace function cc_is_group_member(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from cc_group_members
    where group_id = p_group and user_id = p_user
  );
$$;

-- A calendar is readable when you own it or you are in its group.
create or replace function cc_can_read_calendar(p_calendar uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from cc_calendars c
    where c.id = p_calendar
      and (c.owner_id = p_user or cc_is_group_member(c.group_id, p_user))
  );
$$;

-- What the viewer may see of one event: 'full', 'busy' or 'none'. Mirrors
-- accessFor() in src/lib/access.ts — keep the two in step.
create or replace function cc_event_access(p_event uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.owner_id = p_user then 'full'
    when c.kind = 'shared' and cc_is_group_member(c.group_id, p_user) then 'full'
    when exists (
      select 1 from cc_event_shares s
      where s.event_id = e.id and s.user_id = p_user
    ) then 'full'
    when not exists (
      select 1
      from cc_group_members mine
      join cc_group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = p_user and theirs.user_id = c.owner_id
    ) then 'none'
    when coalesce(e.privacy, c.privacy) = 'details' then 'full'
    when coalesce(e.privacy, c.privacy) = 'busy' then 'busy'
    else 'none'
  end
  from cc_events e
  join cc_calendars c on c.id = e.calendar_id
  where e.id = p_event;
$$;

-- Shared calendars are read/write for the whole group; personal ones only for
-- their owner. Tighten later if we add read-only members.
create or replace function cc_can_write_calendar(p_calendar uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select cc_can_read_calendar(p_calendar, p_user);
$$;

create or replace function cc_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cc_events_touch on cc_events;
create trigger cc_events_touch
  before update on cc_events
  for each row execute function cc_touch_updated_at();

-- New auth users get a profile automatically.
create or replace function cc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into cc_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists cc_on_auth_user_created on auth.users;
create trigger cc_on_auth_user_created
  after insert on auth.users
  for each row execute function cc_handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table cc_profiles            enable row level security;
alter table cc_groups              enable row level security;
alter table cc_group_members       enable row level security;
alter table cc_calendars           enable row level security;
alter table cc_calendar_visibility enable row level security;
alter table cc_events              enable row level security;
alter table cc_event_shares        enable row level security;

-- Profiles: yourself, plus anyone you share a group with.
create policy cc_profiles_read on cc_profiles for select using (
  id = auth.uid()
  or exists (
    select 1
    from cc_group_members mine
    join cc_group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = cc_profiles.id
  )
);
create policy cc_profiles_write on cc_profiles for update using (id = auth.uid());

-- Groups.
create policy cc_groups_read on cc_groups for select using (
  owner_id = auth.uid() or cc_is_group_member(id, auth.uid())
);
create policy cc_groups_insert on cc_groups for insert with check (owner_id = auth.uid());
create policy cc_groups_update on cc_groups for update using (owner_id = auth.uid());
create policy cc_groups_delete on cc_groups for delete using (owner_id = auth.uid());

-- Membership: members see the roster, the owner edits it.
create policy cc_group_members_read on cc_group_members for select using (
  user_id = auth.uid() or cc_is_group_member(group_id, auth.uid())
);
create policy cc_group_members_write on cc_group_members for all using (
  exists (select 1 from cc_groups g where g.id = group_id and g.owner_id = auth.uid())
) with check (
  exists (select 1 from cc_groups g where g.id = group_id and g.owner_id = auth.uid())
);

-- Calendars.
create policy cc_calendars_read on cc_calendars for select using (
  owner_id = auth.uid() or cc_is_group_member(group_id, auth.uid())
);
create policy cc_calendars_insert on cc_calendars for insert with check (owner_id = auth.uid());
create policy cc_calendars_update on cc_calendars for update using (owner_id = auth.uid());
create policy cc_calendars_delete on cc_calendars for delete using (owner_id = auth.uid());

-- Per-user view state.
create policy cc_visibility_all on cc_calendar_visibility for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Events: the base table only ever hands over rows the viewer may see in FULL.
-- Busy blocks come from the cc_calendar_feed view below, which is the only way
-- to learn that someone else's time is taken — the details never leave the row.
create policy cc_events_read on cc_events for select using (
  cc_event_access(id, auth.uid()) = 'full'
);
create policy cc_events_insert on cc_events for insert with check (
  created_by = auth.uid() and cc_can_write_calendar(calendar_id, auth.uid())
);
create policy cc_events_update on cc_events for update using (
  cc_can_write_calendar(calendar_id, auth.uid())
) with check (
  cc_can_write_calendar(calendar_id, auth.uid())
);
create policy cc_events_delete on cc_events for delete using (
  cc_can_write_calendar(calendar_id, auth.uid())
);

-- Per-event sharing.
create policy cc_event_shares_read on cc_event_shares for select using (
  user_id = auth.uid()
  or exists (
    select 1 from cc_events e
    where e.id = event_id and cc_can_read_calendar(e.calendar_id, auth.uid())
  )
);
create policy cc_event_shares_write on cc_event_shares for all using (
  shared_by = auth.uid()
  or exists (
    select 1 from cc_events e
    where e.id = event_id and cc_can_write_calendar(e.calendar_id, auth.uid())
  )
) with check (
  shared_by = auth.uid()
);

-- ---------------------------------------------------------------------------
-- Reading feed
--
-- Row level security can hide rows but not columns, so "busy" access is served
-- by this view: it is the only object the client selects events from. Rows the
-- viewer may only see as busy come back stripped to their times, with a
-- masked = true flag; everything else is refused outright.
-- ---------------------------------------------------------------------------

create or replace view cc_calendar_feed
with (security_invoker = false)
as
select
  e.id,
  e.calendar_id,
  c.owner_id,
  case when acc.level = 'full' then e.title else 'Busy' end        as title,
  case when acc.level = 'full' then e.notes end                    as notes,
  case when acc.level = 'full' then e.location end                 as location,
  e.starts_at,
  e.ends_at,
  e.all_day,
  case when acc.level = 'full' then e.color else 'slate' end       as color,
  case when acc.level = 'full' then e.created_by else c.owner_id end as created_by,
  (acc.level = 'busy')                                             as masked
from cc_events e
join cc_calendars c on c.id = e.calendar_id
cross join lateral (select cc_event_access(e.id, auth.uid()) as level) acc
where acc.level in ('full', 'busy');

grant select on cc_calendar_feed to authenticated;

-- Guests are only ever listed for events the viewer can see in full.
create or replace view cc_event_guests
with (security_invoker = false)
as
select s.event_id, s.user_id, s.shared_by
from cc_event_shares s
where cc_event_access(s.event_id, auth.uid()) = 'full';

grant select on cc_event_guests to authenticated;
