-- A list's name is a nickname, not a required field.
--
-- It defaulted to the Hebrew literal 'הבית', which is wrong twice. It hard-codes
-- one language into the data, so an English user's list is named in Hebrew and
-- stays that way. And it makes "named" indistinguishable from "never named", so
-- the switcher cannot tell whether to show the name or say whose list it is —
-- which is why three different people's lists all read the same thing.
--
-- NULL now means unnamed and the client renders the translated default. A value
-- means somebody deliberately chose it, and clearing the field stores NULL
-- rather than an empty string so that unnamed stays a real state.

alter table grocery.lists alter column name drop default;
alter table grocery.lists alter column name drop not null;

-- Every existing list still carried the old default, which nobody typed.
update grocery.lists set name = null where name in ('הבית', 'Household');

-- The bootstrap trigger should not invent one either.
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
