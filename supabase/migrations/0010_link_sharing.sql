-- Sharing is a link. Nothing else.
--
-- The code was a detour: a six-character token shown on screen so it could be
-- read aloud, a field to type one into, and a sheet crowded with both. Asked for
-- instead: copy the link or send it, and that is the whole of it. The link has
-- always been the code in a URL, so what changes here is only what the code is
-- for — nobody types it any more, so it no longer has to be short.
--
-- Also here, because it is the other half of "a new person gets a link": someone
-- who signs up by following one already has an empty list, made for them by the
-- sign-up trigger, and joining the list they were sent is the reason they came.
-- That untouched list is put away when they join, so the first thing they see is
-- the list they were invited to — not a choice between it and an empty one.

-- ── Longer tokens ───────────────────────────────────────────────────────────
-- Twelve characters from the same unambiguous alphabet: 32^12, about 1.2e18.
-- Links already sent keep working until their owner replaces them.
create or replace function grocery.random_join_code()
returns text
language sql volatile
as $fn$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1),
    ''
  )
  from generate_series(1, 12);
$fn$;

-- ── Knowing you are already in ──────────────────────────────────────────────
-- Tapping a link to a list you are already on should just take you there, not
-- ask you to join it. The return type changes, so it is dropped and made again.
drop function if exists grocery.lookup_list_by_code(text);

create function grocery.lookup_list_by_code(p_code text)
returns table (list_id bigint, list_name text, owner_name text, member_count int, already_member boolean)
language plpgsql stable security definer
set search_path = grocery, pg_temp
as $fn$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  return query
  select l.id,
         l.name::text,
         p.display_name::text,
         (select count(*)::int from grocery.list_members m where m.list_id = l.id),
         exists (select 1 from grocery.list_members m where m.list_id = l.id and m.user_id = auth.uid())
  from grocery.lists l
  left join grocery.profiles p on p.id = l.owner_id
  where l.join_code = upper(btrim(p_code))
    and l.archived_at is null;
end;
$fn$;

-- ── Joining ─────────────────────────────────────────────────────────────────
create or replace function grocery.join_by_code(p_code text)
returns bigint
language plpgsql volatile security definer
set search_path = grocery, pg_temp
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_list   bigint;
  v_joined boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select l.id into v_list
  from grocery.lists l
  where l.join_code = upper(btrim(p_code))
    and l.archived_at is null;

  if v_list is null then
    raise exception 'no such code' using errcode = 'P0002';
  end if;

  insert into grocery.profiles (id) values (v_uid) on conflict (id) do nothing;

  insert into grocery.list_members (list_id, user_id, role)
  values (v_list, v_uid, 'member')
  on conflict (list_id, user_id) do nothing;
  v_joined := found;

  -- Only on an actual join, and only a list that holds nothing at all: the one
  -- sign-up made, never named, never shared, never used, and the only one this
  -- person owns. Archived, like every other removal here, not deleted.
  if v_joined then
    update grocery.lists l
       set archived_at = now()
     where l.owner_id = v_uid
       and l.id <> v_list
       and l.archived_at is null
       and l.name is null
       and (select count(*) from grocery.lists o
             where o.owner_id = v_uid and o.archived_at is null) = 1
       and not exists (select 1 from grocery.list_members m
                        where m.list_id = l.id and m.user_id <> v_uid)
       and not exists (select 1 from grocery.trips t
                        where t.list_id = l.id and t.status <> 'active')
       and not exists (select 1 from grocery.items i
                        join grocery.trips t on t.id = i.trip_id
                        where t.list_id = l.id);
  end if;

  return v_list;
end;
$fn$;

revoke execute on function grocery.lookup_list_by_code(text), grocery.join_by_code(text) from public, anon;
grant execute on function grocery.lookup_list_by_code(text), grocery.join_by_code(text) to authenticated;
