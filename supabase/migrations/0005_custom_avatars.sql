-- A profile picture of your own.
--
-- `avatar_url` already holds whatever Google supplied at sign-in. An uploaded
-- picture goes in its own column rather than overwriting it, so that clearing
-- yours returns you to the Google one instead of to a blank circle. Precedence
-- is custom → Google → a drawn letter, resolved in one place on the client
-- (`resolveAvatar` in src/lib/helpers.js) so no screen can disagree about
-- whose face is whose.

alter table grocery.profiles
  add column if not exists custom_avatar_url text;

-- No new row policy: `profiles_update_self` already limits UPDATE to
-- `id = auth.uid()`, and the new column inherits that.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'grocery-avatars',
  'grocery-avatars',
  true,                                   -- a face rendered at 56px on every row
  2097152,                                -- 2 MB; the client compresses to ~200 KB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Each person writes only inside a folder named for their own id, so one
-- account cannot overwrite another's picture even though the bucket is
-- world-readable. Same shape as grocery-items.
create policy grocery_avatars_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'grocery-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy grocery_avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'grocery-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Replacing a picture deletes the one before it, and this is the policy that
-- makes that delete possible at all. SpendWise's own profiles bucket grew 40
-- orphans over a year because its delete failed and said nothing; here the
-- client checks the result of every removal.
create policy grocery_avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'grocery-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy grocery_avatars_read on storage.objects
  for select to public
  using (bucket_id = 'grocery-avatars');

-- The admin table shows faces too, and was showing the Google one even for
-- someone who had uploaded their own.
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
  select p.id, p.email, p.display_name,
    coalesce(p.custom_avatar_url, p.avatar_url),
    p.created_at,
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
