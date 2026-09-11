-- Grocery — full schema, consolidated.
--
-- This is the whole database: six tables in a `grocery` schema, on Supabase
-- Auth (auth.users), with Row Level Security carrying all authorization.
-- There is no application server, so RLS is not defence in depth here — it is
-- the only defence. Every policy below is load-bearing.
--
-- Applied to the live project as four migrations:
--   grocery_schema_init, grocery_rls_policies,
--   grocery_functions, grocery_harden_touch_function

create schema if not exists grocery;

-- === Tables ================================================================

-- The readable half of auth.users (which the client cannot select), so the
-- list can show who added an item and who bought it.
create table grocery.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table grocery.lists (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        varchar(120) not null default 'הבית',
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table grocery.list_members (
  id             bigint generated always as identity primary key,
  list_id        bigint not null references grocery.lists(id) on delete cascade,
  user_id        uuid   not null references auth.users(id) on delete cascade,
  role           varchar(16) not null default 'member' check (role in ('owner','member')),
  joined_at      timestamptz not null default now(),
  last_opened_at timestamptz,
  unique (list_id, user_id)
);
create index list_members_user_idx on grocery.list_members (user_id);

-- One shopping run. A list always has exactly one active trip, and that trip's
-- items ARE the current list — which is why items hang off a trip, not a list.
create table grocery.trips (
  id           bigint generated always as identity primary key,
  list_id      bigint not null references grocery.lists(id) on delete cascade,
  status       varchar(16) not null default 'active' check (status in ('active','completed')),
  store_name   varchar(120),
  total_ils    numeric(12,2),
  receipt_path text,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
-- The invariant, enforced rather than assumed: two people tapping "finish" at
-- the same moment cannot leave the list with two active trips.
create unique index trips_one_active_per_list on grocery.trips (list_id) where status = 'active';
create index trips_list_completed_idx on grocery.trips (list_id, completed_at desc);

create table grocery.items (
  id              bigint generated always as identity primary key,
  trip_id         bigint not null references grocery.trips(id) on delete cascade,
  name            varchar(200) not null,
  category_key    varchar(40) not null default 'other',
  quantity        numeric(10,2),
  unit            varchar(24),
  note            text,
  image_url       text,
  product_url     text,
  sort_order      integer not null default 0,
  is_purchased    boolean not null default false,
  added_by        uuid references auth.users(id) on delete set null,
  purchased_by    uuid references auth.users(id) on delete set null,
  purchased_at    timestamptz,
  -- Optimistic concurrency: every update carries the version it read.
  version         integer not null default 1,
  -- A short soft claim so two phones don't open the same editor. A courtesy —
  -- `version` is what actually prevents a lost update.
  editing_user_id uuid references auth.users(id) on delete set null,
  editing_until   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index items_trip_idx on grocery.items (trip_id, is_purchased, sort_order);

create table grocery.invitations (
  id            bigint generated always as identity primary key,
  list_id       bigint not null references grocery.lists(id) on delete cascade,
  inviter_id    uuid   not null references auth.users(id) on delete cascade,
  invitee_email varchar(255),
  invitee_id    uuid references auth.users(id) on delete set null,
  token         uuid   not null unique default gen_random_uuid(),
  status        varchar(16) not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  expires_at    timestamptz not null default (now() + interval '14 days'),
  responded_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index invitations_list_idx on grocery.invitations (list_id, status);
create index invitations_email_idx on grocery.invitations (lower(invitee_email), status);

-- === Membership helpers ====================================================
-- SECURITY DEFINER on purpose: a policy on list_members that queried
-- list_members would recurse forever. These run as the definer, so the lookup
-- inside them is not itself policy-checked.

create or replace function grocery.is_member(p_list_id bigint)
returns boolean language sql security definer stable set search_path = grocery, pg_temp as $fn$
  select exists (select 1 from grocery.list_members m
                 where m.list_id = p_list_id and m.user_id = auth.uid());
$fn$;

create or replace function grocery.is_owner(p_list_id bigint)
returns boolean language sql security definer stable set search_path = grocery, pg_temp as $fn$
  select exists (select 1 from grocery.list_members m
                 where m.list_id = p_list_id and m.user_id = auth.uid() and m.role = 'owner');
$fn$;

create or replace function grocery.trip_list_id(p_trip_id bigint)
returns bigint language sql security definer stable set search_path = grocery, pg_temp as $fn$
  select t.list_id from grocery.trips t where t.id = p_trip_id;
$fn$;

-- === RLS ===================================================================
-- The rules the Express middleware used to carry:
--   * you see a list only if you are a member of it
--   * only the owner manages membership
--   * naming a list you are not on gets you nothing

alter table grocery.profiles     enable row level security;
alter table grocery.lists        enable row level security;
alter table grocery.list_members enable row level security;
alter table grocery.trips        enable row level security;
alter table grocery.items        enable row level security;
alter table grocery.invitations  enable row level security;

create policy profiles_read_self_and_listmates on grocery.profiles
  for select to authenticated using (
    id = auth.uid() or exists (
      select 1 from grocery.list_members mine
      join grocery.list_members theirs on theirs.list_id = mine.list_id
      where mine.user_id = auth.uid() and theirs.user_id = grocery.profiles.id));
create policy profiles_update_self on grocery.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy lists_read_member on grocery.lists
  for select to authenticated using (grocery.is_member(id));
create policy lists_insert_own on grocery.lists
  for insert to authenticated with check (owner_id = auth.uid());
create policy lists_update_owner on grocery.lists
  for update to authenticated using (grocery.is_owner(id)) with check (grocery.is_owner(id));
create policy lists_delete_owner on grocery.lists
  for delete to authenticated using (grocery.is_owner(id));

create policy members_read_same_list on grocery.list_members
  for select to authenticated using (grocery.is_member(list_id));
-- Either the owner adds someone, or you add yourself to a list you just made.
-- Accepting an invitation goes through accept_invitation() instead.
create policy members_insert_owner_or_self_owned on grocery.list_members
  for insert to authenticated with check (
    grocery.is_owner(list_id) or (user_id = auth.uid() and exists (
      select 1 from grocery.lists l where l.id = list_id and l.owner_id = auth.uid())));
create policy members_update_owner on grocery.list_members
  for update to authenticated using (grocery.is_owner(list_id)) with check (grocery.is_owner(list_id));
-- The owner removes anyone; a member may always leave.
create policy members_delete_owner_or_self on grocery.list_members
  for delete to authenticated using (grocery.is_owner(list_id) or user_id = auth.uid());

create policy trips_read_member   on grocery.trips for select to authenticated using (grocery.is_member(list_id));
create policy trips_insert_member on grocery.trips for insert to authenticated with check (grocery.is_member(list_id));
create policy trips_update_member on grocery.trips for update to authenticated
  using (grocery.is_member(list_id)) with check (grocery.is_member(list_id));
create policy trips_delete_owner  on grocery.trips for delete to authenticated using (grocery.is_owner(list_id));

create policy items_read_member   on grocery.items for select to authenticated
  using (grocery.is_member(grocery.trip_list_id(trip_id)));
create policy items_insert_member on grocery.items for insert to authenticated
  with check (grocery.is_member(grocery.trip_list_id(trip_id)));
create policy items_update_member on grocery.items for update to authenticated
  using (grocery.is_member(grocery.trip_list_id(trip_id)))
  with check (grocery.is_member(grocery.trip_list_id(trip_id)));
create policy items_delete_member on grocery.items for delete to authenticated
  using (grocery.is_member(grocery.trip_list_id(trip_id)));

-- Two audiences: the owner managing what they sent, the invitee seeing what
-- waits for them. The token is not a read path — redeeming goes through
-- accept_invitation(), so an unknown token reveals nothing.
create policy invitations_read_owner_or_invitee on grocery.invitations
  for select to authenticated using (
    grocery.is_owner(list_id)
    or lower(invitee_email) = lower((select email from auth.users where id = auth.uid())));
create policy invitations_insert_owner on grocery.invitations
  for insert to authenticated with check (grocery.is_owner(list_id) and inviter_id = auth.uid());
create policy invitations_update_owner on grocery.invitations
  for update to authenticated using (grocery.is_owner(list_id)) with check (grocery.is_owner(list_id));
create policy invitations_delete_owner on grocery.invitations
  for delete to authenticated using (grocery.is_owner(list_id));
