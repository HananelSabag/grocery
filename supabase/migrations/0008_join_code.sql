-- Sharing becomes a standing code instead of a one-time link.
--
-- What was there: the owner generated an invitation row with a uuid token, put
-- the token in a URL, and the recipient's click marked it `accepted`. Which
-- means the link is spent the moment it works. Send it in a family chat, have
-- your wife open it, then open it yourself to check it went through — and the
-- second person to tap sees "invitation not found". It also expired after
-- fourteen days, silently, and nobody could answer "what is this link, how long
-- is it good for, how do I change it" — which is exactly what got asked.
--
-- A code has none of those questions. Every list has one, it is the same code
-- tomorrow, anyone holding it can join, and the owner can replace it — which is
-- the only revocation anybody actually wants. It reads aloud over the phone, it
-- fits in a message, and it survives being forwarded.
--
-- The alphabet leaves out I, O, 0 and 1, because these get read out loud and
-- typed by people who are not looking carefully. 32^6 is about a billion, which
-- is not a security boundary on its own — but joining requires a signed-in
-- account and the code is only ever resolved through the function below, which
-- returns a household's name and nothing else.

-- ── Code generation ─────────────────────────────────────────────────────────

create or replace function grocery.random_join_code()
returns text
language sql volatile
as $fn$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1),
    ''
  )
  from generate_series(1, 6);
$fn$;

-- SECURITY DEFINER on purpose: as the invoker this would only see the caller's
-- own lists, so "is this code taken" would be answered against a handful of
-- rows and hand out duplicates.
create or replace function grocery.fresh_join_code()
returns text
language plpgsql volatile security definer
set search_path = grocery, pg_temp
as $fn$
declare
  v_code text;
  v_tries int := 0;
begin
  loop
    v_code := grocery.random_join_code();
    exit when not exists (select 1 from grocery.lists where join_code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 50 then
      raise exception 'could not allocate a join code';
    end if;
  end loop;
  return v_code;
end;
$fn$;

-- ── The column ──────────────────────────────────────────────────────────────

alter table grocery.lists add column if not exists join_code text;

-- Volatile, so this is evaluated per row rather than once for the whole update.
update grocery.lists set join_code = grocery.fresh_join_code() where join_code is null;

create unique index if not exists lists_join_code_key on grocery.lists (join_code);
alter table grocery.lists alter column join_code set not null;
alter table grocery.lists alter column join_code set default grocery.fresh_join_code();

-- ── Resolving a code ────────────────────────────────────────────────────────

-- Somebody who has not joined yet cannot read the list row — that is the whole
-- point of the policies — so this is the one way a code turns into a name.
-- It returns what is needed to recognise the household before joining it, and
-- nothing else: no items, no members, no email addresses.
create or replace function grocery.lookup_list_by_code(p_code text)
returns table (list_id bigint, list_name text, owner_name text, member_count int)
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
         (select count(*)::int from grocery.list_members m where m.list_id = l.id)
  from grocery.lists l
  left join grocery.profiles p on p.id = l.owner_id
  where l.join_code = upper(btrim(p_code))
    and l.archived_at is null;
end;
$fn$;

-- Idempotent: joining a list you are already on returns its id rather than
-- failing, because the person tapping a link a second time has done nothing
-- wrong and should land on the list either way.
create or replace function grocery.join_by_code(p_code text)
returns bigint
language plpgsql volatile security definer
set search_path = grocery, pg_temp
as $fn$
declare
  v_uid  uuid := auth.uid();
  v_list bigint;
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

  return v_list;
end;
$fn$;

-- The only revocation there is: everyone still holding the old code is out.
create or replace function grocery.rotate_join_code(p_list_id bigint)
returns text
language plpgsql volatile security definer
set search_path = grocery, pg_temp
as $fn$
declare v_code text;
begin
  if not grocery.is_owner(p_list_id) then
    raise exception 'owner only' using errcode = '42501';
  end if;

  v_code := grocery.fresh_join_code();
  update grocery.lists set join_code = v_code where id = p_list_id;
  return v_code;
end;
$fn$;

-- ── Grants ──────────────────────────────────────────────────────────────────
--
-- Postgres grants EXECUTE to PUBLIC by default, which includes `anon` — the
-- role a browser holds before anybody signs in. Naming `authenticated` does not
-- take that away; the revoke does.

revoke execute on function
  grocery.random_join_code(),
  grocery.fresh_join_code(),
  grocery.lookup_list_by_code(text),
  grocery.join_by_code(text),
  grocery.rotate_join_code(bigint)
from public, anon;

-- fresh_join_code is granted because it is the column default: creating a list
-- evaluates it as the inserting user.
grant execute on function
  grocery.fresh_join_code(),
  grocery.lookup_list_by_code(text),
  grocery.join_by_code(text),
  grocery.rotate_join_code(bigint)
to authenticated;
