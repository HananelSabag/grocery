-- RLS verification — run against the live database, wrapped in a rollback.
--
-- There is no application server here, so these policies are the whole of the
-- app's authorization. That makes them worth testing directly rather than
-- inferring from the UI, which can only ever show that the happy path works.
--
-- Run with: supabase db execute --file supabase/tests/rls.sql
-- (or paste into the SQL editor — nothing is committed)
--
-- Last run: all four write paths blocked, read isolation clean, anon denied
-- at the grant level.

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','rls-a@test.local','x',now(),now(),now(),'{}','{"full_name":"User A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','rls-b@test.local','x',now(),now(),now(),'{}','{"full_name":"User B"}');

-- The signup trigger should have handed each of them a working list.
select 'bootstrap' as check,
       (select count(*) from grocery.lists        where owner_id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')) as lists,
       (select count(*) from grocery.list_members where user_id  in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')) as members,
       (select count(*) from grocery.profiles     where id       in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')) as profiles;
-- expected: 2, 2, 2

-- One item in each household.
insert into grocery.items (trip_id, name, added_by)
select t.id, 'A-SECRET-MILK', l.owner_id from grocery.trips t join grocery.lists l on l.id=t.list_id
where l.owner_id='aaaaaaaa-0000-0000-0000-000000000001' and t.status='active';

insert into grocery.items (trip_id, name, added_by)
select t.id, 'B-SECRET-BREAD', l.owner_id from grocery.trips t join grocery.lists l on l.id=t.list_id
where l.owner_id='bbbbbbbb-0000-0000-0000-000000000002' and t.status='active';

create temp table probe(step text, result text);
create temp table target as
select t.id as trip_id, l.id as list_id from grocery.trips t join grocery.lists l on l.id=t.list_id
where l.owner_id='bbbbbbbb-0000-0000-0000-000000000002' and t.status='active';
grant select on target to authenticated;
grant select, insert on probe to authenticated;

-- === Read isolation, acting exactly as PostgREST does ======================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select 'read_isolation' as check,
       (select count(*) from grocery.items where name='A-SECRET-MILK')  as sees_own,
       (select count(*) from grocery.items where name='B-SECRET-BREAD') as sees_other,
       (select count(*) from grocery.lists)                             as lists_visible;
-- expected: 1, 0, 1

-- === Write isolation =======================================================
do $probe$
declare v_trip bigint; v_list bigint; v_count int;
begin
  select trip_id, list_id into v_trip, v_list from target;

  begin
    insert into grocery.items (trip_id, name) values (v_trip, 'INTRUDER');
    insert into probe values ('insert_item_into_other_list', 'ALLOWED -- LEAK');
  exception when others then
    insert into probe values ('insert_item_into_other_list', 'blocked ' || sqlstate);
  end;

  begin
    insert into grocery.list_members (list_id, user_id, role)
    values (v_list, 'aaaaaaaa-0000-0000-0000-000000000001', 'member');
    insert into probe values ('join_other_list', 'ALLOWED -- LEAK');
  exception when others then
    insert into probe values ('join_other_list', 'blocked ' || sqlstate);
  end;

  -- An UPDATE that matches no row raises nothing, so count rows rather than
  -- trusting the absence of an error.
  update grocery.lists set name='PWNED' where id=v_list;
  get diagnostics v_count = ROW_COUNT;
  insert into probe values ('rename_other_list', v_count || ' rows changed');

  delete from grocery.items where trip_id = v_trip;
  get diagnostics v_count = ROW_COUNT;
  insert into probe values ('delete_other_items', v_count || ' rows deleted');
end
$probe$;

select * from probe order by step;
-- expected: blocked 42501, blocked 42501, 0 rows changed, 0 rows deleted

rollback;

-- === Anonymous ============================================================
-- Separately, because it fails at the grant rather than the policy: anon has
-- usage on the schema and no table privileges at all, so an unauthenticated
-- request is refused before RLS is consulted.
--
--   begin; set local role anon; select count(*) from grocery.lists; rollback;
--   → ERROR 42501: permission denied for table lists


-- ===========================================================================
-- Sharing — the full invitation round trip.
--
-- Run this against a real pending token (the share sheet mints one). It is the
-- path an invited person actually takes, and the one place where somebody who
-- is NOT yet a member has to be allowed through a door.
--
-- Last run: every line as expected.
-- ===========================================================================

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('cccccccc-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','invitee@test.local','x',now(),now(),now(),
        '{}','{"full_name":"Invitee"}');

create temp table probe(step text, result text);
grant select, insert on probe to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated","email":"invitee@test.local"}';

do $probe$
declare v_list bigint; v_count int; v_trip bigint;
  -- Replace with a live pending token and its list id.
  c_token constant uuid   := '00000000-0000-0000-0000-000000000000';
  c_list  constant bigint := 0;
begin
  select count(*) into v_count from grocery.lists where id = c_list;
  insert into probe values ('1. sees list before accepting', v_count || ' rows');   -- expect 0

  begin
    v_list := grocery.accept_invitation(c_token);
    insert into probe values ('2. accept_invitation', 'joined list ' || v_list);
  exception when others then
    insert into probe values ('2. accept_invitation', 'FAILED ' || sqlstate || ' ' || sqlerrm);
    return;
  end;

  select count(*) into v_count from grocery.lists where id = c_list;
  insert into probe values ('3. sees list after', v_count || ' rows');              -- expect 1

  select count(*) into v_count from grocery.items;
  insert into probe values ('4. sees items after', v_count || ' rows');             -- expect >0

  select id into v_trip from grocery.trips where list_id = c_list and status = 'active';
  insert into grocery.items (trip_id, name) values (v_trip, 'added by member');
  insert into probe values ('5. member can add an item', 'yes');                    -- expect yes

  -- A member is not an owner, and the difference has to be real rather than a
  -- matter of which buttons the client chose to render.
  update grocery.lists set name = 'MEMBER RENAMED' where id = c_list;
  get diagnostics v_count = ROW_COUNT;
  insert into probe values ('6. member renames list', v_count || ' rows changed');  -- expect 0

  delete from grocery.list_members where user_id <> 'cccccccc-0000-0000-0000-000000000003';
  get diagnostics v_count = ROW_COUNT;
  insert into probe values ('7. member evicts the owner', v_count || ' deleted');   -- expect 0

  -- A token is spent once. Otherwise a forwarded link keeps letting people in.
  begin
    perform grocery.accept_invitation(c_token);
    insert into probe values ('8. reuse the same token', 'ALLOWED -- LEAK');
  exception when others then
    insert into probe values ('8. reuse the same token', 'blocked');                -- expect blocked
  end;
end
$probe$;

select * from probe order by step;
rollback;
