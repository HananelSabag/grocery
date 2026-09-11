-- Grocery — the operations that need more than a policy can express.
--
-- Each is SECURITY DEFINER for a specific reason stated at the function, and
-- each re-checks membership itself: running as the definer means RLS is not
-- doing it for them.

-- ---------------------------------------------------------------------------
-- First sign-in: mirror the Google identity, and hand the user a working list.
--
-- Landing on an empty screen with a "create your first list" button is a step
-- nobody wants — everyone who signs in wants a list, so they get one. Sharing
-- it later is what makes it a household list.
--
-- Wrapped so a failure here can never block a sign-up: worst case the user
-- lands without a list and ensure_list() makes one on first load.
-- ---------------------------------------------------------------------------
create or replace function grocery.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = grocery, pg_temp
as $fn$
declare
  v_list_id bigint;
begin
  insert into grocery.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into grocery.lists (owner_id) values (new.id) returning id into v_list_id;
  insert into grocery.list_members (list_id, user_id, role) values (v_list_id, new.id, 'owner');
  insert into grocery.trips (list_id, status) values (v_list_id, 'active');

  return new;
exception when others then
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created_grocery on auth.users;
create trigger on_auth_user_created_grocery
  after insert on auth.users
  for each row execute function grocery.handle_new_user();

-- ---------------------------------------------------------------------------
-- The list this user works in, created if they somehow have none.
-- Returns the list id; the client reads the list itself through RLS as usual.
-- ---------------------------------------------------------------------------
create or replace function grocery.ensure_list()
returns bigint
language plpgsql
security definer
set search_path = grocery, pg_temp
as $fn$
declare
  v_uid     uuid := auth.uid();
  v_list_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into grocery.profiles (id) values (v_uid) on conflict (id) do nothing;

  select m.list_id into v_list_id
  from grocery.list_members m
  join grocery.lists l on l.id = m.list_id
  where m.user_id = v_uid and l.archived_at is null
  order by m.joined_at
  limit 1;

  if v_list_id is null then
    insert into grocery.lists (owner_id) values (v_uid) returning id into v_list_id;
    insert into grocery.list_members (list_id, user_id, role) values (v_list_id, v_uid, 'owner');
  end if;

  -- Every list needs somewhere to put items.
  insert into grocery.trips (list_id, status)
  select v_list_id, 'active'
  where not exists (
    select 1 from grocery.trips t where t.list_id = v_list_id and t.status = 'active'
  );

  return v_list_id;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Redeem an invitation.
--
-- SECURITY DEFINER because the invitee is by definition not yet a member, so
-- no policy could let them read the row they are accepting. The token is the
-- credential: unknown, expired, and already-answered all fail the same way, so
-- guessing tokens tells you nothing.
-- ---------------------------------------------------------------------------
create or replace function grocery.accept_invitation(p_token uuid)
returns bigint
language plpgsql
security definer
set search_path = grocery, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_inv grocery.invitations;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_inv
  from grocery.invitations
  where token = p_token and status = 'pending' and expires_at > now()
  for update;

  if not found then
    raise exception 'invitation is not valid' using errcode = 'P0002';
  end if;

  insert into grocery.list_members (list_id, user_id, role)
  values (v_inv.list_id, v_uid, 'member')
  on conflict (list_id, user_id) do nothing;

  update grocery.invitations
     set status = 'accepted', responded_at = now(), invitee_id = v_uid
   where id = v_inv.id;

  return v_inv.list_id;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Finish the shopping run: close the current trip and open the next one.
--
-- Unpurchased items carry over — the usual reason an item is still unticked is
-- that the shop was out of it, and retyping it is the annoying part.
-- ---------------------------------------------------------------------------
create or replace function grocery.finish_trip(
  p_trip_id    bigint,
  p_store_name varchar default null,
  p_total_ils  numeric default null
)
returns bigint
language plpgsql
security definer
set search_path = grocery, pg_temp
as $fn$
declare
  v_list_id  bigint;
  v_new_trip bigint;
begin
  select list_id into v_list_id from grocery.trips where id = p_trip_id and status = 'active';
  if v_list_id is null then
    raise exception 'no such active trip' using errcode = 'P0002';
  end if;
  if not grocery.is_member(v_list_id) then
    raise exception 'not a member of this list' using errcode = '42501';
  end if;

  update grocery.trips
     set status = 'completed',
         store_name = coalesce(p_store_name, store_name),
         total_ils = coalesce(p_total_ils, total_ils),
         completed_by = auth.uid(),
         completed_at = now()
   where id = p_trip_id;

  insert into grocery.trips (list_id, status) values (v_list_id, 'active') returning id into v_new_trip;

  update grocery.items
     set trip_id = v_new_trip, updated_at = now()
   where trip_id = p_trip_id and is_purchased = false;

  return v_new_trip;
end;
$fn$;

-- Keep updated_at honest without the client having to remember. search_path is
-- pinned: without it the function resolves names against whatever the caller's
-- path happens to be.
create or replace function grocery.touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, pg_temp as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

create trigger items_touch    before update on grocery.items
  for each row execute function grocery.touch_updated_at();
create trigger lists_touch    before update on grocery.lists
  for each row execute function grocery.touch_updated_at();
create trigger profiles_touch before update on grocery.profiles
  for each row execute function grocery.touch_updated_at();

-- PostgREST reaches the schema through these; RLS still gates every row.
grant usage on schema grocery to anon, authenticated;
grant select, insert, update, delete on all tables in schema grocery to authenticated;
grant usage, select on all sequences in schema grocery to authenticated;
grant execute on function grocery.ensure_list() to authenticated;
grant execute on function grocery.accept_invitation(uuid) to authenticated;
grant execute on function grocery.finish_trip(bigint, varchar, numeric) to authenticated;
