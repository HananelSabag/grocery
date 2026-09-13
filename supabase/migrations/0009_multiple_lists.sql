-- More than one list per person, and every list worth telling apart has a name.
--
-- A household had exactly one list, made for them at sign-up, and a second only
-- ever arrived by somebody sharing theirs. Asked for: a list for a trip to
-- Eilat, made ahead of time and kept apart from the weekly shop. So a person can
-- now make lists of their own, and each one they make is named — two lists both
-- called "רשימת קניות" are no help on the one screen whose whole job is telling
-- them apart. The list made at sign-up stays nameable-or-not, as before.

-- Names are for people, so they get a sane length. NULL still means "unnamed",
-- which the client renders in the reader's language; an empty or blank string
-- would be neither, so it is refused.
alter table grocery.lists
  add constraint lists_name_length
  check (name is null or char_length(btrim(name)) between 1 and 40);

create or replace function grocery.create_list(p_name text)
returns bigint
language plpgsql volatile security definer
set search_path = grocery, pg_temp
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_name  text := left(nullif(btrim(p_name), ''), 40);
  v_owned int;
  v_list  bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- The client names a list the user left blank ("רשימה 2") before sending it,
  -- in the user's own language. Arriving here without one is a bug rather than
  -- a choice, so it fails loudly instead of making an unnamed duplicate.
  if v_name is null then
    raise exception 'a new list needs a name' using errcode = '22023';
  end if;

  -- Generous for a household, and a ceiling on a loop that forgot to stop.
  select count(*) into v_owned
  from grocery.lists
  where owner_id = v_uid and archived_at is null;

  if v_owned >= 20 then
    raise exception 'too many lists' using errcode = '54000';
  end if;

  insert into grocery.profiles (id) values (v_uid) on conflict (id) do nothing;
  insert into grocery.lists (owner_id, name) values (v_uid, v_name) returning id into v_list;
  insert into grocery.list_members (list_id, user_id, role) values (v_list, v_uid, 'owner');
  insert into grocery.trips (list_id, status) values (v_list, 'active');

  return v_list;
end;
$fn$;

-- "Stop sharing" used to set archived_at — which hid the list from its owner as
-- well, the opposite of what its own confirmation promised ("your list and
-- history stay"). This does what it says: everyone but the owner is removed,
-- any old invitation link is revoked, and the code changes so nobody can walk
-- straight back in with the one they already have.
create or replace function grocery.stop_sharing(p_list_id bigint)
returns text
language plpgsql volatile security definer
set search_path = grocery, pg_temp
as $fn$
declare v_code text;
begin
  if not grocery.is_owner(p_list_id) then
    raise exception 'owner only' using errcode = '42501';
  end if;

  delete from grocery.list_members
  where list_id = p_list_id and role <> 'owner';

  update grocery.invitations
     set status = 'revoked', responded_at = now()
   where list_id = p_list_id and status = 'pending';

  v_code := grocery.fresh_join_code();
  update grocery.lists set join_code = v_code where id = p_list_id;

  return v_code;
end;
$fn$;

-- EXECUTE is granted to PUBLIC by default, which includes `anon`; naming
-- `authenticated` does not take that away, the revoke does.
revoke execute on function grocery.create_list(text), grocery.stop_sharing(bigint) from public, anon;
grant execute on function grocery.create_list(text), grocery.stop_sharing(bigint) to authenticated;
