-- Admin, done in RLS rather than in a privileged backend.
--
-- Baby-Tracker solves this with an edge function holding the service_role key,
-- because that key can read anything. There is no edge function here and no
-- server to hide a key in, so the reach has to be granted in policy: an admin
-- is a row in a table, and every table gets one extra read policy saying "…or
-- an admin".
--
-- The trade is a good one. The elevation is visible in the schema, revocable
-- with a DELETE, and — unlike a service key — cannot write anything it was not
-- already allowed to write. Admin here is a wider SELECT, not a second
-- superuser, which is also why the panel is read-only.

create table grocery.admins (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

-- Kept in a row rather than hardcoded in a function so it can change without a
-- migration, and in the database rather than a client env var because a
-- client-side check is a suggestion, not a rule.
insert into grocery.admins (email, note) values ('hananel12345@gmail.com', 'owner');

alter table grocery.admins enable row level security;

-- Reads the address out of the JWT, never out of auth.users — a policy runs as
-- the querying role and `authenticated` has no privilege on that table. That
-- exact mistake already broke the invitations policy once (see 0003).
create or replace function grocery.is_admin()
returns boolean language sql security definer stable
set search_path = grocery, pg_temp as $fn$
  select exists (
    select 1 from grocery.admins a
    where lower(a.email) = lower(nullif(auth.jwt() ->> 'email', ''))
  );
$fn$;

-- An admin may see who the admins are. Nobody may edit the list from a client:
-- there is no insert/update/delete policy, so adding one is a deliberate act in
-- the SQL editor.
create policy admins_read_self on grocery.admins
  for select to authenticated using (grocery.is_admin());

-- ── The address, so the panel can show who a person is ─────────────────────
-- profiles carried a name and a picture but no email, which is the one field
-- that actually identifies an account.
alter table grocery.profiles add column if not exists email text;

update grocery.profiles p set email = u.email
  from auth.users u where u.id = p.id and p.email is null;

create or replace function grocery.handle_new_user()
returns trigger language plpgsql security definer
set search_path = grocery, pg_temp as $fn$
declare v_list_id bigint;
begin
  insert into grocery.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do update set email = excluded.email;

  insert into grocery.lists (owner_id) values (new.id) returning id into v_list_id;
  insert into grocery.list_members (list_id, user_id, role) values (v_list_id, new.id, 'owner');
  insert into grocery.trips (list_id, status) values (v_list_id, 'active');
  return new;
exception when others then
  return new;
end;
$fn$;

-- ── Admin reach ────────────────────────────────────────────────────────────
-- Deliberately separate policies rather than "or is_admin()" bolted onto the
-- member ones: the member rule stays exactly as it is and as it is tested, and
-- what admin adds is legible on its own.

create policy profiles_read_admin     on grocery.profiles     for select to authenticated using (grocery.is_admin());
create policy lists_read_admin        on grocery.lists        for select to authenticated using (grocery.is_admin());
create policy list_members_read_admin on grocery.list_members for select to authenticated using (grocery.is_admin());
create policy trips_read_admin        on grocery.trips        for select to authenticated using (grocery.is_admin());
create policy items_read_admin        on grocery.items        for select to authenticated using (grocery.is_admin());
create policy invitations_read_admin  on grocery.invitations  for select to authenticated using (grocery.is_admin());

grant select on grocery.admins to authenticated;

-- ── What the panel reads ───────────────────────────────────────────────────
-- SECURITY DEFINER because these aggregate across every household, and each
-- re-checks is_admin() in its own body: running as the definer means RLS is not
-- checking for them, so the guard has to be here or the function IS the leak.

create or replace function grocery.admin_overview()
returns table (
  users bigint, lists bigint, shared_lists bigint, active_items bigint,
  completed_trips bigint, pending_invites bigint, signups_7d bigint, active_7d bigint
)
language plpgsql security definer set search_path = grocery, pg_temp as $fn$
begin
  if not grocery.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from grocery.profiles),
    (select count(*) from grocery.lists where archived_at is null),
    -- The number worth watching: a list nobody shared is one person's notepad.
    (select count(*) from (
       select list_id from grocery.list_members group by list_id having count(*) > 1) s),
    (select count(*) from grocery.items i
       join grocery.trips t on t.id = i.trip_id where t.status = 'active'),
    (select count(*) from grocery.trips where status = 'completed'),
    (select count(*) from grocery.invitations where status = 'pending' and expires_at > now()),
    (select count(*) from grocery.profiles where created_at > now() - interval '7 days'),
    -- "Active" means they changed something, not that they opened the app.
    (select count(distinct i.added_by) from grocery.items i
      where i.updated_at > now() - interval '7 days' and i.added_by is not null);
end;
$fn$;

create or replace function grocery.admin_users()
returns table (
  id uuid, email text, display_name text, avatar_url text, created_at timestamptz,
  lists bigint, owns bigint, items_added bigint, trips_closed bigint,
  last_active timestamptz, is_admin boolean
)
language plpgsql security definer set search_path = grocery, pg_temp as $fn$
begin
  if not grocery.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  return query
  select p.id, p.email, p.display_name, p.avatar_url, p.created_at,
    (select count(*) from grocery.list_members m where m.user_id = p.id),
    (select count(*) from grocery.lists l where l.owner_id = p.id and l.archived_at is null),
    (select count(*) from grocery.items i where i.added_by = p.id),
    (select count(*) from grocery.trips t where t.completed_by = p.id),
    greatest(
      (select max(i.updated_at) from grocery.items i where i.added_by = p.id),
      (select max(m.last_opened_at) from grocery.list_members m where m.user_id = p.id)),
    exists (select 1 from grocery.admins a where lower(a.email) = lower(p.email))
  from grocery.profiles p
  order by p.created_at desc;
end;
$fn$;

create or replace function grocery.admin_lists()
returns table (
  id bigint, name varchar, owner_name text, owner_email text,
  members bigint, active_items bigint, trips bigint,
  created_at timestamptz, archived_at timestamptz
)
language plpgsql security definer set search_path = grocery, pg_temp as $fn$
begin
  if not grocery.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  return query
  select l.id, l.name, p.display_name, p.email,
    (select count(*) from grocery.list_members m where m.list_id = l.id),
    (select count(*) from grocery.items i join grocery.trips t on t.id = i.trip_id
      where t.list_id = l.id and t.status = 'active'),
    (select count(*) from grocery.trips t where t.list_id = l.id and t.status = 'completed'),
    l.created_at, l.archived_at
  from grocery.lists l
  left join grocery.profiles p on p.id = l.owner_id
  order by l.created_at desc;
end;
$fn$;

-- Callable by any signed-in user; each refuses anyone who is not an admin. The
-- alternative — granting only to a privileged role — would need a server to
-- hold that role's key.
grant execute on function grocery.admin_overview() to authenticated;
grant execute on function grocery.admin_users()    to authenticated;
grant execute on function grocery.admin_lists()    to authenticated;
